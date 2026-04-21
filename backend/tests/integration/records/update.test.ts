import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createRecord } from '../../helpers/records';

const URL = (id: string) => `/api/records/${id}`;
const UNKNOWN_ID = 'cl000000000000000000000000';

describe('PATCH /api/records/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('returns 401 without session cookie', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).send({ competitionName: 'Updated' });
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('returns 404 for unknown record id', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(UNKNOWN_ID)).send({ competitionName: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  describe('400 — validation', () => {
    it('empty body {} → 400', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await teacherAgent.patch(URL(record.id)).send({});
      expect(res.status).toBe(400);
    });

    it('invalid level → 400', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await teacherAgent.patch(URL(record.id)).send({ level: 'global' });
      expect(res.status).toBe(400);
    });

    it('placement = 0 → 400', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await teacherAgent.patch(URL(record.id)).send({ placement: 0 });
      expect(res.status).toBe(400);
    });

    it('empty competitionName → 400', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await teacherAgent.patch(URL(record.id)).send({ competitionName: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('403 — forbidden', () => {
    it('coach cannot update any record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: coachAgent } = await loginAs('coach');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await coachAgent.patch(URL(record.id)).send({ competitionName: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('non-creator student cannot update another student record', async () => {
      const { user: studentA } = await loginAs('student');
      const { agent: agentB } = await loginAs('student');
      // Record created by studentA
      const record = await createRecord({ studentId: studentA.id, createdById: studentA.id });

      const res = await agentB.patch(URL(record.id)).send({ competitionName: 'By B' });
      expect(res.status).toBe(403);
    });
  });

  describe('200 — creator can update', () => {
    it('creator student can update own record', async () => {
      const { agent, user } = await loginAs('student');
      const record = await createRecord({ studentId: user.id, createdById: user.id });

      const res = await agent.patch(URL(record.id)).send({ competitionName: 'Updated By Creator' });

      expect(res.status).toBe(200);
      expect(res.body.record.competitionName).toBe('Updated By Creator');
    });
  });

  describe('200 — teacher can update any record', () => {
    it('teacher updates record created by student', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id, createdById: studentUser.id });

      const res = await teacherAgent.patch(URL(record.id)).send({ placement: 2 });

      expect(res.status).toBe(200);
      expect(res.body.record.placement).toBe(2);
    });
  });

  describe('200 — admin can update any record', () => {
    it('admin updates record created by student', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent } = await loginAs('admin');
      const record = await createRecord({ studentId: studentUser.id, createdById: studentUser.id });

      const res = await adminAgent.patch(URL(record.id)).send({ level: 'daerah' });

      expect(res.status).toBe(200);
      expect(res.body.record.level).toBe('daerah');
    });
  });

  describe('200 — partial updates', () => {
    it('only the provided field is changed', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({
        studentId: studentUser.id,
        competitionName: 'Original Name',
        placement: 10,
        level: 'sekolah',
      });

      const res = await teacherAgent.patch(URL(record.id)).send({ competitionName: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.record.competitionName).toBe('New Name');
      // Other fields unchanged
      expect(res.body.record.placement).toBe(10);
      expect(res.body.record.level).toBe('sekolah');
    });

    it('can update placement to null (change to participation)', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id, placement: 5 });

      const res = await teacherAgent.patch(URL(record.id)).send({ placement: null });

      expect(res.status).toBe(200);
      expect(res.body.record.placement).toBeNull();
    });

    it('DB is updated after patch', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id, pajsk: false });

      const res = await teacherAgent.patch(URL(record.id)).send({ pajsk: true });

      expect(res.status).toBe(200);
      const row = await prisma.competitionRecord.findUnique({ where: { id: record.id } });
      expect(row!.pajsk).toBe(true);
    });
  });

  describe('studentId in body is ignored', () => {
    it('studentId in patch body does not move record to another student', async () => {
      const { user: studentA } = await loginAs('student');
      const { user: studentB } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentA.id });

      // Attempt to move record to studentB by passing studentId
      const res = await teacherAgent.patch(URL(record.id)).send({
        competitionName: 'Updated Name',
        studentId: studentB.id,
      });

      expect(res.status).toBe(200);
      // Record must still belong to studentA
      const row = await prisma.competitionRecord.findUnique({ where: { id: record.id } });
      expect(row!.studentId).toBe(studentA.id);
      expect(res.body.record.student.id).toBe(studentA.id);
    });
  });

  describe('200 — response shape includes nested fields', () => {
    it('response includes nested student and createdBy', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent, user: teacherUser } = await loginAs('teacher');
      const record = await createRecord({
        studentId: studentUser.id,
        createdById: teacherUser.id,
      });

      const res = await teacherAgent.patch(URL(record.id)).send({ pajsk: true });

      expect(res.status).toBe(200);
      expect(res.body.record.student).toHaveProperty('id', studentUser.id);
      expect(res.body.record.student).toHaveProperty('name');
      expect(res.body.record.createdBy).toHaveProperty('id', teacherUser.id);
      expect(res.body.record.createdBy).toHaveProperty('name');
    });
  });
});
