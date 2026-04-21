import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createRecord } from '../../helpers/records';

const URL = (id: string) => `/api/records/${id}`;
const UNKNOWN_ID = 'cl000000000000000000000000';

describe('DELETE /api/records/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('returns 401 without session cookie', async () => {
      const res = await request(app).delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('returns 404 for unknown record id', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });

    it('returns 404 when trying to delete already-deleted record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      await teacherAgent.delete(URL(record.id));
      const res = await teacherAgent.delete(URL(record.id));

      expect(res.status).toBe(404);
    });
  });

  describe('403 — forbidden', () => {
    it('coach cannot delete any record', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: coachAgent } = await loginAs('coach');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await coachAgent.delete(URL(record.id));
      expect(res.status).toBe(403);
    });

    it('non-creator student cannot delete another student record', async () => {
      const { user: studentA } = await loginAs('student');
      const { agent: agentB } = await loginAs('student');
      const record = await createRecord({ studentId: studentA.id, createdById: studentA.id });

      const res = await agentB.delete(URL(record.id));
      expect(res.status).toBe(403);
    });
  });

  describe('204 — creator can delete', () => {
    it('creator student can delete own record', async () => {
      const { agent, user } = await loginAs('student');
      const record = await createRecord({ studentId: user.id, createdById: user.id });

      const res = await agent.delete(URL(record.id));

      expect(res.status).toBe(204);
    });

    it('row is actually removed from DB after creator deletes', async () => {
      const { agent, user } = await loginAs('student');
      const record = await createRecord({ studentId: user.id, createdById: user.id });

      await agent.delete(URL(record.id));

      const row = await prisma.competitionRecord.findUnique({ where: { id: record.id } });
      expect(row).toBeNull();
    });
  });

  describe('204 — teacher can delete any record', () => {
    it('teacher deletes record created by student', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id, createdById: studentUser.id });

      const res = await teacherAgent.delete(URL(record.id));

      expect(res.status).toBe(204);
    });

    it('row is actually removed from DB when teacher deletes', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      await teacherAgent.delete(URL(record.id));

      const row = await prisma.competitionRecord.findUnique({ where: { id: record.id } });
      expect(row).toBeNull();
    });
  });

  describe('204 — admin can delete any record', () => {
    it('admin deletes record created by student', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent } = await loginAs('admin');
      const record = await createRecord({ studentId: studentUser.id, createdById: studentUser.id });

      const res = await adminAgent.delete(URL(record.id));

      expect(res.status).toBe(204);
    });

    it('row is actually removed from DB when admin deletes', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: adminAgent } = await loginAs('admin');
      const record = await createRecord({ studentId: studentUser.id });

      await adminAgent.delete(URL(record.id));

      const row = await prisma.competitionRecord.findUnique({ where: { id: record.id } });
      expect(row).toBeNull();
    });
  });

  describe('204 — response body is empty', () => {
    it('204 response has no body', async () => {
      const { user: studentUser } = await loginAs('student');
      const { agent: teacherAgent } = await loginAs('teacher');
      const record = await createRecord({ studentId: studentUser.id });

      const res = await teacherAgent.delete(URL(record.id));

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(res.text).toBe('');
    });
  });
});
