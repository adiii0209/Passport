/**
 * Portal Service
 * CRUD operations for portal configurations stored in MongoDB.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('./db');
const driveService = require('./driveService');
const sheetsService = require('./sheetsService');

const COLLECTION = 'portals';
const ROOT_PORTAL_SLUG = 'root';
const ROOT_PORTAL_TITLE = 'Root Portal';

/**
 * Default document upload fields for new portals.
 */
const DEFAULT_REQUIRED_DOCUMENTS = [
  { key: 'passport_front', label: 'Passport Front', required: true, helperText: 'Ensure the photo page is clear and glare-free.' },
  { key: 'passport_back', label: 'Passport Back', required: true, helperText: 'Upload the address page from your passport.' },
  { key: 'pan_card', label: 'PAN Card', required: true, helperText: 'Capture the full card within the frame.' },
  { key: 'selfie', label: 'Profile Photo', required: true, helperText: 'Look straight into the camera in good lighting.' },
];

const DEFAULT_REQUIRED_FORM_FIELDS = {
  contact_number: true,
  email: true,
  meal_preference: true,
};

function buildPortalDocument(data = {}) {
  return {
    slug: normalizeSlug(data.slug),
    title: data.title || '',
    subtitle: data.subtitle || '',
    travelDates: normalizeTravelDates(data.travelDates),
    hero: {
      type: data.hero?.type || 'image',
      url: data.hero?.url || '',
      driveFileId: data.hero?.driveFileId || '',
    },
    logo: {
      url: data.logo?.url || '',
      driveFileId: data.logo?.driveFileId || '',
    },
    theme: {
      primaryColor: data.theme?.primaryColor || '#6366f1',
      accentColor: data.theme?.accentColor || '#f59e0b',
      heroOverlayOpacity: data.theme?.heroOverlayOpacity ?? 0.4,
    },
    requiredFormFields: {
      ...DEFAULT_REQUIRED_FORM_FIELDS,
      ...(data.requiredFormFields || {}),
    },
    requiredDocuments: data.requiredDocuments || DEFAULT_REQUIRED_DOCUMENTS,
    allowedEmailDomains: data.allowedEmailDomains || [],
    highlights: data.highlights || [],
    googleSheetId: data.googleSheetId || '',
    googleSheetName: data.googleSheetName || '',
    masterSheetShortcutId: data.masterSheetShortcutId || '',
    driveFolderId: data.driveFolderId || '',
    portalFolderId: data.portalFolderId || '',
    photoFolderId: data.photoFolderId || '',
    passportFrontFolderId: data.passportFrontFolderId || '',
    passportBackFolderId: data.passportBackFolderId || '',
    passportMergedFolderId: data.passportMergedFolderId || '',
    panFolderId: data.panFolderId || '',
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    isRootPortal: Boolean(data.isRootPortal),
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
  };
}

function getRootPortalSeed() {
  return buildPortalDocument({
    slug: ROOT_PORTAL_SLUG,
    title: ROOT_PORTAL_TITLE,
    subtitle: 'Primary root portal configuration for the default registration experience.',
    isActive: true,
    isRootPortal: true,
    travelDates: {
      start: '',
      end: '',
      displayText: '',
    },
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
    requiredFormFields: DEFAULT_REQUIRED_FORM_FIELDS,
    allowedEmailDomains: [],
    highlights: [],
  });
}

function isProtectedRootPortal(portal) {
  return Boolean(portal?.isRootPortal);
}

async function ensureRootPortalExists() {
  const db = getDb();
  const collection = db.collection(COLLECTION);

  const existingRoot = await collection.findOne({
    $or: [
      { isRootPortal: true },
      { slug: ROOT_PORTAL_SLUG },
    ],
  });

  if (existingRoot) {
    const needsRootFlag = !existingRoot.isRootPortal;
    const needsRootTitle = !existingRoot.title;
    const desiredSheetConfig = await resolvePortalSheetConfig({ ...existingRoot, isRootPortal: true }).catch((error) => {
      console.error('⚠️  Root portal sheet provisioning failed:', error.message);
      return {};
    });
    const needsSheetBinding =
      (desiredSheetConfig.googleSheetId && existingRoot.googleSheetId !== desiredSheetConfig.googleSheetId)
      || (desiredSheetConfig.googleSheetName && existingRoot.googleSheetName !== desiredSheetConfig.googleSheetName);

    if (needsRootFlag || needsRootTitle || needsSheetBinding) {
      const updates = {
        updatedAt: new Date(),
        ...desiredSheetConfig,
      };

      if (needsRootFlag) {
        updates.isRootPortal = true;
      }
      if (needsRootTitle) {
        updates.title = ROOT_PORTAL_TITLE;
      }

      const result = await collection.findOneAndUpdate(
        { _id: existingRoot._id },
        { $set: updates },
        { returnDocument: 'after' }
      );
      return result || { ...existingRoot, ...updates };
    }

    return existingRoot;
  }

  const rootPortal = getRootPortalSeed();
  const result = await collection.insertOne(rootPortal);
  const createdRootPortal = { ...rootPortal, _id: result.insertedId };

  const infrastructure = await provisionPortalInfrastructure(createdRootPortal);
  if (Object.keys(infrastructure).length > 0) {
    await collection.updateOne(
      { _id: result.insertedId },
      {
        $set: {
          ...infrastructure,
          updatedAt: new Date(),
        },
      }
    );
    return { ...createdRootPortal, ...infrastructure };
  }

  return createdRootPortal;
}

/**
 * Validate and normalize a portal slug.
 * Must be lowercase, alphanumeric + hyphens, 3-50 chars.
 */
function normalizeSlug(slug) {
  return String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatTravelDate(dateStr, includeYear = false) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function buildTravelDisplayText(start, end) {
  const startLabel = formatTravelDate(start);
  const endLabel = formatTravelDate(end, true);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }

  return startLabel || endLabel || '';
}

function normalizeTravelDates(travelDates = {}) {
  const start = travelDates.start || '';
  const end = travelDates.end || '';

  return {
    start,
    end,
    displayText: buildTravelDisplayText(start, end),
  };
}

function sanitizePortalFolderName(value) {
  return driveService.sanitizeDriveFileLabel(value) || 'Portal';
}

async function resolvePortalSheetConfig(portal) {
  const masterSpreadsheetId = process.env.GOOGLE_MASTER_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  if (!masterSpreadsheetId) {
    console.warn('⚠️  GOOGLE_MASTER_SHEET_ID/GOOGLE_SHEET_ID is not configured. Skipping portal sheet provisioning.');
    return {};
  }

  const sheetName = isProtectedRootPortal(portal)
    ? await sheetsService.getFirstSheetName(masterSpreadsheetId)
    : sheetsService.normalizeSheetName(portal.slug || portal.title || 'Portal');

  await sheetsService.ensureHeaders(masterSpreadsheetId, sheetName, sheetsService.REGISTRATION_HEADERS);

  return {
    googleSheetId: masterSpreadsheetId,
    googleSheetName: sheetName,
  };
}

async function createPortalDriveFolders(portal) {
  const mediaRootFolderId = process.env.MEDIA_FOLDER_ID;
  if (!mediaRootFolderId) {
    console.warn('⚠️  MEDIA_FOLDER_ID is not configured. Skipping portal folder provisioning.');
    return {};
  }

  const portalFolderName = sanitizePortalFolderName(`${portal.title || portal.slug}`);
  const portalRootFolder = await driveService.createFolder(portalFolderName, mediaRootFolderId);

  const [passportFrontFolder, passportBackFolder, panFolder, passportMergedFolder, photoFolder] = await Promise.all([
    driveService.createFolder('Passport Front', portalRootFolder.id),
    driveService.createFolder('Passport Back', portalRootFolder.id),
    driveService.createFolder('PAN', portalRootFolder.id),
    driveService.createFolder('Passport Merged', portalRootFolder.id),
    driveService.createFolder('Photo', portalRootFolder.id),
  ]);

  const masterSpreadsheetId = process.env.GOOGLE_MASTER_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  let masterSheetShortcutId = '';
  if (masterSpreadsheetId) {
    try {
      const shortcut = await driveService.createShortcut(
        masterSpreadsheetId,
        `${portalFolderName} Sheet`,
        portalRootFolder.id
      );
      masterSheetShortcutId = shortcut.id;
    } catch (error) {
      console.error('⚠️  Could not create portal sheet shortcut:', error.message);
    }
  }

  return {
    driveFolderId: portalRootFolder.id,
    portalFolderId: portalRootFolder.id,
    masterSheetShortcutId,
    passportFrontFolderId: passportFrontFolder.id,
    passportBackFolderId: passportBackFolder.id,
    panFolderId: panFolder.id,
    passportMergedFolderId: passportMergedFolder.id,
    photoFolderId: photoFolder.id,
  };
}

async function createPortalSheetTab(portal) {
  const masterSpreadsheetId = process.env.GOOGLE_MASTER_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  if (!masterSpreadsheetId) {
    console.warn('⚠️  GOOGLE_MASTER_SHEET_ID/GOOGLE_SHEET_ID is not configured. Skipping portal sheet provisioning.');
    return {};
  }

  const sheetName = sheetsService.normalizeSheetName(portal.slug || portal.title || 'Portal');
  await sheetsService.ensureHeaders(masterSpreadsheetId, sheetName, sheetsService.REGISTRATION_HEADERS);

  return {
    googleSheetId: masterSpreadsheetId,
    googleSheetName: sheetName,
  };
}

async function provisionPortalInfrastructure(portal) {
  const [folderUpdates, sheetUpdates] = await Promise.all([
    createPortalDriveFolders(portal).catch((error) => {
      console.error('⚠️  Portal folder provisioning failed:', error.message);
      return {};
    }),
    resolvePortalSheetConfig(portal).catch((error) => {
      console.error('⚠️  Portal sheet provisioning failed:', error.message);
      return {};
    }),
  ]);

  return {
    ...folderUpdates,
    ...sheetUpdates,
  };
}

/**
 * Validate portal data before insert/update.
 */
function validatePortalData(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.slug !== undefined) {
    const slug = normalizeSlug(data.slug);
    if (!slug || slug.length < 3) {
      errors.push('Slug must be at least 3 characters (lowercase letters, numbers, hyphens)');
    }
    if (slug.length > 50) {
      errors.push('Slug must be 50 characters or less');
    }
    // Prevent reserved slugs
    const reserved = ['admin', 'api', 'upload', 'selfie', 'details', 'success', 'register', 'login', 'health'];
    if (reserved.includes(slug)) {
      errors.push(`"${slug}" is a reserved slug and cannot be used`);
    }
  }

  if (!isUpdate || data.title !== undefined) {
    if (!isUpdate && (!data.title || !data.title.trim())) {
      errors.push('Title is required');
    }
  }

  if (data.allowedEmailDomains && !Array.isArray(data.allowedEmailDomains)) {
    errors.push('allowedEmailDomains must be an array');
  }

  if (data.requiredDocuments && !Array.isArray(data.requiredDocuments)) {
    errors.push('requiredDocuments must be an array');
  }

  if (data.requiredFormFields && typeof data.requiredFormFields !== 'object') {
    errors.push('requiredFormFields must be an object');
  }

  return errors;
}

/**
 * Create a new portal.
 */
async function createPortal(data) {
  const db = getDb();
  const collection = db.collection(COLLECTION);

  const slug = normalizeSlug(data.slug);

  // Check slug uniqueness
  const existing = await collection.findOne({ slug });
  if (existing) {
    throw new Error(`A portal with slug "${slug}" already exists`);
  }

  const portal = buildPortalDocument(data);

  const result = await collection.insertOne(portal);
  const createdPortal = { ...portal, _id: result.insertedId };

  const infrastructure = await provisionPortalInfrastructure(createdPortal);
  if (Object.keys(infrastructure).length > 0) {
    await collection.updateOne(
      { _id: result.insertedId },
      {
        $set: {
          ...infrastructure,
          updatedAt: new Date(),
        },
      }
    );
    return { ...createdPortal, ...infrastructure };
  }

  return createdPortal;
}

/**
 * Get a portal by its slug (public — only returns active portals).
 */
async function getPortalBySlug(slug) {
  if (normalizeSlug(slug) === ROOT_PORTAL_SLUG) {
    await ensureRootPortalExists();
  }
  const db = getDb();
  return db.collection(COLLECTION).findOne({
    slug: normalizeSlug(slug),
    isActive: true,
  });
}

/**
 * Get a portal by its slug (admin — returns regardless of active status).
 */
async function getPortalBySlugAdmin(slug) {
  if (normalizeSlug(slug) === ROOT_PORTAL_SLUG) {
    await ensureRootPortalExists();
  }
  const db = getDb();
  return db.collection(COLLECTION).findOne({ slug: normalizeSlug(slug) });
}

/**
 * Get all portals (admin view — includes inactive).
 */
async function getAllPortals() {
  await ensureRootPortalExists();
  const db = getDb();
  return db.collection(COLLECTION)
    .find({})
    .sort({ isRootPortal: -1, createdAt: -1 })
    .toArray();
}

/**
 * Get a portal by its MongoDB _id.
 */
async function getPortalById(id) {
  const db = getDb();
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
}

/**
 * Update a portal by ID.
 */
async function updatePortal(id, updates) {
  const db = getDb();
  const collection = db.collection(COLLECTION);
  const existingPortal = await collection.findOne({ _id: new ObjectId(id) });

  if (!existingPortal) {
    return null;
  }

  if (isProtectedRootPortal(existingPortal)) {
    delete updates.slug;
    delete updates.isRootPortal;
  }

  // If slug is being updated, check uniqueness
  if (updates.slug) {
    updates.slug = normalizeSlug(updates.slug);
    const existing = await collection.findOne({
      slug: updates.slug,
      _id: { $ne: new ObjectId(id) },
    });
    if (existing) {
      throw new Error(`A portal with slug "${updates.slug}" already exists`);
    }
  }

  // Remove fields that shouldn't be updated directly
  delete updates._id;
  delete updates.createdAt;

  if (updates.travelDates) {
    updates.travelDates = normalizeTravelDates(updates.travelDates);
  }

  const nextTitle = updates.title !== undefined ? updates.title : existingPortal.title;
  const titleChanged =
    updates.title !== undefined && String(nextTitle || '').trim() !== String(existingPortal.title || '').trim();

  if (titleChanged && existingPortal.driveFolderId) {
    const nextFolderName = sanitizePortalFolderName(nextTitle || existingPortal.slug);
    try {
      await driveService.renameFolder(existingPortal.driveFolderId, nextFolderName);
    } catch (error) {
      console.error('⚠️  Could not rename portal Drive folder:', error.message);
    }
  }

  if (isProtectedRootPortal(existingPortal)) {
    const rootSheetConfig = await resolvePortalSheetConfig(existingPortal).catch((error) => {
      console.error('⚠️  Root portal sheet provisioning failed:', error.message);
      return {};
    });
    Object.assign(updates, rootSheetConfig);
  }

  updates.updatedAt = new Date();

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );

  return result;
}

/**
 * Toggle portal active status.
 */
async function togglePortalStatus(id) {
  const db = getDb();
  const portal = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });

  if (!portal) {
    throw new Error('Portal not found');
  }

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        isActive: !portal.isActive,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  return result;
}

/**
 * Delete a portal by ID.
 */
async function deletePortal(id) {
  const db = getDb();
  const collection = db.collection(COLLECTION);
  const portal = await collection.findOne({ _id: new ObjectId(id) });

  if (!portal) {
    return false;
  }

  if (isProtectedRootPortal(portal)) {
    throw new Error('Do you wanna start a war?');
  }

  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

/**
 * Get portal count statistics.
 */
async function getPortalStats() {
  const db = getDb();
  const collection = db.collection(COLLECTION);

  const [total, active] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ isActive: true }),
  ]);

  return { total, active, inactive: total - active };
}

// Override the initial implementation with a cheaper steady-state path.
// Once the root portal exists and has sheet binding, this avoids Google Sheets roundtrips on every load.
async function ensureRootPortalExists() {
  const db = getDb();
  const collection = db.collection(COLLECTION);

  const existingRoot = await collection.findOne({
    $or: [
      { isRootPortal: true },
      { slug: ROOT_PORTAL_SLUG },
    ],
  });

  if (existingRoot) {
    const needsRootFlag = !existingRoot.isRootPortal;
    const needsRootTitle = !existingRoot.title;
    const needsSheetBinding = !existingRoot.googleSheetId || !existingRoot.googleSheetName;

    if (!needsRootFlag && !needsRootTitle && !needsSheetBinding) {
      return existingRoot;
    }

    const desiredSheetConfig = needsSheetBinding
      ? await resolvePortalSheetConfig({ ...existingRoot, isRootPortal: true }).catch((error) => {
          console.error('Root portal sheet provisioning failed:', error.message);
          return {};
        })
      : {};

    const updates = {
      updatedAt: new Date(),
      ...desiredSheetConfig,
    };

    if (needsRootFlag) {
      updates.isRootPortal = true;
    }
    if (needsRootTitle) {
      updates.title = ROOT_PORTAL_TITLE;
    }

    const result = await collection.findOneAndUpdate(
      { _id: existingRoot._id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result || { ...existingRoot, ...updates };
  }

  const rootPortal = getRootPortalSeed();
  const result = await collection.insertOne(rootPortal);
  const createdRootPortal = { ...rootPortal, _id: result.insertedId };

  const infrastructure = await provisionPortalInfrastructure(createdRootPortal);
  if (Object.keys(infrastructure).length > 0) {
    await collection.updateOne(
      { _id: result.insertedId },
      {
        $set: {
          ...infrastructure,
          updatedAt: new Date(),
        },
      }
    );
    return { ...createdRootPortal, ...infrastructure };
  }

  return createdRootPortal;
}

module.exports = {
  createPortal,
  ensureRootPortalExists,
  getPortalBySlug,
  getPortalBySlugAdmin,
  getAllPortals,
  getPortalById,
  updatePortal,
  togglePortalStatus,
  deletePortal,
  getPortalStats,
  validatePortalData,
  normalizeSlug,
  formatTravelDate,
  buildTravelDisplayText,
  normalizeTravelDates,
  provisionPortalInfrastructure,
  isProtectedRootPortal,
  ROOT_PORTAL_SLUG,
  ROOT_PORTAL_TITLE,
  DEFAULT_REQUIRED_DOCUMENTS,
  DEFAULT_REQUIRED_FORM_FIELDS,
};
