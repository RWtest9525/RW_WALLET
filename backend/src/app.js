// File: backend/src/app.js
const cors = require('cors');
const express = require('express');
const path = require('path');
const env = require('./config/env');
const { applyNoCacheHeaders } = require('./middlewares/cacheMiddleware');
const { createCloudflareWalletService } = require('./services/cloudflareWalletService');
const linkRoutes = require('./routes/linkRoutes');

function createHealthHandler(app, startedAt) {
  return (req, res) => {
    const degraded = !!app.locals.walletServiceError;
    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      service: 'rw-wallet-cloudflare-backend',
      status: degraded ? 'degraded' : 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt,
      backendReady: !degraded,
      backendError: app.locals.walletServiceError || ''
    });
  };
}

async function createApp(io, { startedAt = new Date().toISOString() } = {}) {
  const app = express();
  app.disable('etag');

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(applyNoCacheHeaders);

  const projectRoot = path.join(__dirname, '..', '..');
  const publicDir = path.join(projectRoot, 'public');
  app.use(express.static(projectRoot));
  app.use(express.static(publicDir));
  // Cache images for 1 year immutable for instant fetching
  app.use('/assets/images', express.static(path.join(publicDir, 'assets', 'images'), {
    maxAge: '1y',
    immutable: true
  }));
  app.use('/assets', express.static(path.join(publicDir, 'assets')));
  app.use('/pages', express.static(path.join(publicDir, 'pages')));
  app.use('/.well-known', express.static(path.join(publicDir, '.well-known')));

  // Legacy route fallbacks for auxiliary HTML pages and assets
  const pageFallbackMap = {
    '/privacy.html': 'privacy.html',
    '/privacy': 'privacy.html',
    '/terms.html': 'terms.html',
    '/terms': 'terms.html',
    '/contact.html': 'contact.html',
    '/contact': 'contact.html',
    '/delete-account.html': 'delete-account.html',
    '/delete-account': 'delete-account.html',
    '/dl.html': 'dl.html',
    '/dl': 'dl.html'
  };

  Object.entries(pageFallbackMap).forEach(([routePath, fileName]) => {
    app.get(routePath, (req, res) => {
      res.sendFile(path.join(publicDir, 'pages', fileName));
    });
  });

  // Legacy image route fallbacks with max-age cache
  const legacyImages = [
    'avatars_sheet.png',
    'logo_192.png',
    'logo_512.png',
    'notification_bell.png',
    'profile_card_bg.png',
    'referral_banner.png',
    'referral_howitworks_cards.png',
    'whats_new_megaphone.png',
    'withdraw_amazon.png',
    'withdraw_bank.png',
    'withdraw_confirm_bg.png',
    'withdraw_crypto.png',
    'withdraw_flipkart.png',
    'withdraw_methods_layout.jpg',
    'withdraw_methods_layout.png',
    'withdraw_paypal.png',
    'withdraw_playstore.png',
    'withdraw_upi.png'
  ];

  legacyImages.forEach(imgName => {
    app.get(`/${imgName}`, (req, res) => {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.sendFile(path.join(publicDir, 'assets', 'images', imgName));
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'index.html'));
  });

  app.get('/app-version', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true,
      version: env.commitSha,
      startedAt,
      backendReady: !app.locals.walletServiceError,
      backendError: app.locals.walletServiceError || ''
    });
  });

  app.get('/ping', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('text/plain').status(200).send('ok');
  });

  app.head('/ping', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).end();
  });

  app.get('/health', createHealthHandler(app, startedAt));

  const ocrRoutes = require('./routes/ocrRoutes');
  app.use('/api/ocr', ocrRoutes);

  app.use('/', linkRoutes);

  try {
    const walletService = await createCloudflareWalletService();
    walletService.registerRoutes(app);
    walletService.registerSocketHandlers(io);
    app.locals.walletServiceError = '';
  } catch (error) {
    app.locals.walletServiceError = error.message || 'Cloudflare wallet service failed to initialize';
    console.error('Cloudflare wallet service unavailable:', error);
  }

  app.use('/api', (req, res) => {
    res.status(503).json({
      ok: false,
      error: 'BACKEND_TEMPORARILY_UNAVAILABLE',
      detail: app.locals.walletServiceError || 'Cloudflare wallet service is not ready'
    });
  });

  return app;
}

module.exports = {
  createApp,
  applyNoCacheHeaders,
  createHealthHandler
};
