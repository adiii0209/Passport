const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const sharp = require('sharp');

const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff']);
const PDFSETTINGS = process.env.PDF_COMPRESSION_PRESET || '/ebook';

function getMimeType(filePath, explicitMimeType = '') {
  if (explicitMimeType) return explicitMimeType;

  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    case '.pdf':
      return PDF_MIME;
    default:
      return '';
  }
}

function isPdf(filePath, mimeType = '') {
  return mimeType === PDF_MIME || path.extname(filePath).toLowerCase() === '.pdf';
}

function isImage(filePath, mimeType = '') {
  if (IMAGE_MIMES.has(mimeType)) return true;
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'].includes(ext);
}

function createTempPath(extension) {
  return path.join(
    os.tmpdir(),
    `passport-optimizer-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`
  );
}

function getImageProfile(category) {
  switch (category) {
    case 'portal-media':
      return { maxWidth: 2400, jpegQuality: 80, pngQuality: 85 };
    case 'selfie':
      return { maxWidth: 1600, jpegQuality: 74, pngQuality: 80 };
    case 'document':
    default:
      return { maxWidth: 1800, jpegQuality: 72, pngQuality: 78 };
  }
}

async function optimizeImage(filePath, category) {
  const profile = getImageProfile(category);
  const transformer = sharp(filePath, { failOn: 'none' }).rotate();
  const metadata = await transformer.metadata();
  const shouldPreservePng = category === 'portal-media' && path.extname(filePath).toLowerCase() === '.png' && metadata.hasAlpha;

  const resized = transformer.resize({
    width: profile.maxWidth,
    withoutEnlargement: true,
    fit: 'inside',
  });

  if (shouldPreservePng) {
    const outputPath = createTempPath('.png');
    await resized.png({
      compressionLevel: 9,
      palette: true,
      quality: profile.pngQuality,
    }).toFile(outputPath);

    return {
      path: outputPath,
      extension: '.png',
      mimeType: 'image/png',
      cleanupPaths: [outputPath],
      optimized: true,
    };
  }

  const outputPath = createTempPath('.jpg');
  await resized.jpeg({
    quality: profile.jpegQuality,
    mozjpeg: true,
    chromaSubsampling: '4:2:0',
  }).toFile(outputPath);

  return {
    path: outputPath,
    extension: '.jpg',
    mimeType: 'image/jpeg',
    cleanupPaths: [outputPath],
    optimized: true,
  };
}

function runGhostscript(inputPath, outputPath, executable) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${PDFSETTINGS}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ], {
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Ghostscript exited with code ${code}`));
    });
  });
}

async function optimizePdf(filePath) {
  const candidates = [
    process.env.GHOSTSCRIPT_PATH,
    'gswin64c',
    'gswin32c',
    'gs',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const outputPath = createTempPath('.pdf');
    try {
      await runGhostscript(filePath, outputPath, candidate);
      return {
        path: outputPath,
        extension: '.pdf',
        mimeType: PDF_MIME,
        cleanupPaths: [outputPath],
        optimized: true,
      };
    } catch (error) {
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (unlinkError) {
        // ignore cleanup failure
      }
    }
  }

  return {
    path: filePath,
    extension: '.pdf',
    mimeType: PDF_MIME,
    cleanupPaths: [],
    optimized: false,
  };
}

async function optimizeStoredFile(filePath, options = {}) {
  const {
    category = 'document',
    mimeType = '',
  } = options;

  const resolvedMimeType = getMimeType(filePath, mimeType);

  if (isPdf(filePath, resolvedMimeType)) {
    return optimizePdf(filePath);
  }

  if (isImage(filePath, resolvedMimeType)) {
    return optimizeImage(filePath, category);
  }

  return {
    path: filePath,
    extension: path.extname(filePath) || '',
    mimeType: resolvedMimeType || mimeType || 'application/octet-stream',
    cleanupPaths: [],
    optimized: false,
  };
}

module.exports = {
  optimizeStoredFile,
};
