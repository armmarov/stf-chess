import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER } from '../../helpers/payments';
import {
  cleanTournamentUploads,
  createTournamentRecord,
  writeTournamentFixture,
} from '../../helpers/tournaments';

const URL = (id: string) => `/api/tournaments/${id}/image`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/tournaments/:id/image', () => {
  beforeEach(async () => {
    await resetDb();
    cleanTournamentUploads();
  });

  afterEach(() => {
    cleanTournamentUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — missing cases', () => {
    it('404 when tournament not found', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });

    it('404 when tournament has no image (imagePath null)', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, { imagePath: null });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(404);
    });

    it('404 when imagePath is set but file is missing from disk', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, {
        imagePath: 'tournaments/nonexistent.jpg',
      });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — image streaming', () => {
    it('200 with image/jpeg Content-Type for .jpg file', async () => {
      const admin = await createUser('admin');
      const imagePath = writeTournamentFixture('test.jpg', JPEG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    });

    it('200 with image/png Content-Type for .png file', async () => {
      const admin = await createUser('admin');
      const imagePath = writeTournamentFixture('test.png', PNG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
    });

    it('200 with image/webp Content-Type for .webp file', async () => {
      const admin = await createUser('admin');
      const imagePath = writeTournamentFixture('test.webp', JPEG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath });
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/webp/);
    });

    it('response contains image data', async () => {
      const admin = await createUser('admin');
      const imagePath = writeTournamentFixture('data-check.jpg', JPEG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(tournament.id)).buffer(true);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });
});
