require('dotenv').config();

const http = require('http');
const path = require('path');
const cors = require('cors');
const express = require('express');
const { Server } = require('socket.io');
const { createCloudflareWalletService } = require('./cloudflareWalletService');

async function main() {
  const app = express();
  app.disable('etag');
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    }
    next();
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  });

  app.get('/app-version', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true,
      version: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local',
      startedAt: new Date().toISOString(),
      backendReady: !app.locals.walletServiceError,
      backendError: app.locals.walletServiceError || ''
    });
  });

  app.get('/health', (req, res) => {
    const degraded = !!app.locals.walletServiceError;
    res.status(degraded ? 503 : 200).json({
      ok: !degraded,
      service: 'rw-wallet-cloudflare-backend',
      backendError: app.locals.walletServiceError || ''
    });
  });

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

  const port = Number(process.env.PORT || 8080);
  server.listen(port, () => {
    console.log(`RW wallet backend listening on port ${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
