/**
 * Google Sheets Service
 * Stores registration data in a Google Sheet
 * Auto-creates headers on first write
 * Supports per-portal sheet overrides
 */

const { google } = require('googleapis');

function getSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

const REGISTRATION_HEADERS = [
  'Registration ID',
  'Timestamp',
  'Portal',
  'Portal Title',
  'Given Name',
  'Surname',
  'Full Name',
  'Passport No.',
  'Date of Birth',
  'Date of Issue',
  'Date of Expiry',
  'Place of Birth',
  'Place of Issue',
  'Passport Address',
  'REMARK',
  'LAST DATE OF VACCINATION',
  'PHOTO',
  'PAN CARD',
  'DOMESTIC ID',
  'CONTACT NO',
  'EMAIL',
  'Passport Front Link',
  'Passport Back Link',
  'Passport Merged Link',
  'PAN Card Link',
  'Selfie Link',
  'OCR Raw Text',
];

function quoteSheetName(sheetName) {
  return `'${String(sheetName || 'Sheet1').replace(/'/g, "''")}'`;
}

function columnIndexToLetter(index) {
  let n = index;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || 'A';
}

function normalizeSheetName(name) {
  const cleaned = String(name || 'Portal')
    .replace(/[\[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || 'Portal').slice(0, 99);
}

async function getSpreadsheet(spreadsheetId) {
  const sheets = getSheetsClient();
  return sheets.spreadsheets.get({ spreadsheetId });
}

async function getFirstSheetName(spreadsheetId) {
  const response = await getSpreadsheet(spreadsheetId);
  const firstSheetTitle = response.data.sheets?.[0]?.properties?.title;
  return normalizeSheetName(firstSheetTitle || 'Sheet1');
}

async function ensureSheetTab(spreadsheetId, sheetName) {
  const sheets = getSheetsClient();
  const normalizedName = normalizeSheetName(sheetName);
  try {
    const spreadsheet = await getSpreadsheet(spreadsheetId);
    const existing = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === normalizedName
    );

    if (!existing) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: normalizedName,
                },
              },
            },
          ],
        },
      });
      console.log(`📄 Created sheet tab: ${normalizedName}`);
    }
  } catch (error) {
    console.error(`⚠️  Could not ensure sheet tab "${normalizedName}":`, error.message);
  }

  return normalizedName;
}

async function ensureHeaders(spreadsheetId, sheetName, headers = REGISTRATION_HEADERS) {
  const sheets = getSheetsClient();
  const normalizedName = await ensureSheetTab(spreadsheetId, sheetName);
  const endColumn = columnIndexToLetter(headers.length);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheetName(normalizedName)}!A1:${endColumn}1`,
    });

    const existingHeaders = response.data.values?.[0] || [];
    const hasNoHeaders = existingHeaders.length === 0;
    const headersMismatch =
      existingHeaders.length !== headers.length
      || headers.some((header, index) => String(existingHeaders[index] || '').trim() !== header);

    if (hasNoHeaders || headersMismatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${quoteSheetName(normalizedName)}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
      console.log(
        `${hasNoHeaders ? '📊 Sheet headers created' : '📊 Sheet headers synced'} for ${normalizedName}`
      );
    }
  } catch (error) {
    console.error(`⚠️  Could not verify sheet headers for ${normalizedName}:`, error.message);
  }

  return normalizedName;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const match = String(dateStr).match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
  if (!match) return dateStr;
  const [, day, month, year] = match;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = parseInt(month, 10);
  if (m >= 1 && m <= 12) {
    return `${day}-${monthNames[m - 1]}-${year}`;
  }
  return dateStr;
}

function getISTTimestamp() {
  const date = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[istDate.getUTCMonth()];
  const year = istDate.getUTCFullYear();
  
  let hours = istDate.getUTCHours();
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year} ${strHours}:${minutes}:${seconds} ${ampm} IST`;
}

/**
 * Append a registration record to a Google Sheet.
 * @param {Object} data - Registration record data
 * @param {string} [overrideSheetId] - Optional sheet ID override (for portal-specific sheets)
 */
function buildRegistrationRow(data) {
  return [
    data.registrationId || '',
    getISTTimestamp(),
    data.portalSlug || 'default',
    data.portalTitle || 'Default',
    data.given_name || '',
    data.surname || '',
    data.full_name || '',
    data.passport_number || '',
    formatDate(data.date_of_birth),
    formatDate(data.date_of_issue),
    formatDate(data.date_of_expiry),
    data.place_of_birth || '',
    data.place_of_issue || '',
    data.passport_address || '',
    data.remark || '',
    data.last_date_of_vaccination || '',
    data.photo || '',
    data.pan_card || '',
    data.domestic_id || '',
    data.contact_number || '',
    data.email || '',
    data.passportFrontLink || '',
    data.passportBackLink || '',
    data.passportMergedLink || '',
    data.panCardLink || '',
    data.selfieLink || '',
    data.ocrRawText || '',
  ];
}

async function appendRegistration(data, options = {}) {
  const resolvedOptions = typeof options === 'string' ? { spreadsheetId: options } : (options || {});
  const spreadsheetId = resolvedOptions.spreadsheetId || process.env.GOOGLE_SHEET_ID;
  const sheetName = resolvedOptions.sheetName || 'Sheet1';

  if (!spreadsheetId || spreadsheetId === 'your_sheet_id_here') {
    console.warn('⚠️  Google Sheet ID not configured. Skipping sheet storage.');
    return null;
  }

  const normalizedSheetName = await ensureHeaders(spreadsheetId, sheetName, REGISTRATION_HEADERS);
  const row = buildRegistrationRow(data);
  const endColumn = columnIndexToLetter(REGISTRATION_HEADERS.length);

  const sheets = getSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quoteSheetName(normalizedSheetName)}!A:${endColumn}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    console.log(`📊 Registration data saved to Google Sheets (${spreadsheetId.substring(0, 8)}...)`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to save to Google Sheets:', error.message);
    console.warn('⚠️  Continuing registration without saving to Sheets.');
    return null;
  }
}

module.exports = {
  REGISTRATION_HEADERS,
  normalizeSheetName,
  getFirstSheetName,
  ensureSheetTab,
  ensureHeaders,
  buildRegistrationRow,
  appendRegistration,
};
