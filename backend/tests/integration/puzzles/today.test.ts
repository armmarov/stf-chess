import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createFivePuzzles, recordAttemptRow } from '../../helpers/puzzles';

const URL = '/api/puzzles/today';

describe('GET /api/puzzles/today', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('404 — no puzzles seeded', () => {
    it('404 when no puzzles exist', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(404);
    });
  });

  describe('200 — any role can fetch today', () => {
    it('returns 200 for each role', async () => {
      await createFivePuzzles();
      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('200 — response shape', () => {
    it('returns date and puzzles array of length 5', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('date');
      expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(res.body.puzzles)).toBe(true);
      expect(res.body.puzzles).toHaveLength(5);
    });

    it('puzzle item has expected fields', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      const p = res.body.puzzles[0];
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('externalId');
      expect(p).toHaveProperty('fen');
      expect(p).toHaveProperty('solutionLength');
      expect(p).toHaveProperty('rating');
      expect(p).toHaveProperty('myAttempts');
      expect(p.myAttempts).toHaveProperty('solved');
      expect(p.myAttempts).toHaveProperty('attempts');
      expect(p.myAttempts).toHaveProperty('bestTimeMs');
    });

    it('solutionUci is NEVER in response', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      for (const p of res.body.puzzles) {
        expect(p).not.toHaveProperty('solutionUci');
        expect(p).not.toHaveProperty('solution_uci');
      }
    });

    it('solutionLength matches word count of solution', async () => {
      // Default puzzle has solutionUci 'e7e5 g1f3 b8c6' → 3 plies
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      for (const p of res.body.puzzles) {
        expect(p.solutionLength).toBe(3);
      }
    });

    it('puzzles sorted by rating asc', async () => {
      await createFivePuzzles(); // ratings: 1000, 1100, 1200, 1300, 1400
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      const ratings = res.body.puzzles.map((p: { rating: number }) => p.rating);
      const sorted = [...ratings].sort((a, b) => a - b);
      expect(ratings).toEqual(sorted);
    });
  });

  describe('200 — same puzzles for different users on same day', () => {
    it('two users get identical puzzle id sets', async () => {
      await createFivePuzzles();
      const { agent: agentA } = await loginAs('student');
      const { agent: agentB } = await loginAs('teacher');

      const [resA, resB] = await Promise.all([
        agentA.get(URL),
        agentB.get(URL),
      ]);

      const idsA = resA.body.puzzles.map((p: { id: string }) => p.id).sort();
      const idsB = resB.body.puzzles.map((p: { id: string }) => p.id).sort();
      expect(idsA).toEqual(idsB);
    });
  });

  describe('200 — myAttempts reflects prior attempts', () => {
    it('myAttempts.attempts=0, solved=false when no prior attempt', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      for (const p of res.body.puzzles) {
        expect(p.myAttempts.attempts).toBe(0);
        expect(p.myAttempts.solved).toBe(false);
        expect(p.myAttempts.bestTimeMs).toBeNull();
      }
    });

    it('myAttempts reflects solved attempt for the requesting user', async () => {
      await createFivePuzzles();
      const { agent, user } = await loginAs('student');

      // Get today's puzzles to find a real puzzle id
      const todayRes = await agent.get(URL);
      const puzzleId = todayRes.body.puzzles[0].id;

      // Insert a solved attempt directly
      await recordAttemptRow(puzzleId, user.id, { status: 'solved', timeMs: 4000 });

      const res = await agent.get(URL);
      const entry = res.body.puzzles.find((p: { id: string }) => p.id === puzzleId);

      expect(entry.myAttempts.solved).toBe(true);
      expect(entry.myAttempts.attempts).toBe(1);
      expect(entry.myAttempts.bestTimeMs).toBe(4000);
    });

    it("myAttempts of other user's solves don't bleed into response", async () => {
      await createFivePuzzles();
      const { agent: agentA } = await loginAs('student');
      const { agent: agentB, user: userB } = await loginAs('student');

      // Get puzzle ids
      const todayRes = await agentA.get(URL);
      const puzzleId = todayRes.body.puzzles[0].id;

      // Only userB solves it
      await recordAttemptRow(puzzleId, userB.id, { status: 'solved' });

      const resA = await agentA.get(URL);
      const entryA = resA.body.puzzles.find((p: { id: string }) => p.id === puzzleId);
      expect(entryA.myAttempts.solved).toBe(false);
      expect(entryA.myAttempts.attempts).toBe(0);
    });

    it('bestTimeMs is the minimum solve time when solved multiple times', async () => {
      await createFivePuzzles();
      const { agent, user } = await loginAs('student');

      const todayRes = await agent.get(URL);
      const puzzleId = todayRes.body.puzzles[0].id;

      await recordAttemptRow(puzzleId, user.id, { status: 'solved', timeMs: 8000 });
      await recordAttemptRow(puzzleId, user.id, { status: 'solved', timeMs: 3000 });

      const res = await agent.get(URL);
      const entry = res.body.puzzles.find((p: { id: string }) => p.id === puzzleId);

      expect(entry.myAttempts.bestTimeMs).toBe(3000);
      expect(entry.myAttempts.attempts).toBe(2);
    });
  });
});
