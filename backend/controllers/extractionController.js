/**
 * Extraction Controller
 * Handles passport and PAN card extraction endpoints
 * Pipeline: Upload to Centralized Drive → OCR → AI Extraction → Response
 */

const fs = require('fs');
const path = require('path');
const driveService = require('../services/driveService');
const ocrService = require('../services/ocrService');
const aiService = require('../services/aiService');

/**
 * POST /api/extract-passport
 * Accepts: passport_front (file), passport_back (file)
 * Returns: Extracted passport JSON fields and Google Drive File IDs
 */
async function extractPassport(req, res) {
  const files = req.files;
  const tempFiles = [];

  try {
    // Validate that both files are present
    if (!files?.passport_front?.[0] || !files?.passport_back?.[0]) {
      return res.status(400).json({
        success: false,
        error: 'Both passport_front and passport_back images are required',
      });
    }

    const frontFile = files.passport_front[0];
    const backFile = files.passport_back[0];
    tempFiles.push(frontFile.path, backFile.path);

    console.log('📤 Processing passport images...');

    const timestamp = Date.now();
    const tempFrontName = `Pending_PassportFront_${timestamp}${path.extname(frontFile.originalname)}`;
    const tempBackName = `Pending_PassportBack_${timestamp}${path.extname(backFile.originalname)}`;

    // Step 1: Upload originals to specific Drive folders (we'll rename them on final submission)
    const [frontUpload, backUpload] = await Promise.all([
      driveService.uploadFile(frontFile.path, tempFrontName, process.env.PASSPORT_FRONT_FOLDER_ID),
      driveService.uploadFile(backFile.path, tempBackName, process.env.PASSPORT_BACK_FOLDER_ID),
    ]);

    // Step 2: Extract OCR text from both images (this handles the temp Doc internally)
    const ocrText = await ocrService.extractTextFromMultipleImages([
      { filePath: frontFile.path, fileName: 'passport-front' },
      { filePath: backFile.path, fileName: 'passport-back' },
    ]);

    console.log(`📝 Combined OCR text length: ${ocrText.length} characters`);

    // Step 3: Send OCR text to AI for structured extraction
    const passportData = await aiService.extractPassportDetails(ocrText);

    const extractedFullName = driveService.sanitizeDriveFileLabel(passportData.full_name);

    if (extractedFullName) {
      await Promise.all([
        driveService.renameFileWithExistingExtension(
          frontUpload.id,
          `${extractedFullName} Passport Front`
        ),
        driveService.renameFileWithExistingExtension(
          backUpload.id,
          `${extractedFullName} Passport Back`
        ),
      ]);
    }

    // Step 4: Respond with extracted data and file references
    res.json({
      success: true,
      data: passportData,
      files: {
        passport_front: { id: frontUpload.id, link: frontUpload.webViewLink },
        passport_back: { id: backUpload.id, link: backUpload.webViewLink },
      },
      ocrText,
    });

  } catch (error) {
    console.error('❌ Passport extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Passport extraction failed',
    });
  } finally {
    // Clean up local temp files
    tempFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * POST /api/extract-pan
 * Accepts: pan_card (file)
 * Returns: Extracted PAN number JSON and Google Drive File ID
 */
async function extractPan(req, res) {
  const tempFiles = [];

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'PAN card image is required',
      });
    }

    const panFile = req.file;
    tempFiles.push(panFile.path);

    console.log('📤 Processing PAN card image...');

    const timestamp = Date.now();
    const tempPanName = `Pending_PAN_${timestamp}${path.extname(panFile.originalname)}`;

    const requestedFullName = driveService.sanitizeDriveFileLabel(req.body.full_name);
    const finalPanName = requestedFullName
      ? `${requestedFullName} PAN${path.extname(panFile.originalname)}`
      : tempPanName;

    // Upload original to specific Drive folder
    const panUpload = await driveService.uploadFile(panFile.path, finalPanName, process.env.PAN_FOLDER_ID);

    // Extract OCR text
    const ocrText = await ocrService.extractTextFromImage(panFile.path, 'pancard');

    console.log(`📝 PAN OCR text length: ${ocrText.length} characters`);

    // AI extraction
    const panData = await aiService.extractPanDetails(ocrText);

    res.json({
      success: true,
      data: panData,
      file: { id: panUpload.id, link: panUpload.webViewLink },
      ocrText,
    });

  } catch (error) {
    console.error('❌ PAN extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'PAN extraction failed',
    });
  } finally {
    tempFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    });
  }
}

module.exports = {
  extractPassport,
  extractPan,
};
