/**
 * Portal Controller
 * Handles admin CRUD operations and public portal data retrieval.
 */

const portalService = require('../services/portalService');
const driveService = require('../services/driveService');
const uploadOptimizationService = require('../services/uploadOptimizationService');
const fs = require('fs');

function normalizePortalMedia(portal) {
  if (!portal) return portal;

  const normalized = {
    ...portal,
    hero: { ...(portal.hero || {}) },
    logo: { ...(portal.logo || {}) },
  };

  const heroFileId = driveService.extractDriveFileId(normalized.hero.driveFileId || normalized.hero.url);
  normalized.hero.url = heroFileId
    ? `/api/media/${heroFileId}`
    : (normalized.hero.url || '');

  const logoFileId = driveService.extractDriveFileId(normalized.logo.driveFileId || normalized.logo.url);
  normalized.logo.url = logoFileId
    ? `/api/media/${logoFileId}`
    : (normalized.logo.url || '');

  normalized.travelDates = { ...(portal.travelDates || {}) };
  const syncedTravelDates = portalService.buildTravelDisplayText(
    normalized.travelDates.start,
    normalized.travelDates.end
  );
  normalized.travelDates.displayText = syncedTravelDates || normalized.travelDates.displayText || '';

  return normalized;
}

// ─── Admin Endpoints ─────────────────────────────────────────────

/**
 * POST /api/admin/portals
 * Create a new portal.
 */
async function createPortal(req, res) {
  try {
    const errors = portalService.validatePortalData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const portal = await portalService.createPortal(req.body);
    console.log(`✅ Portal created: ${portal.slug}`);

    res.status(201).json({ success: true, portal: normalizePortalMedia(portal) });
  } catch (error) {
    console.error('❌ Create portal error:', error.message);
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/admin/portals
 * List all portals (admin view — includes inactive).
 */
async function getAllPortals(req, res) {
  try {
    const portals = await portalService.getAllPortals();
    const stats = await portalService.getPortalStats();
    res.json({
      success: true,
      portals: portals.map((portal) => normalizePortalMedia(portal)),
      stats,
    });
  } catch (error) {
    console.error('❌ Get portals error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/admin/portals/:id
 * Get a single portal by ID.
 */
async function getPortalById(req, res) {
  try {
    const portal = await portalService.getPortalById(req.params.id);
    if (!portal) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }
    res.json({ success: true, portal: normalizePortalMedia(portal) });
  } catch (error) {
    console.error('❌ Get portal error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PUT /api/admin/portals/:id
 * Update a portal.
 */
async function updatePortal(req, res) {
  try {
    const errors = portalService.validatePortalData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const portal = await portalService.updatePortal(req.params.id, req.body);
    if (!portal) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }

    console.log(`✅ Portal updated: ${portal.slug}`);
    res.json({ success: true, portal: normalizePortalMedia(portal) });
  } catch (error) {
    console.error('❌ Update portal error:', error.message);
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

/**
 * DELETE /api/admin/portals/:id
 * Delete a portal.
 */
async function deletePortal(req, res) {
  try {
    const deleted = await portalService.deletePortal(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }

    console.log(`🗑️  Portal deleted: ${req.params.id}`);
    res.json({ success: true, message: 'Portal deleted successfully' });
  } catch (error) {
    console.error('❌ Delete portal error:', error.message);
    const status = error.message === 'Do you wanna start a war?' ? 403 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

/**
 * PATCH /api/admin/portals/:id/toggle
 * Toggle portal active/inactive status.
 */
async function togglePortalStatus(req, res) {
  try {
    const portal = await portalService.togglePortalStatus(req.params.id);
    if (!portal) {
      return res.status(404).json({ success: false, error: 'Portal not found' });
    }

    console.log(`🔄 Portal ${portal.slug} is now ${portal.isActive ? 'active' : 'inactive'}`);
    res.json({ success: true, portal });
  } catch (error) {
    console.error('❌ Toggle portal error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/admin/upload-media
 * Upload media (hero image/video, logo) to Google Drive.
 * Returns the public URL and file ID.
 */
async function uploadMedia(req, res) {
  const tempFiles = [];

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    tempFiles.push(req.file.path);

    const mediaType = req.body.mediaType || 'hero'; // 'hero' | 'logo'
    const portalId = req.body.portalId || '';
    let folderId = process.env.MEDIA_FOLDER_ID;

    if (portalId) {
      const portal = await portalService.getPortalById(portalId);
      if (!portal) {
        return res.status(404).json({ success: false, error: 'Portal not found for media upload' });
      }
      folderId = portal.driveFolderId || folderId;
    }

    if (!folderId) {
      return res.status(500).json({
        success: false,
        error: 'Media folder not configured. Set MEDIA_FOLDER_ID in .env',
      });
    }

    const fileName = `portal-${mediaType}-${Date.now()}${require('path').extname(req.file.originalname)}`;
    const optimizationCategory = req.file.mimetype?.startsWith('image/') ? 'portal-media' : 'document';
    const optimizedMedia = await uploadOptimizationService.optimizeStoredFile(req.file.path, {
      category: optimizationCategory,
      mimeType: req.file.mimetype,
    });
    tempFiles.push(...optimizedMedia.cleanupPaths);
    const optimizedFileName = `portal-${mediaType}-${Date.now()}${optimizedMedia.extension || require('path').extname(req.file.originalname)}`;
    const uploadResult = await driveService.uploadFile(
      optimizedMedia.path,
      optimizedFileName,
      folderId,
      optimizedMedia.mimeType
    );

    // Make file publicly accessible
    let publicUrl = uploadResult.webViewLink || '';
    try {
      const publicResult = await driveService.makePublic(uploadResult.id);
      publicUrl = publicResult.webViewLink || publicUrl;
    } catch (err) {
      console.warn('⚠️  Could not make file public:', err.message);
    }

    res.json({
      success: true,
      file: {
        id: uploadResult.id,
        url: `/api/media/${uploadResult.id}`,
        name: optimizedFileName,
        mimeType: optimizedMedia.mimeType,
      },
    });
  } catch (error) {
    console.error('❌ Media upload error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    tempFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * GET /api/admin/stats
 * Get dashboard statistics.
 */
async function getStats(req, res) {
  try {
    const stats = await portalService.getPortalStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Get stats error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ─── Public Endpoint ─────────────────────────────────────────────

/**
 * GET /api/portals/:slug
 * Get portal config by slug (public — only active portals).
 */
async function getPublicPortal(req, res) {
  try {
    const portal = await portalService.getPortalBySlug(req.params.slug);
    if (!portal) {
      return res.status(404).json({
        success: false,
        error: 'Portal not found or inactive',
      });
    }

    // Strip admin-only fields from public response
    const publicPortal = normalizePortalMedia({ ...portal });
    delete publicPortal.googleSheetId;
    delete publicPortal.googleSheetName;
    delete publicPortal.masterSheetShortcutId;
    delete publicPortal.portalFolderId;
    delete publicPortal.driveFolderId;
    delete publicPortal.photoFolderId;
    delete publicPortal.passportFrontFolderId;
    delete publicPortal.passportBackFolderId;
    delete publicPortal.passportMergedFolderId;
    delete publicPortal.panFolderId;

    res.json({ success: true, portal: publicPortal });
  } catch (error) {
    console.error('❌ Get public portal error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/media/:fileId
 * Stream Drive-hosted media through the backend so browsers can render it reliably.
 */
async function getMedia(req, res) {
  try {
    const fileId = driveService.extractDriveFileId(req.params.fileId);
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'Invalid media file id' });
    }

    const driveResponse = await driveService.downloadFileStream(fileId, req.headers.range);
    const contentType = driveResponse.headers?.['content-type'] || 'application/octet-stream';
    const contentLength = driveResponse.headers?.['content-length'];
    const contentRange = driveResponse.headers?.['content-range'];
    const acceptRanges = driveResponse.headers?.['accept-ranges'] || 'bytes';

    res.status(req.headers.range ? 206 : 200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    driveResponse.data.on('error', (error) => {
      console.error('❌ Media stream error:', error.message);
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.destroy(error);
      }
    });

    driveResponse.data.pipe(res);
  } catch (error) {
    console.error('❌ Get media error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  createPortal,
  getAllPortals,
  getPortalById,
  updatePortal,
  deletePortal,
  togglePortalStatus,
  uploadMedia,
  getStats,
  getPublicPortal,
  getMedia,
};
