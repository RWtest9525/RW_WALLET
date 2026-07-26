// File: backend/src/routes/linkRoutes.js
const express = require('express');
const router = express.Router();
const { cfStore } = require('../services/customDeepLinkService');
const { createLinkController } = require('../controllers/linkController');

const linkController = createLinkController(cfStore);

router.get('/download', (req, res) => linkController.handleDownloadPage(req, res));
router.get('/download-apk', (req, res) => linkController.handleApkDownload(req, res));
router.post('/verify-referral', (req, res) => linkController.handleVerifyReferral(req, res));

module.exports = router;
