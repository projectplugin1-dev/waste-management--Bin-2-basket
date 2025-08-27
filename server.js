import express from 'express';
import session from 'express-session';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

import { getPool, initSchemaAndSeed, WASTE_RATES, MAX_DISCOUNT_PERCENT, POINT_VALUE, calculatePointsForWaste, calculateDiscountFromPoints } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Helpers
function requireAuth(req, res, next) {
  if (req.session?.user && req.session.user.role === 'user') return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  if (req.session?.user && req.session.user.role === 'admin') return next();
  return res.status(401).json({ error: 'Admin only' });
}

function currentUser(req) {
  return req.session?.user || null;
}

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    appName: process.env.APP_NAME || 'Bin 2 Basket',
    wasteRates: WASTE_RATES,
    maxDiscountPercent: MAX_DISCOUNT_PERCENT,
    pointValue: POINT_VALUE
  });
});

// Auth routes (User)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, password required' });
  }
  try {
    const pool = await getPool();
    const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const userUid = 'B2B-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const [result] = await pool.query(
      'INSERT INTO users (user_uid, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, \"user\")',
      [userUid, name, email, phone || null, hash]
    );
    return res.json({ success: true, userId: result.insertId, user_uid: userUid });
  } catch (err) {
    console.error('Register error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const pool = await getPool();
    const [[user]] = await pool.query('SELECT id, user_uid, name, email, password_hash, role, points_balance FROM users WHERE email = ? AND role = \"user\"', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, user_uid: user.user_uid, name: user.name, email: user.email, role: 'user', points_balance: user.points_balance };
    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: currentUser(req) });
});

// Admin auth
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const pool = await getPool();
    const [[user]] = await pool.query('SELECT id, user_uid, name, email, password_hash, role FROM users WHERE email = ? AND role = \"admin\"', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, user_uid: user.user_uid, name: user.name, email: user.email, role: 'admin' };
    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Admin login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ user: currentUser(req) });
});

// User endpoints
app.get('/api/user/points-balance', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const [[row]] = await pool.query('SELECT points_balance FROM users WHERE id = ?', [req.session.user.id]);
    req.session.user.points_balance = row?.points_balance || 0;
    res.json({ points_balance: req.session.user.points_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/history', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.session.user.id;
    const [waste] = await pool.query('SELECT * FROM waste_submissions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    const [ledger] = await pool.query('SELECT * FROM points_ledger WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    const [[balanceRow]] = await pool.query('SELECT points_balance FROM users WHERE id = ?', [userId]);
    res.json({ waste_submissions: waste, points_ledger: ledger, orders, points_balance: balanceRow?.points_balance || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Groceries
app.get('/api/groceries', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT id, name, description, price, image_url, stock FROM products WHERE is_active = 1 ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/cart/checkout', requireAuth, async (req, res) => {
  const { items, pointsToRedeem } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });
  const redeemPoints = Math.max(0, Math.floor(Number(pointsToRedeem || 0)));
  try {
    const pool = await getPool();
    // fetch products and compute
    const productIds = items.map(i => Number(i.productId)).filter(Boolean);
    if (productIds.length === 0) return res.status(400).json({ error: 'Invalid items' });
    const [products] = await pool.query('SELECT id, price, stock FROM products WHERE id IN (?)', [productIds]);
    const idToProduct = new Map(products.map(p => [Number(p.id), p]));

    let subtotal = 0;
    for (const it of items) {
      const p = idToProduct.get(Number(it.productId));
      const qty = Math.max(1, Math.floor(Number(it.quantity)));
      if (!p) return res.status(400).json({ error: `Product ${it.productId} not found` });
      if (qty > p.stock) return res.status(400).json({ error: `Insufficient stock for product ${it.productId}` });
      subtotal += Number(p.price) * qty;
    }

    const [[userRow]] = await pool.query('SELECT points_balance FROM users WHERE id = ?', [req.session.user.id]);
    const userBalance = userRow?.points_balance || 0;
    const maxDiscount = (MAX_DISCOUNT_PERCENT / 100) * subtotal;
    const pointsRequested = Math.min(redeemPoints, userBalance);
    let discountFromPoints = calculateDiscountFromPoints(pointsRequested);
    if (discountFromPoints > maxDiscount) {
      discountFromPoints = maxDiscount;
    }
    // actual points to redeem based on discount applied
    const pointsToActuallyRedeem = Math.min(pointsRequested, Math.floor(discountFromPoints / POINT_VALUE));
    const total = Math.max(0, subtotal - discountFromPoints);

    // Begin transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [orderResult] = await conn.query(
        'INSERT INTO orders (user_id, status, subtotal, discount_value, points_redeemed, total) VALUES (?, \"PENDING\", ?, ?, ?, ?)',
        [req.session.user.id, subtotal, discountFromPoints, pointsToActuallyRedeem, total]
      );
      const orderId = orderResult.insertId;
      for (const it of items) {
        const p = idToProduct.get(Number(it.productId));
        const qty = Math.max(1, Math.floor(Number(it.quantity)));
        const lineTotal = Number(p.price) * qty;
        await conn.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
          [orderId, p.id, qty, p.price, lineTotal]
        );
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [qty, p.id, qty]);
      }
      if (pointsToActuallyRedeem > 0) {
        await conn.query(
          'INSERT INTO points_ledger (user_id, change_amount, reason, reference_id) VALUES (?, ?, \"order_redeem\", ?)',
          [req.session.user.id, -pointsToActuallyRedeem, orderId]
        );
        await conn.query('UPDATE users SET points_balance = points_balance - ? WHERE id = ?', [pointsToActuallyRedeem, req.session.user.id]);
      }
      await conn.commit();
      res.json({ success: true, orderId, subtotal, discountApplied: discountFromPoints, pointsRedeemed: pointsToActuallyRedeem, total });
    } catch (txErr) {
      await conn.rollback();
      console.error('Checkout tx error', txErr);
      res.status(500).json({ error: 'Checkout failed' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders/my', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin endpoints
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { q } = req.query;
  try {
    const pool = await getPool();
    if (q) {
      const like = `%${q}%`;
      const [rows] = await pool.query('SELECT id, user_uid, name, email, phone, points_balance, created_at FROM users WHERE role = \"user\" AND (name LIKE ? OR email LIKE ? OR user_uid LIKE ?)', [like, like, like]);
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT id, user_uid, name, email, phone, points_balance, created_at FROM users WHERE role = \"user\" ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/waste-submissions', requireAdmin, async (req, res) => {
  const { user_uid, waste_type, weight_kg } = req.body || {};
  if (!user_uid || !waste_type || !weight_kg) return res.status(400).json({ error: 'user_uid, waste_type, weight_kg required' });
  try {
    const pool = await getPool();
    const [[user]] = await pool.query('SELECT id FROM users WHERE user_uid = ?', [user_uid]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const points = calculatePointsForWaste(waste_type, weight_kg);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [wsRes] = await conn.query('INSERT INTO waste_submissions (user_id, user_uid, waste_type, weight_kg, points_awarded, submitted_by_admin_id) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user_uid, waste_type, weight_kg, points, req.session.user.id]);
      await conn.query('INSERT INTO points_ledger (user_id, change_amount, reason, reference_id) VALUES (?, ?, \"waste_submission\", ?)', [user.id, points, wsRes.insertId]);
      await conn.query('UPDATE users SET points_balance = points_balance + ? WHERE id = ?', [points, user.id]);
      await conn.commit();
      res.json({ success: true, points_awarded: points });
    } catch (txErr) {
      await conn.rollback();
      console.error('Waste submission tx error', txErr);
      res.status(500).json({ error: 'Failed to record waste' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/waste-submissions', requireAdmin, async (req, res) => {
  const { user_uid } = req.query;
  try {
    const pool = await getPool();
    if (user_uid) {
      const [rows] = await pool.query('SELECT * FROM waste_submissions WHERE user_uid = ? ORDER BY created_at DESC', [user_uid]);
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT * FROM waste_submissions ORDER BY created_at DESC LIMIT 500');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    const pool = await getPool();
    if (status) {
      const [rows] = await pool.query('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC', [status]);
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/orders/:id/accept', requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[order]] = await conn.query('SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (!order) {
        await conn.rollback();
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.status !== 'PENDING') {
        await conn.rollback();
        return res.status(400).json({ error: 'Order not pending' });
      }
      await conn.query('UPDATE orders SET status = \"ACCEPTED\" WHERE id = ?', [orderId]);
      await conn.query('INSERT INTO admin_actions (admin_id, order_id, action) VALUES (?, ?, \"ACCEPT\")', [req.session.user.id, orderId]);
      await conn.commit();
      res.json({ success: true });
    } catch (txErr) {
      await conn.rollback();
      console.error(txErr);
      res.status(500).json({ error: 'Failed to accept order' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/orders/:id/decline', requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const { reason } = req.body || {};
  try {
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[order]] = await conn.query('SELECT id, user_id, status, points_redeemed FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (!order) {
        await conn.rollback();
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.status !== 'PENDING') {
        await conn.rollback();
        return res.status(400).json({ error: 'Order not pending' });
      }
      await conn.query('UPDATE orders SET status = \"DECLINED\" WHERE id = ?', [orderId]);
      if (order.points_redeemed > 0) {
        await conn.query('INSERT INTO points_ledger (user_id, change_amount, reason, reference_id) VALUES (?, ?, \"order_refund\", ?)', [order.user_id, order.points_redeemed, orderId]);
        await conn.query('UPDATE users SET points_balance = points_balance + ? WHERE id = ?', [order.points_redeemed, order.user_id]);
      }
      await conn.query('INSERT INTO admin_actions (admin_id, order_id, action, reason) VALUES (?, ?, \"DECLINE\", ?)', [req.session.user.id, orderId, reason || null]);
      await conn.commit();
      res.json({ success: true });
    } catch (txErr) {
      await conn.rollback();
      console.error(txErr);
      res.status(500).json({ error: 'Failed to decline order' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Start server
initSchemaAndSeed()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to init DB', err);
    process.exit(1);
  });

