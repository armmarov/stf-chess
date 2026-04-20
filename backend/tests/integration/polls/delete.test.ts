import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { JPEG_BUFFER } from '../../helpers/payments';
import {
  cleanPollUploads,
  createPollRecord,
  createPollOptionRecord,
  createVoteRecord,
  pollFileExists,
  writePollFixture,
} from '../../helpers/polls';

const URL = (id: string) => `/api/polls/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('DELETE /api/polls/:id', () => {
  beforeEach(async () => {
    await resetDb();
    cleanPollUploads();
  });

  afterEach(() => {
    cleanPollUploads();
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
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.delete(URL(poll.id));
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.delete(URL(poll.id));
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown poll', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('204 — successful delete', () => {
    it('admin deletes poll → 204, row removed from DB', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.delete(URL(poll.id));

      expect(res.status).toBe(204);
      const row = await prisma.poll.findUnique({ where: { id: poll.id } });
      expect(row).toBeNull();
    });

    it('cascade deletes options and votes', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);
      const student = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      await agent.delete(URL(poll.id));

      const options = await prisma.pollOption.findMany({ where: { pollId: poll.id } });
      const votes = await prisma.vote.findMany({ where: { pollId: poll.id } });
      expect(options).toHaveLength(0);
      expect(votes).toHaveLength(0);
    });

    it('option image files deleted from disk on poll delete', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);
      const imgPath = writePollFixture('to-delete.jpg', JPEG_BUFFER);
      await createPollOptionRecord(poll.id, 'With image', { imagePath: imgPath, order: 2 });

      expect(pollFileExists(imgPath)).toBe(true);

      await agent.delete(URL(poll.id));

      expect(pollFileExists(imgPath)).toBe(false);
    });

    it('delete with no images succeeds without error', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);
      const res = await agent.delete(URL(poll.id));
      expect(res.status).toBe(204);
    });
  });
});
