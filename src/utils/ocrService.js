/**
 * Frontend OCR Service (src/utils/ocrService.js)
 * Dedicated module for frontend OCR text extraction, review text parsing below reviewer name,
 * and client-side comment verification.
 */

/**
 * Extracts actual review text from OCR raw text below the reviewer name
 */
export function extractActualReviewText(ocrText = '', reviewerName = '') {
  if (!ocrText) return '';

  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return ocrText;

  let reviewerIdx = -1;
  if (reviewerName) {
    const targetName = reviewerName.trim().toLowerCase();
    reviewerIdx = lines.findIndex(l => l.toLowerCase() === targetName || l.toLowerCase().includes(targetName));
  }

  // If reviewer name line found, extract review text after rating/date line
  if (reviewerIdx !== -1 && reviewerIdx < lines.length - 1) {
    let reviewStartIdx = reviewerIdx + 1;
    const nextLine = lines[reviewStartIdx] || '';
    
    // Skip star rating / date line right below name (e.g. "★★★★★ 2 days ago")
    if (/^[0-9★☆*\s\-\/]+$/.test(nextLine) || nextLine.toLowerCase().includes('ago') || nextLine.toLowerCase().includes('edited')) {
      reviewStartIdx++;
    }

    if (reviewStartIdx < lines.length) {
      return lines.slice(reviewStartIdx).join(' ');
    }
  }

  // Fallback: Skip top status bar / header lines
  const reviewLines = lines.filter(line => {
    const lower = line.toLowerCase();
    return !lower.includes('google play') &&
           !lower.includes('your review') &&
           !lower.includes('ratings and reviews') &&
           !/^\d{1,2}:\d{2}/.test(line) &&
           !/^\d{1,3}%$/.test(line) &&
           !/^[★☆*\s]+$/.test(line);
  });

  return reviewLines.join(' ');
}

/**
 * Runs OCR Space API on client side if needed
 */
export async function runClientOcrSpace(imageBlob, apiKey = 'helloworld') {
  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'screenshot.jpg');
    formData.append('language', 'eng');
    formData.append('OCREngine', '2');
    formData.append('apikey', apiKey);

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      if (data.OCRExitCode === 1 && data.ParsedResults && data.ParsedResults.length > 0) {
        return {
          success: true,
          text: data.ParsedResults[0].ParsedText || ''
        };
      }
    }
  } catch (err) {
    console.warn('[Frontend-OCR] Client OCR.space call failed:', err);
  }
  return { success: false, text: '' };
}

/**
 * Client-side normalized & fuzzy comment verification helper (targeting FIRST 4 WORDS)
 */
export function verifyClientCommentMatch(ocrText = '', targetComment = '') {
  if (!ocrText || !targetComment) return false;

  const rawWords = String(targetComment).trim().split(/\s+/).filter(Boolean);
  const first4Words = rawWords.slice(0, 4).join(' ');

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ocrClean = clean(ocrText);
  const targetCleanFull = clean(targetComment);
  const targetClean4 = clean(first4Words);

  // Level 1: First 4 Words / Full Containment Check
  if (ocrClean.includes(targetClean4) || ocrClean.includes(targetCleanFull)) return true;

  // Level 2: Substituted OCR Character Confusion Matching (l/1/i, o/0, s/5, b/8)
  const sub = (s) => s.replace(/[1l!|]/g, 'i').replace(/0/g, 'o').replace(/5/g, 's').replace(/8/g, 'b');
  if (sub(ocrClean).includes(sub(targetClean4)) || sub(ocrClean).includes(sub(targetCleanFull))) return true;

  // Level 3: Word-Level Overlap Check on First 4 Words
  const targetWords = first4Words
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2);

  if (targetWords.length > 0) {
    let matchedCount = 0;
    for (const w of targetWords) {
      if (ocrClean.includes(clean(w)) || sub(ocrClean).includes(sub(clean(w)))) {
        matchedCount++;
      }
    }
    const requiredMin = Math.min(2, targetWords.length);
    if (matchedCount >= requiredMin) {
      return true;
    }
  }

  return false;
}

/**
 * Calls Backend OCR Verification endpoint (/api/ocr/verify)
 */
export async function verifyReviewScreenshotApi({ image, screenshotUrl, base64, reviewerName, expectedComment }) {
  const baseUrl = typeof window !== 'undefined' && window.BACKEND_BASE_URL ? window.BACKEND_BASE_URL : 'https://rw-wallet.onrender.com';
  try {
    const response = await fetch(`${baseUrl}/api/ocr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image,
        screenshotUrl,
        base64,
        reviewerName,
        expectedComment
      })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Frontend-OCR] Backend OCR endpoint call failed:', err);
  }
  return { success: false, isMatched: false, error: 'OCR_ENDPOINT_FAILED' };
}

// Expose globally for backward compatibility across all legacy modules
if (typeof window !== 'undefined') {
  window.extractActualReviewText = extractActualReviewText;
  window.verifyReviewScreenshotApi = verifyReviewScreenshotApi;
  window.ocrService = {
    extractActualReviewText,
    runClientOcrSpace,
    verifyClientCommentMatch,
    verifyReviewScreenshotApi
  };
}
