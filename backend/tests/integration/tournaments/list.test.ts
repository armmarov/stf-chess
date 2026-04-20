import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import {
  createTournamentRecord,
  createInterestRecord,
} from '../../helpers/tournaments';

const URL = '/api/tournaments';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/tournaments', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — any authed role gets list', () => {
    it('admin gets 200 with tournaments array', async () => {
      const { agent } = await loginAs('admin');
      const admin = await createUser('admin');
      await createTournamentRecord(admin.id);

      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tournaments)).toBe(true);
      expect(res.body.tournaments.length).toBeGreaterThanOrEqual(1);
    });

    it('teacher gets 200', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tournaments)).toBe(true);
    });

    it('student gets 200', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tournaments)).toBe(true);
    });

    it('empty list returned when no tournaments exist', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.tournaments).toHaveLength(0);
    });
  });

  describe('200 — myInterested flag for students', () => {
    it('student with no interest → myInterested: false', async () => {
      const admin = await createUser('admin');
      await createTournamentRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.tournaments[0].myInterested).toBe(false);
    });

    it('student who expressed interest → myInterested: true', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createInterestRecord(tournament.id, student.id);

      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.tournaments[0].myInterested).toBe(true);
    });

    it('student only sees own myInterested flag (another student interested)', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const otherStudent = await createUser('student');
      await createInterestRecord(tournament.id, otherStudent.id);

      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.tournaments[0].myInterested).toBe(false);
      expect(res.body.tournaments[0].interestCount).toBe(1);
    });
  });

  describe('200 — non-student fields', () => {
    it('teacher gets interestCount but no myInterested', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const student = await createUser('student');
      await createInterestRecord(tournament.id, student.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.tournaments[0].interestCount).toBe(1);
      expect(res.body.tournaments[0].myInterested).toBeUndefined();
    });

    it('admin gets interestCount but no myInterested', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createTournamentRecord(admin.id);
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.tournaments[0].interestCount).toBe(0);
      expect(res.body.tournaments[0].myInterested).toBeUndefined();
    });
  });

  describe('ordering — startDate desc nulls last', () => {
    it('tournaments ordered by startDate desc nulls last, then createdAt desc', async () => {
      const admin = await createUser('admin');
      const t1 = await createTournamentRecord(admin.id, {
        name: 'Earlier start',
        startDate: new Date('2025-01-01'),
      });
      const t2 = await createTournamentRecord(admin.id, {
        name: 'Later start',
        startDate: new Date('2025-06-01'),
      });
      const t3 = await createTournamentRecord(admin.id, {
        name: 'No start date',
        startDate: null,
      });

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);

      const ids = res.body.tournaments.map((t: { id: string }) => t.id);
      const idx2 = ids.indexOf(t2.id);
      const idx1 = ids.indexOf(t1.id);
      const idx3 = ids.indexOf(t3.id);

      // Later startDate first, null startDate last
      expect(idx2).toBeLessThan(idx1);
      expect(idx3).toBeGreaterThan(idx1);
    });
  });
});
