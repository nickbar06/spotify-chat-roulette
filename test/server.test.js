const request = require('supertest');
const { app } = require('../server');

describe('HTTP application', () => {
  test('reports its health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test('returns a signed-out session without exposing tokens', async () => {
    const response = await request(app).get('/api/auth/session');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        authenticated: false,
        profile: null,
      }),
    );
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');
  });

  test('protects Spotify data routes', async () => {
    const response = await request(app).get('/api/library');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/not connected/i);
  });

  test('rejects an OAuth callback without matching state', async () => {
    const response = await request(app).get('/callback?code=example&state=wrong');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('auth=invalid');
  });
});
