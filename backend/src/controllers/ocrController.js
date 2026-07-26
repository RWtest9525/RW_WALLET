/**
 * OCR Controller (backend/src/controllers/ocrController.js)
 * Handles review screenshot verification requests for Play Store tasks.
 */

const ocrService = require('../services/ocrService');

/**
 * Verifies a Play Store review screenshot against expected reviewer name and comment.
 */
async function verifyReviewScreenshot(req, res) {
  try {
    const {
      image,
      screenshotUrl,
      base64,
      reviewerName: reqReviewerName,
      userName: reqUserName,
      gmailName: reqGmailName,
      expectedComment: reqExpectedComment,
      comment: reqComment,
      assignedComment: reqAssignedComment
    } = req.body || {};

    const reviewerName = (reqReviewerName || reqUserName || reqGmailName || '').trim();
    const expectedComment = (reqExpectedComment || reqComment || reqAssignedComment || '').trim();

    let imgBuffer = null;

    // 1. Parse Image Source (Base64, Image URL, or Direct Buffer)
    const rawImage = image || base64;
    if (rawImage && typeof rawImage === 'string') {
      const cleanBase64 = rawImage.replace(/^data:image\/\w+;base64,/, '');
      imgBuffer = Buffer.from(cleanBase64, 'base64');
    } else if (screenshotUrl && typeof screenshotUrl === 'string') {
      try {
        const fetchRes = await fetch(screenshotUrl);
        if (fetchRes.ok) {
          imgBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }
      } catch (fetchErr) {
        console.warn('[OCR-Controller] Image URL fetch failed:', fetchErr.message);
      }
    } else if (req.file && req.file.buffer) {
      imgBuffer = req.file.buffer;
    }

    if (!imgBuffer || imgBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        isMatched: false,
        similarityScore: 0.0,
        extractedText: '',
        error: 'SCREENSHOT_IMAGE_REQUIRED',
        detail: 'Please provide a valid review screenshot (base64 or screenshotUrl)'
      });
    }

    // 2. Perform OCR Recognition
    const { ocrText, ocrConfidence } = await ocrService.runOcrOnBuffer(imgBuffer);

    // 3. Extract Reviewer Name & Perform Multi-Level Fuzzy Match Verification
    const extractedUserName = ocrService.extractReviewerName(ocrText);
    const fuzzyComment = ocrService.verifyFuzzyCommentMatch(ocrText, expectedComment, 0.68);
    const fuzzyName = ocrService.verifyFuzzyReviewerMatch(ocrText, extractedUserName, reviewerName, 0.68);

    const isMatched = fuzzyComment.isMatched && fuzzyName.isMatched;

    let similarityScore = Math.min(fuzzyComment.similarityScore, fuzzyName.similarityScore);
    if (isMatched && similarityScore < 0.68) {
      similarityScore = 0.68;
    }
    similarityScore = Number(similarityScore.toFixed(2));

    // Return JSON structure: { success: true, isMatched: boolean, similarityScore: number, extractedText: string }
    return res.json({
      success: true,
      isMatched,
      similarityScore,
      extractedText: ocrText || '',
      extractedUserName,
      matchedComment: fuzzyComment.matchedComment || expectedComment || ''
    });

  } catch (error) {
    console.error('[OCR-Controller] Verification failed:', error);
    return res.status(500).json({
      success: false,
      isMatched: false,
      similarityScore: 0.0,
      extractedText: '',
      error: 'OCR_VERIFICATION_FAILED',
      detail: error.message || 'Error occurred while verifying review screenshot'
    });
  }
}

/**
 * Verifies multiple review screenshots for Bulker users, performs fuzzy OCR comment extraction,
 * auto-skips duplicate submissions, and returns a summary response:
 * { success: true, processed: X, skippedDuplicates: Y, failed: Z }
 */
async function verifyBulkReviewScreenshots(req, res, d1Store = null) {
  try {
    const { screenshots, items, taskId } = req.body || {};
    const list = Array.isArray(screenshots) ? screenshots : (Array.isArray(items) ? items : []);

    if (!list.length) {
      return res.status(400).json({
        success: false,
        processed: 0,
        skippedDuplicates: 0,
        failed: 0,
        error: 'NO_SCREENSHOTS_PROVIDED',
        message: 'Please provide an array of screenshots to verify.'
      });
    }

    let processed = 0;
    let skippedDuplicates = 0;
    let failed = 0;

    const seenComments = new Set();

    for (const item of list) {
      const rawImage = item.image || item.base64 || item.screenshotUrl;
      const expectedComment = (item.assignedComment || item.expectedComment || item.comment || '').trim();
      const currentTaskId = item.taskId || taskId || 'unknown';

      if (!rawImage) {
        failed++;
        continue;
      }

      let imgBuffer = null;
      if (typeof rawImage === 'string' && rawImage.startsWith('data:image')) {
        imgBuffer = Buffer.from(rawImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      } else if (typeof rawImage === 'string' && rawImage.startsWith('http')) {
        try {
          const fetchRes = await fetch(rawImage);
          if (fetchRes.ok) imgBuffer = Buffer.from(await fetchRes.arrayBuffer());
        } catch {}
      } else if (Buffer.isBuffer(rawImage)) {
        imgBuffer = rawImage;
      }

      if (!imgBuffer) {
        failed++;
        continue;
      }

      // OCR Extraction
      const { ocrText } = await ocrService.runOcrOnBuffer(imgBuffer);
      const cleanOcr = ocrService.cleanStr(ocrText);
      const cleanComment = ocrService.cleanStr(expectedComment);

      // Check duplicate in-memory or DB
      if ((cleanComment && seenComments.has(cleanComment)) || (cleanOcr && seenComments.has(cleanOcr.slice(0, 50)))) {
        skippedDuplicates++;
        continue;
      }

      // DB check for existing submissions if d1Store is available
      if (d1Store && typeof d1Store.first === 'function' && currentTaskId) {
        const existing = await d1Store.first(
          `SELECT id FROM task_submissions 
           WHERE task_id = ? AND (assigned_comment = ? OR screenshot_url = ?) AND manual_status != 'rejected' LIMIT 1`,
          [currentTaskId, expectedComment, item.screenshotUrl || 'NO_URL']
        ).catch(() => null);

        if (existing) {
          skippedDuplicates++;
          continue;
        }
      }

      // Track comment to prevent intra-batch duplicates
      if (cleanComment) seenComments.add(cleanComment);
      if (cleanOcr) seenComments.add(cleanOcr.slice(0, 50));

      // Match verification check
      const fuzzyMatch = ocrService.verifyFuzzyCommentMatch(ocrText, expectedComment, 0.68);
      if (fuzzyMatch.isMatched || expectedComment.length === 0) {
        processed++;
      } else {
        failed++;
      }
    }

    return res.json({
      success: true,
      processed,
      skippedDuplicates,
      failed
    });
  } catch (error) {
    console.error('[OCR-Controller] Bulk verification failed:', error);
    return res.status(500).json({
      success: false,
      processed: 0,
      skippedDuplicates: 0,
      failed: 0,
      error: 'BULK_OCR_FAILED',
      detail: error.message
    });
  }
}

module.exports = {
  verifyReviewScreenshot,
  verifyBulkReviewScreenshots
};
