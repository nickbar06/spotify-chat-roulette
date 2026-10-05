const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:4200';

module.exports = {
  PORT,
  CLIENT_ORIGIN,
  CLIENT_DIST: path.resolve(__dirname, '../client/dist'),
  SESSION_SECRET: process.env.SESSION_SECRET || 'spotify-chat-roulette-dev-secret',
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI:
    process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
