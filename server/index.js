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
import { IMAGE_UPLOAD_PURPOSES, containsImageReference, getManagedImageObjectKey } from './image-storage.js';
import {
  calculateDeliveryQuote,
  validateDeliveryDistancePricing
} from './delivery-pricing.js';
import {
  createPayuRequestHash,
  createPayuVerifyHash,
  decryptPayuSecret,
  encryptPayuSecret,
  formatPayuAmount,
  verifyPayuResponseHash
} from './payu.js';
import { isOrderNotificationConfigured, sendNewOrderNotification } from './order-notifications.js';

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
const getPayuCredentials = settings => {
  if (settings.payuCredentialsCleared) return { key: '', salt: '' };
  return {
    key: decryptPayuSecret(settings.payuMerchantKeyEncrypted || settings.payuMerchantKey || process.env.PAYU_MERCHANT_KEY || '').trim(),
    salt: decryptPayuSecret(settings.payuMerchantSaltEncrypted || settings.payuMerchantSalt || process.env.PAYU_MERCHANT_SALT || '').trim()
  };
};
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
const PAYMENT_PROOFS_DIR = path.join(__dirname, 'payment-proofs');
if (!fs.existsSync(PAYMENT_PROOFS_DIR)) {
  fs.mkdirSync(PAYMENT_PROOFS_DIR, { recursive: true });
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
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
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
const deliveryQuoteLimit = rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'delivery-quote' });

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

function createOrderPolicyConsent(body, settings, paymentMethod) {
  if (body?.policyConsent?.accepted !== true) {
    return { error: 'Please agree to the store policies before placing your order.', statusCode: 400 };
  }

  const policyVersion = Math.max(1, Number(settings.storePolicyVersion) || 1);
  if (Number(body.policyConsent.policyVersion) !== policyVersion) {
    return { error: 'Store policies changed during checkout. Review and accept the current policies before continuing.', statusCode: 409 };
  }

  if (paymentMethod === 'upi' && body.upiPaymentAttested !== true) {
    return { error: 'Confirm your UPI payment details are accurate before submitting.', statusCode: 400 };
  }

  const activePolicies = settings.storePolicies || DEFAULT_SETTINGS.storePolicies;
  const policySnapshot = {
    termsAndConditions: String(activePolicies.termsAndConditions || '').trim(),
    refundReturnPolicy: String(activePolicies.refundReturnPolicy || '').trim(),
    privacyPolicy: String(activePolicies.privacyPolicy || '').trim(),
    shippingPolicy: String(activePolicies.shippingPolicy || '').trim()
  };
  if (Object.values(policySnapshot).some(policy => !policy)) {
    return { error: 'Store policies are not configured. Please contact the store before ordering.', statusCode: 503 };
  }

  const acceptedAt = new Date().toISOString();
  const snapshotText = policy => policy
    .replaceAll('{{freeShippingThreshold}}', `${settings.currency || '₹'}${Number(settings.freeShippingThreshold ?? DEFAULT_SETTINGS.freeShippingThreshold)}`)
    .replaceAll('{{contactEmail}}', settings.contactEmail || DEFAULT_SETTINGS.contactEmail);

  return {
    value: {
      policyVersion,
      acceptedAt,
      policySnapshot: Object.fromEntries(Object.entries(policySnapshot).map(([key, policy]) => [key, snapshotText(policy)])),
      ...(paymentMethod === 'upi' ? { upiPaymentAttestedAt: acceptedAt } : {})
    }
  };
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
    let supaData;
    let supaError;
    try {
      ({ data: supaData, error: supaError } = await supabaseAuth.auth.getUser(token));
    } catch (error) {
      console.error('Could not verify the Supabase customer session:', error);
      return res.status(503).json({ error: 'Could not verify your sign-in right now. Please try again.' });
    }

    if (supaError || !supaData?.user) return res.status(401).json({ error: 'Your sign-in has expired. Please sign in again.' });

    const supaUser = supaData.user;
    const email = String(supaUser.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(403).json({ error: 'An email address is needed for orders and account recovery. Allow email access or use email sign-in.' });
    }

    try {
      let user = await db.getUserByEmail(email);
      if (user) {
        delete user.passwordHash;
      } else {
        user = await db.syncAuthUser({
          id: supaUser.id,
          email,
          name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || supaUser.user_metadata?.user_name || '',
          phone: supaUser.user_metadata?.phone || ''
        });
      }
      if (!user) throw new Error('AUTH_PROFILE_SYNC_EMPTY');
      req.user = user;
      return next();
    } catch (error) {
      console.error('Could not sync the authenticated customer profile:', error);
      return res.status(503).json({ error: 'Your sign-in worked, but we could not save your customer profile. Please retry shortly.' });
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
app.get('/api/health', async (_req, res) => {
  try {
    await db.getSettings();
    res.json({
      status: 'ok',
      service: 'Cozy Loops E-Commerce Production Engine',
      database: process.env.SUPABASE_DB_URL ? 'Supabase PostgreSQL' : 'SQLite 3 (WAL mode)',
      customerAuth: supabaseAuth ? 'Supabase Auth' : 'Legacy app authentication',
      distanceDeliveryQuotes: true,
      orderEmailNotifications: isOrderNotificationConfigured(),
      time: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health check database error:', err);
    res.status(503).json({ status: 'error', error: 'Store database is unavailable.' });
  }
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
              name: supaData.user.user_metadata?.full_name || supaData.user.user_metadata?.name || supaData.user.email.split('@')[0] || 'Customer',
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
const imageContentTypes = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

function uploadError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function storePublicImage(file) {
  const extension = getImageExtension(file.buffer);
  if (!extension) throw uploadError(400, 'Unsupported or invalid image file.');
  const filename = `crochet_${crypto.randomUUID()}${extension}`;
  const contentType = imageContentTypes[extension];

  if (supabaseAdmin) {
    try {
      const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'media';
      const { data: bucket, error: bucketError } = await supabaseAdmin.storage.getBucket(bucketName);
      if (bucketError || !bucket?.public) {
        const message = bucketError
          ? `Unable to verify Supabase image bucket "${bucketName}": ${bucketError.message}`
          : `Supabase image bucket "${bucketName}" must be public.`;
        if (isProduction) {
          console.error(message);
          throw uploadError(503, bucketError
            ? 'Persistent image storage is not configured.'
            : 'Image storage is not publicly readable. Please contact the store administrator.');
        }
        console.warn(message);
      } else {
        const { error: uploadErrorResult } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(filename, file.buffer, { contentType, upsert: true });
        if (!uploadErrorResult) {
          const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filename);
          try {
            const publicUrl = new URL(urlData?.publicUrl);
            const expectedPath = `/storage/v1/object/public/${bucketName}/`;
            if (publicUrl.protocol === 'https:' && publicUrl.pathname.startsWith(expectedPath)) {
              return { url: publicUrl.toString(), filename, size: file.size, storage: 'supabase' };
            }
          } catch {
            // Invalid URLs fall through to the existing development-only disk fallback.
          }
          if (isProduction) {
            throw uploadError(502, 'Image storage did not return a public URL.');
          }
          console.warn('Supabase storage returned an invalid public image URL.');
        } else if (isProduction) {
          console.error('Supabase storage upload failed:', uploadErrorResult.message);
          throw uploadError(502, 'Image storage is temporarily unavailable.');
        } else {
          console.warn('Supabase storage upload failed, falling back to local disk:', uploadErrorResult.message);
        }
      }
    } catch (error) {
      if (error.statusCode) throw error;
      if (isProduction) {
        console.error('Supabase storage error:', error);
        throw uploadError(502, 'Image storage is temporarily unavailable.');
      }
      console.warn('Supabase storage error, falling back to local disk:', error?.message || error);
    }
  }

  if (isProduction) throw uploadError(503, 'Persistent image storage is not configured.');
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer, { flag: 'wx' });
  return { url: `/uploads/${filename}`, filename, size: file.size, storage: 'local' };
}

async function isImageReferenced(imageUrl) {
  const [settings, products, offers, orders] = await Promise.all([
    db.getSettings(),
    db.getProducts(),
    db.getOffers(),
    db.getOrders()
  ]);
  return [settings, ...products, ...offers, ...orders].some(record => containsImageReference(record, imageUrl));
}

function imageUploadMiddleware(req, res, next) {
  upload.single('image')(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image files must be 5 MB or smaller.' });
    }
    return res.status(400).json({ error: error.message || 'Could not read the image file.' });
  });
}

async function storePrivatePaymentProof(file) {
  const extension = getImageExtension(file.buffer);
  if (!extension) throw uploadError(400, 'Unsupported or invalid image file.');
  const filename = `upi_${crypto.randomUUID()}${extension}`;
  const contentType = imageContentTypes[extension];

  if (supabaseAdmin) {
    try {
      const bucketName = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET || 'payment-proofs';
      const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(filename, file.buffer, { contentType, upsert: false });
      if (error) {
        if (isProduction) {
          console.error('Private payment proof storage upload failed:', error.message);
          throw uploadError(502, 'Payment screenshot storage is temporarily unavailable.');
        }
        console.warn('Private payment proof storage failed, falling back to local disk:', error.message);
      } else {
        return { key: filename, storage: 'supabase' };
      }
    } catch (error) {
      if (error.statusCode) throw error;
      if (isProduction) {
        console.error('Private payment proof storage error:', error);
        throw uploadError(502, 'Payment screenshot storage is temporarily unavailable.');
      }
      console.warn('Private payment proof storage error, falling back to local disk:', error?.message || error);
    }
  }

  if (isProduction) throw uploadError(503, 'Private payment proof storage is not configured.');
  fs.writeFileSync(path.join(PAYMENT_PROOFS_DIR, filename), file.buffer, { flag: 'wx' });
  return { key: filename, storage: 'local' };
}

function isStoredImageUrl(value) {
  const imageUrl = String(value || '').trim();
  if (/^\/uploads\/[A-Za-z0-9_-]+\.(?:jpe?g|png|gif|webp)$/i.test(imageUrl)) return true;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === 'https:' && /\.(?:jpe?g|png|gif|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

app.post('/api/upload', requireAdmin, uploadLimit, imageUploadMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const purpose = String(req.body?.purpose || '');
    const uploadRule = Object.hasOwn(IMAGE_UPLOAD_PURPOSES, purpose) ? IMAGE_UPLOAD_PURPOSES[purpose] : null;
    if (!uploadRule) {
      return res.status(400).json({ error: 'Choose a valid image type before uploading.' });
    }
    if (req.file.size > uploadRule.maxBytes) {
      return res.status(413).json({
        error: `${uploadRule.label} must be ${uploadRule.maxBytes === 300 * 1024 ? '300 KB' : `${uploadRule.maxBytes / (1024 * 1024)} MB`} or smaller.`
      });
    }
    const stored = await storePublicImage(req.file);
    res.json({ success: true, ...stored });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to upload image' });
  }
});

app.delete('/api/images', requireAdmin, async (req, res) => {
  try {
    const imageUrl = String(req.body?.url || '');
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'media';
    const objectKey = getManagedImageObjectKey(imageUrl, process.env.SUPABASE_URL, bucketName);
    const localMatch = !isProduction && /^\/uploads\/(crochet_[a-f0-9-]+\.(?:jpg|png|gif|webp))$/i.exec(imageUrl);
    if (!objectKey && !localMatch) {
      return res.json({ deleted: false, managed: false, referenced: false });
    }
    if (await isImageReferenced(imageUrl)) {
      return res.json({ deleted: false, managed: true, referenced: true });
    }
    if (localMatch) {
      try {
        await fs.promises.unlink(path.join(UPLOADS_DIR, localMatch[1]));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      return res.json({ deleted: true, managed: true, referenced: false });
    }
    if (!supabaseAdmin) {
      return res.json({ deleted: false, managed: false, referenced: false });
    }
    const { error } = await supabaseAdmin.storage.from(bucketName).remove([objectKey]);
    if (error) {
      console.error('Could not remove an unused public image:', error.message);
      return res.status(502).json({ error: 'The image is no longer referenced, but storage cleanup failed.' });
    }
    res.json({ deleted: true, managed: true, referenced: false });
  } catch (error) {
    console.error('Image cleanup failed:', error);
    res.status(500).json({ error: 'Could not safely clean up the unused image.' });
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
    delete sanitized.payuMerchantKeyEncrypted;
    delete sanitized.payuMerchantSaltEncrypted;
    delete sanitized.payuCredentialsCleared;
    sanitized.superAdminId = settings.superAdminId || process.env.SUPER_ADMIN_ID || '';
    sanitized.adminPasscodeConfigured = getValidAdminPasscodes(settings).length > 0;
    const superAdmin = getSuperAdminCredentials(settings);
    sanitized.superAdminConfigured = Boolean(superAdmin.id && superAdmin.password);
    sanitized.deliveryAgentPasscodeConfigured = Boolean(getDeliveryAgentPasscode(settings));
    const { key: payuKey, salt: payuSalt } = getPayuCredentials(settings);
    sanitized.payuConfigured = Boolean(payuKey && payuSalt);
    sanitized.paymentPayuEnabled = sanitized.payuConfigured && settings.paymentPayuEnabled === true;
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

app.get('/api/delivery/quote', deliveryQuoteLimit, async (req, res) => {
  const pincode = String(req.query.pincode || '');
  const subtotal = Number(req.query.subtotal);
  if (!/^[1-9]\d{5}$/.test(pincode) || !Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ error: 'A valid Indian pincode and non-negative subtotal are required.' });
  }
  try {
    const settings = await db.getSettings();
    res.json(calculateDeliveryQuote(settings, pincode, subtotal));
  } catch (err) {
    console.error('Delivery quote error:', err);
    res.status(500).json({ error: 'Could not calculate the delivery charge.' });
  }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    const changes = { ...req.body };
    delete changes.razorpayKeySecretConfigured;
    delete changes.razorpayWebhookSecretConfigured;
    delete changes.adminPasscodeConfigured;
    delete changes.superAdminConfigured;
    delete changes.payuConfigured;

    const envUpdates = {};
    const clearPayuCredentials = changes.clearPayuCredentials === true;
    delete changes.clearPayuCredentials;
    const newPayuKey = String(changes.payuMerchantKey || '').trim();
    const newPayuSalt = String(changes.payuMerchantSalt || '').trim();
    if (newPayuKey.length > 256 || newPayuSalt.length > 256 || /[\r\n]/.test(newPayuKey) || /[\r\n]/.test(newPayuSalt)) {
      return res.status(400).json({ error: 'PayU Merchant Key and Salt must be valid values no longer than 256 characters.' });
    }
    delete changes.payuMerchantKey;
    delete changes.payuMerchantSalt;
    if (newPayuKey) changes.payuMerchantKeyEncrypted = encryptPayuSecret(newPayuKey);
    if (newPayuSalt) changes.payuMerchantSaltEncrypted = encryptPayuSecret(newPayuSalt);
    if (newPayuKey || newPayuSalt) changes.payuCredentialsCleared = false;
    if (clearPayuCredentials) {
      changes.payuMerchantKeyEncrypted = '';
      changes.payuMerchantSaltEncrypted = '';
      changes.payuMerchantKey = '';
      changes.payuMerchantSalt = '';
      changes.payuCredentialsCleared = true;
    }
    if (changes.deliveryDistancePricing !== undefined) {
      const distancePricingError = validateDeliveryDistancePricing(changes.deliveryDistancePricing);
      if (distancePricingError) return res.status(400).json({ error: distancePricingError });
    }

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
    const payuCredentials = getPayuCredentials(next);
    const payuKey = payuCredentials.key.trim();
    const payuSalt = payuCredentials.salt.trim();
    if (changes.paymentPayuEnabled === true && (!payuKey || !payuSalt)) {
      return res.status(400).json({ error: 'Add both PayU Merchant Key and Salt before enabling PayU.' });
    }
    if (changes.paymentPayuEnabled !== undefined && typeof changes.paymentPayuEnabled !== 'boolean') {
      return res.status(400).json({ error: 'PayU must be enabled or disabled using a boolean setting.' });
    }
    if (changes.payuTestMode !== undefined && typeof changes.payuTestMode !== 'boolean') {
      return res.status(400).json({ error: 'PayU mode must be either test or live.' });
    }
    if (!clearPayuCredentials && next.payuMerchantKey) {
      if (!next.payuMerchantKeyEncrypted) changes.payuMerchantKeyEncrypted = encryptPayuSecret(next.payuMerchantKey);
      changes.payuMerchantKey = '';
    }
    if (!clearPayuCredentials && next.payuMerchantSalt) {
      if (!next.payuMerchantSaltEncrypted) changes.payuMerchantSaltEncrypted = encryptPayuSecret(next.payuMerchantSalt);
      changes.payuMerchantSalt = '';
    }
    if (changes.paymentRazorpayEnabled && (!(next.razorpayKeyId || process.env.RAZORPAY_KEY_ID) || !(next.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET))) {
      return res.status(400).json({ error: 'Add both Razorpay Key ID and Key Secret before enabling Razorpay.' });
    }
    if (next.paymentUpiEnabled !== false && (
      changes.paymentUpiEnabled === true ||
      changes.upiId !== undefined ||
      changes.upiPayeeName !== undefined ||
      changes.upiQrImage !== undefined
    )) {
      const upiId = String(next.upiId || '').trim();
      const isValidUpiVpa = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(upiId);
      if (!isValidUpiVpa) {
        return res.status(400).json({ error: 'Add a valid UPI ID/VPA before enabling UPI. Razorpay payment links are not UPI IDs.' });
      }
      if (!isStoredImageUrl(next.upiQrImage)) {
        return res.status(400).json({ error: 'Upload a valid UPI QR image before enabling Direct UPI.' });
      }
      changes.upiId = upiId;
    }
    if (changes.codRules !== undefined) {
      if (!Array.isArray(changes.codRules) || changes.codRules.length > 100) {
        return res.status(400).json({ error: 'Cash on Delivery rules must be a list of at most 100 rules.' });
      }
      for (const rule of changes.codRules) {
        const category = String(rule?.category || '').trim();
        const hasMin = rule?.minPrice !== undefined && rule.minPrice !== '';
        const hasMax = rule?.maxPrice !== undefined && rule.maxPrice !== '';
        const minPrice = hasMin ? Number(rule.minPrice) : undefined;
        const maxPrice = hasMax ? Number(rule.maxPrice) : undefined;
        if (
          !rule?.id ||
          !['enabled', 'disabled'].includes(rule.availability) ||
          (!category && !hasMin && !hasMax) ||
          (hasMin && (!Number.isFinite(minPrice) || minPrice < 0)) ||
          (hasMax && (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
          (hasMin && hasMax && minPrice > maxPrice)
        ) {
          return res.status(400).json({ error: 'Each Cash on Delivery rule needs a category or price range, a valid status, and a valid price range.' });
        }
      }
      changes.codRules = changes.codRules.map(rule => ({
        id: String(rule.id),
        category: String(rule.category || '').trim() || undefined,
        minPrice: rule.minPrice === undefined || rule.minPrice === '' ? undefined : Number(rule.minPrice),
        maxPrice: rule.maxPrice === undefined || rule.maxPrice === '' ? undefined : Number(rule.maxPrice),
        availability: rule.availability
      }));
    }
    const updated = await db.updateSettings(changes);
    const sanitized = { ...updated };
    delete sanitized.adminPasscode;
    delete sanitized.superAdminPassword;
    delete sanitized.deliveryAgentPasscode;
    delete sanitized.payuMerchantKey;
    delete sanitized.payuMerchantSalt;
    delete sanitized.payuMerchantKeyEncrypted;
    delete sanitized.payuMerchantSaltEncrypted;
    delete sanitized.payuCredentialsCleared;
    sanitized.superAdminId = updated.superAdminId || process.env.SUPER_ADMIN_ID || '';
    sanitized.adminPasscodeConfigured = getValidAdminPasscodes(updated).length > 0;
    const superAdmin = getSuperAdminCredentials(updated);
    sanitized.superAdminConfigured = Boolean(superAdmin.id && superAdmin.password);
    sanitized.deliveryAgentPasscodeConfigured = Boolean(getDeliveryAgentPasscode(updated));
    const updatedPayuCredentials = getPayuCredentials(updated);
    const updatedPayuKey = updatedPayuCredentials.key.trim();
    const updatedPayuSalt = updatedPayuCredentials.salt.trim();
    sanitized.payuConfigured = Boolean(updatedPayuKey && updatedPayuSalt);
    sanitized.paymentPayuEnabled = sanitized.payuConfigured && updated.paymentPayuEnabled === true;
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
    if (err.message?.startsWith('Set PAYU_CREDENTIALS_ENCRYPTION_KEY') || err.message?.startsWith('PAYU_CREDENTIALS_ENCRYPTION_KEY or JWT_SECRET')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==========================================
// PRODUCTS API
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
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
    res.setHeader('Cache-Control', 'no-store');
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
    const publicOrder = { ...order, customer: publicCustomer };
    delete publicOrder.paymentProofKey;
    delete publicOrder.paymentProofStorage;
    res.json([publicOrder]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to track order' });
  }
});

app.post('/api/orders', orderLimit, requireUser, async (req, res) => {
  try {
    const settings = await db.getSettings();
    const method = req.body?.paymentMethod || 'cod';
    const consent = createOrderPolicyConsent(req.body, settings, method);
    if (consent.error) return res.status(consent.statusCode).json({ error: consent.error });
    if (method === 'upi') {
      const upiId = String(settings.upiId || '').trim();
      const isValidUpiVpa = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(upiId);
      if (settings.paymentUpiEnabled === false || !isValidUpiVpa || !isStoredImageUrl(settings.upiQrImage)) {
        return res.status(400).json({ error: 'Direct UPI payments are not configured yet.' });
      }
      const upiRefNumber = String(req.body?.upiRefNumber || '').trim();
      if (!upiRefNumber || upiRefNumber.length > 24) {
        return res.status(400).json({ error: 'Enter your UPI transaction reference / UTR number.' });
      }
    }
    if (method === 'cod' && settings.paymentCodEnabled === false) return res.status(400).json({ error: 'Cash on Delivery is currently unavailable.' });
    if (method === 'payu') return res.status(400).json({ error: 'Use the PayU checkout endpoint to start a PayU payment.' });
    const rzpKeyId = (settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
    const rzpKeySecret = (settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();
    const isRazorpayConfigured = Boolean(rzpKeyId && rzpKeySecret);
    const isRazorpayActive = isRazorpayConfigured && settings.paymentRazorpayEnabled !== false;

    if (method === 'razorpay' && !isRazorpayActive) {
      return res.status(400).json({ error: 'Razorpay online payment is currently unavailable. Please choose UPI QR or Cash on Delivery.' });
    }
    const customer = req.body?.customer || {};
    const newOrder = await db.createOrder({
      ...req.body,
      policyConsent: consent.value,
      customer: {
        ...customer,
        name: String(customer.name || req.user.name || '').trim(),
        email: req.user.email,
        phone: String(customer.phone || req.user.phone || '').trim()
      }
    });
    void sendNewOrderNotification(newOrder, settings.currency);
    res.status(201).json(newOrder);
  } catch (err) {
    const clientErrors = ['INVALID_CUSTOMER', 'EMPTY_ORDER', 'INVALID_QUANTITY', 'PRODUCT_NOT_FOUND', 'INSUFFICIENT_STOCK', 'INVALID_PROMO', 'INVALID_PAYMENT_METHOD', 'COD_NOT_AVAILABLE_FOR_ITEMS'];
    if (clientErrors.includes(err.message)) return res.status(400).json({ error: err.message });
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/api/orders/:id/payment-proof', requireUser, uploadLimit, upload.single('image'), async (req, res) => {
  let uploadedProof;
  try {
    if (!req.file) return res.status(400).json({ error: 'No payment screenshot was uploaded.' });
    const order = await db.getOrderById(req.params.id);
    if (!order || order.customer?.email?.toLowerCase() !== req.user.email?.toLowerCase()) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.paymentMethod !== 'upi' || order.paymentStatus !== 'pending' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'A screenshot can only be added to a pending Direct UPI order.' });
    }

    uploadedProof = await storePrivatePaymentProof(req.file);
    const updated = await db.updateOrderStatus(order.id, order.status, {
      paymentProofKey: uploadedProof.key,
      paymentProofStorage: uploadedProof.storage
    });
    if (!updated) return res.status(404).json({ error: 'Order not found.' });
    res.json(updated);
  } catch (error) {
    console.error('UPI payment proof upload failed:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to upload payment screenshot.' });
  }
});

app.get('/api/orders/:id/payment-proof', requireAdmin, async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order?.paymentProofKey || !order.paymentProofStorage) {
      return res.status(404).json({ error: 'No payment screenshot is attached to this order.' });
    }
    const filename = path.basename(order.paymentProofKey);
    if (filename !== order.paymentProofKey || !/^upi_[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(filename)) {
      return res.status(404).json({ error: 'Payment screenshot was not found.' });
    }
    const contentType = imageContentTypes[path.extname(filename)];
    let imageBuffer;
    if (order.paymentProofStorage === 'supabase') {
      if (!supabaseAdmin) return res.status(503).json({ error: 'Private payment proof storage is unavailable.' });
      const bucketName = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET || 'payment-proofs';
      const { data, error } = await supabaseAdmin.storage.from(bucketName).createSignedUrl(filename, 60);
      if (error || !data?.signedUrl) {
        console.error('Could not create private payment proof download URL:', error?.message || 'No signed URL returned.');
        return res.status(502).json({ error: 'Payment screenshot is temporarily unavailable.' });
      }
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        console.error('Could not retrieve private payment proof:', response.status);
        return res.status(502).json({ error: 'Payment screenshot is temporarily unavailable.' });
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else if (order.paymentProofStorage === 'local') {
      imageBuffer = fs.readFileSync(path.join(PAYMENT_PROOFS_DIR, filename));
    } else {
      return res.status(404).json({ error: 'Payment screenshot was not found.' });
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline; filename="upi-payment-proof"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(imageBuffer);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'Payment screenshot was not found.' });
    console.error('Could not load UPI payment proof:', error);
    res.status(500).json({ error: 'Failed to load payment screenshot.' });
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
// PAYMENT GATEWAYS API: PAYU, RAZORPAY & UPI
// ==========================================
app.post('/api/payments/payu/create-order', paymentLimit, requireUser, async (req, res) => {
  let storeOrder;
  try {
    const settings = await db.getSettings();
    const consent = createOrderPolicyConsent(req.body, settings, 'payu');
    if (consent.error) return res.status(consent.statusCode).json({ error: consent.error });
    const { key, salt } = getPayuCredentials(settings);
    if (!key || !salt || settings.paymentPayuEnabled !== true) {
      return res.status(400).json({ error: 'PayU is not configured and enabled in Studio Settings.' });
    }
    const phoneDigits = String(req.body?.customer?.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({ error: 'Enter a valid mobile number with 10 to 15 digits for PayU checkout.' });
    }

    const callbackBase = process.env.PAYU_CALLBACK_BASE_URL || process.env.PUBLIC_API_URL ||
      process.env.RENDER_EXTERNAL_URL || (!isProduction ? `${req.protocol}://${req.get('host')}` : '');
    if (!callbackBase) {
      return res.status(503).json({ error: 'Configure PAYU_CALLBACK_BASE_URL with this backend’s public HTTPS URL before accepting PayU payments.' });
    }
    let callbackOrigin;
    try {
      const parsedBase = new URL(callbackBase);
      if (isProduction && parsedBase.protocol !== 'https:') throw new Error('HTTPS required');
      if (parsedBase.username || parsedBase.password) throw new Error('Credentials are not allowed');
      callbackOrigin = parsedBase.origin;
    } catch {
      return res.status(503).json({ error: 'PAYU_CALLBACK_BASE_URL must be a valid public HTTPS URL.' });
    }

    const customer = req.body?.customer || {};
    storeOrder = await db.createOrder({
      ...req.body,
      policyConsent: consent.value,
      customer: {
        ...customer,
        name: String(customer.name || req.user.name || '').trim(),
        email: req.user.email,
        phone: String(customer.phone || req.user.phone || '').trim()
      },
      paymentMethod: 'payu',
      status: 'pending'
    });
    const transactionId = `D${crypto.randomBytes(12).toString('hex')}`;
    await db.linkPayuTransaction(storeOrder.id, transactionId);
    void sendNewOrderNotification(storeOrder, settings.currency);
    const amount = formatPayuAmount(storeOrder.total);
    const productinfo = `Store order ${storeOrder.id}`.slice(0, 100);
    const firstname = String(storeOrder.customer.name).trim().slice(0, 60);
    const email = String(storeOrder.customer.email).trim().slice(0, 255);
    const udf1 = storeOrder.id;
    const fields = {
      key,
      txnid: transactionId,
      amount,
      productinfo,
      firstname,
      email,
      phone: String(storeOrder.customer.phone || '').replace(/\D/g, '').slice(0, 15),
      udf1,
      surl: `${callbackOrigin}/api/payments/payu/callback`,
      furl: `${callbackOrigin}/api/payments/payu/callback`
    };
    fields.hash = createPayuRequestHash({ ...fields, salt });
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      success: true,
      orderId: storeOrder.id,
      checkoutUrl: settings.payuTestMode === false
        ? 'https://secure.payu.in/_payment'
        : 'https://test.payu.in/_payment',
      fields
    });
  } catch (err) {
    if (storeOrder) {
      try {
        await db.cancelOrder(storeOrder.id, 'PayU checkout could not be initialized');
      } catch (cancelError) {
        console.error('PayU checkout order cleanup failed:', cancelError);
      }
    }
    const clientErrors = ['INVALID_CUSTOMER', 'EMPTY_ORDER', 'INVALID_QUANTITY', 'PRODUCT_NOT_FOUND', 'INSUFFICIENT_STOCK', 'INVALID_PROMO', 'INVALID_PAYMENT_METHOD'];
    if (clientErrors.includes(err.message)) return res.status(400).json({ error: err.message });
    console.error('PayU order creation error:', err);
    res.status(500).json({ error: 'Failed to initialize PayU checkout.' });
  }
});

app.post('/api/payments/payu/callback', async (req, res) => {
  const renderResult = (success, title, message, orderId = '') => {
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    const storeUrl = allowedOrigins[0] || process.env.PUBLIC_APP_URL || (!isProduction ? 'http://localhost:5173' : '/');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).type('html').send(`<!doctype html>
      <html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(title)}</title>
      <body style="margin:0;background:#faf7f2;font:16px system-ui,sans-serif;color:#29231f;display:grid;min-height:100vh;place-items:center">
        <main style="box-sizing:border-box;width:min(92vw,480px);padding:32px 24px;text-align:center;background:white;border:1px solid #eee4dc;border-radius:20px">
          <div style="font-size:48px;color:${success ? '#16803c' : '#b45309'}">${success ? '✓' : '!'}</div>
          <h1 style="font-size:24px">${escapeHtml(title)}</h1>
          <p style="color:#665d57;line-height:1.6">${escapeHtml(message)}</p>
          ${orderId ? `<p>Order reference: <strong>${escapeHtml(orderId)}</strong></p>` : ''}
          <a href="${escapeHtml(storeUrl)}" style="display:inline-block;margin-top:12px;padding:12px 20px;border-radius:999px;background:#c85a32;color:#fff;text-decoration:none;font-weight:700">Return to store</a>
        </main>
      </body></html>`);
  };

  try {
    const response = req.body || {};
    const settings = await db.getSettings();
    const { key, salt } = getPayuCredentials(settings);
    if (!key || !salt || String(response.key || '') !== key || !verifyPayuResponseHash(response, salt)) {
      return res.status(401).send('Invalid PayU payment response.');
    }

    const order = await db.getOrderByPayuTransactionId(String(response.txnid || ''));
    if (!order || order.id !== String(response.udf1 || '') || order.paymentMethod !== 'payu') {
      return res.status(400).send('Payment response does not match an order.');
    }
    if (order.paymentStatus === 'paid') {
      return renderResult(true, 'Payment received', 'Your payment is verified and your order is being prepared.', order.id);
    }
    if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
      return renderResult(false, 'Payment not completed', 'This order is no longer awaiting payment.', order.id);
    }
    const expectedAmount = formatPayuAmount(order.total);
    if (formatPayuAmount(response.amount) !== expectedAmount) {
      return res.status(400).send('Payment amount does not match the order.');
    }

    const callbackStatus = String(response.status || '').toLowerCase();
    if (callbackStatus !== 'success') {
      if (['failure', 'failed'].includes(callbackStatus)) {
        await db.cancelOrder(order.id, 'PayU payment failed');
        return renderResult(false, 'Payment was not completed', 'No payment was confirmed. The reserved items have been released; you can place the order again.', order.id);
      }
      return renderResult(false, 'Payment is being checked', 'PayU has not confirmed this payment yet. Return to the store to check the latest order status. Please wait a few minutes before trying payment again; if it is still pending after 3 minutes, contact the store with your order reference.', order.id);
    }

    const verifyUrl = settings.payuTestMode === false
      ? 'https://info.payu.in/merchant/postservice.php?form=2'
      : 'https://test.payu.in/merchant/postservice.php?form=2';
    const verifyBody = new URLSearchParams({
      key,
      command: 'verify_payment',
      var1: String(response.txnid),
      hash: createPayuVerifyHash({ key, salt, txnid: String(response.txnid) })
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let verification;
    try {
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verifyBody,
        signal: controller.signal
      });
      if (!verifyResponse.ok) throw new Error(`PayU verification returned HTTP ${verifyResponse.status}`);
      verification = await verifyResponse.json();
    } catch (err) {
      console.error('PayU transaction lookup failed:', err);
      return renderResult(false, 'Payment verification pending', 'We could not confirm the payment with PayU yet. Return to the store to check the latest order status. Please wait a few minutes before trying payment again; if it is still pending after 3 minutes, contact the store with your order reference.', order.id);
    } finally {
      clearTimeout(timeout);
    }
    const transaction = Object.values(verification?.transaction_details || {})
      .find(detail => String(detail?.txnid || '') === String(response.txnid));
    const verifiedAmount = transaction?.amt ?? transaction?.transaction_amount;
    if (
      Number(verification?.status) !== 1 ||
      String(transaction?.status || '').toLowerCase() !== 'success' ||
      formatPayuAmount(verifiedAmount) !== expectedAmount
    ) {
      return renderResult(false, 'Payment verification pending', 'PayU has not confirmed the payment with the expected amount yet. Return to the store to check the latest order status. Please wait a few minutes before trying payment again; if it is still pending after 3 minutes, contact the store with your order reference.', order.id);
    }

    await db.updateOrderStatus(order.id, 'processing', {
      paymentStatus: 'paid',
      payuTransactionId: String(response.txnid),
      payuPaymentId: String(transaction.mihpayid || '')
    });
    return renderResult(true, 'Payment received', 'Your payment is verified and your order is being prepared.', order.id);
  } catch (err) {
    console.error('PayU callback verification error:', err);
    res.status(500).send('Unable to verify this payment right now. Please contact the store with your order reference.');
  }
});

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

app.post('/api/payments/razorpay/create-order', paymentLimit, requireUser, async (req, res) => {
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
    if (storeOrder.customer.email?.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(404).json({ error: 'Order not found.' });
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

app.post('/api/payments/razorpay/verify', paymentLimit, requireUser, async (req, res) => {
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
    if (storeOrder.customer.email?.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
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

app.post('/api/orders/:id/cancel-payment', paymentLimit, requireUser, async (req, res) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order || order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'pending') {
      return res.status(404).json({ error: 'Pending payment order not found.' });
    }
    if (order.customer.email?.toLowerCase() !== req.user.email.toLowerCase()) {
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
