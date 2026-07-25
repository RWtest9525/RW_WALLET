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
        error: 'SCREENSHOT_IMAGE_REQUIRED',
        detail: 'Please provide a valid review screenshot (base64 or screenshotUrl)'
      });
    }

    // 2. Perform OCR Recognition
    const { ocrText, ocrConfidence } = await ocrService.runOcrOnBuffer(imgBuffer);

    // 3. Extract Reviewer Name & Match Comment
    const extractedUserName = ocrService.extractReviewerName(ocrText);
    const targetComments = expectedComment ? [expectedComment] : [];
    const matchedComment = ocrService.matchAssignedComment(ocrText, targetComments);

    // 4. Fuzzy / Normalized String Matching Checks
    const cleanOcrText = ocrService.cleanStr(ocrText);
    const cleanExpectedComment = ocrService.cleanStr(expectedComment);
    const cleanReviewerName = ocrService.cleanStr(reviewerName);
    const cleanExtractedName = ocrService.cleanStr(extractedUserName);

    // Comment is matched if direct algorithm matched OR clean OCR text contains expected comment
    const isCommentMatched = expectedComment
      ? (!!matchedComment || (cleanExpectedComment.length > 0 && cleanOcrText.includes(cleanExpectedComment)))
      : true;

    // User name is matched if cleanExtractedName or cleanOcrText contains reviewerName
    const isNameMatched = reviewerName
      ? (cleanExtractedName.includes(cleanReviewerName) ||
         cleanReviewerName.includes(cleanExtractedName) ||
         cleanOcrText.includes(cleanReviewerName))
      : true;

    const isMatched = isCommentMatched && isNameMatched;

    return res.json({
      success: true,
      isMatched,
      extractedText: {
        userName: extractedUserName,
        comment: matchedComment || expectedComment || ocrText
      },
      confidenceScore: ocrConfidence || 0.95
    });

  } catch (error) {
    console.error('[OCR-Controller] Verification failed:', error);
    return res.status(500).json({
      success: false,
      isMatched: false,
      error: 'OCR_VERIFICATION_FAILED',
      detail: error.message || 'Error occurred while verifying review screenshot'
    });
  }
}

module.exports = {
  verifyReviewScreenshot
};
