/**
 * Google Sheets Service
 * Stores registration data in a Google Sheet
 * Auto-creates headers on first write
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

// Column headers for the registration sheet
const HEADERS = [
  'Registration ID',
  'Timestamp',
  'Given Name',
  'Surname',
  'Full Name',
  'Passport Number',
  'Date of Birth',
  'Date of Issue',
  'Date of Expiry',
  'Place of Birth',
  'Place of Issue',
  'Passport Address',
  'PAN Number',
  'Contact Number',
  'Email Address',
  'Meal Preference',
  'Passport Front Link',
  'Passport Back Link',
  'PAN Card Link',
  'Selfie Link',
  'User Folder Link',
  'OCR Raw Text',
];

async function ensureHeaders(spreadsheetId) {
  const sheets = getSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:V1',
    });

    // If no data or empty, write headers
    if (!response.data.values || response.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADERS],
        },
      });
      console.log('📊 Sheet headers created');
    }
  } catch (error) {
    console.error('⚠️  Could not verify sheet headers:', error.message);
  }
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

async function appendRegistration(data) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId || spreadsheetId === 'your_sheet_id_here') {
    console.warn('⚠️  Google Sheet ID not configured. Skipping sheet storage.');
    return null;
  }

  // Ensure headers exist
  await ensureHeaders(spreadsheetId);

  const row = [
    data.registrationId || '',
    getISTTimestamp(),
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
    data.pan_number || '',
    data.contact_number || '',
    data.email || '',
    data.meal_preference || '',
    data.passportFrontLink || '',
    data.passportBackLink || '',
    data.panCardLink || '',
    data.selfieLink || '',
    data.userFolderLink || '',
    data.ocrRawText || '',
  ];

  const sheets = getSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:V',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    console.log('📊 Registration data saved to Google Sheets');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to save to Google Sheets:', error.message);
    console.warn('⚠️  Continuing registration without saving to Sheets.');
    return null;
  }
}

module.exports = {
  appendRegistration,
};
