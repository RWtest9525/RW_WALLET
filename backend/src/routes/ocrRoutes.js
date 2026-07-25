/**
 * OCR Routes (backend/src/routes/ocrRoutes.js)
 * Mounts OCR review verification endpoints.
 */

const express = require('express');
const router = express.Router();
const ocrController = require('../controllers/ocrController');

// POST /api/ocr/verify
router.post('/verify', (req, res) => ocrController.verifyReviewScreenshot(req, res));

module.exports = router;
