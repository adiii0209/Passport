/**
 * File Upload Middleware
 * Configures Multer for handling multipart form uploads
 * Includes file type validation and size limits
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter: only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, and HEIC images are allowed.`), false);
  }
};

// Multer instance with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // Max 5 files per request
  },
});

// Pre-configured upload middlewares for specific routes
const uploadPassport = upload.fields([
  { name: 'passport_front', maxCount: 1 },
  { name: 'passport_back', maxCount: 1 },
]);

const uploadPan = upload.single('pan_card');

const uploadSelfie = upload.single('selfie');

module.exports = {
  upload,
  uploadPassport,
  uploadPan,
  uploadSelfie,
};
