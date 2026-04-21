import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs, createUser } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createRecord } from '../../helpers/records';

const URL = '/api/records';

describe('GET /api/records', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('returns 401 without session cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — empty list', () => {
    it('returns empty records array when no records exist', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
      expect(res.body.records).toHaveLength(0);
    });
  });

  describe('200 — all roles can list', () => {
    it('teacher can list records', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('admin can list records', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('coach can list records', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('student can list records', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });
  });

  describe('200 — response shape', () => {
    it('record item includes nested student and createdBy fields', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      await createRecord({ studentId: studentUser.id, createdById: studentUser.id });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(1);
      const rec = res.body.records[0];
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('competitionName');
      expect(rec).toHaveProperty('competitionDate');
      expect(rec).toHaveProperty('level');
      expect(rec).toHaveProperty('category');
      expect(rec).toHaveProperty('pajsk');
      expect(rec).toHaveProperty('fideRated');
      expect(rec).toHaveProperty('mcfRated');
      expect(rec).toHaveProperty('placement');
      expect(rec).toHaveProperty('createdAt');
      expect(rec).toHaveProperty('updatedAt');
      // nested student
      expect(rec.student).toHaveProperty('id');
      expect(rec.student).toHaveProperty('name');
      expect(rec.student).toHaveProperty('username');
      expect(rec.student).toHaveProperty('className');
      // nested createdBy
      expect(rec.createdBy).toHaveProperty('id');
      expect(rec.createdBy).toHaveProperty('name');
    });

    it('competitionDate is returned as YYYY-MM-DD string', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      await createRecord({
        studentId: studentUser.id,
        competitionDate: '2026-03-20',
      });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.records[0].competitionDate).toBe('2026-03-20');
    });
  });

  describe('200 — sorting: competitionDate desc, createdAt desc tiebreaker', () => {
    it('sorts records by competitionDate descending', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent } = await loginAs('teacher');

      await createRecord({ studentId: studentUser.id, competitionDate: '2025-06-01' });
      await createRecord({ studentId: studentUser.id, competitionDate: '2026-01-01' });
      await createRecord({ studentId: studentUser.id, competitionDate: '2025-12-01' });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const dates = res.body.records.map((r: { competitionDate: string }) => r.competitionDate);
      const sorted = [...dates].sort((a, b) => b.localeCompare(a));
      expect(dates).toEqual(sorted);
    });

    it('uses createdAt desc as tiebreaker for same competitionDate', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent } = await loginAs('teacher');

      // Insert two records with the same competitionDate
      const recA = await createRecord({
        studentId: studentUser.id,
        competitionDate: '2026-03-01',
        competitionName: 'Tournament A',
      });
      // Small delay to ensure different createdAt
      await new Promise((r) => setTimeout(r, 10));
      const recB = await createRecord({
        studentId: studentUser.id,
        competitionDate: '2026-03-01',
        competitionName: 'Tournament B',
      });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      // recB was created later so it should appear first (desc order)
      const names = res.body.records.map((r: { competitionName: string }) => r.competitionName);
      const idxA = names.indexOf(recA.competitionName);
      const idxB = names.indexOf(recB.competitionName);
      expect(idxB).toBeLessThan(idxA);
    });
  });

  describe('200 — studentId filter', () => {
    it('returns only records belonging to the filtered studentId', async () => {
      const { user: studentA } = await loginAs('student');
      const { user: studentB } = await loginAs('student');
      const { agent } = await loginAs('teacher');

      await createRecord({ studentId: studentA.id, competitionName: 'Competition A' });
      await createRecord({ studentId: studentB.id, competitionName: 'Competition B' });

      const res = await agent.get(`${URL}?studentId=${studentA.id}`);

      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(1);
      expect(res.body.records[0].student.id).toBe(studentA.id);
    });

    it('returns empty array when studentId has no records', async () => {
      const { user: studentA } = await loginAs('student');
      const { user: studentB } = await loginAs('student');
      const { agent } = await loginAs('teacher');

      await createRecord({ studentId: studentA.id });

      const res = await agent.get(`${URL}?studentId=${studentB.id}`);

      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(0);
    });

    it('returns all records when no studentId filter is supplied', async () => {
      const { user: studentA } = await loginAs('student');
      const { user: studentB } = await loginAs('student');
      const { agent } = await loginAs('teacher');

      await createRecord({ studentId: studentA.id });
      await createRecord({ studentId: studentB.id });

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(2);
    });
  });
});
