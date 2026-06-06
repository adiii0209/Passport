/**
 * PDF Merge Service
 * Merges passport front and back files (images or PDFs) into a single 2-page PDF document.
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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
      } else {
        // Downscale and recompress image inputs before embedding so merged PDFs stay small.
        const optimizedImageBuffer = await sharp(fileBytes, { failOn: 'none' })
          .rotate()
          .resize({
            width: 1800,
            withoutEnlargement: true,
            fit: 'inside',
          })
          .jpeg({
            quality: 72,
            mozjpeg: true,
            chromaSubsampling: '4:2:0',
          })
          .toBuffer();

        const jpgImage = await pdfDoc.embedJpg(optimizedImageBuffer);
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
    const message = String(error?.message || error || 'Unknown PDF merge error');
    throw new Error(`Failed to merge passport pages into PDF: ${message}`);
  }
}

module.exports = {
  mergeToPdf,
};
