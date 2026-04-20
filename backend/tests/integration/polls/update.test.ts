import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createPollRecord, isoFromNow } from '../../helpers/polls';

const URL = (id: string) => `/api/polls/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/polls/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).send({ title: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(poll.id)).send({ title: 'Updated' });
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.patch(URL(poll.id)).send({ title: 'Updated' });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown poll', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(UNKNOWN_ID)).send({ title: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('200 — partial update', () => {
    it('admin updates title only → 200, title changed', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id, { title: 'Original' });

      const res = await agent.patch(URL(poll.id)).send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.poll.title).toBe('Updated Title');
    });

    it('admin updates description → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.patch(URL(poll.id)).send({ description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.poll.description).toBe('New description');
    });

    it('empty string description → null (cleared)', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id, { description: 'Old desc' });

      const res = await agent.patch(URL(poll.id)).send({ description: '' });

      expect(res.status).toBe(200);
      expect(res.body.poll.description).toBeNull();
    });

    it('admin updates endDate → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);
      const newEnd = isoFromNow(120);

      const res = await agent.patch(URL(poll.id)).send({ endDate: newEnd });

      expect(res.status).toBe(200);
      expect(res.body.poll).toBeDefined();
    });

    it('options unchanged after PATCH (immutable)', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id, { options: ['Alpha', 'Beta'] });

      await agent.patch(URL(poll.id)).send({ title: 'New Title' });

      const res = await agent.get(URL(poll.id));
      const labels = res.body.poll.options.map((o: { label: string }) => o.label);
      expect(labels).toContain('Alpha');
      expect(labels).toContain('Beta');
    });

    it('response includes poll detail shape', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.patch(URL(poll.id)).send({ title: 'New' });

      expect(res.status).toBe(200);
      expect(res.body.poll.options).toBeDefined();
      expect(res.body.poll.totalVotes).toBeDefined();
    });
  });

  describe('400 — bad date range', () => {
    it('endDate before startDate (both provided) → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.patch(URL(poll.id)).send({
        startDate: isoFromNow(60),
        endDate: isoFromNow(30),
      });

      expect(res.status).toBe(400);
    });
  });
});
