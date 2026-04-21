import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createPuzzle, recordAttemptRow } from '../../helpers/puzzles';

const URL = (id: string) => `/api/puzzles/${id}/attempt`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

const VALID_BODY = { status: 'solved', movesTaken: 3, timeMs: 5000 };

describe('POST /api/puzzles/:id/attempt', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL(UNKNOWN_ID)).send(VALID_BODY);
      expect(res.status).toBe(401);
    });
  });

  describe('404 — puzzle not found', () => {
    it('404 for unknown puzzle id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(UNKNOWN_ID)).send(VALID_BODY);
      expect(res.status).toBe(404);
    });
  });

  describe('400 — validation', () => {
    it('missing status → 400', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');
      const { status: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL(puzzle.id)).send(rest);
      expect(res.status).toBe(400);
    });

    it('invalid status value → 400', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(puzzle.id)).send({ ...VALID_BODY, status: 'quit' });
      expect(res.status).toBe(400);
    });

    it('negative timeMs → 400', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(puzzle.id)).send({ ...VALID_BODY, timeMs: -1 });
      expect(res.status).toBe(400);
    });

    it('missing movesTaken → 400', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');
      const { movesTaken: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL(puzzle.id)).send(rest);
      expect(res.status).toBe(400);
    });
  });

  describe('201 — creates attempt row', () => {
    it('returns 201 with attempt object', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.attempt).toHaveProperty('id');
      expect(res.body.attempt.status).toBe('solved');
      expect(res.body.attempt.movesTaken).toBe(3);
      expect(res.body.attempt.timeMs).toBe(5000);
    });

    it('attempt is persisted in DB', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      const row = await prisma.puzzleAttempt.findUnique({
        where: { id: res.body.attempt.id },
      });
      expect(row).not.toBeNull();
      expect(row!.userId).toBe(user.id);
      expect(row!.puzzleId).toBe(puzzle.id);
      expect(row!.status).toBe('solved');
    });

    it('attemptedOn is today (UTC date)', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');
      const todayStr = new Date().toISOString().slice(0, 10);

      const res = await agent.post(URL(puzzle.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.attempt.attemptedOn).toContain(todayStr);
    });

    it('all three statuses can be recorded', async () => {
      for (const status of ['solved', 'failed', 'gave_up'] as const) {
        const puzzle = await createPuzzle();
        const { agent } = await loginAs('student');
        const res = await agent.post(URL(puzzle.id)).send({ ...VALID_BODY, status });
        expect(res.status).toBe(201);
        expect(res.body.attempt.status).toBe(status);
      }
    });
  });

  describe('isFirstTry logic', () => {
    it('isFirstTry=true on first attempt of the day', async () => {
      const puzzle = await createPuzzle();
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.attempt.isFirstTry).toBe(true);
    });

    it('isFirstTry=false on second attempt of the same day', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      // Insert first attempt directly (simulates prior attempt)
      await recordAttemptRow(puzzle.id, user.id, { status: 'failed' });

      const res = await agent.post(URL(puzzle.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.attempt.isFirstTry).toBe(false);
    });

    it('isFirstTry=true for a different puzzle even if other puzzle has attempts', async () => {
      const puzzleA = await createPuzzle();
      const puzzleB = await createPuzzle();
      const { agent, user } = await loginAs('student');

      await recordAttemptRow(puzzleA.id, user.id, { status: 'solved' });

      const res = await agent.post(URL(puzzleB.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.attempt.isFirstTry).toBe(true);
    });

    it("isFirstTry=true for same puzzle if prior attempt was by a different user", async () => {
      const puzzle = await createPuzzle();
      const { agent: agentA, user: userA } = await loginAs('student');
      const { agent: agentB } = await loginAs('student');

      await recordAttemptRow(puzzle.id, userA.id, { status: 'solved' });

      const res = await agentB.post(URL(puzzle.id)).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.attempt.isFirstTry).toBe(true);
    });
  });

  describe('solutionUci exposure on gave_up', () => {
    it('gave_up response includes solutionUci', async () => {
      const puzzle = await createPuzzle({ solutionUci: 'e7e5 g1f3 b8c6' });
      const { agent } = await loginAs('student');

      const res = await agent
        .post(URL(puzzle.id))
        .send({ status: 'gave_up', movesTaken: 0, timeMs: 30000 });

      expect(res.status).toBe(201);
      expect(res.body.attempt.solutionUci).toBe('e7e5 g1f3 b8c6');
    });

    it('solved response does NOT include solutionUci', async () => {
      const puzzle = await createPuzzle({ solutionUci: 'e7e5 g1f3 b8c6' });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send(VALID_BODY); // status: 'solved'

      expect(res.status).toBe(201);
      expect(res.body.attempt).not.toHaveProperty('solutionUci');
    });

    it('failed response does NOT include solutionUci', async () => {
      const puzzle = await createPuzzle({ solutionUci: 'e7e5 g1f3 b8c6' });
      const { agent } = await loginAs('student');

      const res = await agent
        .post(URL(puzzle.id))
        .send({ status: 'failed', movesTaken: 3, timeMs: 12000 });

      expect(res.status).toBe(201);
      expect(res.body.attempt).not.toHaveProperty('solutionUci');
    });
  });
});
