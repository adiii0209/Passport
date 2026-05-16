/**
 * API Routes
 * Defines all REST API endpoints for the travel registration application
 */

const express = require('express');
const router = express.Router();
const { uploadPassport, uploadPan, uploadSelfie } = require('../middleware/upload');
const extractionController = require('../controllers/extractionController');
const registrationController = require('../controllers/registrationController');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * POST /api/extract-passport
 * Upload passport front + back images for OCR extraction
 */
router.post('/extract-passport', uploadPassport, extractionController.extractPassport);

/**
 * POST /api/extract-pan
 * Upload PAN card image for OCR extraction
 */
router.post('/extract-pan', uploadPan, extractionController.extractPan);

/**
 * POST /api/submit-registration
 * Submit final registration with selfie + form data
 */
router.post('/submit-registration', uploadSelfie, registrationController.submitRegistration);

module.exports = router;
