import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createPollRecord, createVoteRecord } from '../../helpers/polls';

const URL = (id: string) => `/api/polls/${id}/vote`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/polls/:id/vote', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL(UNKNOWN_ID)).send({ optionId: UNKNOWN_ID });
      expect(res.status).toBe(401);
    });
  });

  describe('404 — poll not found', () => {
    it('404 for unknown poll', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(UNKNOWN_ID)).send({ optionId: UNKNOWN_ID });
      expect(res.status).toBe(404);
    });
  });

  describe('409 — timing constraints', () => {
    it('409 "Poll has not started" when startDate in future', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, {
        startDate: new Date(Date.now() + 60 * 60 * 1000),
        endDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/not started/i);
    });

    it('409 "Poll has ended" when endDate in past', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, {
        startDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 60 * 60 * 1000),
      });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/ended/i);
    });

    it('409 "You have already voted" on double-vote', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent, user: student } = await loginAs('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already voted/i);
    });

    it('409 even if second vote targets a different option', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, { options: ['A', 'B', 'C'] });
      const { agent, user: student } = await loginAs('student');
      await createVoteRecord(poll.id, poll.options[0].id, student.id);

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[1].id });

      expect(res.status).toBe(409);
    });
  });

  describe('400 — invalid optionId', () => {
    it('400 when optionId belongs to a different poll', async () => {
      const admin = await createUser('admin');
      const pollA = await createPollRecord(admin.id);
      const pollB = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(pollA.id)).send({ optionId: pollB.options[0].id });

      expect(res.status).toBe(400);
    });

    it('400 when optionId is not a valid UUID', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(poll.id)).send({ optionId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });

    it('400 when optionId is completely unknown UUID', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(poll.id)).send({ optionId: UNKNOWN_ID });

      expect(res.status).toBe(400);
    });
  });

  describe('201 — happy path', () => {
    it('201 with updated poll detail; voteCount++, myVoted: true, myOptionId set', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent, user: student } = await loginAs('student');

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(201);
      const p = res.body.poll;
      expect(p.myVoted).toBe(true);
      expect(p.myOptionId).toBe(poll.options[0].id);
      expect(p.totalVotes).toBe(1);

      const votedOption = p.options.find((o: { id: string }) => o.id === poll.options[0].id);
      expect(votedOption.voteCount).toBe(1);

      const vote = await prisma.vote.findFirst({
        where: { pollId: poll.id, userId: student.id },
      });
      expect(vote).not.toBeNull();
    });

    it('two different users can vote on the same poll independently', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id, { options: ['A', 'B'] });

      const { agent: agentA, user: studentA } = await loginAs('student');
      const { agent: agentB, user: studentB } = await loginAs('student');

      const resA = await agentA.post(URL(poll.id)).send({ optionId: poll.options[0].id });
      const resB = await agentB.post(URL(poll.id)).send({ optionId: poll.options[1].id });

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      const votes = await prisma.vote.findMany({ where: { pollId: poll.id } });
      expect(votes).toHaveLength(2);
      const voterIds = votes.map((v) => v.userId);
      expect(voterIds).toContain(studentA.id);
      expect(voterIds).toContain(studentB.id);
    });

    it('non-student (teacher) can also vote', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(201);
      expect(res.body.poll.myVoted).toBe(true);
    });

    it('admin can vote on own poll', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(201);
    });

    it('admin vote response includes voters on options', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const poll = await createPollRecord(admin.id);

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(201);
      const voted = res.body.poll.options.find((o: { id: string }) => o.id === poll.options[0].id);
      expect(Array.isArray(voted.voters)).toBe(true);
      expect(voted.voters[0].id).toBe(admin.id);
    });

    it('student vote response omits voters from options', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(poll.id)).send({ optionId: poll.options[0].id });

      expect(res.status).toBe(201);
      res.body.poll.options.forEach((o: Record<string, unknown>) => {
        expect(o.voters).toBeUndefined();
      });
    });
  });
});
