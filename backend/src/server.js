require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const { createApp } = require('./app');

async function startServer() {
  const startedAt = new Date().toISOString();
  const server = http.createServer();
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  const app = await createApp(io, { startedAt });
  server.on('request', app);

  const port = Number(process.env.PORT || 8080);
  server.listen(port, () => {
    console.log(`RW wallet backend listening on port ${port}`);
  });

  return { app, server, io };
}

module.exports = {
  startServer
};
