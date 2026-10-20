import crypto from 'node:crypto';
import { Pool } from 'pg';
import { DEFAULT_SETTINGS } from './default-settings.js';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_SIZE) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (err) => {
  console.error('Postgres pool idle client warning (auto-reconnecting):', err?.message || err);
});

const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const orderStatus = value => {
  const status = String(value || 'pending').toLowerCase().trim();
  const map = {
    'in crafting': 'processing',
    'cancel': 'cancelled',
    'canceled': 'cancelled',
    'out for delivery': 'out_for_delivery'
  };
  const resolved = map[status] || status;
  return ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(resolved) ? resolved : 'pending';
};
const paymentStatus = value => {
  const status = String(value || 'pending').toLowerCase().trim();
  return ['pending', 'paid', 'failed', 'refund_pending', 'refunded'].includes(status) ? status : 'pending';
};
const cleanUser = row => row && ({
  id: row.id, name: row.name, email: row.email, phone: row.phone || '', address: row.address || '',
  city: row.city || '', pincode: row.pincode || '', createdAt: row.created_at, updatedAt: row.updated_at
});
const cleanOrder = value => {
  const order = parse(value);
  if (!order) return null;
  const result = {
    ...order,
    status: orderStatus(order.status),
    paymentStatus: paymentStatus(order.paymentStatus),
    customer: {
      ...order.customer,
      name: order.customer?.name || order.customerName || 'Customer',
      email: order.customer?.email || order.customerEmail || '',
      phone: order.customer?.phone || order.customerPhone || '',
      address: order.customer?.address || order.customerAddress || ''
    },
    discountAmount: Number(order.discountAmount ?? order.discount ?? 0)
  };
  delete result.customerName; delete result.customerEmail; delete result.customerPhone; delete result.customerAddress; delete result.discount;
  return result;
};

async function settingsWith(client = pool) {
  const { rows } = await client.query('SELECT data FROM settings WHERE id = 1');
  return { ...DEFAULT_SETTINGS, ...(rows[0] ? parse(rows[0].data) : {}) };
}
async function saveProduct(client, product) {
  await client.query(`UPDATE products SET title=$2, category=$3, price=$4, original_price=$5, stock=$6,
    is_featured=$7, is_bestseller=$8, rating=$9, reviews_count=$10, data=$11::jsonb WHERE id=$1`, [
    product.id, product.title, product.category, product.price, product.originalPrice ?? null, product.stock ?? 0,
    Boolean(product.isFeatured), Boolean(product.isBestSeller), product.rating ?? 5, product.reviewsCount ?? 0, JSON.stringify(product)
  ]);
}
async function insertOrder(client, order) {
  await client.query(`INSERT INTO orders (id, customer_name, customer_email, customer_phone, status, total, payment_method,
    payment_status, tracking_number, data, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`, [
    order.id, order.customer.name, order.customer.email, order.customer.phone || '', order.status, order.total,
    order.paymentMethod, order.paymentStatus, order.trackingNumber || null, JSON.stringify(order), order.createdAt
  ]);
}

export const postgresDb = {
  async initialize() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (id smallint PRIMARY KEY CHECK(id=1), data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS products (
        id text PRIMARY KEY, title text NOT NULL CHECK(length(trim(title))>0), category text NOT NULL,
        price numeric(12,2) NOT NULL CHECK(price>=0), original_price numeric(12,2) CHECK(original_price IS NULL OR original_price>=0),
        stock integer NOT NULL DEFAULT 0 CHECK(stock>=0), is_featured boolean NOT NULL DEFAULT false, is_bestseller boolean NOT NULL DEFAULT false,
        rating numeric(2,1) NOT NULL DEFAULT 5 CHECK(rating BETWEEN 0 AND 5), reviews_count integer NOT NULL DEFAULT 0 CHECK(reviews_count>=0),
        data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS offers (
        id text PRIMARY KEY, code text UNIQUE NOT NULL CHECK(length(trim(code))>0), is_active boolean NOT NULL DEFAULT true,
        discount_type text NOT NULL CHECK(discount_type IN ('percentage','fixed')),
        discount_value numeric(12,2) NOT NULL CHECK(discount_value>=0 AND (discount_type<>'percentage' OR discount_value<=100)), data jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (
        id text PRIMARY KEY, customer_name text NOT NULL, customer_email text NOT NULL, customer_phone text,
        status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled')),
        total numeric(12,2) NOT NULL CHECK(total>=0), payment_method text NOT NULL CHECK(payment_method IN ('cod','upi','razorpay','whatsapp')),
        payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','refund_pending','refunded')), tracking_number text,
        data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS orders_email_idx ON orders(lower(customer_email));
      CREATE TABLE IF NOT EXISTS reviews (
        id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE, customer_name text NOT NULL,
        customer_email text, rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), comment text NOT NULL,
        verified_purchase boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, name text NOT NULL CHECK(length(trim(name))>0), email text NOT NULL UNIQUE
          CHECK(email=lower(trim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
        password_hash text CHECK(password_hash IS NULL OR length(trim(password_hash))>0), phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
        city text NOT NULL DEFAULT '', pincode text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    `);
    // Existing accounts keep their profile and order history but authenticate through Supabase Auth.
    await pool.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_hash_check');
    await pool.query('ALTER TABLE users ADD CONSTRAINT users_password_hash_check CHECK(password_hash IS NULL OR length(trim(password_hash))>0)');
    // Ensure order status and payment status constraints accommodate full delivery lifecycle and cancellations
    await pool.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
      ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'));
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
      ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK(payment_status IN ('pending','paid','failed','refund_pending','refunded'));
    `);
    await pool.query('INSERT INTO settings(id,data) VALUES (1,$1::jsonb) ON CONFLICT(id) DO NOTHING', [JSON.stringify(DEFAULT_SETTINGS)]);
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users(lower(email))');
  },
  getSettings: () => settingsWith(),
  async updateSettings(changes) {
    const current = await settingsWith();
    const updated = { ...current, ...changes };
    await pool.query('UPDATE settings SET data=$1::jsonb, updated_at=now() WHERE id=1', [JSON.stringify(updated)]);
    return updated;
  },
  async getProducts() { const { rows } = await pool.query('SELECT data FROM products ORDER BY created_at DESC'); return rows.map(row => parse(row.data)); },
  async getProductById(id) { const { rows } = await pool.query('SELECT data FROM products WHERE id=$1', [id]); return rows[0] ? parse(rows[0].data) : null; },
  async addProduct(input) {
    const product = { ...input, id: input.id || `prod_${crypto.randomUUID()}`, rating: input.rating || 5, reviewsCount: input.reviewsCount || 0, createdAt: input.createdAt || new Date().toISOString() };
    await pool.query(`INSERT INTO products(id,title,category,price,original_price,stock,is_featured,is_bestseller,rating,reviews_count,data,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`, [product.id, product.title, product.category, product.price, product.originalPrice ?? null, product.stock ?? 0, Boolean(product.isFeatured), Boolean(product.isBestSeller), product.rating, product.reviewsCount, JSON.stringify(product), product.createdAt]);
    return product;
  },
  async updateProduct(id, changes) { const current = await postgresDb.getProductById(id); if (!current) return null; const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)); const updated = { ...current, ...defined }; await saveProduct(pool, updated); return updated; },
  async deleteProduct(id) { await pool.query('DELETE FROM products WHERE id=$1', [id]); return true; },
  async getOffers() { const { rows } = await pool.query('SELECT data FROM offers ORDER BY id DESC'); return rows.map(row => parse(row.data)); },
  async addOffer(input) {
    const offer = { ...input, id: `offer_${crypto.randomUUID()}`, usedCount: 0, isActive: input.isActive !== false, code: String(input.code || '').toUpperCase() };
    await pool.query('INSERT INTO offers(id,code,is_active,discount_type,discount_value,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [offer.id, offer.code, offer.isActive, offer.discountType, offer.discountValue, JSON.stringify(offer)]); return offer;
  },
  async updateOffer(id, changes) { const { rows } = await pool.query('SELECT data FROM offers WHERE id=$1', [id]); if (!rows[0]) return null; const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)); const offer = { ...parse(rows[0].data), ...defined }; offer.code = String(offer.code).toUpperCase(); await pool.query('UPDATE offers SET code=$2,is_active=$3,discount_type=$4,discount_value=$5,data=$6::jsonb WHERE id=$1', [id, offer.code, offer.isActive, offer.discountType, offer.discountValue, JSON.stringify(offer)]); return offer; },
  async deleteOffer(id) { await pool.query('DELETE FROM offers WHERE id=$1', [id]); return true; },
  async toggleOfferStatus(id) { const { rows } = await pool.query('SELECT data,is_active FROM offers WHERE id=$1', [id]); if (!rows[0]) return null; const offer = { ...parse(rows[0].data), isActive: !rows[0].is_active }; await pool.query('UPDATE offers SET is_active=$2,data=$3::jsonb WHERE id=$1', [id, offer.isActive, JSON.stringify(offer)]); return offer; },
  async getOrders() { const { rows } = await pool.query('SELECT data FROM orders ORDER BY created_at DESC'); return rows.map(row => cleanOrder(row.data)); },
  async getOrderById(id) { const { rows } = await pool.query('SELECT data FROM orders WHERE id=$1', [id]); return rows[0] ? cleanOrder(rows[0].data) : null; },
  async getOrderByRazorpayOrderId(id) { const { rows } = await pool.query("SELECT data FROM orders WHERE data->>'razorpayOrderId'=$1", [id]); return rows[0] ? cleanOrder(rows[0].data) : null; },
  async getOrdersByQuery(q) { const { rows } = await pool.query('SELECT data FROM orders WHERE lower(id)=lower($1)', [q.trim()]); return rows.map(row => cleanOrder(row.data)); },
  async createOrder(orderData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const customerInput = orderData.customer || {};
      const customer = { name: String(customerInput.name || '').trim(), email: String(customerInput.email || '').trim().toLowerCase(), phone: String(customerInput.phone || '').trim(), address: String(customerInput.address || '').trim(), city: String(customerInput.city || '').trim(), pincode: String(customerInput.pincode || '').trim() };
      if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) || !customer.address) throw new Error('INVALID_CUSTOMER');
      const paymentMethod = orderData.paymentMethod || 'cod';
      if (!['cod','upi','razorpay','whatsapp'].includes(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD');
      if (!Array.isArray(orderData.items) || !orderData.items.length) throw new Error('EMPTY_ORDER');
      const quantities = new Map();
      for (const item of orderData.items) { const qty = Number(item.quantity); if (!item.productId || !Number.isSafeInteger(qty) || qty < 1) throw new Error('INVALID_QUANTITY'); quantities.set(item.productId, (quantities.get(item.productId) || 0) + qty); }
      const products = []; let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        const { rows } = await client.query('SELECT data FROM products WHERE id=$1 FOR UPDATE', [productId]);
        if (!rows[0]) throw new Error('PRODUCT_NOT_FOUND'); const product = parse(rows[0].data);
        if (!Number.isSafeInteger(product.stock) || product.stock < quantity) throw new Error('INSUFFICIENT_STOCK');
        const item = { productId, productTitle: product.title, price: Number(product.price), quantity, image: product.image, color: orderData.items.find(entry => entry.productId === productId)?.color };
        subtotal += item.price * quantity; products.push({ product, item, remainingStock: product.stock - quantity });
      }
      subtotal = Number(subtotal.toFixed(2)); let discountAmount = 0; let promoCodeApplied;
      if (orderData.promoCodeApplied) {
        const { rows } = await client.query('SELECT data FROM offers WHERE upper(code)=upper($1) AND is_active=true', [String(orderData.promoCodeApplied).trim()]);
        const offer = rows[0] ? parse(rows[0].data) : null; const now = Date.now(); const start = offer?.startDate ? Date.parse(offer.startDate) : 0; const end = offer?.endDate ? Date.parse(offer.endDate) : Infinity;
        if (!offer || (start && now < start) || (end && now > end) || subtotal < Number(offer.minOrderValue || 0)) throw new Error('INVALID_PROMO');
        discountAmount = Number((offer.discountType === 'percentage' ? subtotal * Number(offer.discountValue) / 100 : Math.min(subtotal, Number(offer.discountValue))).toFixed(2)); promoCodeApplied = offer.code;
      }
      const settings = await settingsWith(client); const threshold = Math.max(0, Number(settings.freeShippingThreshold ?? 299)); const shippingAmount = subtotal === 0 || subtotal >= threshold ? 0 : Math.max(0, Number(settings.shippingFee ?? 40)); const total = Number(Math.max(0, subtotal - discountAmount + shippingAmount).toFixed(2));
      const id = `ORD-${crypto.randomUUID()}`; const createdAt = new Date().toISOString();
      const order = { id, customer, items: products.map(entry => entry.item), subtotal, discountAmount, shippingAmount, promoCodeApplied, total, status: 'pending', paymentMethod, paymentStatus: 'pending', trackingNumber: '', timeline: [{ status: 'Order Placed', timestamp: createdAt, note: `Order received via ${paymentMethod.toUpperCase()}.` }], createdAt };
      await insertOrder(client, order); for (const entry of products) await saveProduct(client, { ...entry.product, stock: entry.remainingStock });
      await client.query('COMMIT'); return order;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
  async linkRazorpayOrder(id, razorpayOrderId) { const current = await postgresDb.getOrderById(id); if (!current || current.paymentMethod !== 'razorpay' || current.paymentStatus !== 'pending' || current.razorpayOrderId) throw new Error('INVALID_PAYMENT_ORDER'); const updated = { ...current, razorpayOrderId }; await pool.query('UPDATE orders SET data=$2::jsonb WHERE id=$1', [id, JSON.stringify(updated)]); return updated; },
  async cancelOrder(id, cancelReason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); const { rows } = await client.query('SELECT data FROM orders WHERE id=$1 FOR UPDATE', [id]); if (!rows[0]) { await client.query('COMMIT'); return null; }
      const current = cleanOrder(rows[0].data); if (current.status === 'cancelled') { await client.query('COMMIT'); return current; }
      for (const item of current.items || []) { const { rows: productRows } = await client.query('SELECT data FROM products WHERE id=$1 FOR UPDATE', [item.productId]); if (!productRows[0]) continue; const product = parse(productRows[0].data); await saveProduct(client, { ...product, stock: product.stock + item.quantity }); }
      const reasonText = cancelReason ? `Reason: ${cancelReason}` : 'Cancelled by studio admin';
      const updated = { ...current, status: 'cancelled', cancelReason: cancelReason || 'Cancelled by studio admin', cancelledAt: new Date().toISOString(), paymentStatus: current.paymentStatus === 'paid' ? 'refund_pending' : (current.paymentStatus === 'pending' ? 'failed' : current.paymentStatus), timeline: [...(current.timeline || []), { status: 'ORDER CANCELLED', timestamp: new Date().toISOString(), note: `${reasonText}. Reserved items returned to studio stock.` }] };
      await client.query('UPDATE orders SET status=$2,payment_status=$3,data=$4::jsonb WHERE id=$1', [id, updated.status, updated.paymentStatus, JSON.stringify(updated)]); await client.query('COMMIT'); return updated;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
  async updateOrderStatus(id, status, extras = {}) {
    if (status === 'cancelled') return postgresDb.cancelOrder(id, extras.cancelReason);
    const current = await postgresDb.getOrderById(id);
    if (!current) return null;
    let defaultNote = `Status updated to ${status.toUpperCase().replace(/_/g, ' ')}`;
    if (status === 'confirmed') defaultNote = 'Order confirmed by studio. Reserved items queued for crafting & packaging.';
    else if (status === 'processing') defaultNote = 'Artisan is handcrafting loops & floral details at the workshop bench.';
    else if (status === 'shipped') { const courier = extras.courierPartner || current.courierPartner || 'Courier'; const awb = extras.trackingNumber || current.trackingNumber; defaultNote = awb ? `Parcel dispatched via ${courier}. AWB: ${awb}` : `Parcel handed over to ${courier}.`; }
    else if (status === 'out_for_delivery') defaultNote = extras.deliveryNotes || 'Delivery partner has picked up parcel and is out for doorstep delivery.';
    else if (status === 'delivered') defaultNote = 'Parcel successfully delivered to recipient. Thank you for supporting handmade craftsmanship! 🌸';
    let nextPaymentStatus = extras.paymentStatus || current.paymentStatus;
    if (status === 'delivered' && current.paymentMethod === 'cod' && nextPaymentStatus === 'pending') nextPaymentStatus = 'paid';
    const updated = { ...current, ...extras, status, paymentStatus: nextPaymentStatus, timeline: [...(current.timeline || []), { status: status === 'out_for_delivery' ? 'OUT FOR DELIVERY' : (status === 'confirmed' ? 'ORDER CONFIRMED' : `STATUS: ${status.toUpperCase()}`), timestamp: new Date().toISOString(), note: defaultNote }] };
    if (status === 'shipped' && !updated.shippedAt) updated.shippedAt = new Date().toISOString();
    if (status === 'delivered' && !updated.deliveredAt) updated.deliveredAt = new Date().toISOString();
    await pool.query('UPDATE orders SET status=$2,payment_status=$3,tracking_number=$4,data=$5::jsonb WHERE id=$1', [id, status, updated.paymentStatus || current.paymentStatus, updated.trackingNumber || null, JSON.stringify(updated)]);
    return updated;
  },
  async deleteOrder(id) { await pool.query('DELETE FROM orders WHERE id=$1', [id]); return true; },
  async getReviews(productId) { const { rows } = productId ? await pool.query('SELECT * FROM reviews WHERE product_id=$1 ORDER BY created_at DESC', [productId]) : await pool.query('SELECT * FROM reviews ORDER BY created_at DESC'); return rows.map(r => ({ id:r.id, productId:r.product_id, customerName:r.customer_name, customerEmail:r.customer_email, rating:r.rating, comment:r.comment, verifiedPurchase:r.verified_purchase, createdAt:r.created_at })); },
  async addReview(input) { const id = `rev_${crypto.randomUUID()}`; const review = { id, productId:input.productId, customerName:input.customerName || 'Handcraft Lover', customerEmail:input.customerEmail || '', rating:Math.min(5,Math.max(1,Number(input.rating)||5)), comment:input.comment || '', verifiedPurchase:input.verifiedPurchase !== false, createdAt:new Date().toISOString() }; const client = await pool.connect(); try { await client.query('BEGIN'); await client.query('INSERT INTO reviews(id,product_id,customer_name,customer_email,rating,comment,verified_purchase,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [review.id,review.productId,review.customerName,review.customerEmail,review.rating,review.comment,review.verifiedPurchase,review.createdAt]); const { rows } = await client.query('SELECT avg(rating)::numeric(2,1) AS rating,count(*)::int AS count FROM reviews WHERE product_id=$1', [review.productId]); const product = await postgresDb.getProductById(review.productId); if (product) await saveProduct(client,{...product,rating:Number(rows[0].rating),reviewsCount:rows[0].count}); await client.query('COMMIT'); return review; } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
  async deleteReview(id) { const client = await pool.connect(); try { await client.query('BEGIN'); const { rows } = await client.query('DELETE FROM reviews WHERE id=$1 RETURNING product_id', [id]); if (rows[0]) { const product = await postgresDb.getProductById(rows[0].product_id); if (product) { const agg = await client.query('SELECT avg(rating)::numeric(2,1) AS rating,count(*)::int AS count FROM reviews WHERE product_id=$1', [product.id]); await saveProduct(client,{...product,rating:Number(agg.rows[0].rating || 5),reviewsCount:agg.rows[0].count}); } } await client.query('COMMIT'); return true; } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
  hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`; },
  verifyPassword(password, stored) { try { const [salt,hash] = stored.split(':'); const test=crypto.scryptSync(password,salt,64); return crypto.timingSafeEqual(Buffer.from(hash,'hex'),test); } catch { return false; } },
  async getUserByEmail(email) { const { rows } = await pool.query('SELECT * FROM users WHERE lower(email)=lower($1)',[email]); return rows[0] ? {...cleanUser(rows[0]),passwordHash:rows[0].password_hash} : null; },
  async getUserById(id) { const { rows } = await pool.query('SELECT * FROM users WHERE id=$1',[id]); return cleanUser(rows[0]); },
  async syncAuthUser({ id, email, name = '', phone = '' }) {
    if (!id || !email) throw new Error('AUTH_PROFILE_MISSING');
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await postgresDb.getUserByEmail(normalizedEmail);
    if (existing) {
      const { rows } = await pool.query(
        'UPDATE users SET name=COALESCE(NULLIF($2,\'\'),name),phone=COALESCE(NULLIF($3,\'\'),phone),updated_at=now() WHERE id=$1 RETURNING *',
        [existing.id, name.trim(), phone.trim()]
      );
      return cleanUser(rows[0]);
    }
    const { rows } = await pool.query(`INSERT INTO users(id,name,email,password_hash,phone) VALUES($1,$2,$3,NULL,$4)
      ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,name=COALESCE(NULLIF(EXCLUDED.name,''),users.name),phone=COALESCE(NULLIF(EXCLUDED.phone,''),users.phone),updated_at=now() RETURNING *`,
      [id, name.trim() || normalizedEmail.split('@')[0], normalizedEmail, phone.trim()]);
    return cleanUser(rows[0]);
  },
  async createUser({name,email,password,phone='',address='',city='',pincode=''}) { if (await postgresDb.getUserByEmail(email)) throw new Error('EMAIL_EXISTS'); const id=`usr_${crypto.randomUUID()}`; const hash=postgresDb.hashPassword(password); try { const { rows }=await pool.query('INSERT INTO users(id,name,email,password_hash,phone,address,city,pincode) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,name.trim(),email.trim().toLowerCase(),hash,phone,address,city,pincode]); return cleanUser(rows[0]); } catch(error) { if (error.code === '23505') throw new Error('EMAIL_EXISTS'); throw error; } },
  async updateUser(id, changes) { const current=await postgresDb.getUserById(id); if (!current) return null; const defined=Object.fromEntries(Object.entries(changes).filter(([, value])=>value!==undefined)); const updated={...current,...defined,updatedAt:new Date().toISOString()}; if (updated.name !== undefined) updated.name=updated.name.trim(); const hash=changes.password ? postgresDb.hashPassword(changes.password) : null; const { rows }=await pool.query('UPDATE users SET name=$2,phone=$3,address=$4,city=$5,pincode=$6,password_hash=COALESCE($7,password_hash),updated_at=now() WHERE id=$1 RETURNING *',[id,updated.name,updated.phone,updated.address,updated.city,updated.pincode,hash]); return cleanUser(rows[0]); },
  async getUserOrders(userId) { const user=await postgresDb.getUserById(userId); if (!user) return []; const { rows }=await pool.query('SELECT data FROM orders WHERE lower(customer_email)=lower($1) ORDER BY created_at DESC',[user.email]); return rows.map(row=>cleanOrder(row.data)); }
};

await postgresDb.initialize();
