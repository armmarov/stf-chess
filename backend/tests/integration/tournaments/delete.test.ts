import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { JPEG_BUFFER } from '../../helpers/payments';
import {
  cleanTournamentUploads,
  createTournamentRecord,
  createInterestRecord,
  tournamentFileExists,
  writeTournamentFixture,
} from '../../helpers/tournaments';

const URL = (id: string) => `/api/tournaments/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('DELETE /api/tournaments/:id', () => {
  beforeEach(async () => {
    await resetDb();
    cleanTournamentUploads();
  });

  afterEach(() => {
    cleanTournamentUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.delete(URL(tournament.id));
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.delete(URL(tournament.id));
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown tournament', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('204 — successful delete', () => {
    it('admin deletes tournament → 204, row removed from DB', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent.delete(URL(tournament.id));

      expect(res.status).toBe(204);
      const row = await prisma.tournament.findUnique({ where: { id: tournament.id } });
      expect(row).toBeNull();
    });

    it('admin deletes tournament with image → image file removed from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const imagePath = writeTournamentFixture('to-delete.jpg', JPEG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath });

      expect(tournamentFileExists(imagePath)).toBe(true);

      const res = await agent.delete(URL(tournament.id));

      expect(res.status).toBe(204);
      expect(tournamentFileExists(imagePath)).toBe(false);
    });

    it('admin deletes tournament without image → 204 with no error', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, { imagePath: null });

      const res = await agent.delete(URL(tournament.id));
      expect(res.status).toBe(204);
    });

    it('delete cascades to tournament_interests', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      await createInterestRecord(tournament.id, s1.id);
      await createInterestRecord(tournament.id, s2.id);

      const res = await agent.delete(URL(tournament.id));

      expect(res.status).toBe(204);
      const interests = await prisma.tournamentInterest.findMany({
        where: { tournamentId: tournament.id },
      });
      expect(interests).toHaveLength(0);
    });
  });
});
