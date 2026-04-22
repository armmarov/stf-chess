import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { PDF_BUFFER } from '../../helpers/payments';
import {
  cleanTournamentUploads,
  createTournamentRecord,
  writeTournamentFixture,
} from '../../helpers/tournaments';

const URL = (id: string, which: string) => `/api/tournaments/${id}/letter/${which}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/tournaments/:id/letter/:which', () => {
  beforeEach(async () => {
    await resetDb();
    cleanTournamentUploads();
  });

  afterEach(() => {
    cleanTournamentUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie for bskk', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID, 'bskk'));
      expect(res.status).toBe(401);
    });

    it('401 without cookie for kpm', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID, 'kpm'));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — missing cases', () => {
    it('404 for unknown tournament id', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(UNKNOWN_ID, 'bskk'));
      expect(res.status).toBe(404);
    });

    it('404 for unknown which value', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id, 'jkr'));
      expect(res.status).toBe(404);
    });

    it('404 when bskkLetterPath is null', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, { bskkLetterPath: null });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id, 'bskk'));
      expect(res.status).toBe(404);
    });

    it('404 when kpmLetterPath is null', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, { kpmLetterPath: null });
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(tournament.id, 'kpm'));
      expect(res.status).toBe(404);
    });

    it('404 when bskkLetterPath set but file missing from disk', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, {
        bskkLetterPath: 'tournaments/ghost-bskk.pdf',
      });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id, 'bskk'));
      expect(res.status).toBe(404);
    });

    it('404 when kpmLetterPath set but file missing from disk', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, {
        kpmLetterPath: 'tournaments/ghost-kpm.pdf',
      });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id, 'kpm'));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — bskk letter download', () => {
    it('200 with application/pdf content type', async () => {
      const admin = await createUser('admin');
      const bskkPath = writeTournamentFixture('bskk-letter.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { bskkLetterPath: bskkPath });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(tournament.id, 'bskk'));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });

    it('Content-Disposition is inline', async () => {
      const admin = await createUser('admin');
      const bskkPath = writeTournamentFixture('bskk-letter.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { bskkLetterPath: bskkPath });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(tournament.id, 'bskk'));

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/inline/);
    });
  });

  describe('200 — kpm letter download', () => {
    it('200 with application/pdf content type', async () => {
      const admin = await createUser('admin');
      const kpmPath = writeTournamentFixture('kpm-letter.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { kpmLetterPath: kpmPath });
      const { agent } = await loginAs('coach');

      const res = await agent.get(URL(tournament.id, 'kpm'));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });

    it('Content-Disposition is inline', async () => {
      const admin = await createUser('admin');
      const kpmPath = writeTournamentFixture('kpm-inline.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { kpmLetterPath: kpmPath });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(tournament.id, 'kpm'));

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/inline/);
    });
  });

  describe('200 — any authed role can download letters', () => {
    it('all roles can download bskk letter', async () => {
      const admin = await createUser('admin');
      const bskkPath = writeTournamentFixture('shared-bskk.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { bskkLetterPath: bskkPath });

      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL(tournament.id, 'bskk'));
        expect(res.status).toBe(200);
      }
    });

    it('all roles can download kpm letter', async () => {
      const admin = await createUser('admin');
      const kpmPath = writeTournamentFixture('shared-kpm.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { kpmLetterPath: kpmPath });

      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL(tournament.id, 'kpm'));
        expect(res.status).toBe(200);
      }
    });
  });
});
