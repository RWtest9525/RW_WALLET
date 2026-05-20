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

  const walletService = await createCloudflareWalletService();
  walletService.registerRoutes(app);
  walletService.registerSocketHandlers(io);

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
      startedAt: new Date().toISOString()
    });
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'rw-wallet-cloudflare-backend' });
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
