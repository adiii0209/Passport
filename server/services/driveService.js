/**
 * Google Drive Service
 * Handles file uploads, OCR conversion, and file management.
 * Uses centralized Google OAuth 2.0 with a single Refresh Token.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ─── MIME type mapping for common image extensions ───────────
const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'image/jpeg';
}

// ─── Initialize OAuth2 Client Centralized ──────────────────
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/api/auth/google/callback'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ═══════════════════════════════════════════════════════════════
// FILE UPLOAD
// ═══════════════════════════════════════════════════════════════

async function uploadFile(filePath, fileName, folderId, mimeType) {
  const drive = getDriveClient();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const detectedMime = mimeType || detectMimeType(filePath);

  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  };

  const media = {
    mimeType: detectedMime,
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink',
    });
    console.log(`📄 Uploaded: ${fileName} → Drive (${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error(`❌ Upload failed for ${fileName}:`, error.message);
    throw new Error(`Failed to upload ${fileName} to Google Drive: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// OCR VIA GOOGLE DOCS CONVERSION
// ═══════════════════════════════════════════════════════════════

async function uploadAndConvertToDoc(filePath, fileName) {
  const drive = getDriveClient();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for OCR: ${filePath}`);
  }

  const imageMime = detectMimeType(filePath);

  const fileMetadata = {
    name: `OCR_Temp_${fileName}`,
    mimeType: 'application/vnd.google-apps.document',
  };

  const media = {
    mimeType: imageMime,
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name',
    });
    console.log(`🔍 OCR Doc created: OCR_Temp_${fileName} (${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error(`❌ OCR conversion failed for ${fileName}:`, error.message);
    throw new Error(`Failed to create OCR document for ${fileName}: ${error.message}`);
  }
}

async function extractTextFromDoc(docId) {
  const drive = getDriveClient();
  try {
    const response = await drive.files.export({
      fileId: docId,
      mimeType: 'text/plain',
    });

    const text = typeof response.data === 'string'
      ? response.data
      : String(response.data || '');

    console.log(`📝 Extracted ${text.length} characters from Doc ${docId}`);
    return text;
  } catch (error) {
    console.error(`❌ Text export failed for Doc ${docId}:`, error.message);
    throw new Error(`Failed to export OCR text from document: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════

async function deleteFile(fileId) {
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId });
    console.log(`🗑️  Deleted: ${fileId}`);
  } catch (error) {
    console.warn(`⚠️  Could not delete file ${fileId}:`, error.message);
  }
}

async function makePublic(fileId) {
  const drive = getDriveClient();
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const file = await drive.files.get({
      fileId,
      fields: 'webViewLink, webContentLink',
    });

    return file.data.webViewLink;
  } catch (error) {
    console.warn(`⚠️  Could not make file public ${fileId}:`, error.message);
    return null;
  }
}

async function renameFile(fileId, newName) {
  const drive = getDriveClient();
  try {
    const response = await drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: 'id, name, webViewLink',
    });
    console.log(`✏️  Renamed file ${fileId} to: ${newName}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to rename file ${fileId}:`, error.message);
    throw new Error(`Failed to rename file: ${error.message}`);
  }
}

module.exports = {
  uploadFile,
  uploadAndConvertToDoc,
  extractTextFromDoc,
  deleteFile,
  makePublic,
  renameFile,
};
