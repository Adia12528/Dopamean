import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import Razorpay from 'razorpay';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_JWT_SECRET = process.env.JWT_SECRET || 'cozyloops_production_secret_key_2026';

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `crochet_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

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
    if (hmac !== expectedHmac) return false;
    const data = JSON.parse(payload);
    // Token valid for 7 days
    if (Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

// Optional auth middleware for sensitive admin endpoints
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const settings = db.getSettings();
  if (!token || !verifyAdminToken(token, settings.adminPasscode || 'admin123')) {
    // For backward-compatibility during transition, allow passcode header as fallback
    const passcodeHeader = req.headers['x-admin-passcode'];
    if (passcodeHeader && passcodeHeader === (settings.adminPasscode || 'admin123')) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Super Admin credentials required.' });
  }
  next();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Cozy Loops E-Commerce Production Engine',
    database: 'SQLite 3 (WAL mode)',
    time: new Date().toISOString()
  });
});

// ==========================================
// ADMIN AUTHENTICATION API
// ==========================================
app.post('/api/admin/login', (req, res) => {
  try {
    const { passcode } = req.body;
    const settings = db.getSettings();
    const correctPasscode = settings.adminPasscode || 'admin123';

    if (!passcode || passcode.trim() !== correctPasscode.trim()) {
      return res.status(401).json({ success: false, message: 'Invalid Admin Passcode' });
    }

    const token = generateAdminToken(correctPasscode);
    res.json({
      success: true,
      token,
      message: 'Super Admin authenticated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/admin/verify', (req, res) => {
  const { token } = req.body;
  const settings = db.getSettings();
  const isValid = verifyAdminToken(token, settings.adminPasscode || 'admin123');
  res.json({ valid: isValid });
});

// ==========================================
// IMAGE UPLOAD API
// ==========================================
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ==========================================
// STORE SETTINGS API (Customizable by Owner)
// ==========================================
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    // Do not leak secret key in public settings GET
    const sanitized = { ...settings };
    if (sanitized.razorpayKeySecret) {
      sanitized.razorpayKeySecretConfigured = true;
      delete sanitized.razorpayKeySecret;
    }
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    const sanitized = { ...updated };
    if (sanitized.razorpayKeySecret) {
      sanitized.razorpayKeySecretConfigured = true;
      delete sanitized.razorpayKeySecret;
    }
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==========================================
// PRODUCTS API
// ==========================================
app.get('/api/products', (req, res) => {
  try {
    const products = db.getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const newProduct = db.addProduct(req.body);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const updated = db.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    db.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==========================================
// OFFERS & PROMOS API
// ==========================================
app.get('/api/offers', (req, res) => {
  try {
    res.json(db.getOffers());
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve offers' });
  }
});

app.post('/api/offers', (req, res) => {
  try {
    const newOffer = db.addOffer(req.body);
    res.status(201).json(newOffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

app.put('/api/offers/:id', (req, res) => {
  try {
    const updated = db.updateOffer(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Offer not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

app.delete('/api/offers/:id', (req, res) => {
  try {
    db.deleteOffer(req.params.id);
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

app.patch('/api/offers/:id/toggle', (req, res) => {
  try {
    const toggled = db.toggleOfferStatus(req.params.id);
    if (!toggled) return res.status(404).json({ error: 'Offer not found' });
    res.json(toggled);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle offer status' });
  }
});

// ==========================================
// ORDERS & TRACKING API
// ==========================================
app.get('/api/orders', (req, res) => {
  try {
    res.json(db.getOrders());
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders' });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

// Public Order Tracking by Order ID, Phone, or Email
app.get('/api/orders/track/lookup', (req, res) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide a valid Order ID or Phone number' });
    }
    const matching = db.getOrdersByQuery(q.trim());
    if (matching.length === 0) {
      return res.status(404).json({ error: 'No order found matching your search. Please check your Order ID or phone number.' });
    }
    res.json(matching);
  } catch (err) {
    res.status(500).json({ error: 'Failed to track order' });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const newOrder = db.createOrder(req.body);
    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const { status, trackingNumber, paymentStatus } = req.body;
    const updated = db.updateOrderStatus(req.params.id, status, { trackingNumber, paymentStatus });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==========================================
// REVIEWS API (Customer reviews & ratings)
// ==========================================
app.get('/api/reviews/:productId', (req, res) => {
  try {
    const reviews = db.getReviews(req.params.productId);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const { productId, customerName, customerEmail, rating, comment } = req.body;
    if (!productId || !comment || !rating) {
      return res.status(400).json({ error: 'Product ID, rating, and review comment are required.' });
    }
    const newReview = db.addReview({
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

app.delete('/api/reviews/:id', (req, res) => {
  try {
    db.deleteReview(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ==========================================
// PAYMENT GATEWAYS API: RAZORPAY & UPI
// ==========================================
app.post('/api/payments/razorpay/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    const settings = db.getSettings();

    const keyId = settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
    const keySecret = settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(400).json({
        error: 'Razorpay keys are not configured yet in Studio Settings. You can also pay instantly via UPI QR or Cash on Delivery!'
      });
    }

    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    const options = {
      amount: Math.round(Number(amount) * 100), // amount in smallest currency unit (paise)
      currency,
      receipt: receipt || `rec_${Date.now()}`,
      notes: notes || {}
    };

    const razorpayOrder = await instance.orders.create(options);
    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create Razorpay order' });
  }
});

app.post('/api/payments/razorpay/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const settings = db.getSettings();
    const keySecret = settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(400).json({ error: 'Razorpay key secret not configured' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update order status if orderId provided
    if (orderId) {
      db.updateOrderStatus(orderId, 'processing', {
        paymentStatus: 'paid',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id
      });
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id
    });
  } catch (err) {
    console.error('Razorpay verification error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Start backend server
app.listen(PORT, () => {
  console.log(`🧶 Dopamean Backend & SQLite running on http://localhost:${PORT}`);
});
