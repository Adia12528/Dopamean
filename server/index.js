import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID || '';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '';
const USER_JWT_SECRET = process.env.USER_JWT_SECRET || crypto.randomBytes(32).toString('hex');
const supabaseAuth = process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const supabaseAdmin = process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

if (process.env.NODE_ENV === 'production') {
  const missing = ['SUPABASE_DB_URL'].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required production database configuration: ${missing.join(', ')}`);
  if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length < 8) {
    console.warn('Security Warning: ADMIN_PASSCODE is short. Consider using at least 12 characters for public production.');
  }
}


// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// Middleware
app.disable('x-powered-by');
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true,
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.json({ limit: '15mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use('/uploads', express.static(UPLOADS_DIR));

const requestWindows = new Map();
function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    const bucket = requestWindows.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      requestWindows.set(key, { startedAt: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    next();
  };
}
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'login' });
const lookupLimit = rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'order-lookup' });
const uploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, keyPrefix: 'upload' });
const orderLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyPrefix: 'order-create' });
const reviewLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'review-create' });
const paymentLimit = rateLimit({ windowMs: 60 * 1000, max: 20, keyPrefix: 'payment' });

function configuredAdminPasscode(settings) {
  if (settings?.adminPasscode && settings.adminPasscode.trim()) {
    return settings.adminPasscode.trim();
  }
  if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim() !== 'replace-with-a-unique-admin-passcode') {
    return process.env.ADMIN_PASSCODE.trim();
  }
  return 'admin123';
}

function getImageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return '.gif';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return '.webp';
  return null;
}

function safeEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Simple admin auth helper token generator & validator
function generateAdminToken(passcode) {
  const payload = JSON.stringify({ role: 'admin', ts: Date.now() });
  const hmac = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(payload + passcode).digest('hex');
  return Buffer.from(`${payload}::${hmac}`).toString('base64');
}

function verifyAdminToken(token, currentPasscode) {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const [payload, hmac] = raw.split('::');
    const expectedHmac = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(payload + currentPasscode).digest('hex');
    if (!safeEqualHex(hmac, expectedHmac)) return false;
    const data = JSON.parse(payload);
    // Token valid for 7 days
    return data.role === 'admin' && Number.isFinite(data.ts) && data.ts <= Date.now() && Date.now() - data.ts <= 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// Optional auth middleware for sensitive admin endpoints
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  Promise.resolve().then(() => db.getSettings()).then(settings => {
    const passcode = configuredAdminPasscode(settings);
    const isSuperAdmin = token && verifyAdminToken(token, '__SUPER_ADMIN__');
    if (!token || (!isSuperAdmin && (!passcode || !verifyAdminToken(token, passcode)))) {
      return res.status(401).json({ error: 'Unauthorized: Super Admin credentials required.' });
    }
    next();
  }).catch(() => res.status(503).json({ error: 'Store database is unavailable.' }));
}

// ── User JWT helpers ─────────────────────────────────────────────────────────
function generateUserToken(userId) {
  const payload = JSON.stringify({ userId, ts: Date.now() });
  const hmac = crypto.createHmac('sha256', USER_JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}::${hmac}`).toString('base64');
}

function verifyUserToken(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const [payload, hmac] = raw.split('::');
    const expectedHmac = crypto.createHmac('sha256', USER_JWT_SECRET).update(payload).digest('hex');
    if (!safeEqualHex(hmac, expectedHmac)) return null;
    const data = JSON.parse(payload);
    // Token valid for 30 days
    if (!data.userId || !Number.isFinite(data.ts) || data.ts > Date.now() || Date.now() - data.ts > 30 * 24 * 60 * 60 * 1000) return null;
    return data.userId;
  } catch {
    return null;
  }
}

async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });

  // 1. Try Supabase JWT if token has standard 3-part JWT structure and supabase client is present
  if (supabaseAuth && token.includes('.') && token.split('.').length === 3) {
    try {
      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (!error && data?.user?.email) {
        const user = await db.syncAuthUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || '',
          phone: data.user.user_metadata?.phone || ''
        });
        req.user = user;
        return next();
      }
    } catch {
      // Continue to local token verification
    }
  }

  // 2. Try Local app HMAC-signed user token
  const userId = verifyUserToken(token);
  if (!userId) return res.status(401).json({ error: 'Please log in to continue.' });

  try {
    const user = await db.getUserById(userId);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = user;
    next();
  } catch {
    res.status(503).json({ error: 'Store database is unavailable.' });
  }
}


// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Cozy Loops E-Commerce Production Engine',
    database: process.env.SUPABASE_DB_URL ? 'Supabase PostgreSQL' : 'SQLite 3 (WAL mode)',
    customerAuth: supabaseAuth ? 'Supabase Auth' : 'Legacy app authentication',
    time: new Date().toISOString()
  });
});

// ==========================================
// ADMIN AUTHENTICATION API
// ==========================================
app.post('/api/admin/login', loginLimit, async (req, res) => {
  try {
    const { passcode, superAdminId, superAdminPassword } = req.body;

    // ── Tier 1: Super Admin (env-hardcoded, unchangeable) ────────────────────
    if (superAdminId !== undefined || superAdminPassword !== undefined) {
      if (
        SUPER_ADMIN_ID && SUPER_ADMIN_PASSWORD &&
        superAdminId?.trim() === SUPER_ADMIN_ID &&
        superAdminPassword?.trim() === SUPER_ADMIN_PASSWORD
      ) {
        const token = generateAdminToken('__SUPER_ADMIN__');
        return res.json({
          success: true,
          token,
          role: 'superadmin',
          message: 'Super Admin authenticated successfully'
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials' });
    }

    // ── Tier 2: Regular Admin (store passcode, changeable in settings) ───────
    const settings = await db.getSettings();
    const correctPasscode = configuredAdminPasscode(settings);
    if (!correctPasscode || !passcode || passcode.trim() !== correctPasscode.trim()) {
      return res.status(401).json({ success: false, message: 'Invalid Admin Passcode' });
    }
    const token = generateAdminToken(correctPasscode);
    res.json({
      success: true,
      token,
      role: 'admin',
      message: 'Admin authenticated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/admin/verify', async (req, res) => {
  const { token } = req.body;
  const settings = await db.getSettings();
  // A super-admin token is signed against the '__SUPER_ADMIN__' sentinel
  const isSuperAdmin = verifyAdminToken(token, '__SUPER_ADMIN__');
  const passcode = configuredAdminPasscode(settings);
  const isAdmin = isSuperAdmin || Boolean(passcode && verifyAdminToken(token, passcode));
  res.json({ valid: isAdmin, role: isSuperAdmin ? 'superadmin' : (isAdmin ? 'admin' : null) });
});

// ==========================================
// USER (CUSTOMER) AUTHENTICATION API
// ==========================================
app.post('/api/users/register', loginLimit, async (req, res) => {
  try {
    const { name, email, password, phone, address, city, pincode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const user = await db.createUser({ name, email, password, phone, address, city, pincode });
    const token = generateUserToken(user.id);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    if (err.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

app.post('/api/users/login', loginLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = await db.getUserByEmail(email);
    let authenticated = false;

    if (user?.passwordHash) {
      authenticated = db.verifyPassword(password, user.passwordHash);
    } else if (supabaseAuth) {
      try {
        const { data: supaData, error: supaErr } = await supabaseAuth.auth.signInWithPassword({ email, password });
        if (!supaErr && supaData?.user) {
          authenticated = true;
          const synced = await db.syncAuthUser({
            id: supaData.user.id,
            email: supaData.user.email,
            name: supaData.user.user_metadata?.name || '',
            phone: supaData.user.user_metadata?.phone || ''
          });
          const token = generateUserToken(synced.id);
          return res.json({ success: true, token, user: synced });
        }
      } catch {
        // Fall through
      }
    }

    if (!user || !authenticated) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = generateUserToken(user.id);
    // Return user without passwordHash
    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.get('/api/users/me', requireUser, (req, res) => {
  res.json(req.user);
});

app.put('/api/users/me', requireUser, async (req, res) => {
  try {
    const { name, phone, address, city, pincode } = req.body;
    const updated = await db.updateUser(req.user.id, { name, phone, address, city, pincode });
    res.json(updated);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.get('/api/users/my-orders', requireUser, async (req, res) => {
  try {
    const orders = await db.getUserOrders(req.user.id);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});


// ==========================================
// IMAGE UPLOAD API (Supabase Storage with Local Disk Fallback)
// ==========================================
app.post('/api/upload', requireAdmin, uploadLimit, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const extension = getImageExtension(req.file.buffer);
    if (!extension) return res.status(400).json({ error: 'Unsupported or invalid image file.' });
    const filename = `crochet_${crypto.randomUUID()}${extension}`;

    // 1. Try Supabase Cloud Storage first (permanent CDN for production)
    if (supabaseAdmin) {
      try {
        const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'media';
        const { error: uploadError } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(filename, req.file.buffer, {
            contentType: req.file.mimetype || 'image/jpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filename);
          if (urlData?.publicUrl) {
            return res.json({
              success: true,
              url: urlData.publicUrl,
              filename,
              size: req.file.size,
              storage: 'supabase'
            });
          }
        } else {
          console.warn('Supabase storage upload failed, falling back to local disk:', uploadError.message);
        }
      } catch (storageErr) {
        console.warn('Supabase storage error, falling back to local disk:', storageErr?.message || storageErr);
      }
    }

    // 2. Local disk fallback
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer, { flag: 'wx' });
    const imageUrl = `/uploads/${filename}`;
    res.json({
      success: true,
      url: imageUrl,
      filename,
      size: req.file.size,
      storage: 'local'
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ==========================================
// STORE SETTINGS API (Customizable by Owner)
// ==========================================
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    // Do not leak secret key in public settings GET
    const sanitized = { ...settings };
    delete sanitized.adminPasscode;
    sanitized.razorpayKeyId = (sanitized.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
    if (sanitized.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET) {
      sanitized.razorpayKeySecretConfigured = true;
      delete sanitized.razorpayKeySecret;
    }
    if (sanitized.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET) {
      sanitized.razorpayWebhookSecretConfigured = true;
    }
    delete sanitized.razorpayWebhookSecret;

    // Enable Razorpay if keys are configured (either via DB or process.env) unless explicitly disabled
    const hasRazorpayKeys = Boolean(sanitized.razorpayKeyId && sanitized.razorpayKeySecretConfigured);
    if (hasRazorpayKeys && settings.paymentRazorpayEnabled !== false) {
      sanitized.paymentRazorpayEnabled = true;
    }
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    if (req.body.adminPasscode !== undefined && String(req.body.adminPasscode).trim().length < 12) {
      return res.status(400).json({ error: 'Admin passcodes must be at least 12 characters.' });
    }
    const changes = { ...req.body };
    delete changes.razorpayKeySecretConfigured;
    delete changes.razorpayWebhookSecretConfigured;
    const current = await db.getSettings();
    const next = { ...current, ...changes };
    if (changes.paymentRazorpayEnabled && (!(next.razorpayKeyId || process.env.RAZORPAY_KEY_ID) || !(next.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET))) {
      return res.status(400).json({ error: 'Add both Razorpay Key ID and Key Secret before enabling Razorpay.' });
    }
    if (changes.paymentUpiEnabled && (!String(next.upiId || '').trim() || !String(next.upiPayeeName || '').trim())) {
      return res.status(400).json({ error: 'Add a UPI ID and payee name before enabling UPI.' });
    }
    const updated = await db.updateSettings(changes);
    const sanitized = { ...updated };
    delete sanitized.adminPasscode;
    sanitized.razorpayKeyId = sanitized.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '';
    if (sanitized.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET) {
      sanitized.razorpayKeySecretConfigured = true;
      delete sanitized.razorpayKeySecret;
    }
    if (sanitized.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET) {
      sanitized.razorpayWebhookSecretConfigured = true;
    }
    delete sanitized.razorpayWebhookSecret;
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==========================================
// PRODUCTS API
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const newProduct = await db.addProduct(req.body);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==========================================
// OFFERS & PROMOS API
// ==========================================
app.get('/api/offers', async (req, res) => {
  try {
    res.json(await db.getOffers());
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve offers' });
  }
});

app.post('/api/offers', requireAdmin, async (req, res) => {
  try {
    const newOffer = await db.addOffer(req.body);
    res.status(201).json(newOffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

app.put('/api/offers/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateOffer(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Offer not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

app.delete('/api/offers/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteOffer(req.params.id);
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

app.patch('/api/offers/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const toggled = await db.toggleOfferStatus(req.params.id);
    if (!toggled) return res.status(404).json({ error: 'Offer not found' });
    res.json(toggled);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle offer status' });
  }
});

// ==========================================
// ORDERS & TRACKING API
// ==========================================
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    res.json(await db.getOrders());
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

app.get('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

// Public Order Tracking by Order ID, Phone, or Email
app.get('/api/orders/track/lookup', lookupLimit, async (req, res) => {
  try {
    const q = req.query.q;
    const checkoutEmail = req.query.email;
    if (!q || typeof q !== 'string' || q.trim().length < 2 || !checkoutEmail || typeof checkoutEmail !== 'string') {
      return res.status(400).json({ error: 'Order ID and checkout email are required.' });
    }
    const order = await db.getOrderById(q.trim());
    if (!order || order.customer?.email?.toLowerCase() !== checkoutEmail.trim().toLowerCase()) {
      return res.status(404).json({ error: 'No order found. Check the ID and checkout email.' });
    }
    const publicCustomer = { ...order.customer };
    delete publicCustomer.email;
    delete publicCustomer.phone;
    delete publicCustomer.address;
    delete publicCustomer.city;
    delete publicCustomer.pincode;
    res.json([{ ...order, customer: publicCustomer }]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to track order' });
  }
});

app.post('/api/orders', orderLimit, async (req, res) => {
  try {
    const settings = await db.getSettings();
    const method = req.body?.paymentMethod || 'cod';
    if (method === 'upi' && settings.paymentUpiEnabled === false) return res.status(400).json({ error: 'UPI payments are currently unavailable.' });
    if (method === 'cod' && settings.paymentCodEnabled === false) return res.status(400).json({ error: 'Cash on Delivery is currently unavailable.' });
    const rzpKeyId = (settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
    const rzpKeySecret = (settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();
    const isRazorpayConfigured = Boolean(rzpKeyId && rzpKeySecret);
    const isRazorpayActive = isRazorpayConfigured && settings.paymentRazorpayEnabled !== false;

    if (method === 'razorpay' && !isRazorpayActive) {
      return res.status(400).json({ error: 'Razorpay online payment is currently unavailable. Please choose UPI QR or Cash on Delivery.' });
    }
    const newOrder = await db.createOrder(req.body);
    res.status(201).json(newOrder);
  } catch (err) {
    const clientErrors = ['INVALID_CUSTOMER', 'EMPTY_ORDER', 'INVALID_QUANTITY', 'PRODUCT_NOT_FOUND', 'INSUFFICIENT_STOCK', 'INVALID_PROMO', 'INVALID_PAYMENT_METHOD'];
    if (clientErrors.includes(err.message)) return res.status(400).json({ error: err.message });
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.patch('/api/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status, trackingNumber, paymentStatus, courierPartner, cancelReason, deliveryNotes } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid order status. Allowed: ${allowedStatuses.join(', ')}` });
    }
    const updated = await db.updateOrderStatus(req.params.id, status, {
      trackingNumber,
      paymentStatus,
      courierPartner,
      cancelReason,
      deliveryNotes
    });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    console.error('Failed to update order status:', err);
    res.status(500).json({ error: err.message || 'Failed to update order status' });
  }
});

// ==========================================
// REVIEWS API (Customer reviews & ratings)
// ==========================================
app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const reviews = await db.getReviews(req.params.productId);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', reviewLimit, async (req, res) => {
  try {
    const { productId, customerName, customerEmail, rating, comment } = req.body;
    if (!productId || !comment || !rating) {
      return res.status(400).json({ error: 'Product ID, rating, and review comment are required.' });
    }
    const newReview = await db.addReview({
      productId,
      customerName: customerName || 'Verified Buyer',
      customerEmail: customerEmail || '',
      rating: parseInt(rating, 10),
      comment: comment.trim(),
      verifiedPurchase: true
    });
    res.status(201).json(newReview);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add review' });
  }
});

app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteReview(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ==========================================
// PAYMENT GATEWAYS API: RAZORPAY & UPI
// ==========================================
app.post('/api/payments/razorpay/test', requireAdmin, paymentLimit, async (req, res) => {
  const settings = await db.getSettings();
  const keyId = (settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) return res.status(400).json({ error: 'Save both Razorpay Key ID and Key Secret first.' });
  try {
    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    await instance.orders.all({ count: 1 });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: 'Razorpay could not authenticate these keys. Check the Key ID, Key Secret, and test/live mode.' });
  }
});

app.post('/api/payments/razorpay/create-order', paymentLimit, async (req, res) => {
  try {
    const { orderId } = req.body;
    const settings = await db.getSettings();

    const keyId = (settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(400).json({
        error: 'Razorpay keys are not configured yet in Studio Settings. You can also pay instantly via UPI QR or Cash on Delivery!'
      });
    }

    const storeOrder = await db.getOrderById(orderId);
    if (!storeOrder || storeOrder.paymentMethod !== 'razorpay' || storeOrder.status !== 'pending' || storeOrder.razorpayOrderId) {
      return res.status(400).json({ error: 'A valid pending Razorpay order is required.' });
    }

    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    const options = {
      amount: Math.round(storeOrder.total * 100),
      currency: 'INR',
      receipt: String(storeOrder.id).slice(0, 40),
      payment_capture: 1,
      notes: { storeOrderId: storeOrder.id }
    };

    const razorpayOrder = await instance.orders.create(options);
    await db.linkRazorpayOrder(storeOrder.id, razorpayOrder.id);
    res.json({
      success: true,
      orderId: razorpayOrder.id,
      storeOrderId: storeOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create Razorpay order' });
  }
});

app.post('/api/payments/razorpay/verify', paymentLimit, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const settings = await db.getSettings();
    const keyId = (settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keySecret) {
      return res.status(400).json({ error: 'Razorpay key secret not configured' });
    }

    const storeOrder = await db.getOrderById(orderId);
    if (!storeOrder || storeOrder.paymentMethod !== 'razorpay' || storeOrder.razorpayOrderId !== razorpay_order_id || storeOrder.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Payment does not match a pending store order.' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${storeOrder.razorpayOrderId}|${razorpay_payment_id}`)
      .digest('hex');

    if (!safeEqualHex(razorpay_signature, generatedSignature)) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    let payment = await instance.payments.fetch(razorpay_payment_id);
    if (payment.order_id !== storeOrder.razorpayOrderId || payment.amount !== Math.round(storeOrder.total * 100)) {
      return res.status(400).json({ success: false, message: 'Payment details do not match this order.' });
    }

    // Auto-capture if merchant Razorpay account is in authorized mode
    if (payment.status === 'authorized') {
      try {
        payment = await instance.payments.capture(razorpay_payment_id, Math.round(storeOrder.total * 100), 'INR');
      } catch (capErr) {
        console.error('Razorpay auto-capture error:', capErr);
      }
    }

    if (payment.status !== 'captured') {
      return res.status(409).json({ success: false, message: `Payment status is ${payment.status}, expected captured.` });
    }
    const updated = await db.updateOrderStatus(orderId, 'processing', {
      paymentStatus: 'paid',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    });
    return res.json({ success: true, message: 'Payment verified successfully', paymentId: razorpay_payment_id, order: updated });
  } catch (err) {
    console.error('Razorpay verification error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

app.post('/api/webhooks/razorpay', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const webhookSecret = settings.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(503).json({ error: 'Payment webhook is not configured.' });
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex');
    if (!safeEqualHex(signature, expected)) return res.status(401).json({ error: 'Invalid webhook signature.' });

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    if (event === 'payment.captured' && payment?.order_id && payment?.id) {
      const order = await db.getOrderByRazorpayOrderId(payment.order_id);
      if (order && payment.amount === Math.round(order.total * 100) && order.paymentStatus !== 'paid') {
        await db.updateOrderStatus(order.id, 'processing', {
          paymentStatus: 'paid',
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Razorpay webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

app.post('/api/orders/:id/cancel-payment', paymentLimit, async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order || order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'pending') {
      return res.status(404).json({ error: 'Pending payment order not found.' });
    }
    if (order.razorpayOrderId) {
      const settings = await db.getSettings();
      const instance = new Razorpay({
        key_id: settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID,
        key_secret: settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET
      });
      const payments = await instance.orders.fetchPayments(order.razorpayOrderId);
      if ((payments.items || []).some(payment => ['authorized', 'captured'].includes(payment.status))) {
        return res.status(409).json({ error: 'Payment is in progress. The order cannot be cancelled yet.' });
      }
    }
    res.json(await db.cancelOrder(order.id));
  } catch (err) {
    res.status(400).json({ error: 'Unable to cancel this payment order.' });
  }
});

// Start backend server
app.listen(PORT, () => {
  const dbEngine = process.env.SUPABASE_DB_URL ? 'Supabase PostgreSQL' : 'SQLite (Local)';
  console.log(`🧶 Cozy Loops Backend running on http://localhost:${PORT} (${dbEngine})`);
});
