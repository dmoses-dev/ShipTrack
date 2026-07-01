require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./utils/db');
const { attachUser } = require('./middleware/auth');

const authRouter      = require('./routes/auth');
const shipmentsRouter = require('./routes/shipments');
const couriersRouter  = require('./routes/couriers');
const paymentsRouter  = require('./routes/payments');
const statsRouter     = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts' }));
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 200 }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Body / static ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Sessions (MongoDB-backed) ─────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/shiptrack',
    ttl: 24 * 60 * 60,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(attachUser);

// ── API: session info for sidebar ─────────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ success: false });
  res.json({ success: true, data: {
    id:    req.session.userId,
    name:  req.session.userName,
    email: req.session.userEmail,
    role:  req.session.role,
  }});
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',          authRouter);
app.use('/api/shipments', shipmentsRouter);
app.use('/api/couriers',  couriersRouter);
app.use('/payments',      paymentsRouter);
app.use('/api/stats',     statsRouter);

// ── Page routes ───────────────────────────────────────────────────────────────
app.get('/',      (req, res) => res.sendFile(path.join(__dirname, '../views/index.html')));
app.get('/track', (req, res) => res.sendFile(path.join(__dirname, '../views/track.html')));

app.get('/admin', (req, res) => {
  if (!req.session?.userId) return res.redirect('/auth/login?next=/admin');
  res.sendFile(path.join(__dirname, '../views/admin.html'));
});
app.get('/admin/couriers', (req, res) => {
  if (!req.session?.userId) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, '../views/couriers.html'));
});
app.get('/admin/users', (req, res) => {
  if (!req.session?.userId) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, '../views/users.html'));
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '../views/404.html')));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚚  ShipTrack PRO  →  http://localhost:${PORT}`);
    console.log(`    Admin dashboard  →  http://localhost:${PORT}/admin`);
    console.log(`    Public tracking  →  http://localhost:${PORT}/track\n`);
  });
}).catch(err => {
  console.error('[FATAL] DB connection failed:', err.message);
  process.exit(1);
});
