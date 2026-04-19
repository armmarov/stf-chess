import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';

/**
 * Rate-limit test lives in its own file so Jest runs it in an isolated worker
 * with a fresh in-memory rate-limit store.
 *
 * Requires AUTH_RATE_LIMIT_MAX to be set to a small value (e.g. 3) in .env.test.
 * If the backend uses the hardcoded max of 20, set AUTH_RATE_LIMIT_MAX=20 and
 * the test still works — it just sends more requests.
 *
 * NOTE FOR BACKEND-DEVELOPER: please make the rate limit max configurable via
 * AUTH_RATE_LIMIT_MAX env var (default 20 in production). This keeps the test fast.
 */

const URL = '/api/auth/login';
const RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '20', 10);

describe('POST /api/auth/login — rate limiting', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it(`429 after ${RATE_LIMIT_MAX} failed requests from same IP`, async () => {
    // Exhaust the rate limit with bad-credential requests
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await request(app)
        .post(URL)
        .send({ username: 'ghost', password: 'wrong' });
    }

    // The next request must be rate-limited
    const res = await request(app)
      .post(URL)
      .send({ username: 'ghost', password: 'wrong' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBeDefined();
  });
});
