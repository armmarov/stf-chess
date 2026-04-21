import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createRecord } from '../../helpers/records';

const URL = (id: string) => `/api/records/${id}`;
const UNKNOWN_ID = 'cl000000000000000000000000';

describe('GET /api/records/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('returns 401 without session cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('returns 404 for unknown record id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — happy path', () => {
    it('returns 200 with full record for student', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      const record = await createRecord({
        studentId: studentUser.id,
        competitionName: 'Selangor Open 2026',
        competitionDate: '2026-02-10',
        level: 'negeri',
        category: 'u18',
        pajsk: true,
        fideRated: false,
        mcfRated: true,
        placement: 3,
      });

      const res = await agent.get(URL(record.id));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('record');
    });

    it('returns correct field values', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      const record = await createRecord({
        studentId: studentUser.id,
        competitionName: 'Selangor Open 2026',
        competitionDate: '2026-02-10',
        level: 'negeri',
        category: 'u18',
        pajsk: true,
        fideRated: false,
        mcfRated: true,
        placement: 3,
      });

      const res = await agent.get(URL(record.id));

      const rec = res.body.record;
      expect(rec.id).toBe(record.id);
      expect(rec.competitionName).toBe('Selangor Open 2026');
      expect(rec.competitionDate).toBe('2026-02-10');
      expect(rec.level).toBe('negeri');
      expect(rec.category).toBe('u18');
      expect(rec.pajsk).toBe(true);
      expect(rec.fideRated).toBe(false);
      expect(rec.mcfRated).toBe(true);
      expect(rec.placement).toBe(3);
    });

    it('response includes nested student object', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await agent.get(URL(record.id));

      expect(res.status).toBe(200);
      expect(res.body.record.student).toHaveProperty('id', studentUser.id);
      expect(res.body.record.student).toHaveProperty('name');
      expect(res.body.record.student).toHaveProperty('username');
      expect(res.body.record.student).toHaveProperty('className');
    });

    it('response includes nested createdBy object', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      const { user: teacherUser } = await loginAs('teacher');
      const record = await createRecord({
        studentId: studentUser.id,
        createdById: teacherUser.id,
      });

      const res = await agent.get(URL(record.id));

      expect(res.status).toBe(200);
      expect(res.body.record.createdBy).toHaveProperty('id', teacherUser.id);
      expect(res.body.record.createdBy).toHaveProperty('name');
    });

    it('teacher can get any record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await teacherAgent.get(URL(record.id));

      expect(res.status).toBe(200);
    });

    it('admin can get any record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent } = await loginAs('admin');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await adminAgent.get(URL(record.id));

      expect(res.status).toBe(200);
    });

    it('coach can get any record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: coachAgent } = await loginAs('coach');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await coachAgent.get(URL(record.id));

      expect(res.status).toBe(200);
    });

    it('returns placement = null for participation record', async () => {
      const { agent, user: studentUser } = await loginAs('student');
      const record = await createRecord({ studentId: studentUser.id, placement: null });

      const res = await agent.get(URL(record.id));

      expect(res.status).toBe(200);
      expect(res.body.record.placement).toBeNull();
    });
  });
});
