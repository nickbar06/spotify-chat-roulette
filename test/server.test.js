const { authenticateUser, getCurrentPlayback, refreshAccessToken, startServer, stopServer, server } = require('../server');
const SpotifyWebApi = require('spotify-web-api-node');
const sinon = require('sinon');
const request = require('supertest');

describe('Server Functions', () => {
  let spotifyApiStub;
  let testServer;

  beforeAll((done) => {
    testServer = startServer();
    done();
  });

  afterAll((done) => {
    stopServer();
    done();
  });

  beforeEach(() => {
    spotifyApiStub = sinon.stub(SpotifyWebApi.prototype);
  });

  afterEach(() => {
    sinon.restore();
  });

  test('should authenticate user successfully', async () => {
    const mockUser = { display_name: 'Test User' };
    spotifyApiStub.getMe.resolves({ body: mockUser });

    const user = await authenticateUser('test_access_token');
    expect(user).toEqual(mockUser);
  });

  test('should fail to authenticate user', async () => {
    spotifyApiStub.getMe.rejects(new Error('Authentication error'));

    await expect(authenticateUser('invalid_token')).rejects.toThrow('Authentication error: Authentication error');
  });

  test('should get current playback successfully', async () => {
    const mockPlayback = { item: { artists: [{ name: 'Test Artist' }] } };
    spotifyApiStub.getMyCurrentPlaybackState.resolves({ body: mockPlayback });

    const playback = await getCurrentPlayback();
    expect(playback).toEqual(mockPlayback);
  });

  test('should fail to get current playback', async () => {
    spotifyApiStub.getMyCurrentPlaybackState.rejects(new Error('Playback error'));

    await expect(getCurrentPlayback()).rejects.toThrow('Error getting current playback: Playback error');
  });

  test('should refresh access token successfully', async () => {
    spotifyApiStub.clientCredentialsGrant.resolves({ body: { access_token: 'new_access_token' } });

    await refreshAccessToken();
    expect(spotifyApiStub.setAccessToken.calledWith('new_access_token')).toBe(true);
  });

  test('should fail to refresh access token', async () => {
    spotifyApiStub.clientCredentialsGrant.rejects(new Error('Refresh error'));

    await expect(refreshAccessToken()).rejects.toThrow('Error refreshing access token');
  });

  test('GET /callback should handle authorization code', async () => {
    const mockCode = 'test_code';
    const mockAccessToken = 'test_access_token';
    const mockRefreshToken = 'test_refresh_token';
    spotifyApiStub.authorizationCodeGrant.resolves({
      body: {
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken
      }
    });

    const response = await request(server)
      .get('/callback')
      .query({ code: mockCode });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`http://localhost:3000/#access_token=${mockAccessToken}`);
  });

  test('GET /callback should handle authorization error', async () => {
    const mockCode = 'test_code';
    spotifyApiStub.authorizationCodeGrant.rejects(new Error('Authorization error'));

    const response = await request(server)
      .get('/callback')
      .query({ code: mockCode });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/#/error/invalid%20token');
  });
});
