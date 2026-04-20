import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import {
  createTournamentRecord,
  createInterestRecord,
} from '../../helpers/tournaments';

const URL = (id: string) => `/api/tournaments/${id}/interest`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/tournaments/:id/interest', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL(UNKNOWN_ID)).send({ interested: true });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-student', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL(tournament.id)).send({ interested: true });
      expect(res.status).toBe(403);
    });

    it('admin → 403', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);
      const res = await agent.post(URL(tournament.id)).send({ interested: true });
      expect(res.status).toBe(403);
    });

    it('coach → 403', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('coach');
      const res = await agent.post(URL(tournament.id)).send({ interested: true });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown tournament', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(UNKNOWN_ID)).send({ interested: true });
      expect(res.status).toBe(404);
    });
  });

  describe('200 — toggle interest', () => {
    it('interested:true → { interested: true, interestCount: 1 } and DB row created', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent, user: student } = await loginAs('student');

      const res = await agent.post(URL(tournament.id)).send({ interested: true });

      expect(res.status).toBe(200);
      expect(res.body.interested).toBe(true);
      expect(res.body.interestCount).toBe(1);

      const row = await prisma.tournamentInterest.findUnique({
        where: { tournamentId_studentId: { tournamentId: tournament.id, studentId: student.id } },
      });
      expect(row).not.toBeNull();
    });

    it('interested:false → { interested: false, interestCount: 0 } and DB row deleted', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createInterestRecord(tournament.id, student.id);

      const res = await agent.post(URL(tournament.id)).send({ interested: false });

      expect(res.status).toBe(200);
      expect(res.body.interested).toBe(false);
      expect(res.body.interestCount).toBe(0);

      const row = await prisma.tournamentInterest.findUnique({
        where: { tournamentId_studentId: { tournamentId: tournament.id, studentId: student.id } },
      });
      expect(row).toBeNull();
    });

    it('interested:false with no existing row is a no-op → interestCount 0', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(tournament.id)).send({ interested: false });

      expect(res.status).toBe(200);
      expect(res.body.interested).toBe(false);
      expect(res.body.interestCount).toBe(0);
    });

    it('toggling interested:true twice is idempotent — interestCount stays 1', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent, user: student } = await loginAs('student');

      await agent.post(URL(tournament.id)).send({ interested: true });
      const res = await agent.post(URL(tournament.id)).send({ interested: true });

      expect(res.status).toBe(200);
      expect(res.body.interestCount).toBe(1);

      const rows = await prisma.tournamentInterest.findMany({
        where: { tournamentId: tournament.id, studentId: student.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('two different students → interestCount 2', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);

      const { agent: agentA } = await loginAs('student');
      const { agent: agentB, user: studentB } = await loginAs('student');

      await agentA.post(URL(tournament.id)).send({ interested: true });
      await createInterestRecord(tournament.id, studentB.id);

      const res = await agentB.post(URL(tournament.id)).send({ interested: true });

      expect(res.status).toBe(200);
      expect(res.body.interestCount).toBe(2);
    });
  });
});
