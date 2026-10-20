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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { db } = await import('./db.js');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID || '';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || '';
const USER_JWT_SECRET = process.env.USER_JWT_SECRET || crypto.randomBytes(32).toString('hex');
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && /^https?:\/\//i.test(process.env.RAZORPAY_WEBHOOK_SECRET || '')) {
  throw new Error('RAZORPAY_WEBHOOK_SECRET must be the signing secret, not the webhook URL.');
}
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
  .map(origin => {
    const url = new URL(origin);
    if (url.origin !== origin.replace(/\/$/, '')) {
      throw new Error(`CORS_ORIGIN entries must be origins without a path: ${origin}`);
    }
    if (isProduction && url.protocol !== 'https:') {
      throw new Error('CORS_ORIGIN entries must use HTTPS in production.');
    }
    return url.origin;
  });
const supabaseAuth = process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

if (isProduction) {
  const required = ['SUPABASE_DB_URL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'JWT_SECRET', 'USER_JWT_SECRET', 'ADMIN_PASSCODE', 'CORS_ORIGIN'];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  for (const name of ['JWT_SECRET', 'USER_JWT_SECRET']) {
    if (Buffer.byteLength(process.env[name], 'utf8') < 32) {
      throw new Error(`${name} must be at least 32 bytes in production.`);
    }
  }
  if (process.env.ADMIN_PASSCODE.trim().length < 12) {
    throw new Error('ADMIN_PASSCODE must be at least 12 characters in production.');
  }
  if (allowedOrigins.length === 0) throw new Error('CORS_ORIGIN must contain at least one HTTPS storefront origin.');
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
if (isProduction) app.set('trust proxy', 1);
app.use(cors({
  origin: isProduction ? allowedOrigins : allowedOrigins.length ? allowedOrigins : true,
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
app.use(express.json({ limit: '15mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.get('/uploads/hero_landing.png', (_req, res) => res.redirect(301, '/uploads/hero_landing.webp'));
app.use('/uploads', express.static(UPLOADS_DIR));

const requestWindows = new Map();
function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    // In local development, bypass rate limits to prevent locking out developer
    if (process.env.NODE_ENV !== 'production') return next();
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

function updateEnvFile(updates) {
  try {
    if (isProduction) {
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null) process.env[key] = String(value).trim();
      }
      return;
    }
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, 'utf8');
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null) continue;
      const strVal = String(value).trim();
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${strVal}`);
      } else {
        content = content.trimEnd() + `\n${key}=${strVal}\n`;
      }
      process.env[key] = strVal;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('Synchronized credentials to .env file:', Object.keys(updates));
  } catch (err) {
    console.warn('Could not update .env file:', err);
  }
}

function getSuperAdminCredentials(settings) {
  const storedId = settings?.superAdminId?.trim() || '';
  const storedPassword = settings?.superAdminPassword?.trim() || '';
  const id = (storedId || SUPER_ADMIN_ID.trim()).trim();
  const password = (storedPassword || SUPER_ADMIN_PASSWORD.trim()).trim();
  if (!isProduction || password.length >= 12) return { id, password };
  if (SUPER_ADMIN_ID.trim() && SUPER_ADMIN_PASSWORD.trim().length >= 12) {
    return { id: SUPER_ADMIN_ID.trim(), password: SUPER_ADMIN_PASSWORD.trim() };
  }
  return { id: '', password: '' };
}

function getValidAdminPasscodes(settings) {
  const dbPass = settings?.adminPasscode?.trim();
  if (dbPass && (!isProduction || dbPass.length >= 12)) return [dbPass];
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass && envPass !== 'replace-with-a-unique-admin-passcode' && (!isProduction || envPass.length >= 12)) return [envPass];
  return [];
}

// ── Delivery Agent Auth ────────────────────────────────────────────────────────
function getDeliveryAgentPasscode(settings) {
  const dbPass = settings?.deliveryAgentPasscode?.trim();
  if (dbPass && (!isProduction || dbPass.length >= 12)) return dbPass;
  const envPass = process.env.DELIVERY_AGENT_PASSCODE?.trim();
  if (envPass && (!isProduction || envPass.length >= 12)) return envPass;
  return '';
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

// ── Admin token (superadmin / studio) ────────────────────────────────────────
function generateAdminToken(passcode, role = 'admin') {
  const payload = JSON.stringify({ role, ts: Date.now() });
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
    return ['admin','superadmin'].includes(data.role) && Number.isFinite(data.ts) && data.ts <= Date.now() && Date.now() - data.ts <= 7 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

// ── Delivery Agent token ──────────────────────────────────────────────────────
function generateDeliveryToken(passcode) {
  const payload = JSON.stringify({ role: 'delivery_agent', ts: Date.now() });
  const hmac = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(payload + passcode).digest('hex');
  return Buffer.from(`${payload}::${hmac}`).toString('base64');
}

function verifyDeliveryToken(token, currentPasscode) {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const [payload, hmac] = raw.split('::');
    const expectedHmac = crypto.createHmac('sha256', ADMIN_JWT_SECRET).update(payload + currentPasscode).digest('hex');
    if (!safeEqualHex(hmac, expectedHmac)) return false;
    const data = JSON.parse(payload);
    return data.role === 'delivery_agent' && Number.isFinite(data.ts) && data.ts <= Date.now() && Date.now() - data.ts <= 12 * 60 * 60 * 1000; // 12h session
  } catch { return false; }
}

// ── Admin middleware (superadmin full access) ─────────────────────────────────
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });

  const isSuperAdmin = verifyAdminToken(token, '__SUPER_ADMIN__');
  if (isSuperAdmin) { req.adminRole = 'superadmin'; return next(); }

  Promise.resolve().then(() => db.getSettings()).then(settings => {
    const validPasscodes = getValidAdminPasscodes(settings);
    const isValid = validPasscodes.some(p => verifyAdminToken(token, p));
    if (!isValid) return res.status(401).json({ error: 'Unauthorized: Valid admin credentials required.' });
    req.adminRole = 'admin';
    next();
  }).catch(() => res.status(503).json({ error: 'Store database is unavailable.' }));
}

// ── Delivery Agent middleware ──────────────────────────────────────────────────
// Allows: superadmin (full) or delivery_agent (delivery ops only)
function requireDeliveryAgent(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Delivery agent authentication required.' });

  // Superadmin can access everything
  if (verifyAdminToken(token, '__SUPER_ADMIN__')) { req.adminRole = 'superadmin'; return next(); }

  Promise.resolve().then(() => db.getSettings()).then(settings => {
    // Check if it's a regular admin token
    const adminPasscodes = getValidAdminPasscodes(settings);
    if (adminPasscodes.some(p => verifyAdminToken(token, p))) { req.adminRole = 'admin'; return next(); }
    // Check if it's a delivery agent token
    const deliveryPasscode = getDeliveryAgentPasscode(settings);
    if (deliveryPasscode && verifyDeliveryToken(token, deliveryPasscode)) { req.adminRole = 'delivery_agent'; return next(); }
    return res.status(401).json({ error: 'Unauthorized: Valid credentials required.' });
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
    const settings = await db.getSettings();

    // ── Tier 1: Super Admin (configurable from Super Admin Studio or .env) ──
    if (superAdminId !== undefined || superAdminPassword !== undefined) {
      const superAdmin = getSuperAdminCredentials(settings);
      if (
        superAdmin.id && superAdmin.password &&
        superAdminId?.trim() === superAdmin.id &&
        superAdminPassword?.trim() === superAdmin.password
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
    const validPasscodes = getValidAdminPasscodes(settings);
    const provided = passcode?.trim();
    const matchedPasscode = validPasscodes.find(p => p === provided);
    if (!matchedPasscode) {
      return res.status(401).json({ success: false, message: 'Invalid Admin Passcode' });
    }
    const token = generateAdminToken(matchedPasscode);
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
  try {
    const { token } = req.body;
    if (!token) return res.json({ valid: false, role: null });
    const isSuperAdmin = verifyAdminToken(token, '__SUPER_ADMIN__');
    if (isSuperAdmin) return res.json({ valid: true, role: 'superadmin' });
    const settings = await db.getSettings();
    const validPasscodes = getValidAdminPasscodes(settings);
    const isAdmin = validPasscodes.some(p => verifyAdminToken(token, p));
    if (isAdmin) return res.json({ valid: true, role: 'admin' });
    // Check delivery agent
    const deliveryPasscode = getDeliveryAgentPasscode(settings);
    const isDelivery = Boolean(deliveryPasscode && verifyDeliveryToken(token, deliveryPasscode));
    res.json({ valid: isDelivery, role: isDelivery ? 'delivery_agent' : null });
  } catch {
    res.json({ valid: false, role: null });
  }
});

// ==========================================
// DELIVERY AGENT AUTHENTICATION API
// ==========================================
app.post('/api/delivery/login', loginLimit, async (req, res) => {
  try {
    const { passcode } = req.body;
    const settings = await db.getSettings();
    const deliveryPasscode = getDeliveryAgentPasscode(settings);
    const provided = String(passcode || '').trim();
    if (!provided || provided !== deliveryPasscode) {
      return res.status(401).json({ success: false, message: 'Invalid delivery agent passcode' });
    }
    const token = generateDeliveryToken(deliveryPasscode);
    res.json({
      success: true,
      token,
      role: 'delivery_agent',
      message: 'Delivery agent authenticated successfully'
    });
  } catch {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Delivery agent: get orders in their pipeline (shipped + out_for_delivery)
app.get('/api/delivery/orders', requireDeliveryAgent, async (req, res) => {
  try {
    const allOrders = await db.getOrders();
    // Superadmin and admin see all; delivery agent sees only actionable orders
    const deliveryStatuses = ['shipped', 'out_for_delivery', 'delivered'];
    const visible = req.adminRole === 'delivery_agent'
      ? allOrders.filter(o => deliveryStatuses.includes(o.status))
      : allOrders;
    res.json(visible);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve delivery orders' });
  }
});

// Delivery agent: update status — restricted to out_for_delivery and delivered only
app.patch('/api/delivery/orders/:id/status', requireDeliveryAgent, async (req, res) => {
  try {
    const rawStatus = String(req.body.status || '').trim().toLowerCase();
    const statusMap = {
      'out_for_delivery': 'out_for_delivery',
      'out for delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'deliver': 'delivered'
    };
    const status = statusMap[rawStatus];

    if (req.adminRole === 'delivery_agent' && !status) {
      return res.status(403).json({ error: 'Delivery agents can only update status to "out_for_delivery" or "delivered".' });
    }

    // Superadmin/admin: fall through to full status update
    const effectiveStatus = status || rawStatus;
    const allowedStatuses = ['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled'];
    if (!allowedStatuses.includes(effectiveStatus)) {
      return res.status(400).json({ error: `Invalid status: "${req.body.status}"` });
    }

    const { deliveryNotes, trackingNumber } = req.body;
    const updated = await db.updateOrderStatus(req.params.id, effectiveStatus, { deliveryNotes, trackingNumber });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update order status' });
  }
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
    const cleanEmail = email.trim().toLowerCase();
    const user = await db.createUser({ name: name.trim(), email: cleanEmail, password, phone, address, city, pincode });
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
    const cleanEmail = email.trim().toLowerCase();
    let user = await db.getUserByEmail(cleanEmail);
    let authenticated = false;

    if (user?.passwordHash) {
      authenticated = db.verifyPassword(password, user.passwordHash);
    }

    if (!authenticated && supabaseAuth) {
      try {
        const { data: supaData, error: supaErr } = await supabaseAuth.auth.signInWithPassword({ email: cleanEmail, password });
        if (!supaErr && supaData?.user) {
          authenticated = true;
          if (user) {
            try {
              await db.updateUser(user.id, { password });
            } catch {
              // ignore sync error
            }
          } else {
            user = await db.syncAuthUser({
              id: supaData.user.id,
              email: supaData.user.email,
              name: supaData.user.user_metadata?.name || supaData.user.email.split('@')[0] || 'Customer',
              phone: supaData.user.user_metadata?.phone || ''
            });
          }
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
    const contentType = {
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }[extension];

    // 1. Try Supabase Cloud Storage first (permanent CDN for production)
    if (supabaseAdmin) {
      try {
        const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'media';
        const { error: uploadError } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(filename, req.file.buffer, {
            contentType,
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
          if (isProduction) {
            console.error('Supabase storage upload failed:', uploadError.message);
            return res.status(502).json({ error: 'Image storage is temporarily unavailable.' });
          }
          console.warn('Supabase storage upload failed, falling back to local disk:', uploadError.message);
        }
      } catch (storageErr) {
        if (isProduction) {
          console.error('Supabase storage error:', storageErr);
          return res.status(502).json({ error: 'Image storage is temporarily unavailable.' });
        }
        console.warn('Supabase storage error, falling back to local disk:', storageErr?.message || storageErr);
      }
    }

    if (isProduction) {
      return res.status(503).json({ error: 'Persistent image storage is not configured.' });
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
    delete sanitized.superAdminPassword;
    delete sanitized.deliveryAgentPasscode;
    delete sanitized.payuMerchantKey;
    delete sanitized.payuMerchantSalt;
    sanitized.superAdminId = settings.superAdminId || process.env.SUPER_ADMIN_ID || '';
    sanitized.adminPasscodeConfigured = getValidAdminPasscodes(settings).length > 0;
    const superAdmin = getSuperAdminCredentials(settings);
    sanitized.superAdminConfigured = Boolean(superAdmin.id && superAdmin.password);
    sanitized.deliveryAgentPasscodeConfigured = Boolean(getDeliveryAgentPasscode(settings));
    sanitized.payuConfigured = Boolean(settings.payuMerchantKey && settings.payuMerchantSalt);
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
    const changes = { ...req.body };
    delete changes.razorpayKeySecretConfigured;
    delete changes.razorpayWebhookSecretConfigured;
    delete changes.adminPasscodeConfigured;
    delete changes.superAdminConfigured;

    const envUpdates = {};

    // 1. Studio Admin Passcode Update
    let newToken = null;
    if (changes.adminPasscode !== undefined) {
      const newPass = String(changes.adminPasscode || '').trim();
      if (newPass.length > 0) {
        const minimumLength = isProduction ? 12 : 6;
        if (newPass.length < minimumLength) {
          return res.status(400).json({ error: `Admin passcode must be at least ${minimumLength} characters.` });
        }
        changes.adminPasscode = newPass;
        envUpdates.ADMIN_PASSCODE = newPass;
        newToken = generateAdminToken(newPass);
      } else {
        delete changes.adminPasscode;
      }
    }

    // 2. Super Admin ID / Username Update
    if (changes.superAdminId !== undefined) {
      const newSuperId = String(changes.superAdminId || '').trim();
      if (newSuperId.length > 0) {
        changes.superAdminId = newSuperId;
        envUpdates.SUPER_ADMIN_ID = newSuperId;
      } else {
        delete changes.superAdminId;
      }
    }

    // 3. Super Admin Password Update
    if (changes.superAdminPassword !== undefined) {
      const newSuperPass = String(changes.superAdminPassword || '').trim();
      if (newSuperPass.length > 0) {
        const minimumLength = isProduction ? 12 : 6;
        if (newSuperPass.length < minimumLength) {
          return res.status(400).json({ error: `Super Admin password must be at least ${minimumLength} characters.` });
        }
        changes.superAdminPassword = newSuperPass;
        envUpdates.SUPER_ADMIN_PASSWORD = newSuperPass;
      } else {
        delete changes.superAdminPassword;
      }
    }

    // 4. Delivery Agent Passcode Update
    if (changes.deliveryAgentPasscode !== undefined) {
      const newDeliveryPass = String(changes.deliveryAgentPasscode || '').trim();
      if (newDeliveryPass.length > 0) {
        const minimumLength = isProduction ? 12 : 6;
        if (newDeliveryPass.length < minimumLength) {
          return res.status(400).json({ error: `Delivery agent passcode must be at least ${minimumLength} characters.` });
        }
        changes.deliveryAgentPasscode = newDeliveryPass;
        envUpdates.DELIVERY_AGENT_PASSCODE = newDeliveryPass;
      } else {
        delete changes.deliveryAgentPasscode;
      }
    }

    // Write to codebase .env file and process.env immediately
    if (Object.keys(envUpdates).length > 0) {
      updateEnvFile(envUpdates);
    }

    const current = await db.getSettings();
    const next = { ...current, ...changes };
    if (changes.paymentRazorpayEnabled && (!(next.razorpayKeyId || process.env.RAZORPAY_KEY_ID) || !(next.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET))) {
      return res.status(400).json({ error: 'Add both Razorpay Key ID and Key Secret before enabling Razorpay.' });
    }
    if (next.paymentUpiEnabled !== false && (
      changes.paymentUpiEnabled === true ||
      changes.upiId !== undefined ||
      changes.upiPayeeName !== undefined
    )) {
      const upiId = String(next.upiId || '').trim();
      const isValidUpiVpa = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(upiId);
      if (!isValidUpiVpa || !String(next.upiPayeeName || '').trim()) {
        return res.status(400).json({ error: 'Add a valid UPI ID/VPA and payee name before enabling UPI. Razorpay payment links are not UPI IDs.' });
      }
      changes.upiId = upiId;
    }
    const updated = await db.updateSettings(changes);
    const sanitized = { ...updated };
    delete sanitized.adminPasscode;
    delete sanitized.superAdminPassword;
    delete sanitized.deliveryAgentPasscode;
    delete sanitized.payuMerchantKey;
    delete sanitized.payuMerchantSalt;
    sanitized.superAdminId = updated.superAdminId || process.env.SUPER_ADMIN_ID || '';
    sanitized.adminPasscodeConfigured = getValidAdminPasscodes(updated).length > 0;
    const superAdmin = getSuperAdminCredentials(updated);
    sanitized.superAdminConfigured = Boolean(superAdmin.id && superAdmin.password);
    sanitized.deliveryAgentPasscodeConfigured = Boolean(getDeliveryAgentPasscode(updated));
    sanitized.payuConfigured = Boolean(updated.payuMerchantKey && updated.payuMerchantSalt);
    if (newToken) sanitized.newToken = newToken;

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
    console.error('Update settings error:', err);
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
    const { trackingNumber, paymentStatus, courierPartner, cancelReason, deliveryNotes } = req.body;
    const rawStatus = String(req.body.status || '').trim().toLowerCase();
    const statusMap = {
      'cancel': 'cancelled',
      'canceled': 'cancelled',
      'cancelled': 'cancelled',
      'confirm': 'confirmed',
      'confirmed': 'confirmed',
      'in crafting': 'processing',
      'processing': 'processing',
      'crafting': 'processing',
      'ship': 'shipped',
      'shipped': 'shipped',
      'out for delivery': 'out_for_delivery',
      'out_for_delivery': 'out_for_delivery',
      'deliver': 'delivered',
      'delivered': 'delivered',
      'pending': 'pending'
    };
    const status = statusMap[rawStatus] || rawStatus;
    const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid order status: "${req.body.status}". Allowed: ${allowedStatuses.join(', ')}` });
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

app.post('/api/orders/:id/cancel', requireAdmin, async (req, res) => {
  try {
    const { cancelReason } = req.body || {};
    const updated = await db.cancelOrder(req.params.id, cancelReason);
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    console.error('Failed to cancel order:', err);
    res.status(500).json({ error: err.message || 'Failed to cancel order' });
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
