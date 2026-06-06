/**
 * Travel Registration App - Express Server
 * Main entry point for the backend application
 */

require('dotenv').config({ override: true });

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/adminRoutes');
const { connectDb, closeDb } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 5000;

function normalizeOrigin(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

function getAllowedOrigins() {
  const envOrigins = [process.env.FRONTEND_URL, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  return [...new Set(envOrigins)];
}

const allowedOrigins = getAllowedOrigins();

// ─── CORS Configuration ─────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Body Parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Request Logging ─────────────────────────────────────────────
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ─── API Routes ──────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// ─── Root Endpoint ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Travel Registration API',
    version: '2.0.0',
    endpoints: {
      health: 'GET /api/health',
      extractPassport: 'POST /api/extract-passport',
      extractPan: 'POST /api/extract-pan',
      submitRegistration: 'POST /api/submit-registration',
      getPortal: 'GET /api/portals/:slug',
      adminLogin: 'POST /api/admin/login',
      adminPortals: 'GET /api/admin/portals',
    },
  });
});

// ─── Error Handling Middleware ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);

  // Multer-specific errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum size is 10MB.',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ─── Start Server ────────────────────────────────────────────────
async function startServer() {
  try {
    // Initialize MongoDB connection
    await connectDb();

    app.listen(PORT, () => {
      console.log(`Allowed CORS origins: ${allowedOrigins.join(', ') || 'all origins allowed (no FRONTEND_URL/ALLOWED_ORIGINS set)'}`);
      console.log(`
  ╔════════════════════════════════════════╗
  ║   Travel Registration API Server      ║
  ║   Running on http://localhost:${PORT}     ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}       ║
  ║   MongoDB: Connected ✓               ║
  ║   Admin: /api/admin/login             ║
  ╚════════════════════════════════════════╝
  `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await closeDb();
  process.exit(0);
});

startServer();
