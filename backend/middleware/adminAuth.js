/**
 * Admin Authentication Middleware
 * JWT-based authentication for admin routes.
 * Admin credentials are stored in environment variables.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'passport-extractor-admin-secret-change-me';
const TOKEN_EXPIRY = '24h';

/**
 * Hash a password (used once to generate the hash for .env).
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Authenticate admin credentials and return a JWT token.
 */
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required',
    });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error('❌ Admin credentials not configured in .env');
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not configured',
    });
  }

  // Check username
  if (username !== adminUsername) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  // Check password (supports both plain text and bcrypt hashed)
  let passwordValid = false;
  if (adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')) {
    passwordValid = await bcrypt.compare(password, adminPassword);
  } else {
    passwordValid = password === adminPassword;
  }

  if (!passwordValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  // Generate JWT
  const token = jwt.sign(
    { username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  console.log(`🔐 Admin login successful: ${username}`);

  res.json({
    success: true,
    token,
    user: { username, role: 'admin' },
  });
}

/**
 * Middleware to verify JWT token on protected routes.
 * Expects: Authorization: Bearer <token>
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.',
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid token.',
    });
  }
}

module.exports = {
  login,
  verifyToken,
  hashPassword,
};
