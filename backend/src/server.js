// File: backend/src/server.js
const http = require('http');
const { Server } = require('socket.io');
const env = require('./config/env');
const { createApp } = require('./app');

async function startServer() {
  const startedAt = new Date().toISOString();
  let appInstance;
  const server = http.createServer((req, res) => {
    if (appInstance) {
      appInstance(req, res);
    }
  });
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST']
    }
  });

  appInstance = await createApp(io, { startedAt });

  const port = Number(env.port || 8080);
  server.listen(port, () => {
    console.log(`RW wallet backend listening on port ${port}`);
  });

  return { app: appInstance, server, io };
}

module.exports = {
  startServer
};
