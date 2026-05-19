require('dotenv').config();

const http = require('http');
const cors = require('cors');
const express = require('express');
const { Server } = require('socket.io');
const { createCloudflareWalletService } = require('./cloudflareWalletService');

async function main() {
  const app = express();
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
