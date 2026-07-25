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
  app.use('/assets', express.static(path.join(publicDir, 'assets')));
  app.use('/pages', express.static(path.join(publicDir, 'pages')));
  app.use('/js', express.static(path.join(publicDir, 'js')));
  app.use('/css', express.static(path.join(publicDir, 'css')));
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

  app.get('/avatars_sheet.png', (req, res) => {
    res.sendFile(path.join(publicDir, 'assets', 'images', 'avatars_sheet.png'));
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
