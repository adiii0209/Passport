const { google } = require('googleapis');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );
}

// Generate the Google Login URL
function getGoogleAuthUrl(req, res) {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request a refresh token
    prompt: 'consent', // Force consent screen to always get a refresh token
    scope: scopes,
  });

  res.json({ success: true, url });
}

// Handle the OAuth callback
async function handleGoogleCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No authorization code provided.');
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    // Instead of storing tokens on the backend, we encode them and send to frontend
    // Frontend will store them in localStorage and send them in headers for API requests
    const sessionData = {
      tokens,
      user: userInfo.data,
    };
    const tokensBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    // Redirect back to frontend with tokens in the hash or query string
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/?tokens=${encodeURIComponent(tokensBase64)}`);
  } catch (error) {
    console.error('Error exchanging OAuth code:', error);
    res.status(500).send('Authentication failed.');
  }
}

module.exports = {
  getOAuth2Client,
  getGoogleAuthUrl,
  handleGoogleCallback,
};
