/**
 * OCR Service (backend/src/services/ocrService.js)
 * Dedicated module for handling screenshot OCR processing, reviewer name extraction,
 * fuzzy & relaxed review comment matching (targeting FIRST 4 WORDS), and avatar cropping.
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
 * Strips punctuation, quotes, emojis, special symbols, line breaks, and extra whitespace.
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/["'“”‘’`.,\/#!$%\^&\*;:{}=\-_`~()?<>{}\[\]|\+\\]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes string for strict alphanumeric character-by-character matching
 */
function cleanStr(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates similarity score (0.0 to 1.0) based on normalized Levenshtein distance.
 */
function calculateSimilarityScore(str1, str2) {
  const norm1 = cleanStr(str1);
  const norm2 = cleanStr(str2);
  if (!norm1 && !norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;
  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 1.0;

  const dist = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  return maxLen === 0 ? 1.0 : Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Replaces common OCR character confusions (e.g. l/1/i, O/0, S/5, B/8).
 */
function substituteOcrConfusions(text) {
  return cleanStr(text)
    .replace(/[1l!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/8/g, 'b');
}

/**
 * Performs Multi-level Fuzzy & Relaxed match verification targeting the FIRST 4 WORDS of expected comment inside OCR text.
 * Threshold defaults to 0.60 (60% similarity).
 */
function verifyFuzzyCommentMatch(ocrText, expectedComment, threshold = 0.60) {
  if (!expectedComment || !String(expectedComment).trim()) {
    return { isMatched: true, similarityScore: 1.0, matchedComment: '' };
  }
  if (!ocrText || !String(ocrText).trim()) {
    return { isMatched: false, similarityScore: 0.0, matchedComment: expectedComment };
  }

  // Extract first 4 words of expected comment
  const rawWords = String(expectedComment).trim().split(/\s+/).filter(Boolean);
  const first4Words = rawWords.slice(0, 4).join(' ');

  const cleanOcr = cleanStr(ocrText);
  const cleanTargetFull = cleanStr(expectedComment);
  const cleanTarget4 = cleanStr(first4Words);
  const normOcr = normalizeText(ocrText);
  const normTargetFull = normalizeText(expectedComment);
  const normTarget4 = normalizeText(first4Words);

  // Level 1: First 4 Words / Full Comment Containment Check (100% Match)
  if (cleanOcr.includes(cleanTarget4) || normOcr.includes(normTarget4) ||
      cleanOcr.includes(cleanTargetFull) || normOcr.includes(normTargetFull)) {
    return { isMatched: true, similarityScore: 1.0, matchedComment: expectedComment };
  }

  // Level 2: OCR Character Confusion Substitution Match on First 4 Words (e.g. l vs 1, O vs 0)
  const subOcr = substituteOcrConfusions(ocrText);
  const subTarget4 = substituteOcrConfusions(first4Words);
  const subTargetFull = substituteOcrConfusions(expectedComment);
  if (subOcr.includes(subTarget4) || subOcr.includes(subTargetFull)) {
    return { isMatched: true, similarityScore: 0.95, matchedComment: expectedComment };
  }

  // Level 3: Word-Level Overlap on First 4 Words
  const targetWords4 = normTarget4.split(/\s+/).filter(w => w.length >= 2);
  if (targetWords4.length > 0) {
    let matchedWordCount = 0;
    for (const word of targetWords4) {
      const cleanW = cleanStr(word);
      const subW = substituteOcrConfusions(word);
      if (cleanOcr.includes(cleanW) || subOcr.includes(subW)) {
        matchedWordCount++;
      }
    }
    // Require at least 2 words (or 1 word if comment has only 1 word)
    const requiredMin = Math.min(2, targetWords4.length);
    if (matchedWordCount >= requiredMin) {
      const computedScore = Math.max(0.60, Number((matchedWordCount / targetWords4.length).toFixed(2)));
      return { isMatched: true, similarityScore: computedScore, matchedComment: expectedComment };
    }
  }

  // Level 4: Sliding Window Levenshtein Fuzzy Similarity Search on First 4 Words
  if (cleanTarget4.length > 3 && cleanOcr.length >= cleanTarget4.length) {
    const winLen = cleanTarget4.length;
    let maxWinScore = 0;
    const step = Math.max(1, Math.floor(winLen / 4));

    for (let i = 0; i <= cleanOcr.length - winLen; i += step) {
      const windowSub = cleanOcr.slice(i, i + winLen);
      const score = calculateSimilarityScore(windowSub, cleanTarget4);
      if (score > maxWinScore) {
        maxWinScore = score;
      }
      if (maxWinScore >= 0.85) break;
    }

    if (maxWinScore >= threshold) {
      return { isMatched: true, similarityScore: Number(maxWinScore.toFixed(2)), matchedComment: expectedComment };
    }
  }

  // Level 5: Overall Full String Similarity Score Fallback
  const overallScore = calculateSimilarityScore(ocrText, expectedComment);
  const isMatched = overallScore >= threshold;
  return {
    isMatched,
    similarityScore: Number(overallScore.toFixed(2)),
    matchedComment: isMatched ? expectedComment : ''
  };
}

/**
 * Multi-level fuzzy matching for reviewer name verification
 */
function verifyFuzzyReviewerMatch(ocrText, extractedUserName, reviewerName, threshold = 0.60) {
  if (!reviewerName || !String(reviewerName).trim()) {
    return { isMatched: true, similarityScore: 1.0 };
  }

  const cleanReviewer = cleanStr(reviewerName);
  const cleanExtracted = cleanStr(extractedUserName);
  const cleanOcr = cleanStr(ocrText);

  if (cleanExtracted.includes(cleanReviewer) || cleanReviewer.includes(cleanExtracted) || cleanOcr.includes(cleanReviewer)) {
    return { isMatched: true, similarityScore: 1.0 };
  }

  const nameScore = calculateSimilarityScore(extractedUserName, reviewerName);
  const ocrSubScore = calculateSimilarityScore(cleanOcr, cleanReviewer);
  const maxScore = Math.max(nameScore, ocrSubScore);

  return {
    isMatched: maxScore >= threshold,
    similarityScore: Number(maxScore.toFixed(2))
  };
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
 * Matches target comment in OCR text using fuzzy & relaxed matching algorithm
 */
function matchAssignedComment(ocrText, targetComments = [], threshold = 0.60) {
  if (!ocrText || !targetComments || !targetComments.length) return null;

  for (const comment of targetComments) {
    const res = verifyFuzzyCommentMatch(ocrText, comment, threshold);
    if (res.isMatched) {
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
  normalizeText,
  cleanStr,
  levenshteinDistance,
  calculateSimilarityScore,
  substituteOcrConfusions,
  verifyFuzzyCommentMatch,
  verifyFuzzyReviewerMatch,
  runOcrOnBuffer,
  matchAssignedComment,
  extractReviewerName,
  cropReviewerAvatar
};
