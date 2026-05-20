/**
 * PDF Merge Service
 * Merges passport front and back files (images or PDFs) into a single 2-page PDF document.
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Merges passport front and back files and writes the output PDF to outputPath.
 * Supports PDF inputs (copies pages) and image inputs (PNG/JPEG) (embeds as pages).
 * 
 * @param {string} frontPath - Path to the passport front file
 * @param {string} backPath - Path to the passport back file
 * @param {string} outputPath - Path where the merged PDF should be saved
 */
async function mergeToPdf(frontPath, backPath, outputPath) {
  try {
    const pdfDoc = await PDFDocument.create();

    const processFile = async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const fileBytes = fs.readFileSync(filePath);

      if (ext === '.pdf') {
        const srcDoc = await PDFDocument.load(fileBytes);
        const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));
      } else if (ext === '.png') {
        const pngImage = await pdfDoc.embedPng(fileBytes);
        const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pngImage.width,
          height: pngImage.height,
        });
      } else {
        // Treat as JPEG/JPG by default (e.g., .jpg, .jpeg, .webp, etc.)
        // pdf-lib's embedJpg is highly compatible with standard jpeg images
        const jpgImage = await pdfDoc.embedJpg(fileBytes);
        const page = pdfDoc.addPage([jpgImage.width, jpgImage.height]);
        page.drawImage(jpgImage, {
          x: 0,
          y: 0,
          width: jpgImage.width,
          height: jpgImage.height,
        });
      }
    };

    await processFile(frontPath);
    await processFile(backPath);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`✅ Successfully merged passport files into PDF: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error merging passport files to PDF:', error);
    throw new Error(`Failed to merge passport pages into PDF: ${error.message}`);
  }
}

module.exports = {
  mergeToPdf,
};
