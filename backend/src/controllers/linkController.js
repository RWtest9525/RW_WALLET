// File: backend/src/controllers/linkController.js
const path = require('path');
const fs = require('fs');

function getClientIp(req) {
  const trueClientIp = req.headers['true-client-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  if (trueClientIp) {
    return trueClientIp.trim();
  }
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

function createLinkController(cfStore) {
  return {
    getClientIp,
    
    async handleDownloadPage(req, res) {
      try {
        const clientIp = getClientIp(req);
        const refCode = req.query.ref;

        console.log(`[GET /download] Request from IP: ${clientIp}, Ref: ${refCode || 'None'}`);

        if (refCode) {
          await cfStore.saveReferral(clientIp, refCode.trim());
          console.log(`[Cloudflare DeepLink] Saved IP ${clientIp} -> Ref ${refCode}`);
        }

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Reviews World App</title>
  <link rel="icon" href="https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      color: #f1f5f9;
    }
    .card {
      background: rgba(30,41,59,0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(100,116,139,0.25);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0,0,0,0.4);
    }
    .logo {
      width: 80px; height: 80px;
      border-radius: 20px;
      margin: 0 auto 20px;
      box-shadow: 0 8px 24px rgba(37,99,235,0.3);
    }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
    .ref-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(16,185,129,0.12);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 12px;
      padding: 8px 16px;
      font-size: 13px; font-weight: 700;
      color: #6ee7b7;
      margin-bottom: 24px;
    }
    .ref-badge svg { width:16px; height:16px; }
    .download-btn {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      font-size: 16px; font-weight: 800;
      border: none; border-radius: 16px;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 8px 24px rgba(37,99,235,0.35);
      transition: all 0.2s;
    }
    .download-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(37,99,235,0.45); }
    .download-btn:active { transform: scale(0.98); }
    .download-btn svg { width:20px; height:20px; }
    .info {
      margin-top: 20px;
      padding: 14px;
      background: rgba(100,116,139,0.1);
      border-radius: 12px;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .info b { color: #e2e8f0; }
    .shield { display:inline-flex; align-items:center; gap:4px; color:#6ee7b7; font-weight:600; }
    .steps { margin-top: 20px; text-align: left; font-size: 13px; color: #94a3b8; }
    .steps li { margin-bottom: 8px; padding-left: 4px; }
    .steps b { color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg" alt="Reviews World" class="logo">
    <h1>Reviews World</h1>
    <p class="subtitle">Earn rewards by completing simple tasks</p>
    ${refCode ? `<div class="ref-badge"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg> Referral: ${refCode}</div>` : ''}

    <a href="/download-apk" class="download-btn">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Download App (APK)
    </a>

    <div class="info">
      <p class="shield"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> 100% Safe &amp; Verified</p>
      <p style="margin-top:6px">This app is developed by <b>Reviews World</b>. Your referral code will be automatically applied after installation.</p>
    </div>

    <ol class="steps">
      <li><b>Tap "Download App"</b> above</li>
      <li>If browser shows a warning, tap <b>"Download anyway"</b> — this is normal for all APK files</li>
      <li><b>Open the APK</b> file and install</li>
      <li>Your referral code <b>auto-fills</b> on signup!</li>
    </ol>
  </div>
</body>
</html>`);
      } catch (error) {
        console.error('Error in /download:', error);
        if (!res.headersSent) {
          res.status(500).json({ ok: false, error: 'Internal Server Error' });
        }
      }
    },

    async handleApkDownload(req, res) {
      try {
        const candidateDirs = [
          path.join(__dirname, '..', '..', '..', 'public', 'assets', 'downloads'),
          path.join(__dirname, '..', '..', '..', 'public', 'files'),
          path.join(__dirname, '..', '..', 'public', 'assets', 'downloads'),
          path.join(__dirname, '..', '..', 'public', 'files'),
          path.join(__dirname, '..', 'public', 'assets', 'downloads'),
          path.join(__dirname, '..', 'public', 'files'),
          path.join(process.cwd(), 'public', 'assets', 'downloads'),
          path.join(process.cwd(), 'public', 'files'),
          path.join(process.cwd(), '..', 'public', 'assets', 'downloads'),
          path.join(process.cwd(), '..', 'public', 'files'),
          path.join(process.cwd(), 'files'),
          path.join(process.cwd(), 'dist', 'files')
        ];

        let apkPath = null;
        console.log('[GET /download-apk] __dirname:', __dirname);
        console.log('[GET /download-apk] cwd:', process.cwd());

        for (const dir of candidateDirs) {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.apk'));
            console.log(`[GET /download-apk] Found in ${dir}:`, files);
            if (files.length > 0) {
              const preferred = files.find(f => f.toLowerCase() === 'reviewsworld.apk') ||
                                files.find(f => f.toLowerCase() === 'app.apk') ||
                                files.find(f => f.toLowerCase() === 'base.apk') ||
                                files[0];
              apkPath = path.join(dir, preferred);
              break;
            }
          }
        }

        if (!apkPath || !fs.existsSync(apkPath)) {
          console.error('[GET /download-apk] APK not found. Searched:', candidateDirs);
          return res.status(404).send('APK file not found. Please contact admin.');
        }

        res.set('Content-Type', 'application/vnd.android.package-archive');
        res.set('Content-Disposition', 'attachment; filename="ReviewsWorld.apk"');
        console.log('[GET /download-apk] Serving APK from:', apkPath);
        res.download(apkPath, 'ReviewsWorld.apk');
      } catch (error) {
        console.error('Error in /download-apk:', error);
        if (!res.headersSent) {
          res.status(500).json({ ok: false, error: 'Internal Server Error' });
        }
      }
    },

    async handleVerifyReferral(req, res) {
      try {
        const clientIp = getClientIp(req);
        console.log(`[POST /verify-referral] Verifying IP: ${clientIp}`);

        const refCode = await cfStore.getAndDeleteReferral(clientIp);

        if (refCode) {
          console.log(`[Cloudflare DeepLink] Matched referral code for IP ${clientIp}: ${refCode}`);
          return res.json({
            success: true,
            referralCode: refCode
          });
        }

        console.log(`[Cloudflare DeepLink] No active referral code found for IP: ${clientIp}`);
        return res.json({
          success: false,
          referralCode: null
        });
      } catch (error) {
        console.error('Error in /verify-referral:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
      }
    }
  };
}

module.exports = {
  createLinkController,
  getClientIp
};
