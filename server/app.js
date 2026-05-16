/**
 * Travel Registration App - Express Server
 * Main entry point for the backend application
 */

require('dotenv').config({ override: true });

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS Configuration ─────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

// ─── Root Endpoint ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Travel Registration API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      extractPassport: 'POST /api/extract-passport',
      extractPan: 'POST /api/extract-pan',
      submitRegistration: 'POST /api/submit-registration',
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
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   Travel Registration API Server      ║
  ║   Running on http://localhost:${PORT}     ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}       ║
  ╚════════════════════════════════════════╝
  `);
});
