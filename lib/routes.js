const crypto = require('crypto');
const express = require('express');
const config = require('./config');
const {
  SCOPES,
  createSpotifyApi,
  getAuthorizedSpotify,
  normalizePlayback,
  normalizeProfile,
  normalizeTrack,
  spotifyIsConfigured,
} = require('./spotify');

function saveSession(session) {
  return new Promise((resolve, reject) => {
    session.save((error) => (error ? reject(error) : resolve()));
  });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createApiRouter() {
  const router = express.Router();

  router.get('/auth/session', (req, res) => {
    res.json({
      authenticated: Boolean(req.session.spotify),
      configured: spotifyIsConfigured(),
      profile: req.session.spotify?.profile || null,
    });
  });

  router.get('/auth/login', (req, res) => {
    if (!spotifyIsConfigured()) {
      return res.status(503).json({
        error: 'Add Spotify credentials to .env before connecting an account.',
      });
    }

    const state = crypto.randomBytes(24).toString('hex');
    req.session.oauthState = state;
    const authorizeUrl = createSpotifyApi().createAuthorizeURL(SCOPES, state, true);
    return req.session.save((error) => {
      if (error) return res.status(500).json({ error: 'Could not start sign in' });
      return res.json({ authorizeUrl });
    });
  });

  router.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('scr.sid');
      res.status(204).end();
    });
  });

  router.get(
    '/profile',
    asyncRoute(async (req, res) => {
      const spotify = await getAuthorizedSpotify(req.session);
      const response = await spotify.getMe();
      const profile = normalizeProfile(response.body);
      req.session.spotify.profile = profile;
      await saveSession(req.session);
      res.json(profile);
    }),
  );

  router.get(
    '/library',
    asyncRoute(async (req, res) => {
      const spotify = await getAuthorizedSpotify(req.session);
      const [playlists, tracks, albums, artists] = await Promise.all([
        spotify.getUserPlaylists({ limit: 20 }),
        spotify.getMySavedTracks({ limit: 12 }),
        spotify.getMySavedAlbums({ limit: 12 }),
        spotify.getFollowedArtists({ limit: 12 }),
      ]);

      await saveSession(req.session);
      res.json({
        playlists: (playlists.body.items || []).map((playlist) => ({
          id: playlist.id,
          uri: playlist.uri,
          name: playlist.name,
          type: 'Playlist',
          detail: playlist.owner?.display_name || 'Spotify',
          image: playlist.images?.[0]?.url || null,
          spotifyUrl: playlist.external_urls?.spotify || null,
        })),
        tracks: (tracks.body.items || []).map(({ track }) => ({
          ...normalizeTrack(track),
          type: 'Liked song',
        })),
        albums: (albums.body.items || []).map(({ album }) => ({
          id: album.id,
          name: album.name,
          type: 'Album',
          detail: (album.artists || []).map((artist) => artist.name).join(', '),
          image: album.images?.[0]?.url || null,
          spotifyUrl: album.external_urls?.spotify || null,
        })),
        artists: (artists.body.artists?.items || []).map((artist) => ({
          id: artist.id,
          name: artist.name,
          type: 'Artist',
          detail: 'Artist',
          image: artist.images?.[0]?.url || null,
          spotifyUrl: artist.external_urls?.spotify || null,
        })),
      });
    }),
  );

  router.get(
    '/library/playlists/:playlistId',
    asyncRoute(async (req, res) => {
      const spotify = await getAuthorizedSpotify(req.session);
      const response = await spotify.getPlaylist(req.params.playlistId);
      const playlist = response.body;
      await saveSession(req.session);
      res.json({
        id: playlist.id,
        uri: playlist.uri,
        name: playlist.name,
        description: playlist.description || '',
        image: playlist.images?.[0]?.url || null,
        owner: playlist.owner?.display_name || 'Spotify',
        total: playlist.tracks?.total || 0,
        tracks: (playlist.tracks?.items || [])
          .map((item) => normalizeTrack(item.track))
          .filter(Boolean),
      });
    }),
  );

  router.get(
    '/player',
    asyncRoute(async (req, res) => {
      const spotify = await getAuthorizedSpotify(req.session);
      const response = await spotify.getMyCurrentPlaybackState();
      await saveSession(req.session);
      res.json(normalizePlayback(response.body));
    }),
  );

  router.get(
    '/player/token',
    asyncRoute(async (req, res) => {
      await getAuthorizedSpotify(req.session);
      await saveSession(req.session);
      res.json({ accessToken: req.session.spotify.accessToken });
    }),
  );

  router.put(
    '/player/:action',
    asyncRoute(async (req, res) => {
      const spotify = await getAuthorizedSpotify(req.session);
      const { action } = req.params;
      const { contextUri, deviceId, positionMs, state, trackUri, volume } = req.body || {};

      switch (action) {
        case 'play':
          await spotify.play({
            ...(deviceId ? { device_id: deviceId } : {}),
            ...(contextUri ? { context_uri: contextUri } : {}),
            ...(trackUri ? { uris: [trackUri] } : {}),
          });
          break;
        case 'pause':
          await spotify.pause(deviceId ? { device_id: deviceId } : {});
          break;
        case 'next':
          await spotify.skipToNext(deviceId ? { device_id: deviceId } : {});
          break;
        case 'previous':
          await spotify.skipToPrevious(deviceId ? { device_id: deviceId } : {});
          break;
        case 'seek':
          await spotify.seek(Number(positionMs), deviceId ? { device_id: deviceId } : {});
          break;
        case 'volume':
          await spotify.setVolume(Number(volume), deviceId ? { device_id: deviceId } : {});
          break;
        case 'shuffle':
          await spotify.setShuffle(Boolean(state), deviceId ? { device_id: deviceId } : {});
          break;
        case 'repeat':
          await spotify.setRepeat(state || 'off', deviceId ? { device_id: deviceId } : {});
          break;
        case 'transfer':
          if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });
          await spotify.transferMyPlayback([deviceId], { play: true });
          break;
        default:
          return res.status(404).json({ error: 'Unknown player action' });
      }

      await saveSession(req.session);
      return res.status(204).end();
    }),
  );

  return router;
}

function createCallbackRouter() {
  const router = express.Router();

  router.get(
    '/callback',
    asyncRoute(async (req, res) => {
      if (!req.query.code || !req.query.state || req.query.state !== req.session.oauthState) {
        return res.redirect(`${config.CLIENT_ORIGIN}/?auth=invalid`);
      }

      const spotify = createSpotifyApi();
      const grant = await spotify.authorizationCodeGrant(req.query.code);
      spotify.setAccessToken(grant.body.access_token);
      const profileResponse = await spotify.getMe();

      req.session.spotify = {
        accessToken: grant.body.access_token,
        refreshToken: grant.body.refresh_token,
        expiresAt: Date.now() + grant.body.expires_in * 1000,
        profile: normalizeProfile(profileResponse.body),
      };
      delete req.session.oauthState;
      await saveSession(req.session);
      return res.redirect(config.CLIENT_ORIGIN);
    }),
  );

  return router;
}

module.exports = { createApiRouter, createCallbackRouter };
