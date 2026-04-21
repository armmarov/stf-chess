import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';

const URL = '/api/records';

const validBody = (studentId: string) => ({
  studentId,
  competitionName: 'Malaysian Schools Championship',
  competitionDate: '2026-04-10',
  level: 'kebangsaan',
  category: 'u18',
  pajsk: true,
  fideRated: false,
  mcfRated: false,
  placement: 5,
});

describe('POST /api/records', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('returns 401 without session cookie', async () => {
      const res = await request(app).post(URL).send({ studentId: 'any' });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — forbidden roles', () => {
    it('coach cannot create any record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: coachAgent } = await loginAs('coach');

      const res = await coachAgent.post(URL).send(validBody(studentUser.id));

      expect(res.status).toBe(403);
    });

    it('student cannot create record for another student', async () => {
      const { agent: studentAgentA } = await loginAs('student');
      const { user: studentUserB } = await loginAs('student');

      const res = await studentAgentA.post(URL).send(validBody(studentUserB.id));

      expect(res.status).toBe(403);
    });
  });

  describe('201 — student creates record for self', () => {
    it('returns 201 when student posts own studentId', async () => {
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL).send(validBody(user.id));

      expect(res.status).toBe(201);
    });

    it('returned record has correct fields', async () => {
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL).send(validBody(user.id));

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('record');
      const rec = res.body.record;
      expect(rec).toHaveProperty('id');
      expect(rec.competitionName).toBe('Malaysian Schools Championship');
      expect(rec.competitionDate).toBe('2026-04-10');
      expect(rec.level).toBe('kebangsaan');
      expect(rec.category).toBe('u18');
      expect(rec.pajsk).toBe(true);
      expect(rec.placement).toBe(5);
    });

    it('createdById is always the requesting user (student self-create)', async () => {
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL).send(validBody(user.id));

      expect(res.status).toBe(201);
      // Verify DB directly
      const row = await prisma.competitionRecord.findUnique({ where: { id: res.body.record.id } });
      expect(row!.createdById).toBe(user.id);
      expect(row!.studentId).toBe(user.id);
    });

    it('accepts placement = null (participation)', async () => {
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL).send({ ...validBody(user.id), placement: null });

      expect(res.status).toBe(201);
      expect(res.body.record.placement).toBeNull();
    });
  });

  describe('201 — teacher creates record for any student', () => {
    it('teacher can create record for a student', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent, user: teacherUser } = await loginAs('teacher');

      const res = await teacherAgent.post(URL).send(validBody(studentUser.id));

      expect(res.status).toBe(201);
      expect(res.body.record.student.id).toBe(studentUser.id);
    });

    it('createdById is teacher when teacher creates record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent, user: teacherUser } = await loginAs('teacher');

      const res = await teacherAgent.post(URL).send(validBody(studentUser.id));

      expect(res.status).toBe(201);
      const row = await prisma.competitionRecord.findUnique({ where: { id: res.body.record.id } });
      expect(row!.createdById).toBe(teacherUser.id);
      expect(row!.studentId).toBe(studentUser.id);
    });

    it('studentId in body is honored for teacher', async () => {
      const { user: studentA } = await loginAs('student');
      const { user: studentB } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');

      const res = await teacherAgent.post(URL).send(validBody(studentB.id));

      expect(res.status).toBe(201);
      expect(res.body.record.student.id).toBe(studentB.id);
    });
  });

  describe('201 — admin creates record for any student', () => {
    it('admin can create record for a student', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent, user: adminUser } = await loginAs('admin');

      const res = await adminAgent.post(URL).send(validBody(studentUser.id));

      expect(res.status).toBe(201);
      expect(res.body.record.student.id).toBe(studentUser.id);
    });

    it('createdById is admin when admin creates record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent, user: adminUser } = await loginAs('admin');

      const res = await adminAgent.post(URL).send(validBody(studentUser.id));

      expect(res.status).toBe(201);
      const row = await prisma.competitionRecord.findUnique({ where: { id: res.body.record.id } });
      expect(row!.createdById).toBe(adminUser.id);
    });

    it('studentId in body is honored for admin', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent } = await loginAs('admin');

      const res = await adminAgent.post(URL).send(validBody(studentUser.id));

      expect(res.status).toBe(201);
      expect(res.body.record.student.id).toBe(studentUser.id);
    });
  });

  describe('400 — validation errors', () => {
    it('missing studentId → 400', async () => {
      const { agent, user } = await loginAs('student');
      const { studentId: _, ...rest } = validBody(user.id);
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('missing competitionName → 400', async () => {
      const { agent, user } = await loginAs('student');
      const { competitionName: _, ...rest } = validBody(user.id);
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('empty competitionName → 400', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.post(URL).send({ ...validBody(user.id), competitionName: '' });
      expect(res.status).toBe(400);
    });

    it('invalid level → 400', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.post(URL).send({ ...validBody(user.id), level: 'international' });
      expect(res.status).toBe(400);
    });

    it('invalid category → 400', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.post(URL).send({ ...validBody(user.id), category: 'u12' });
      expect(res.status).toBe(400);
    });

    it('placement = 0 → 400', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.post(URL).send({ ...validBody(user.id), placement: 0 });
      expect(res.status).toBe(400);
    });

    it('placement = 31 → 400', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.post(URL).send({ ...validBody(user.id), placement: 31 });
      expect(res.status).toBe(400);
    });

    it('non-ISO date → 400', async () => {
      const { agent, user } = await loginAs('student');
      const res = await agent.post(URL).send({ ...validBody(user.id), competitionDate: '10/04/2026' });
      expect(res.status).toBe(400);
    });

    it('missing pajsk → 400', async () => {
      const { agent, user } = await loginAs('student');
      const { pajsk: _, ...rest } = validBody(user.id);
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('missing fideRated → 400', async () => {
      const { agent, user } = await loginAs('student');
      const { fideRated: _, ...rest } = validBody(user.id);
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('missing mcfRated → 400', async () => {
      const { agent, user } = await loginAs('student');
      const { mcfRated: _, ...rest } = validBody(user.id);
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });
  });

  describe('DB persistence', () => {
    it('record is persisted in the database after creation', async () => {
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL).send(validBody(user.id));

      expect(res.status).toBe(201);
      const row = await prisma.competitionRecord.findUnique({ where: { id: res.body.record.id } });
      expect(row).not.toBeNull();
      expect(row!.studentId).toBe(user.id);
      expect(row!.competitionName).toBe('Malaysian Schools Championship');
    });
  });
});
