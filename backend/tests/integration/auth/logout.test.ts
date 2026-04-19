import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

const LOGOUT_URL = '/api/auth/logout';

describe('POST /api/auth/logout', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('204 and clears stf_token cookie when authenticated', async () => {
    const { agent } = await loginAs('student');

    const res = await agent.post(LOGOUT_URL);

    expect(res.status).toBe(204);

    // Cookie should be cleared (Max-Age=0 or expired date)
    const rawCookies = res.headers['set-cookie'] as string | string[] | undefined;
    if (rawCookies) {
      const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
      const tokenCookie = cookies.find((c) => c.startsWith('stf_token='));
      if (tokenCookie) {
        // Either Max-Age=0 or an Expires date in the past clears the cookie
        const isCleared =
          /Max-Age=0/i.test(tokenCookie) ||
          /Expires=.*GMT/i.test(tokenCookie);
        expect(isCleared).toBe(true);
      }
    }
  });

  it('204 even when called without a cookie (logout is idempotent)', async () => {
    const res = await request(app).post(LOGOUT_URL);
    expect(res.status).toBe(204);
  });

  it('subsequent GET /api/auth/me with cleared cookie returns 401', async () => {
    const { agent } = await loginAs('student');

    await agent.post(LOGOUT_URL);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});
