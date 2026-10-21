import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DEFAULT_SETTINGS } from './default-settings.js';
import { isProductCodEligible } from './cod-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.db');
const JSON_BACKUP_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database instance
const sqlite = new DatabaseSync(DB_FILE);

// Enable WAL (Write-Ahead Logging) for lightning fast concurrency & durability
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA synchronous = NORMAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    category TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    original_price REAL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_featured INTEGER DEFAULT 0,
    is_bestseller INTEGER DEFAULT 0,
    rating REAL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
    reviews_count INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value REAL NOT NULL CHECK (discount_value >= 0 AND (discount_type != 'percentage' OR discount_value <= 100)),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
    total REAL NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'upi', 'razorpay', 'payu', 'whatsapp')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refund_pending', 'refunded')),
    tracking_number TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    verified_purchase INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    email TEXT UNIQUE NOT NULL CHECK (email = trim(email) AND email GLOB '*?@?*.*?'),
    password_hash TEXT NOT NULL CHECK (length(trim(password_hash)) > 0),
    phone TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migrate pre-existing SQLite orders table if it was created with restrictive check constraints
try {
  const ordersTableInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get();
  if (ordersTableInfo?.sql && (!ordersTableInfo.sql.includes('confirmed') || !ordersTableInfo.sql.includes('payu'))) {
    sqlite.exec(`
      CREATE TABLE orders_v2 (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
        total REAL NOT NULL CHECK (total >= 0),
        payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'upi', 'razorpay', 'payu', 'whatsapp')),
        payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refund_pending', 'refunded')),
        tracking_number TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO orders_v2 SELECT * FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_v2 RENAME TO orders;
    `);
  }
} catch (err) {
  console.warn('SQLite orders table migration note:', err.message);
}

// Add offer discount columns to databases created by earlier versions.
const offerColumns = sqlite.prepare('PRAGMA table_info(offers)').all().map(column => column.name);
if (!offerColumns.includes('discount_type')) {
  sqlite.exec("ALTER TABLE offers ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percentage', 'fixed'))");
}
if (!offerColumns.includes('discount_value')) {
  sqlite.exec('ALTER TABLE offers ADD COLUMN discount_value REAL NOT NULL DEFAULT 0 CHECK (discount_value >= 0 AND (discount_type != \'percentage\' OR discount_value <= 100))');
}

// Populate and normalize indexed values for legacy rows before enforcement.
for (const row of sqlite.prepare('SELECT id, data FROM offers').all()) {
  const offer = JSON.parse(row.data);
  const type = offer.discountType === 'percentage' ? 'percentage' : 'fixed';
  const value = Number.isFinite(Number(offer.discountValue)) ? Math.max(0, Math.min(type === 'percentage' ? 100 : Number.MAX_VALUE, Number(offer.discountValue))) : 0;
  sqlite.prepare('UPDATE offers SET discount_type = ?, discount_value = ? WHERE id = ?').run(type, value, row.id);
}

// Triggers bring equivalent guarantees to pre-existing SQLite tables, which SQLite cannot alter in place.
// Normalize old casing before order triggers are installed.
sqlite.exec("UPDATE orders SET status = CASE lower(status) WHEN 'pending' THEN 'pending' WHEN 'in crafting' THEN 'processing' WHEN 'processing' THEN 'processing' WHEN 'shipped' THEN 'shipped' WHEN 'out for delivery' THEN 'out_for_delivery' WHEN 'out_for_delivery' THEN 'out_for_delivery' WHEN 'confirmed' THEN 'confirmed' WHEN 'delivered' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' ELSE 'pending' END");
sqlite.exec('DROP TRIGGER IF EXISTS orders_validate_insert; DROP TRIGGER IF EXISTS orders_validate_update;');
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS products_validate_insert BEFORE INSERT ON products WHEN
    length(trim(NEW.title)) = 0 OR NEW.price < 0 OR NEW.stock < 0 OR NEW.rating NOT BETWEEN 0 AND 5
    BEGIN SELECT RAISE(ABORT, 'invalid product'); END;
  CREATE TRIGGER IF NOT EXISTS products_validate_update BEFORE UPDATE ON products WHEN
    length(trim(NEW.title)) = 0 OR NEW.price < 0 OR NEW.stock < 0 OR NEW.rating NOT BETWEEN 0 AND 5
    BEGIN SELECT RAISE(ABORT, 'invalid product'); END;
  CREATE TRIGGER IF NOT EXISTS orders_validate_insert BEFORE INSERT ON orders WHEN
    NEW.status NOT IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled') OR NEW.total < 0 OR
    NEW.payment_method NOT IN ('cod','upi','razorpay','payu','whatsapp') OR NEW.payment_status NOT IN ('pending','paid','failed','refund_pending','refunded')
    BEGIN SELECT RAISE(ABORT, 'invalid order'); END;
  CREATE TRIGGER IF NOT EXISTS orders_validate_update BEFORE UPDATE ON orders WHEN
    NEW.status NOT IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled') OR NEW.total < 0 OR
    NEW.payment_method NOT IN ('cod','upi','razorpay','payu','whatsapp') OR NEW.payment_status NOT IN ('pending','paid','failed','refund_pending','refunded')
    BEGIN SELECT RAISE(ABORT, 'invalid order'); END;
  CREATE TRIGGER IF NOT EXISTS reviews_validate_insert BEFORE INSERT ON reviews WHEN
    NEW.rating NOT BETWEEN 1 AND 5 OR NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id)
    BEGIN SELECT RAISE(ABORT, 'invalid review'); END;
  CREATE TRIGGER IF NOT EXISTS reviews_validate_update BEFORE UPDATE ON reviews WHEN
    NEW.rating NOT BETWEEN 1 AND 5 OR NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id)
    BEGIN SELECT RAISE(ABORT, 'invalid review'); END;
  CREATE TRIGGER IF NOT EXISTS products_delete_reviews AFTER DELETE ON products
    BEGIN DELETE FROM reviews WHERE product_id = OLD.id; END;
  CREATE TRIGGER IF NOT EXISTS users_validate_insert BEFORE INSERT ON users WHEN
    length(trim(NEW.name)) = 0 OR length(trim(NEW.password_hash)) = 0 OR NEW.email NOT GLOB '*?@?*.*?'
    BEGIN SELECT RAISE(ABORT, 'invalid user'); END;
  CREATE TRIGGER IF NOT EXISTS users_validate_update BEFORE UPDATE ON users WHEN
    length(trim(NEW.name)) = 0 OR length(trim(NEW.password_hash)) = 0 OR NEW.email NOT GLOB '*?@?*.*?'
    BEGIN SELECT RAISE(ABORT, 'invalid user'); END;
  CREATE TRIGGER IF NOT EXISTS offers_validate_insert BEFORE INSERT ON offers WHEN
    NEW.discount_type NOT IN ('percentage','fixed') OR NEW.discount_value < 0 OR (NEW.discount_type = 'percentage' AND NEW.discount_value > 100)
    BEGIN SELECT RAISE(ABORT, 'invalid offer'); END;
  CREATE TRIGGER IF NOT EXISTS offers_validate_update BEFORE UPDATE ON offers WHEN
    NEW.discount_type NOT IN ('percentage','fixed') OR NEW.discount_value < 0 OR (NEW.discount_type = 'percentage' AND NEW.discount_value > 100)
    BEGIN SELECT RAISE(ABORT, 'invalid offer'); END;
`);

// Backfill any empty customer_phone/customer_name in orders from data JSON
try {
  const existingOrders = sqlite.prepare("SELECT id, data, customer_name, customer_phone FROM orders").all();
  for (const o of existingOrders) {
    if (!o.customer_phone || !o.customer_name || o.customer_name === 'Customer') {
      try {
        const parsed = JSON.parse(o.data);
        const phone = parsed.customer?.phone || parsed.customerPhone || '';
        const name = parsed.customer?.name || parsed.customerName || '';
        if (phone || (name && name !== 'Customer')) {
          sqlite.prepare("UPDATE orders SET customer_name = COALESCE(NULLIF(?, ''), customer_name), customer_phone = COALESCE(NULLIF(?, ''), customer_phone) WHERE id = ?").run(name || 'Customer', phone || '', o.id);
        }
      } catch {}
    }
  }
} catch (e) {
  console.warn("Backfill orders check:", e.message);
}

// Default store settings


// Seed / Migrate from existing store.json if database is freshly created
function seedOrMigrate() {
  const row = sqlite.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (row.count === 0) {
    let initialSettings = DEFAULT_SETTINGS;
    let initialProducts = [];
    let initialOffers = [];
    let initialOrders = [];

    if (fs.existsSync(JSON_BACKUP_FILE)) {
      try {
        const jsonRaw = fs.readFileSync(JSON_BACKUP_FILE, 'utf8');
        const parsed = JSON.parse(jsonRaw);
        if (parsed.settings) initialSettings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        if (Array.isArray(parsed.products)) initialProducts = parsed.products;
        if (Array.isArray(parsed.offers)) initialOffers = parsed.offers;
        if (Array.isArray(parsed.orders)) initialOrders = parsed.orders;
        console.log(`[SQLite] Migrated ${initialProducts.length} products and settings from store.json`);
      } catch (err) {
        console.warn('[SQLite] Error reading legacy store.json for migration', err);
      }
    }

    // Insert settings
    sqlite.prepare('INSERT INTO settings (id, data, updated_at) VALUES (1, ?, ?)').run(
      JSON.stringify(initialSettings),
      new Date().toISOString()
    );

    // Insert products
    const insertProd = sqlite.prepare(`
      INSERT INTO products (id, title, category, price, original_price, stock, is_featured, is_bestseller, rating, reviews_count, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of initialProducts) {
      insertProd.run(
        p.id,
        p.title || 'Untitled',
        p.category || 'Accessories',
        p.price || 0,
        p.originalPrice || null,
        p.stock || 0,
        p.isFeatured ? 1 : 0,
        p.isBestSeller ? 1 : 0,
        p.rating || 5.0,
        p.reviewsCount || 0,
        JSON.stringify(p),
        p.createdAt || new Date().toISOString()
      );
    }

    // Insert offers
    const insertOffer = sqlite.prepare(`
      INSERT INTO offers (id, code, is_active, discount_type, discount_value, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const o of initialOffers) {
      insertOffer.run(o.id, o.code, o.isActive ? 1 : 0, o.discountType || 'fixed', Number(o.discountValue) || 0, JSON.stringify(o));
    }

    // Insert orders
    const insertOrder = sqlite.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone, status, total, payment_method, payment_status, tracking_number, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ord of initialOrders) {
      const canonicalStatus = ({ 'in crafting': 'processing', 'pending': 'pending', 'processing': 'processing', 'shipped': 'shipped', 'delivered': 'delivered' })[String(ord.status || 'pending').toLowerCase()] || 'pending';
      insertOrder.run(
        ord.id,
        ord.customer?.name || 'Customer',
        ord.customer?.email || '',
        ord.customer?.phone || '',
        canonicalStatus,
        ord.total || 0,
        ord.paymentMethod || 'cod',
        ord.paymentStatus || 'pending',
        ord.trackingNumber || null,
        JSON.stringify(ord),
        ord.createdAt || new Date().toISOString()
      );
    }
  }
}

seedOrMigrate();

// Backup to JSON file periodically / on mutations for safety
function syncBackup() {
  try {
    const settings = db.getSettings();
    const products = db.getProducts();
    const offers = db.getOffers();
    const orders = db.getOrders();
    fs.writeFileSync(JSON_BACKUP_FILE, JSON.stringify({ settings, products, offers, orders }, null, 2), 'utf8');
  } catch (e) {
    console.warn('[SQLite] Backup write warning:', e);
  }
}

function normalizeOrder(order) {
  const status = String(order.status || 'pending').toLowerCase();
  const normalized = {
    ...order,
    status: status === 'in crafting' ? 'processing' : (['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status) ? status : 'pending'),
    customer: {
      ...order.customer,
      name: order.customer?.name || order.customerName || 'Customer',
      email: order.customer?.email || order.customerEmail || '',
      phone: order.customer?.phone || order.customerPhone || '',
      address: order.customer?.address || order.customerAddress || ''
    },
    discountAmount: Number(order.discountAmount ?? order.discount ?? 0)
  };
  delete normalized.customerName;
  delete normalized.customerEmail;
  delete normalized.customerPhone;
  delete normalized.customerAddress;
  delete normalized.discount;
  return normalized;
}

const sqliteDb = {
  // SETTINGS
  getSettings: () => {
    const row = sqlite.prepare('SELECT data FROM settings WHERE id = 1').get();
    if (!row) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  updateSettings: (newSettings) => {
    const current = db.getSettings();
    const updated = { ...current, ...newSettings };
    sqlite.prepare('UPDATE settings SET data = ?, updated_at = ? WHERE id = 1').run(
      JSON.stringify(updated),
      new Date().toISOString()
    );
    syncBackup();
    return updated;
  },

  // PRODUCTS
  getProducts: () => {
    const rows = sqlite.prepare('SELECT data FROM products ORDER BY rowid DESC').all();
    return rows.map(r => JSON.parse(r.data));
  },
  getProductById: (id) => {
    const row = sqlite.prepare('SELECT data FROM products WHERE id = ?').get(id);
    return row ? JSON.parse(row.data) : null;
  },
  addProduct: (productData) => {
    const newProduct = {
      ...productData,
      id: productData.id || `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      rating: productData.rating || 5.0,
      reviewsCount: productData.reviewsCount || 0,
      createdAt: productData.createdAt || new Date().toISOString()
    };
    sqlite.prepare(`
      INSERT INTO products (id, title, category, price, original_price, stock, is_featured, is_bestseller, rating, reviews_count, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newProduct.id,
      newProduct.title,
      newProduct.category,
      newProduct.price,
      newProduct.originalPrice || null,
      newProduct.stock || 0,
      newProduct.isFeatured ? 1 : 0,
      newProduct.isBestSeller ? 1 : 0,
      newProduct.rating,
      newProduct.reviewsCount,
      JSON.stringify(newProduct),
      newProduct.createdAt
    );
    syncBackup();
    return newProduct;
  },
  updateProduct: (id, updates) => {
    const current = db.getProductById(id);
    if (!current) return null;
    const updated = { ...current, ...updates };
    sqlite.prepare(`
      UPDATE products
      SET title = ?, category = ?, price = ?, original_price = ?, stock = ?, is_featured = ?, is_bestseller = ?, rating = ?, reviews_count = ?, data = ?
      WHERE id = ?
    `).run(
      updated.title,
      updated.category,
      updated.price,
      updated.originalPrice || null,
      updated.stock || 0,
      updated.isFeatured ? 1 : 0,
      updated.isBestSeller ? 1 : 0,
      updated.rating,
      updated.reviewsCount,
      JSON.stringify(updated),
      id
    );
    syncBackup();
    return updated;
  },
  deleteProduct: (id) => {
    sqlite.prepare('DELETE FROM products WHERE id = ?').run(id);
    syncBackup();
    return true;
  },

  // OFFERS
  getOffers: () => {
    const rows = sqlite.prepare('SELECT data FROM offers ORDER BY rowid DESC').all();
    return rows.map(r => JSON.parse(r.data));
  },
  addOffer: (offerData) => {
    const newOffer = {
      ...offerData,
      id: `offer_${Date.now()}`,
      usedCount: 0,
      isActive: offerData.isActive !== false
    };
    sqlite.prepare(`
      INSERT INTO offers (id, code, is_active, discount_type, discount_value, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newOffer.id, newOffer.code.toUpperCase(), newOffer.isActive ? 1 : 0, newOffer.discountType, newOffer.discountValue, JSON.stringify(newOffer));
    syncBackup();
    return newOffer;
  },
  updateOffer: (id, updates) => {
    const row = sqlite.prepare('SELECT data FROM offers WHERE id = ?').get(id);
    if (!row) return null;
    const current = JSON.parse(row.data);
    const updated = { ...current, ...updates };
    sqlite.prepare(`
      UPDATE offers
      SET code = ?, is_active = ?, discount_type = ?, discount_value = ?, data = ?
      WHERE id = ?
    `).run(updated.code.toUpperCase(), updated.isActive ? 1 : 0, updated.discountType, updated.discountValue, JSON.stringify(updated), id);
    syncBackup();
    return updated;
  },
  deleteOffer: (id) => {
    sqlite.prepare('DELETE FROM offers WHERE id = ?').run(id);
    syncBackup();
    return true;
  },
  toggleOfferStatus: (id) => {
    const row = sqlite.prepare('SELECT is_active, data FROM offers WHERE id = ?').get(id);
    if (!row) return null;
    const current = JSON.parse(row.data);
    const newStatus = row.is_active ? 0 : 1;
    current.isActive = newStatus === 1;
    sqlite.prepare('UPDATE offers SET is_active = ?, data = ? WHERE id = ?').run(newStatus, JSON.stringify(current), id);
    syncBackup();
    return current;
  },

  // ORDERS
  getOrders: () => {
    const rows = sqlite.prepare('SELECT data FROM orders ORDER BY rowid DESC').all();
    return rows.map(r => normalizeOrder(JSON.parse(r.data)));
  },
  getOrderById: (id) => {
    const row = sqlite.prepare('SELECT data FROM orders WHERE id = ?').get(id);
    return row ? normalizeOrder(JSON.parse(row.data)) : null;
  },
  getOrderByRazorpayOrderId: (razorpayOrderId) => {
    const row = sqlite.prepare("SELECT data FROM orders WHERE json_extract(data, '$.razorpayOrderId') = ?").get(razorpayOrderId);
    return row ? normalizeOrder(JSON.parse(row.data)) : null;
  },
  getOrderByPayuTransactionId: (payuTransactionId) => {
    const row = sqlite.prepare("SELECT data FROM orders WHERE json_extract(data, '$.payuTransactionId') = ?").get(payuTransactionId);
    return row ? normalizeOrder(JSON.parse(row.data)) : null;
  },
  getOrdersByQuery: (q) => {
    const row = sqlite.prepare('SELECT data FROM orders WHERE LOWER(id) = LOWER(?)').get(q.trim());
    return row ? [normalizeOrder(JSON.parse(row.data))] : [];
  },
  createOrder: (orderData) => {
    const customerInput = orderData.customer || {};
    const customer = {
      name: String(customerInput.name || '').trim(),
      email: String(customerInput.email || '').trim().toLowerCase(),
      phone: String(customerInput.phone || '').trim(),
      address: String(customerInput.address || '').trim(),
      city: String(customerInput.city || '').trim(),
      pincode: String(customerInput.pincode || '').trim()
    };
    if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) || !customer.address) {
      throw new Error('INVALID_CUSTOMER');
    }
    const paymentMethod = orderData.paymentMethod || 'cod';
    if (!['cod', 'upi', 'razorpay', 'payu', 'whatsapp'].includes(paymentMethod)) throw new Error('INVALID_PAYMENT_METHOD');
    if (!Array.isArray(orderData.items) || orderData.items.length === 0) throw new Error('EMPTY_ORDER');

    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const quantities = new Map();
      for (const item of orderData.items) {
        const quantity = Number(item.quantity);
        if (!item.productId || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('INVALID_QUANTITY');
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + quantity);
      }

      const products = [];
      const settings = db.getSettings();
      let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        const product = db.getProductById(productId);
        if (!product) throw new Error('PRODUCT_NOT_FOUND');
        if (paymentMethod === 'cod' && !isProductCodEligible(product, settings.codRules || [])) {
          throw new Error('COD_NOT_AVAILABLE_FOR_ITEMS');
        }
        if (!Number.isSafeInteger(product.stock) || product.stock < quantity) throw new Error('INSUFFICIENT_STOCK');
        const item = {
          productId,
          productTitle: product.title,
          price: Number(product.price),
          quantity,
          image: product.image,
          color: orderData.items.find(entry => entry.productId === productId)?.color
        };
        subtotal += item.price * quantity;
        products.push({ product, item, remainingStock: product.stock - quantity });
      }
      subtotal = Number(subtotal.toFixed(2));

      let discountAmount = 0;
      let promoCodeApplied;
      if (orderData.promoCodeApplied) {
        const offerRow = sqlite.prepare('SELECT data FROM offers WHERE UPPER(code) = UPPER(?) AND is_active = 1').get(String(orderData.promoCodeApplied).trim());
        const offer = offerRow ? JSON.parse(offerRow.data) : null;
        const now = Date.now();
        const startsAt = offer?.startDate ? Date.parse(offer.startDate) : 0;
        const endsAt = offer?.endDate ? Date.parse(offer.endDate) : Infinity;
        if (!offer || (startsAt && now < startsAt) || (endsAt && now > endsAt) || subtotal < Number(offer.minOrderValue || 0)) {
          throw new Error('INVALID_PROMO');
        }
        discountAmount = offer.discountType === 'percentage'
          ? subtotal * Number(offer.discountValue) / 100
          : Math.min(subtotal, Number(offer.discountValue));
        discountAmount = Number(discountAmount.toFixed(2));
        promoCodeApplied = offer.code;
      }

      const freeShippingThreshold = Math.max(0, Number(settings.freeShippingThreshold ?? 299));
      const shippingAmount = subtotal === 0 || subtotal >= freeShippingThreshold ? 0 : Math.max(0, Number(settings.shippingFee ?? 40));
      const total = Number(Math.max(0, subtotal - discountAmount + shippingAmount).toFixed(2));
      const id = `ORD-${crypto.randomUUID()}`;
      const createdAt = new Date().toISOString();
      const newOrder = {
        id,
        customer,
        items: products.map(entry => entry.item),
        subtotal,
        discountAmount,
        shippingAmount,
        promoCodeApplied,
        total,
        status: 'pending',
        paymentMethod,
        paymentStatus: 'pending',
        upiRefNumber: paymentMethod === 'upi' ? String(orderData.upiRefNumber || '').trim() : undefined,
        upiCheckoutReference: paymentMethod === 'upi' ? String(orderData.upiCheckoutReference || '').trim().slice(0, 80) || undefined : undefined,
        trackingNumber: '',
        timeline: [{ status: 'Order Placed', timestamp: createdAt, note: `Order received via ${paymentMethod.toUpperCase()}.` }],
        createdAt
      };

      sqlite.prepare(`
        INSERT INTO orders (id, customer_name, customer_email, customer_phone, status, total, payment_method, payment_status, tracking_number, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, customer.name, customer.email, customer.phone, 'pending', total, paymentMethod, 'pending', null, JSON.stringify(newOrder), createdAt);

      const updateProductStock = sqlite.prepare('UPDATE products SET stock = ?, data = ? WHERE id = ?');
      for (const entry of products) {
        updateProductStock.run(entry.remainingStock, JSON.stringify({ ...entry.product, stock: entry.remainingStock }), entry.product.id);
      }
      sqlite.exec('COMMIT');
      syncBackup();
      return newOrder;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
  linkRazorpayOrder: (id, razorpayOrderId) => {
    const current = db.getOrderById(id);
    if (!current || current.paymentMethod !== 'razorpay' || current.paymentStatus !== 'pending' || current.razorpayOrderId) {
      throw new Error('INVALID_PAYMENT_ORDER');
    }
    const updated = { ...current, razorpayOrderId };
    sqlite.prepare('UPDATE orders SET data = ? WHERE id = ?').run(JSON.stringify(updated), id);
    return updated;
  },
  linkPayuTransaction: (id, payuTransactionId) => {
    const current = db.getOrderById(id);
    if (!current || current.paymentMethod !== 'payu' || current.paymentStatus !== 'pending' || current.payuTransactionId) {
      throw new Error('INVALID_PAYMENT_ORDER');
    }
    const updated = { ...current, payuTransactionId };
    sqlite.prepare('UPDATE orders SET data = ? WHERE id = ?').run(JSON.stringify(updated), id);
    return updated;
  },
  cancelOrder: (id, cancelReason) => {
    const current = db.getOrderById(id);
    if (!current) return null;
    if (current.status === 'cancelled') return current;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      for (const item of current.items || []) {
        const product = db.getProductById(item.productId);
        if (!product) continue;
        const restocked = product.stock + item.quantity;
        sqlite.prepare('UPDATE products SET stock = ?, data = ? WHERE id = ?')
          .run(restocked, JSON.stringify({ ...product, stock: restocked }), product.id);
      }
      const reasonText = cancelReason ? `Reason: ${cancelReason}` : 'Cancelled by studio admin';
      const updated = {
        ...current,
        status: 'cancelled',
        cancelReason: cancelReason || 'Cancelled by studio admin',
        cancelledAt: new Date().toISOString(),
        paymentStatus: current.paymentStatus === 'paid' ? 'refund_pending' : (current.paymentStatus === 'pending' ? 'failed' : current.paymentStatus),
        timeline: [
          ...(current.timeline || []),
          { 
            status: 'ORDER CANCELLED', 
            timestamp: new Date().toISOString(), 
            note: `${reasonText}. Reserved items returned to studio stock.` 
          }
        ]
      };
      sqlite.prepare('UPDATE orders SET status = ?, payment_status = ?, data = ? WHERE id = ?')
        .run(updated.status, updated.paymentStatus, JSON.stringify(updated), id);
      sqlite.exec('COMMIT');
      syncBackup();
      return updated;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
  updateOrderStatus: (id, status, extraFields = {}) => {
    if (status === 'cancelled') return db.cancelOrder(id, extraFields.cancelReason);
    const current = db.getOrderById(id);
    if (!current) return null;

    let defaultNote = `Status updated to ${status.toUpperCase().replace(/_/g, ' ')}`;
    if (status === 'confirmed') {
      defaultNote = 'Order confirmed by studio. Reserved items queued for crafting & packaging.';
    } else if (status === 'processing') {
      defaultNote = 'Artisan is handcrafting loops & floral details at the workshop bench.';
    } else if (status === 'shipped') {
      const courier = extraFields.courierPartner || current.courierPartner || 'Courier';
      const awb = extraFields.trackingNumber || current.trackingNumber;
      defaultNote = awb ? `Parcel dispatched via ${courier}. AWB: ${awb}` : `Parcel handed over to ${courier}.`;
    } else if (status === 'out_for_delivery') {
      defaultNote = extraFields.deliveryNotes || 'Delivery partner has picked up parcel and is out for doorstep delivery.';
    } else if (status === 'delivered') {
      defaultNote = 'Parcel successfully delivered to recipient. Thank you for supporting handmade craftsmanship! 🌸';
    }
    if (extraFields.paymentProofKey) {
      defaultNote = 'Customer uploaded an optional UPI payment screenshot for verification.';
    } else if (
      current.paymentMethod === 'upi' &&
      current.paymentStatus !== 'paid' &&
      extraFields.paymentStatus === 'paid'
    ) {
      defaultNote = 'UPI payment verified by the studio against the transaction reference and bank statement.';
    }

    const timeline = current.timeline || [];
    timeline.push({
      status: extraFields.paymentProofKey
        ? 'UPI PAYMENT PROOF SUBMITTED'
        : current.paymentMethod === 'upi' && current.paymentStatus !== 'paid' && extraFields.paymentStatus === 'paid'
          ? 'UPI PAYMENT VERIFIED'
          : status === 'out_for_delivery' ? 'OUT FOR DELIVERY' : (status === 'confirmed' ? 'ORDER CONFIRMED' : `STATUS: ${status.toUpperCase()}`),
      timestamp: new Date().toISOString(),
      note: defaultNote
    });

    // If delivered and payment was pending COD, mark as paid
    let nextPaymentStatus = extraFields.paymentStatus || current.paymentStatus;
    if (status === 'delivered' && current.paymentMethod === 'cod' && nextPaymentStatus === 'pending') {
      nextPaymentStatus = 'paid';
    }

    const updated = {
      ...current,
      ...extraFields,
      status,
      paymentStatus: nextPaymentStatus,
      timeline
    };

    if (status === 'shipped' && !updated.shippedAt) {
      updated.shippedAt = new Date().toISOString();
    }
    if (status === 'delivered' && !updated.deliveredAt) {
      updated.deliveredAt = new Date().toISOString();
    }

    sqlite.prepare(`
      UPDATE orders
      SET status = ?, payment_status = ?, tracking_number = ?, data = ?
      WHERE id = ?
    `).run(
      status,
      updated.paymentStatus || current.paymentStatus,
      updated.trackingNumber || null,
      JSON.stringify(updated),
      id
    );
    syncBackup();
    return updated;
  },
  deleteOrder: (id) => {
    sqlite.prepare('DELETE FROM orders WHERE id = ?').run(id);
    syncBackup();
    return true;
  },

  // REVIEWS
  getReviews: (productId) => {
    let rows;
    if (productId) {
      rows = sqlite.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY rowid DESC').all(productId);
    } else {
      rows = sqlite.prepare('SELECT * FROM reviews ORDER BY rowid DESC').all();
    }
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      rating: r.rating,
      comment: r.comment,
      verifiedPurchase: Boolean(r.verified_purchase),
      createdAt: r.created_at
    }));
  },
  addReview: (reviewData) => {
    const id = `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const review = {
      id,
      productId: reviewData.productId,
      customerName: reviewData.customerName || 'Handcraft Lover',
      customerEmail: reviewData.customerEmail || '',
      rating: Math.min(5, Math.max(1, Number(reviewData.rating) || 5)),
      comment: reviewData.comment || '',
      verifiedPurchase: reviewData.verifiedPurchase !== false,
      createdAt: new Date().toISOString()
    };

    sqlite.prepare(`
      INSERT INTO reviews (id, product_id, customer_name, customer_email, rating, comment, verified_purchase, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      review.id,
      review.productId,
      review.customerName,
      review.customerEmail,
      review.rating,
      review.comment,
      review.verifiedPurchase ? 1 : 0,
      review.createdAt
    );

    // Recalculate product rating & reviewsCount
    const allReviews = db.getReviews(review.productId);
    const avgRating = (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1);
    db.updateProduct(review.productId, {
      rating: parseFloat(avgRating),
      reviewsCount: allReviews.length
    });

    return review;
  },
  deleteReview: (id) => {
    const row = sqlite.prepare('SELECT product_id FROM reviews WHERE id = ?').get(id);
    if (row) {
      sqlite.prepare('DELETE FROM reviews WHERE id = ?').run(id);
      const allReviews = db.getReviews(row.product_id);
      const avgRating = allReviews.length > 0
        ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1)
        : 5.0;
      db.updateProduct(row.product_id, {
        rating: parseFloat(avgRating),
        reviewsCount: allReviews.length
      });
    }
    return true;
  },

  // USERS (Customer Accounts)
  hashPassword: (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  },

  verifyPassword: (password, stored) => {
    try {
      const [salt, hash] = stored.split(':');
      const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
    } catch {
      return false;
    }
  },

  getUserByEmail: (email) => {
    const row = sqlite.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      pincode: row.pincode || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  getUserById: (id) => {
    const row = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      pincode: row.pincode || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  syncAuthUser: ({ id, email, name = '', phone = '' }) => {
    if (!id || !email) throw new Error('AUTH_PROFILE_MISSING');
    const normalizedEmail = email.trim().toLowerCase();
    const existing = sqliteDb.getUserByEmail(normalizedEmail);
    if (existing) {
      sqlite.prepare('UPDATE users SET name = COALESCE(NULLIF(?, \'\'), name), phone = COALESCE(NULLIF(?, \'\'), phone), updated_at = ? WHERE id = ?')
        .run(name.trim(), phone.trim(), new Date().toISOString(), existing.id);
      return sqliteDb.getUserById(existing.id);
    }
    const now = new Date().toISOString();
    sqlite.prepare(
      'INSERT INTO users (id, name, email, password_hash, phone, address, city, pincode, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, \'\', \'\', \'\', ?, ?)'
    ).run(id, name.trim() || normalizedEmail.split('@')[0], normalizedEmail, phone.trim(), now, now);
    return sqliteDb.getUserById(id);
  },

  createUser: ({ name, email, password, phone = '', address = '', city = '', pincode = '' }) => {
    const existing = sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existing) throw new Error('EMAIL_EXISTS');
    const id = `usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const passwordHash = sqliteDb.hashPassword(password);
    const now = new Date().toISOString();
    sqlite.prepare(
      'INSERT INTO users (id, name, email, password_hash, phone, address, city, pincode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name.trim(), email.trim().toLowerCase(), passwordHash, phone, address, city, pincode, now, now);
    return sqliteDb.getUserById(id);
  },

  updateUser: (id, updates) => {
    const fields = [];
    const vals = [];
    if (updates.name !== undefined) { fields.push('name = ?'); vals.push(updates.name.trim()); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); vals.push(updates.phone); }
    if (updates.address !== undefined) { fields.push('address = ?'); vals.push(updates.address); }
    if (updates.city !== undefined) { fields.push('city = ?'); vals.push(updates.city); }
    if (updates.pincode !== undefined) { fields.push('pincode = ?'); vals.push(updates.pincode); }
    if (updates.password) {
      fields.push('password_hash = ?');
      vals.push(sqliteDb.hashPassword(updates.password));
    }
    if (fields.length === 0) return sqliteDb.getUserById(id);
    fields.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(id);
    sqlite.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    return sqliteDb.getUserById(id);
  },

  getUserOrders: (userId) => {
    const user = sqliteDb.getUserById(userId);
    if (!user) return [];
    // Match orders by email
    const rows = sqlite.prepare('SELECT data FROM orders WHERE LOWER(customer_email) = LOWER(?) ORDER BY rowid DESC').all(user.email);
    return rows.map(r => JSON.parse(r.data));
  }
};

export const db = process.env.SUPABASE_DB_URL
  ? (await import('./postgres-db.js')).postgresDb
  : sqliteDb;
