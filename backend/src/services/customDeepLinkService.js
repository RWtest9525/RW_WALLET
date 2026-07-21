const mongoose = require('mongoose');
const path = require('path');

// 1. Mongoose Schema for IP-based Deferred Deep Linking (1-hour TTL)
const referralFingerprintSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  referralCode: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Auto-deleted by MongoDB after 1 hour (3600s)
  }
});

const ReferralFingerprint = mongoose.models.ReferralFingerprint || mongoose.model('ReferralFingerprint', referralFingerprintSchema);

/**
 * Helper to extract true client IP from Render / Cloudflare proxy headers
 */
function getClientIp(req) {
  const trueClientIp = req.headers['true-client-ip'];
  const xForwardedFor = req.headers['x-forwarded-for'];
  
  if (trueClientIp) {
    return trueClientIp.trim();
  }
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Register Express Endpoints for Custom Deferred Deep Linking
 */
function registerDeepLinkRoutes(app) {
  // GET /download - Capture client IP & ref parameter, then send app.apk
  app.get('/download', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const refCode = req.query.ref;

      console.log(`[GET /download] Client IP: ${clientIp}, Ref Code: ${refCode || 'None'}`);

      if (refCode) {
        await ReferralFingerprint.findOneAndUpdate(
          { ipAddress: clientIp },
          { referralCode: refCode.trim(), createdAt: new Date() },
          { upsert: true, new: true }
        );
        console.log(`[GET /download] Stored referral code ${refCode} for IP ${clientIp}`);
      }

      // Serve /files/app.apk
      const apkPath = path.join(__dirname, '..', '..', '..', 'public', 'files', 'app.apk');
      res.download(apkPath, 'app.apk', (err) => {
        if (err && !res.headersSent) {
          console.error('[GET /download] File download error:', err.message);
          res.status(404).send('APK file not found on server.');
        }
      });
    } catch (error) {
      console.error('Error in /download route:', error);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Internal Server Error' });
      }
    }
  });

  // POST /verify-referral - Retrieve referral code for client IP and delete record
  app.post('/verify-referral', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      console.log(`[POST /verify-referral] Verifying IP: ${clientIp}`);

      // Atomically find & delete matching IP record
      const match = await ReferralFingerprint.findOneAndDelete({ ipAddress: clientIp });

      if (match && match.referralCode) {
        console.log(`[POST /verify-referral] Found referral code ${match.referralCode} for IP ${clientIp}`);
        return res.json({
          success: true,
          referralCode: match.referralCode
        });
      }

      return res.json({
        success: false,
        referralCode: null
      });
    } catch (error) {
      console.error('Error in /verify-referral route:', error);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });
}

module.exports = {
  ReferralFingerprint,
  getClientIp,
  registerDeepLinkRoutes
};
