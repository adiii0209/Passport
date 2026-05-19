/**
 * AI Extraction Service
 * Uses OpenRouter API to extract structured data from OCR text
 * Supports passport and PAN card extraction
 */

const https = require('https');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Send a prompt to OpenRouter and get a response
 * @param {string} prompt - The prompt to send
 * @returns {string} - AI response content
 */
async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.FRONTEND_URL || 'http://localhost:5173';
  const title = process.env.OPENROUTER_APP_TITLE || 'Travel Registration App';

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env');
  }

  const payload = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1, // Low temperature for consistent extraction
    max_tokens: 1000,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(OPENROUTER_API_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': title,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`OpenRouter API error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
            return;
          }
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('Empty response from OpenRouter'));
            return;
          }
          resolve(content);
        } catch (e) {
          reject(new Error(`Failed to parse OpenRouter response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`OpenRouter request failed: ${error.message}`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Extract passport details from OCR text using AI
 * @param {string} ocrText - Combined OCR text from passport front + back
 * @returns {Object} - Extracted passport fields
 */
async function extractPassportDetails(ocrText) {
  const prompt = `You are a precise passport details parser. Extract structured details from the provided OCR text.

Return ONLY a valid JSON object. No markdown, no code fences, no extra text.

Required JSON Fields:
- given_name (Given name(s) of the traveler. Look for "Given Name" / "दिया गया नाम" or the MRZ line)
- surname (Surname of the traveler. Look for "Surname" / "उपनाम" or the MRZ line)
- full_name (Combined Given Name + Surname, e.g. "TISHA SAMSUKHA")
- passport_number (Look for "Passport No." or the 8-character string e.g. "AH759807")
- date_of_birth (Normalize to DD-MM-YYYY)
- date_of_issue (Normalize to DD-MM-YYYY)
- date_of_expiry (Normalize to DD-MM-YYYY)
- place_of_birth
- place_of_issue
- passport_address

CRITICAL INSTRUCTIONS FOR NAMES:
1. Look at the Machine Readable Zone (MRZ) at the bottom starting with "P<". The first line always follows the format "P<IND[SURNAME]<<[GIVEN_NAME]<<<<...". This is highly structured and serves as the source of truth for the traveler's name.
2. Cross-reference this MRZ line with the "Surname / उपनाम" and "Given Name(s) / दिया गया नाम" labels.
3. DO NOT extract random noise, signatures (like "IKHAIL AUKHA"), or parental names (like "PANKAJ SAMSUKHA") as the main traveler's given name or full name.

OCR TEXT:
${ocrText}`;

  console.log('🤖 Sending passport OCR text to AI for extraction...');
  const response = await callOpenRouter(prompt);

  // Parse the JSON response, handling potential markdown code fences
  const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    console.log('✅ Passport details extracted successfully');
    return parsed;
  } catch (e) {
    console.error('⚠️  AI response was not valid JSON, attempting repair...');
    // Try to find JSON object in the response
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse AI extraction response: ${e.message}`);
  }
}

/**
 * Extract PAN number from OCR text using AI
 * @param {string} ocrText - OCR text from PAN card
 * @returns {Object} - Extracted PAN details { pan_number }
 */
async function extractPanDetails(ocrText) {
  const prompt = `Extract PAN number from OCR text.

Return ONLY valid JSON. No markdown, no code fences, no extra text.

Format:
{
  "pan_number": ""
}

If not found return null.

OCR TEXT:
${ocrText}`;

  console.log('🤖 Sending PAN OCR text to AI for extraction...');
  const response = await callOpenRouter(prompt);

  const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    console.log('✅ PAN details extracted successfully');
    return parsed;
  } catch (e) {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse PAN extraction response: ${e.message}`);
  }
}

module.exports = {
  extractPassportDetails,
  extractPanDetails,
};
