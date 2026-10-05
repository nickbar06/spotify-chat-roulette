require('dotenv').config();

const fs = require('fs');
const http = require('http');
const path = require('path');
const cors = require('cors');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');
const config = require('./lib/config');
const { createApiRouter, createCallbackRouter } = require('./lib/routes');
const { createChatServer } = require('./lib/socket');

const app = express();
const server = http.createServer(app);
const sessionMiddleware = session({
  name: 'scr.sid',
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PRODUCTION,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
});

app.set('trust proxy', 1);
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use(createCallbackRouter());
app.use('/api', createApiRouter());

if (fs.existsSync(config.CLIENT_DIST)) {
  app.use(express.static(config.CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(config.CLIENT_DIST, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || error.statusCode || error.body?.error?.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status === 500 ? 'Something went wrong' : error.message,
  });
});

const io = new Server(server, {
  cors: { origin: config.CLIENT_ORIGIN, credentials: true },
});
io.engine.use(sessionMiddleware);
createChatServer(io);

function startServer(port = config.PORT) {
  if (server.listening) return server;
  return server.listen(port, () => {
    console.log(`Spotify Chat Roulette running on http://127.0.0.1:${port}`);
  });
}

function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server.listening) return resolve();
    io.close();
    return server.close((error) => (error ? reject(error) : resolve()));
  });
}

if (require.main === module) startServer();

module.exports = { app, io, server, startServer, stopServer };
