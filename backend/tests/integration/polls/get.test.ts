import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createPollRecord, createVoteRecord } from '../../helpers/polls';

const URL = (id: string) => `/api/polls/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/polls/:id', () => {
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
    it('404 for unknown poll id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — full detail shape', () => {
    it('returns all required top-level fields', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id, { title: 'Shape Poll', description: 'Desc' });

      const res = await agent.get(URL(poll.id));

      expect(res.status).toBe(200);
      const p = res.body.poll;
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('title');
      expect(p).toHaveProperty('description');
      expect(p).toHaveProperty('startDate');
      expect(p).toHaveProperty('endDate');
      expect(p).toHaveProperty('isActive');
      expect(p).toHaveProperty('myVoted');
      expect(p).toHaveProperty('myOptionId');
      expect(p).toHaveProperty('createdBy');
      expect(p).toHaveProperty('options');
      expect(p).toHaveProperty('totalVotes');
    });

    it('options have id, label, hasImage, order, voteCount — no imagePath', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));

      expect(res.status).toBe(200);
      const opt = res.body.poll.options[0];
      expect(opt).toHaveProperty('id');
      expect(opt).toHaveProperty('label');
      expect(opt).toHaveProperty('hasImage');
      expect(opt).toHaveProperty('order');
      expect(opt).toHaveProperty('voteCount');
      expect(opt.imagePath).toBeUndefined();
    });

    it('hasImage: false for options without image', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));
      res.body.poll.options.forEach((o: { hasImage: boolean }) => {
        expect(o.hasImage).toBe(false);
      });
    });

    it('voteCount: 0 before any votes', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));
      expect(res.body.poll.totalVotes).toBe(0);
      res.body.poll.options.forEach((o: { voteCount: number }) => {
        expect(o.voteCount).toBe(0);
      });
    });

    it('createdBy has id and name', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.get(URL(poll.id));
      expect(res.body.poll.createdBy.id).toBe(admin.id);
      expect(res.body.poll.createdBy.name).toBeDefined();
    });

    it('myVoted: false and myOptionId: null before voting', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(poll.id));
      expect(res.body.poll.myVoted).toBe(false);
      expect(res.body.poll.myOptionId).toBeNull();
    });

    it('myVoted: true and myOptionId set after voting', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      const res = await agent.get(URL(poll.id));
      expect(res.body.poll.myVoted).toBe(true);
      expect(res.body.poll.myOptionId).toBe(poll.options[0].id);
    });

    it('totalVotes matches sum of option voteCounts', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, { options: ['A', 'B', 'C'] });
      const u1 = await createUser('student');
      const u2 = await createUser('student');
      const u3 = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, u1.id);
      await createVoteRecord(poll.id, poll.options[0].id, u2.id);
      await createVoteRecord(poll.id, poll.options[1].id, u3.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(poll.id));

      const { totalVotes, options } = res.body.poll;
      const sumCounts = options.reduce((s: number, o: { voteCount: number }) => s + o.voteCount, 0);
      expect(totalVotes).toBe(3);
      expect(totalVotes).toBe(sumCounts);
    });

    it('options ordered by order asc', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, { options: ['First', 'Second', 'Third'] });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));
      const labels = res.body.poll.options.map((o: { label: string }) => o.label);
      expect(labels).toEqual(['First', 'Second', 'Third']);
    });

    it('isActive computed correctly (active poll)', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, {
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 3600000),
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));
      expect(res.body.poll.isActive).toBe(true);
    });

    it('isActive: false for ended poll', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, {
        startDate: new Date(Date.now() - 7200000),
        endDate: new Date(Date.now() - 3600000),
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));
      expect(res.body.poll.isActive).toBe(false);
    });
  });

  describe('voters per option — admin/teacher only', () => {
    it('admin GET after vote → option has voters array with voter shape', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);
      const student = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      const res = await agent.get(URL(poll.id));

      expect(res.status).toBe(200);
      const voted = res.body.poll.options.find((o: { id: string }) => o.id === poll.options[0].id);
      expect(Array.isArray(voted.voters)).toBe(true);
      expect(voted.voters).toHaveLength(1);
      expect(voted.voters[0]).toHaveProperty('id');
      expect(voted.voters[0]).toHaveProperty('name');
      expect('className' in voted.voters[0]).toBe(true);
    });

    it('teacher GET → voters present on options', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const student = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id));

      expect(res.status).toBe(200);
      const voted = res.body.poll.options.find((o: { id: string }) => o.id === poll.options[0].id);
      expect(Array.isArray(voted.voters)).toBe(true);
      expect(voted.voters[0].id).toBe(student.id);
    });

    it('student GET → voters key absent from options', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      const res = await agent.get(URL(poll.id));

      expect(res.status).toBe(200);
      res.body.poll.options.forEach((o: Record<string, unknown>) => {
        expect(o.voters).toBeUndefined();
      });
    });

    it('coach GET → voters key absent from options', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const student = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);
      const { agent } = await loginAs('coach');

      const res = await agent.get(URL(poll.id));

      expect(res.status).toBe(200);
      res.body.poll.options.forEach((o: Record<string, unknown>) => {
        expect(o.voters).toBeUndefined();
      });
    });

    it('voters sorted by name asc', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, { options: ['Option A', 'Option B'] });
      const uC = await createUser('student', { name: 'Charlie' });
      const uA = await createUser('student', { name: 'Alice' });
      const uB = await createUser('student', { name: 'Bob' });
      await createVoteRecord(poll.id, poll.options[0].id, uC.id);
      await createVoteRecord(poll.id, poll.options[0].id, uA.id);
      await createVoteRecord(poll.id, poll.options[0].id, uB.id);

      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(poll.id));

      const voted = res.body.poll.options.find((o: { id: string }) => o.id === poll.options[0].id);
      const names = voted.voters.map((v: { name: string }) => v.name);
      expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('voters.length matches voteCount', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, { options: ['A', 'B'] });
      const u1 = await createUser('student');
      const u2 = await createUser('student');
      await createVoteRecord(poll.id, poll.options[0].id, u1.id);
      await createVoteRecord(poll.id, poll.options[0].id, u2.id);

      const { agent } = await loginAs('admin');
      const res = await agent.get(URL(poll.id));

      res.body.poll.options.forEach((o: { voteCount: number; voters: unknown[] }) => {
        expect(o.voters.length).toBe(o.voteCount);
      });
    });

    it('empty voters array on options with no votes', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.get(URL(poll.id));

      res.body.poll.options.forEach((o: { voters: unknown[] }) => {
        expect(o.voters).toEqual([]);
      });
    });
  });
});
