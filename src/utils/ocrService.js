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
 * Client-side normalized comment verification helper
 */
export function verifyClientCommentMatch(ocrText = '', targetComment = '') {
  if (!ocrText || !targetComment) return false;

  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ocrLower = ocrText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const normalizedFullText = ocrLower.replace(/\s+/g, '');

  const words = String(targetComment).trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const w1 = clean(words[0]);
    const w2 = clean(words[1]);
    const combined = w1 + w2;
    return normalizedFullText.includes(combined) || (ocrLower.includes(w1) && ocrLower.includes(w2));
  } else if (words.length === 1) {
    const w1 = clean(words[0]);
    return ocrLower.includes(w1);
  }

  return false;
}

// Expose globally for backward compatibility across all legacy modules
if (typeof window !== 'undefined') {
  window.extractActualReviewText = extractActualReviewText;
  window.ocrService = {
    extractActualReviewText,
    runClientOcrSpace,
    verifyClientCommentMatch
  };
}
