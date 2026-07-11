require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
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
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  appInstance = await createApp(io, { startedAt });

  const port = Number(process.env.PORT || 8080);
  server.listen(port, () => {
    console.log(`RW wallet backend listening on port ${port}`);
  });

  return { app: appInstance, server, io };
}

module.exports = {
  startServer
};
