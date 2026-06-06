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
  '.pdf': 'application/pdf',
};

function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'image/jpeg';
}

function sanitizeDriveFileLabel(value) {
  return String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDriveFileId(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  if (/^[a-zA-Z0-9_-]{20,}$/.test(input) && !input.includes('://')) {
    return input;
  }

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

function buildDrivePublicUrl(value, options = {}) {
  const { download = false, fallbackUrl = '' } = options;
  const fileId = extractDriveFileId(value);

  if (!fileId) {
    return fallbackUrl || String(value || '');
  }

  return `https://drive.google.com/uc?export=${download ? 'download' : 'view'}&id=${fileId}`;
}

// ─── Initialize OAuth2 Client Centralized ──────────────────
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
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

async function renameFolder(folderId, newName) {
  const safeFolderName = sanitizeDriveFileLabel(newName) || 'Portal';
  return renameFile(folderId, safeFolderName);
}

async function getFile(fileId) {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, parents, webViewLink, webContentLink',
  });
  return response.data;
}

async function downloadFileStream(fileId, rangeHeader) {
  const drive = getDriveClient();
  return drive.files.get(
    { fileId, alt: 'media' },
    {
      responseType: 'stream',
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    }
  );
}

async function renameFileWithExistingExtension(fileId, baseName) {
  const existingFile = await getFile(fileId);
  const extension = path.extname(existingFile.name || '');
  const safeBaseName = sanitizeDriveFileLabel(baseName) || 'Document';
  const nextName = `${safeBaseName}${extension}`;
  return renameFile(fileId, nextName);
}

async function createFolder(folderName, parentFolderId) {
  const drive = getDriveClient();
  const safeFolderName = sanitizeDriveFileLabel(folderName) || 'Registration';

  const response = await drive.files.create({
    requestBody: {
      name: safeFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: 'id, name, webViewLink',
  });

  console.log(`📁 Created folder: ${safeFolderName} (${response.data.id})`);
  return response.data;
}

async function createShortcut(targetFileId, shortcutName, parentFolderId) {
  if (!targetFileId) {
    throw new Error('Target file ID is required to create a shortcut');
  }

  const drive = getDriveClient();
  const safeShortcutName = sanitizeDriveFileLabel(shortcutName) || 'Shortcut';

  const response = await drive.files.create({
    requestBody: {
      name: safeShortcutName,
      mimeType: 'application/vnd.google-apps.shortcut',
      parents: parentFolderId ? [parentFolderId] : undefined,
      shortcutDetails: {
        targetId: targetFileId,
      },
    },
    fields: 'id, name, webViewLink',
  });

  console.log(`🔗 Created shortcut: ${safeShortcutName} (${response.data.id})`);
  return response.data;
}

function getFolderLink(folderId) {
  if (!folderId) return '';
  return `https://drive.google.com/drive/folders/${folderId}`;
}

async function moveFileToFolder(fileId, destinationFolderId) {
  if (!fileId || !destinationFolderId) return null;

  const drive = getDriveClient();
  const existingFile = await getFile(fileId);
  const previousParents = (existingFile.parents || []).join(',');

  const response = await drive.files.update({
    fileId,
    addParents: destinationFolderId,
    removeParents: previousParents || undefined,
    fields: 'id, name, parents, webViewLink, webContentLink',
  });

  console.log(`📂 Moved file ${fileId} to folder ${destinationFolderId}`);
  return response.data;
}

let cachedMergedFolderId = null;

async function getOrCreateMergedFolder(frontFolderId) {
  if (process.env.PASSPORT_MERGED_FOLDER_ID) {
    return process.env.PASSPORT_MERGED_FOLDER_ID;
  }
  if (cachedMergedFolderId) {
    return cachedMergedFolderId;
  }

  let parentFolderId = null;
  if (frontFolderId) {
    try {
      const frontFolder = await getFile(frontFolderId);
      if (frontFolder.parents && frontFolder.parents.length > 0) {
        parentFolderId = frontFolder.parents[0];
      }
    } catch (e) {
      console.warn(`⚠️ Could not retrieve parents of front folder ${frontFolderId}:`, e.message);
    }
  }

  const drive = getDriveClient();
  const queryParts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "name = 'Passport Merged'",
    "trashed = false"
  ];
  if (parentFolderId) {
    queryParts.push(`'${parentFolderId}' in parents`);
  }
  const query = queryParts.join(' and ');

  try {
    const listResponse = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      pageSize: 1,
    });

    if (listResponse.data.files && listResponse.data.files.length > 0) {
      const existingFolder = listResponse.data.files[0];
      console.log(`📁 Found existing Passport Merged folder: ${existingFolder.name} (${existingFolder.id})`);
      cachedMergedFolderId = existingFolder.id;
      return existingFolder.id;
    }

    const newFolder = await createFolder('Passport Merged', parentFolderId);
    cachedMergedFolderId = newFolder.id;
    return newFolder.id;
  } catch (error) {
    console.error('❌ Failed to get or create Passport Merged folder:', error.message);
    throw new Error(`Failed to get or create Passport Merged folder: ${error.message}`);
  }
}

module.exports = {
  uploadFile,
  uploadAndConvertToDoc,
  extractTextFromDoc,
  deleteFile,
  makePublic,
  renameFile,
  renameFolder,
  renameFileWithExistingExtension,
  createFolder,
  createShortcut,
  getFolderLink,
  moveFileToFolder,
  sanitizeDriveFileLabel,
  extractDriveFileId,
  buildDrivePublicUrl,
  downloadFileStream,
  getOrCreateMergedFolder,
};
