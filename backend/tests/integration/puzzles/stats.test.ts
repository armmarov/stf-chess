import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createFivePuzzles, createPuzzle, recordAttemptRow } from '../../helpers/puzzles';

const URL = '/api/puzzles/me/stats';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00Z');
}

describe('GET /api/puzzles/me/stats', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — zero-state', () => {
    it('returns zero stats when no attempts', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.totalSolved).toBe(0);
      expect(res.body.currentStreak).toBe(0);
      expect(res.body.longestStreak).toBe(0);
      expect(res.body.todayProgress.solved).toBe(0);
      expect(res.body.todayProgress.total).toBe(5);
    });

    it('last7Days array has 7 entries', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      expect(res.body.last7Days).toHaveLength(7);
    });

    it('last7Days entries have date and solved fields', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      for (const entry of res.body.last7Days) {
        expect(entry).toHaveProperty('date');
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry).toHaveProperty('solved');
      }
    });
  });

  describe('totalSolved', () => {
    it('counts total solved attempts (not distinct puzzles)', async () => {
      const puzzleA = await createPuzzle();
      const puzzleB = await createPuzzle();
      const { agent, user } = await loginAs('student');

      await recordAttemptRow(puzzleA.id, user.id, { status: 'solved' });
      await recordAttemptRow(puzzleA.id, user.id, { status: 'solved' }); // second solve
      await recordAttemptRow(puzzleB.id, user.id, { status: 'failed' });

      const res = await agent.get(URL);
      expect(res.body.totalSolved).toBe(2);
    });

    it('failed and gave_up attempts do not count towards totalSolved', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      await recordAttemptRow(puzzle.id, user.id, { status: 'failed' });
      await recordAttemptRow(puzzle.id, user.id, { status: 'gave_up' });

      const res = await agent.get(URL);
      expect(res.body.totalSolved).toBe(0);
    });

    it("other user's solves do not appear in my stats", async () => {
      const puzzle = await createPuzzle();
      const { agent: agentA } = await loginAs('student');
      const { agent: agentB, user: userB } = await loginAs('student');

      await recordAttemptRow(puzzle.id, userB.id, { status: 'solved' });

      const res = await agentA.get(URL);
      expect(res.body.totalSolved).toBe(0);
    });
  });

  describe('todayProgress', () => {
    it('todayProgress.solved increments as today puzzles are solved', async () => {
      const puzzles = await createFivePuzzles();
      const { agent, user } = await loginAs('student');

      // Solve 2 of today's puzzles
      const todayRes = await agent.get('/api/puzzles/today');
      const todayIds: string[] = todayRes.body.puzzles.map((p: { id: string }) => p.id);

      await recordAttemptRow(todayIds[0], user.id, { status: 'solved' });
      await recordAttemptRow(todayIds[1], user.id, { status: 'solved' });

      const res = await agent.get(URL);
      expect(res.body.todayProgress.solved).toBe(2);
      expect(res.body.todayProgress.total).toBe(5);
    });

    it('failed attempt on today puzzle does not increment todayProgress.solved', async () => {
      await createFivePuzzles();
      const { agent, user } = await loginAs('student');

      const todayRes = await agent.get('/api/puzzles/today');
      const puzzleId = todayRes.body.puzzles[0].id;
      await recordAttemptRow(puzzleId, user.id, { status: 'failed' });

      const res = await agent.get(URL);
      expect(res.body.todayProgress.solved).toBe(0);
    });
  });

  describe('currentStreak', () => {
    it('currentStreak=1 when solved today only', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      await recordAttemptRow(puzzle.id, user.id, { status: 'solved', attemptedOn: daysAgo(0) });

      const res = await agent.get(URL);
      expect(res.body.currentStreak).toBe(1);
    });

    it('currentStreak=3 for three consecutive days ending today', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      for (let i = 0; i < 3; i++) {
        await recordAttemptRow(puzzle.id, user.id, {
          status: 'solved',
          attemptedOn: daysAgo(i),
          isFirstTry: i === 0,
        });
      }

      const res = await agent.get(URL);
      expect(res.body.currentStreak).toBe(3);
    });

    it('currentStreak=0 when last solve was yesterday (gap today)', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      await recordAttemptRow(puzzle.id, user.id, {
        status: 'solved',
        attemptedOn: daysAgo(1),
      });

      const res = await agent.get(URL);
      expect(res.body.currentStreak).toBe(0);
    });

    it('currentStreak breaks on non-consecutive days', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      // Days 0 and 1 (contiguous), then gap at day 3
      await recordAttemptRow(puzzle.id, user.id, { status: 'solved', attemptedOn: daysAgo(0) });
      await recordAttemptRow(puzzle.id, user.id, { status: 'solved', attemptedOn: daysAgo(1) });
      await recordAttemptRow(puzzle.id, user.id, { status: 'solved', attemptedOn: daysAgo(3) });

      const res = await agent.get(URL);
      expect(res.body.currentStreak).toBe(2);
    });
  });

  describe('longestStreak', () => {
    it('longestStreak=1 for a single solve day', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      await recordAttemptRow(puzzle.id, user.id, { status: 'solved', attemptedOn: daysAgo(5) });

      const res = await agent.get(URL);
      expect(res.body.longestStreak).toBe(1);
    });

    it('longestStreak captures longest run across history', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      // Run of 4: days 10,9,8,7 ago; then gap; run of 2: days 3,2 ago
      for (const d of [10, 9, 8, 7, 3, 2]) {
        await recordAttemptRow(puzzle.id, user.id, {
          status: 'solved',
          attemptedOn: daysAgo(d),
        });
      }

      const res = await agent.get(URL);
      expect(res.body.longestStreak).toBe(4);
    });

    it('longestStreak >= currentStreak always', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      for (let i = 0; i < 3; i++) {
        await recordAttemptRow(puzzle.id, user.id, {
          status: 'solved',
          attemptedOn: daysAgo(i),
        });
      }

      const res = await agent.get(URL);
      expect(res.body.longestStreak).toBeGreaterThanOrEqual(res.body.currentStreak);
    });
  });

  describe('last7Days', () => {
    it('last7Days covers today through 6 days ago in chronological order', async () => {
      await createFivePuzzles();
      const { agent } = await loginAs('student');
      const today = new Date().toISOString().slice(0, 10);

      const res = await agent.get(URL);

      const dates = res.body.last7Days.map((d: { date: string }) => d.date);
      expect(dates[6]).toBe(today);
      expect(dates).toHaveLength(7);
      // Verify monotonically increasing
      for (let i = 1; i < 7; i++) {
        expect(new Date(dates[i]).getTime()).toBeGreaterThan(new Date(dates[i - 1]).getTime());
      }
    });

    it('solved=true only on days with at least one solved attempt', async () => {
      const puzzle = await createPuzzle();
      const { agent, user } = await loginAs('student');

      // Solve 2 days ago
      await recordAttemptRow(puzzle.id, user.id, {
        status: 'solved',
        attemptedOn: daysAgo(2),
      });
      // Fail 1 day ago
      await recordAttemptRow(puzzle.id, user.id, {
        status: 'failed',
        attemptedOn: daysAgo(1),
      });

      const res = await agent.get(URL);
      const entry2 = res.body.last7Days.find(
        (d: { date: string }) => d.date === new Date(daysAgo(2)).toISOString().slice(0, 10),
      );
      const entry1 = res.body.last7Days.find(
        (d: { date: string }) => d.date === new Date(daysAgo(1)).toISOString().slice(0, 10),
      );
      expect(entry2.solved).toBe(true);
      expect(entry1.solved).toBe(false);
    });
  });
});
