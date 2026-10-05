const SpotifyWebApi = require('spotify-web-api-node');
const config = require('./config');

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-follow-read',
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
];

function createSpotifyApi(credentials = {}) {
  return new SpotifyWebApi({
    clientId: config.SPOTIFY_CLIENT_ID,
    clientSecret: config.SPOTIFY_CLIENT_SECRET,
    redirectUri: config.SPOTIFY_REDIRECT_URI,
    ...credentials,
  });
}

function spotifyIsConfigured() {
  return Boolean(config.SPOTIFY_CLIENT_ID && config.SPOTIFY_CLIENT_SECRET);
}

async function getAuthorizedSpotify(session) {
  const auth = session?.spotify;
  if (!auth?.accessToken) {
    const error = new Error('Spotify account is not connected');
    error.status = 401;
    throw error;
  }

  const spotify = createSpotifyApi({
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
  });

  if (auth.expiresAt && Date.now() >= auth.expiresAt - 60_000) {
    try {
      const refreshed = await spotify.refreshAccessToken();
      auth.accessToken = refreshed.body.access_token;
      auth.expiresAt = Date.now() + refreshed.body.expires_in * 1000;
      spotify.setAccessToken(auth.accessToken);
    } catch (error) {
      delete session.spotify;
      const authorizationError = new Error('Spotify authorization expired');
      authorizationError.status = 401;
      throw authorizationError;
    }
  }

  return spotify;
}

function imageUrl(images = []) {
  return images[0]?.url || null;
}

function normalizeProfile(profile) {
  return {
    id: profile.id,
    name: profile.display_name || profile.id,
    image: imageUrl(profile.images),
    product: profile.product,
    spotifyUrl: profile.external_urls?.spotify || null,
  };
}

function normalizeTrack(track) {
  if (!track) return null;
  return {
    id: track.id || track.uri,
    uri: track.uri,
    name: track.name,
    type: track.type,
    durationMs: track.duration_ms,
    explicit: Boolean(track.explicit),
    artists: (track.artists || []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      spotifyUrl: artist.external_urls?.spotify || null,
    })),
    album: track.album
      ? {
          id: track.album.id,
          name: track.album.name,
          image: imageUrl(track.album.images),
          spotifyUrl: track.album.external_urls?.spotify || null,
        }
      : null,
    spotifyUrl: track.external_urls?.spotify || null,
  };
}

function normalizePlayback(body = {}) {
  const track = normalizeTrack(body.item);
  return {
    available: Boolean(track),
    isPlaying: Boolean(body.is_playing),
    progressMs: body.progress_ms || 0,
    timestamp: body.timestamp || Date.now(),
    shuffle: Boolean(body.shuffle_state),
    repeat: body.repeat_state || 'off',
    device: body.device
      ? {
          id: body.device.id,
          name: body.device.name,
          type: body.device.type,
          volume: body.device.volume_percent,
          active: body.device.is_active,
        }
      : null,
    track,
  };
}

module.exports = {
  SCOPES,
  createSpotifyApi,
  getAuthorizedSpotify,
  normalizePlayback,
  normalizeProfile,
  normalizeTrack,
  spotifyIsConfigured,
};
