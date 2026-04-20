import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import {
  createTournamentRecord,
  createInterestRecord,
} from '../../helpers/tournaments';

const URL = (id: string) => `/api/tournaments/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/tournaments/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown tournament id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — response shape', () => {
    it('admin gets tournament with createdBy, interestCount, and interestedStudents', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, {
        name: 'Admin Tournament',
        registrationLink: 'https://chess.example.com',
        startDate: new Date('2025-05-10'),
      });
      const student = await createUser('student');
      await createInterestRecord(tournament.id, student.id);

      const res = await agent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      expect(res.body.tournament.id).toBe(tournament.id);
      expect(res.body.tournament.name).toBe('Admin Tournament');
      expect(res.body.tournament.createdBy).toBeDefined();
      expect(res.body.tournament.createdBy.id).toBe(admin.id);
      expect(res.body.tournament.createdBy.name).toBeDefined();
      expect(res.body.tournament.interestCount).toBe(1);
      expect(Array.isArray(res.body.tournament.interestedStudents)).toBe(true);
      expect(res.body.tournament.interestedStudents).toHaveLength(1);
    });

    it('teacher gets tournament with interestedStudents but no myInterested', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.interestCount).toBe(0);
      expect(Array.isArray(res.body.tournament.interestedStudents)).toBe(true);
      expect(res.body.tournament.interestedStudents).toHaveLength(0);
      expect(res.body.tournament.myInterested).toBeUndefined();
    });

    it('student gets myInterested: false when not in interestedStudents', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.myInterested).toBe(false);
      expect(res.body.tournament.interestedStudents).toHaveLength(0);
    });

    it('student gets myInterested: true when own id is in interestedStudents', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createInterestRecord(tournament.id, student.id);

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.myInterested).toBe(true);
      expect(res.body.tournament.interestCount).toBe(1);
    });

    it('interestCount matches interestedStudents.length', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const s1 = await createUser('student');
      const s2 = await createUser('student');
      const s3 = await createUser('student');
      await createInterestRecord(tournament.id, s1.id);
      await createInterestRecord(tournament.id, s2.id);
      await createInterestRecord(tournament.id, s3.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.interestCount).toBe(3);
      expect(res.body.tournament.interestedStudents).toHaveLength(3);
      expect(res.body.tournament.interestCount).toBe(
        res.body.tournament.interestedStudents.length,
      );
    });
  });

  describe('interestedStudents — shape and ordering', () => {
    it('interestedStudents entries have id, name, className shape', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const student = await createUser('student');
      await createInterestRecord(tournament.id, student.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      const entry = res.body.tournament.interestedStudents[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('name');
      expect('className' in entry).toBe(true);
    });

    it('interestedStudents sorted by name asc', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const sA = await createUser('student', { name: 'Alice' });
      const sC = await createUser('student', { name: 'Charlie' });
      const sB = await createUser('student', { name: 'Bob' });
      await createInterestRecord(tournament.id, sC.id);
      await createInterestRecord(tournament.id, sA.id);
      await createInterestRecord(tournament.id, sB.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      const names = res.body.tournament.interestedStudents.map((s: { name: string }) => s.name);
      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('after student toggles interest=true, they appear in interestedStudents on GET', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent: studentAgent, user: student } = await loginAs('student');

      await studentAgent
        .post(`/api/tournaments/${tournament.id}/interest`)
        .send({ interested: true });

      const { agent: teacherAgent } = await loginAs('teacher');
      const res = await teacherAgent.get(URL(tournament.id));

      expect(res.status).toBe(200);
      const ids = res.body.tournament.interestedStudents.map((s: { id: string }) => s.id);
      expect(ids).toContain(student.id);
    });

    it('place is included in detail response', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, { place: 'City Hall' });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.place).toBe('City Hall');
    });

    it('place is null when not set', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id, { place: null });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.place).toBeNull();
    });

    it('empty interestedStudents array when no interests', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('admin');

      const res = await agent.get(URL(tournament.id));
      expect(res.status).toBe(200);
      expect(res.body.tournament.interestedStudents).toEqual([]);
      expect(res.body.tournament.interestCount).toBe(0);
    });
  });
});
