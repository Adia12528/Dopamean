import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });
if (!process.env.SUPABASE_DB_URL) throw new Error('Set SUPABASE_DB_URL in the project .env before migrating.');

const sqlite = new DatabaseSync(path.join(here, 'data', 'store.db'), { readOnly: true });
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const json = value => typeof value === 'string' ? JSON.parse(value) : value;

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS settings (id smallint PRIMARY KEY CHECK(id=1), data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY,title text NOT NULL CHECK(length(trim(title))>0),category text NOT NULL,price numeric(12,2) NOT NULL CHECK(price>=0),original_price numeric(12,2) CHECK(original_price IS NULL OR original_price>=0),stock integer NOT NULL DEFAULT 0 CHECK(stock>=0),is_featured boolean NOT NULL DEFAULT false,is_bestseller boolean NOT NULL DEFAULT false,rating numeric(2,1) NOT NULL DEFAULT 5 CHECK(rating BETWEEN 0 AND 5),reviews_count integer NOT NULL DEFAULT 0 CHECK(reviews_count>=0),data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS offers (id text PRIMARY KEY,code text UNIQUE NOT NULL CHECK(length(trim(code))>0),is_active boolean NOT NULL DEFAULT true,discount_type text NOT NULL CHECK(discount_type IN ('percentage','fixed')),discount_value numeric(12,2) NOT NULL CHECK(discount_value>=0 AND (discount_type<>'percentage' OR discount_value<=100)),data jsonb NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY,customer_name text NOT NULL,customer_email text NOT NULL,customer_phone text,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),total numeric(12,2) NOT NULL CHECK(total>=0),payment_method text NOT NULL CHECK(payment_method IN ('cod','upi','razorpay','whatsapp')),payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed')),tracking_number text,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS reviews (id text PRIMARY KEY,product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,customer_name text NOT NULL,customer_email text,rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),comment text NOT NULL,verified_purchase boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY,name text NOT NULL CHECK(length(trim(name))>0),email text NOT NULL UNIQUE CHECK(email=lower(trim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),password_hash text NOT NULL CHECK(length(trim(password_hash))>0),phone text NOT NULL DEFAULT '',address text NOT NULL DEFAULT '',city text NOT NULL DEFAULT '',pincode text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());`);
    const { rows: counts } = await client.query(`SELECT
      (SELECT count(*) FROM products)::int AS products,(SELECT count(*) FROM offers)::int AS offers,
      (SELECT count(*) FROM orders)::int AS orders,(SELECT count(*) FROM reviews)::int AS reviews,
      (SELECT count(*) FROM users)::int AS users`);
    if (Object.values(counts[0]).some(count => count > 0)) throw new Error('The Supabase database already has store records. Migration stopped to avoid overwriting them.');

    const settingsRow = sqlite.prepare('SELECT data,updated_at FROM settings WHERE id=1').get();
    if (settingsRow) await client.query('INSERT INTO settings(id,data,updated_at) VALUES(1,$1::jsonb,$2) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at', [JSON.stringify(json(settingsRow.data)), settingsRow.updated_at]);

    for (const row of sqlite.prepare('SELECT * FROM products').all()) {
      const p = json(row.data);
      await client.query('INSERT INTO products(id,title,category,price,original_price,stock,is_featured,is_bestseller,rating,reviews_count,data,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)', [row.id,row.title,row.category,row.price,row.original_price,row.stock,Boolean(row.is_featured),Boolean(row.is_bestseller),row.rating,row.reviews_count,JSON.stringify(p),row.created_at]);
    }
    for (const row of sqlite.prepare('SELECT * FROM offers').all()) {
      const offer = json(row.data);
      const type = row.discount_type || (offer.discountType === 'percentage' ? 'percentage' : 'fixed');
      const value = Number(row.discount_value ?? offer.discountValue ?? 0);
      await client.query('INSERT INTO offers(id,code,is_active,discount_type,discount_value,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [row.id,String(row.code).toUpperCase(),Boolean(row.is_active),type,value,JSON.stringify(offer)]);
    }
    for (const row of sqlite.prepare('SELECT * FROM orders').all()) {
      const order = json(row.data); const rawStatus = String(order.status || row.status || 'pending').toLowerCase();
      order.status = rawStatus === 'in crafting' ? 'processing' : (['pending','processing','shipped','delivered','cancelled'].includes(rawStatus) ? rawStatus : 'pending');
      order.customer ||= { name: row.customer_name || 'Customer', email: row.customer_email || '', phone: row.customer_phone || '' };
      order.discountAmount = Number(order.discountAmount ?? order.discount ?? 0); delete order.discount;
      const method = ['cod','upi','razorpay','whatsapp'].includes(order.paymentMethod) ? order.paymentMethod : 'cod';
      const paymentStatus = ['pending','paid','failed'].includes(order.paymentStatus) ? order.paymentStatus : 'pending';
      await client.query('INSERT INTO orders(id,customer_name,customer_email,customer_phone,status,total,payment_method,payment_status,tracking_number,data,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)', [row.id,order.customer.name,order.customer.email,order.customer.phone || '',order.status,Number(order.total || 0),method,paymentStatus,order.trackingNumber || null,JSON.stringify(order),row.created_at]);
    }
    for (const row of sqlite.prepare('SELECT * FROM reviews').all()) {
      await client.query('INSERT INTO reviews(id,product_id,customer_name,customer_email,rating,comment,verified_purchase,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [row.id,row.product_id,row.customer_name,row.customer_email,row.rating,row.comment,Boolean(row.verified_purchase),row.created_at]);
    }
    for (const row of sqlite.prepare('SELECT * FROM users').all()) {
      await client.query('INSERT INTO users(id,name,email,password_hash,phone,address,city,pincode,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [row.id,row.name,row.email,row.password_hash,row.phone || '',row.address || '',row.city || '',row.pincode || '',row.created_at,row.updated_at]);
    }
    await client.query('CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC); CREATE INDEX IF NOT EXISTS orders_email_idx ON orders(lower(customer_email)); CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id,created_at DESC); CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users(lower(email))');
    await client.query('COMMIT');
    console.log(`Migrated ${sqlite.prepare('SELECT count(*) AS n FROM products').get().n} products, ${sqlite.prepare('SELECT count(*) AS n FROM offers').get().n} offers, ${sqlite.prepare('SELECT count(*) AS n FROM orders').get().n} orders, ${sqlite.prepare('SELECT count(*) AS n FROM reviews').get().n} reviews, and ${sqlite.prepare('SELECT count(*) AS n FROM users').get().n} customer accounts.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
} finally {
  sqlite.close();
  await pool.end();
}
