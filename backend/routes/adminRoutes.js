/**
 * Admin Routes
 * Protected routes for admin portal management.
 * All routes are prefixed with /api/admin.
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const portalController = require('../controllers/portalController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Media Upload Config ─────────────────────────────────────────

const mediaUploadDir = path.join(__dirname, '..', 'uploads', 'media');
if (!fs.existsSync(mediaUploadDir)) {
  fs.mkdirSync(mediaUploadDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, mediaUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `media-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const mediaFilter = (req, file, cb) => {
  const allowedImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
  const allowedVideo = /\.(mp4|webm|mov)$/i;

  if (allowedImage.test(file.originalname) || allowedVideo.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only image (jpg, png, webp, gif, svg) and video (mp4, webm, mov) files are allowed'));
  }
};

const uploadMedia = multer({
  storage: mediaStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for videos
}).single('media');

// ─── Auth Route (unprotected) ────────────────────────────────────

router.post('/login', adminAuth.login);

// ─── Protected Routes ────────────────────────────────────────────

// All routes below require admin authentication
router.use(adminAuth.verifyToken);

// Dashboard stats
router.get('/stats', portalController.getStats);

// Portal CRUD
router.get('/portals', portalController.getAllPortals);
router.post('/portals', portalController.createPortal);
router.get('/portals/:id', portalController.getPortalById);
router.put('/portals/:id', portalController.updatePortal);
router.delete('/portals/:id', portalController.deletePortal);
router.patch('/portals/:id/toggle', portalController.togglePortalStatus);

// Media upload
router.post('/upload-media', uploadMedia, portalController.uploadMedia);

module.exports = router;
