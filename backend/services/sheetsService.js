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
    new Date().toISOString(),
    data.given_name || '',
    data.surname || '',
    data.full_name || '',
    data.passport_number || '',
    data.date_of_birth || '',
    data.date_of_issue || '',
    data.date_of_expiry || '',
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
