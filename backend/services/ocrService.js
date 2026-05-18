/**
 * OCR Service
 * Orchestrates the Google Drive OCR pipeline:
 *   1. Upload image to Google Drive as Google Doc (triggers OCR)
 *   2. Export text from the created Google Doc
 *   3. Clean up the temporary Google Doc
 */

const driveService = require('./driveService');

/**
 * Extract text from an image using Google Drive's built-in OCR
 * @param {string} filePath - Local path to the image file
 * @param {string} fileName - Original filename
 * @returns {string} - Extracted OCR text
 */
async function extractTextFromImage(filePath, fileName) {
  let ocrDocId = null;

  try {
    // Step 1: Upload image as Google Doc (this triggers OCR)
    console.log(`🔍 Starting OCR for: ${fileName}`);
    const ocrDoc = await driveService.uploadAndConvertToDoc(filePath, fileName);
    ocrDocId = ocrDoc.id;

    // Step 2: Export the text content from the Google Doc
    const text = await driveService.extractTextFromDoc(ocrDocId);
    console.log(`✅ OCR complete for: ${fileName} (${text.length} characters)`);

    return text;
  } catch (error) {
    console.error(`❌ OCR failed for ${fileName}:`, error.message);
    throw new Error(`OCR extraction failed for ${fileName}: ${error.message}`);
  } finally {
    // Step 3: Always clean up the temporary OCR document
    if (ocrDocId) {
      await driveService.deleteFile(ocrDocId);
    }
  }
}

/**
 * Extract text from multiple images and combine the results
 * @param {Array<{filePath: string, fileName: string}>} files - Array of file objects
 * @returns {string} - Combined OCR text from all files
 */
async function extractTextFromMultipleImages(files) {
  const results = [];

  for (const file of files) {
    const text = await extractTextFromImage(file.filePath, file.fileName);
    results.push(text);
  }

  return results.join('\n\n--- PAGE BREAK ---\n\n');
}

module.exports = {
  extractTextFromImage,
  extractTextFromMultipleImages,
};
