/**
 * Registration Controller
 * Handles the final submission of registration data
 * Uploads selfie, renames Drive files, stores data in Sheets
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const driveService = require('../services/driveService');
const sheetsService = require('../services/sheetsService');
const notificationService = require('../services/notificationService');

/**
 * POST /api/submit-registration
 * Accepts: selfie (file), form data fields, file IDs from extraction
 * Returns: Success response with registration ID
 */
async function submitRegistration(req, res) {
  const tempFiles = [];

  try {
    const registrationId = uuidv4().split('-')[0].toUpperCase();
    const preserveCaseKeys = new Set([
      'email',
      'meal_preference',
      'passportFrontId',
      'passportBackId',
      'passportMergedId',
      'panCardId',
      'passportFrontLink',
      'passportBackLink',
      'passportMergedLink',
      'panCardLink',
      'ocrRawText',
    ]);
    const formData = Object.fromEntries(
      Object.entries(req.body || {}).map(([key, value]) => [
        key,
        typeof value === 'string' && !preserveCaseKeys.has(key) ? value.toUpperCase() : value,
      ])
    );

    console.log(`📋 Processing registration: ${registrationId}`);

    const customerName = driveService.sanitizeDriveFileLabel(formData.full_name) || 'Unknown';

    // 1. Rename existing uploaded documents using proper naming convention
    if (formData.passportFrontId) {
      await driveService.renameFileWithExistingExtension(
        formData.passportFrontId,
        `${customerName} Passport Front`
      );
    }
    if (formData.passportBackId) {
      await driveService.renameFileWithExistingExtension(
        formData.passportBackId,
        `${customerName} Passport Back`
      );
    }
    if (formData.passportMergedId) {
      await driveService.renameFileWithExistingExtension(
        formData.passportMergedId,
        `${customerName} Passport Merged`
      );
    }
    if (formData.panCardId) {
      await driveService.renameFileWithExistingExtension(
        formData.panCardId,
        `${customerName} PAN`
      );
    }

    // 2. Upload selfie to PHOTO folder
    let selfieLink = '';
    if (req.file) {
      tempFiles.push(req.file.path);
      const selfieName = `${customerName} Photo${path.extname(req.file.originalname)}`;
      const selfieUpload = await driveService.uploadFile(
        req.file.path,
        selfieName,
        process.env.PHOTO_FOLDER_ID
      );
      selfieLink = selfieUpload.webViewLink || '';
    }

    let passportFrontLink = formData.passportFrontLink || '';
    let passportBackLink = formData.passportBackLink || '';
    let passportMergedLink = formData.passportMergedLink || '';
    let panCardLink = formData.panCardLink || '';

    // Build the data record for Google Sheets
    const registrationRecord = {
      registrationId,
      given_name: formData.given_name || '',
      surname: formData.surname || '',
      full_name: formData.full_name || '',
      passport_number: formData.passport_number || '',
      date_of_birth: formData.date_of_birth || '',
      date_of_issue: formData.date_of_issue || '',
      date_of_expiry: formData.date_of_expiry || '',
      place_of_birth: formData.place_of_birth || '',
      place_of_issue: formData.place_of_issue || '',
      passport_address: formData.passport_address || '',
      pan_number: formData.pan_number || '',
      contact_number: formData.contact_number || '',
      email: formData.email || '',
      meal_preference: formData.meal_preference || '',
      passportFrontLink,
      passportBackLink,
      passportMergedLink,
      panCardLink,
      selfieLink,
      userFolderLink: '', // No specific user folder anymore
      ocrRawText: formData.ocrRawText || '',
    };

    // Save to Google Sheets
    await sheetsService.appendRegistration(registrationRecord);

    // Send Notification (non-blocking)
    notificationService.sendNotification(registrationRecord).catch(err => console.error(err));

    console.log(`✅ Registration ${registrationId} completed successfully`);

    res.json({
      success: true,
      registrationId,
      message: 'Registration submitted successfully!',
    });
  } catch (error) {
    console.error('❌ Registration submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration submission failed',
    });
  } finally {
    tempFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    });
  }
}

module.exports = {
  submitRegistration,
};
