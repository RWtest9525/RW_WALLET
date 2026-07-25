/**
 * OCR Service (backend/src/services/ocrService.js)
 * Dedicated module for handling screenshot OCR processing, reviewer name extraction,
 * review comment matching, and avatar cropping.
 */

const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

// Regex patterns to skip system status bar items and Play Store UI headers
const OCR_SKIP_PATTERNS = [
  /^\d{1,2}:\d{2}/,                     // Time (e.g., "10:30")
  /^\d{1,3}%$/,                         // Battery percentage
  /LTE|WIFI|4G|5G|VoLTE|KB\/S/i,        // Carrier + Data speed
  /Google Play/i,                       // "Google Play" header
  /^Search/i, /^Apps/i, /^Games/i, /^Offers/i,
  /^Movies/i, /^Books/i,
  /^Ratings and reviews/i,
  /^See all reviews/i,
  /^Post/i, /^Cancel/i,
  /^Edit your review/i,
  /^Edit/i,
  /^Episode/i,
  /^[★☆* ]+\d{1,2}/,                    // Star ratings
  /^[0-9.]+ stars/,
  /^[0-9.,]+ reviews/,
  /^[0-9.]+ [KMG]B/,                    // App size
  /No reviews/i,
  /VoLTE/i, /KB\/S/i,
  /Personal into/i,
  /No data collected/i,
  /Developer contact/i,
  /About this app/i,
  /Rate this app/i,
  /Tell us what you think/i,
  /Write a review/i,
  /Safety/i, /Data privacy/i, /Security/i, /Verified/i,
];

/**
 * Normalizes string for character-by-character matching
 */
function cleanStr(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Runs OCR on an image buffer using OCR.space API with Tesseract.js fallback
 */
async function runOcrOnBuffer(imageBuffer, originalName = 'screenshot.jpg', contentType = 'image/jpeg') {
  let ocrText = '';
  let ocrConfidence = 0;
  let ocrResult = null;
  let ocrSuccess = false;

  const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
  try {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: contentType });
    formData.append('file', blob, originalName);
    formData.append('language', 'eng');
    formData.append('OCREngine', '2');
    formData.append('apikey', ocrApiKey);

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });

    if (ocrResponse.ok) {
      const ocrData = await ocrResponse.json();
      if (ocrData.OCRExitCode === 1 && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
        ocrText = ocrData.ParsedResults[0].ParsedText || '';
        ocrConfidence = 0.99;
        ocrSuccess = true;
        console.log('[OCR-Service] OCR.space Engine 2 completed successfully.');
      } else {
        console.warn('[OCR-Service] OCR.space API error:', ocrData.ErrorMessage || ocrData.OCRExitCode);
      }
    } else {
      console.warn('[OCR-Service] OCR.space HTTP error:', ocrResponse.status);
    }
  } catch (err) {
    console.warn('[OCR-Service] OCR.space call failed, using Tesseract fallback:', err.message);
  }

  if (!ocrSuccess) {
    try {
      ocrResult = await Tesseract.recognize(imageBuffer, 'eng');
      ocrText = (ocrResult.data.text || '').trim();
      ocrConfidence = (ocrResult.data.confidence || 0) / 100;
      console.log('[OCR-Service] Tesseract fallback completed.');
    } catch (ocrErr) {
      console.error('[OCR-Service] Tesseract OCR failed:', ocrErr);
      throw new Error('OCR_RECOGNITION_FAILED');
    }
  }

  return { ocrText, ocrConfidence, ocrResult };
}

/**
 * Matches target comment in OCR text using normalized word check algorithm
 */
function matchAssignedComment(ocrText, targetComments = []) {
  if (!ocrText || !targetComments || !targetComments.length) return null;

  const ocrTextLower = ocrText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const normalizedFullText = ocrTextLower.replace(/\s+/g, '');

  for (const comment of targetComments) {
    const expectedWords = String(comment || '').trim().split(/\s+/).filter(Boolean);
    let matchFound = false;

    if (expectedWords.length >= 2) {
      const word1 = cleanStr(expectedWords[0]);
      const word2 = cleanStr(expectedWords[1]);
      const combined = word1 + word2;

      if (normalizedFullText.includes(combined) || (ocrTextLower.includes(word1) && ocrTextLower.includes(word2))) {
        matchFound = true;
      }
    } else if (expectedWords.length === 1) {
      const word1 = cleanStr(expectedWords[0]);
      if (ocrTextLower.includes(word1)) {
        matchFound = true;
      }
    }

    if (matchFound) {
      return comment;
    }
  }

  return null;
}

/**
 * Extracts reviewer name from OCR text using 'Your review' header and skip patterns
 */
function extractReviewerName(ocrText) {
  if (!ocrText) return 'Unknown User';

  const lines = ocrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const yourReviewPattern = /Your review/i;
  let yourReviewIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (yourReviewPattern.test(lines[i])) {
      yourReviewIdx = i;
      break;
    }
  }

  if (yourReviewIdx !== -1) {
    for (let j = 1; j <= 3; j++) {
      if (yourReviewIdx + j < lines.length) {
        const line = lines[yourReviewIdx + j];
        const isSystemLine = OCR_SKIP_PATTERNS.some(p => p.test(line));
        if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
          return line;
        }
      }
    }
  }

  // Fallback: Check lines for valid reviewer name
  for (const line of lines) {
    const isSystemLine = OCR_SKIP_PATTERNS.some(p => p.test(line));
    if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
      return line;
    }
  }

  return 'Unknown User';
}

/**
 * Crops reviewer avatar from screenshot around reviewer name line
 */
async function cropReviewerAvatar(imageBuffer, nameLine, assignedComment = 'screenshot', gmailName = 'Unknown') {
  try {
    const image = await Jimp.read(imageBuffer);
    const imgWidth = image.bitmap.width;
    const imgHeight = image.bitmap.height;
    const bbox = nameLine ? nameLine.bbox : null;

    if (bbox) {
      const cropX = Math.max(0, Math.min(bbox.x0 - 85, imgWidth - 75));
      const cropY = Math.max(0, Math.min(bbox.y0 - 15, imgHeight - 75));
      const cropW = Math.min(75, imgWidth - cropX);
      const cropH = Math.min(75, imgHeight - cropY);

      if (cropW > 10 && cropH > 10) {
        const avatar = image.clone().crop(cropX, cropY, cropW, cropH);
        const avatarBuffer = await avatar.getBufferAsync(Jimp.MIME_JPEG);
        const safeComment = String(assignedComment || 'screenshot').slice(0, 30).replace(/[<>:"/\\|?*]+/g, '_').trim();
        const safeGmailName = String(gmailName || 'Unknown').replace(/[<>:"/\\|?*]+/g, '_').trim().slice(0, 30);
        const avatarFileName = `${safeGmailName} - ${safeComment} (logo).jpg`;
        return { avatarBuffer, avatarFileName };
      }
    }
  } catch (err) {
    console.error('[OCR-Service] Avatar crop error:', err);
  }
  return null;
}

module.exports = {
  OCR_SKIP_PATTERNS,
  cleanStr,
  runOcrOnBuffer,
  matchAssignedComment,
  extractReviewerName,
  cropReviewerAvatar
};
