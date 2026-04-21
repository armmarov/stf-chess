import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createPuzzle } from '../../helpers/puzzles';

const URL = (id: string) => `/api/puzzles/${id}/check-move`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

// Solution: 'e7e5 g1f3 b8c6' (3 plies, indices 0,1,2)
const SOLUTION = 'e7e5 g1f3 b8c6';

describe('POST /api/puzzles/:id/check-move', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app)
        .post(URL(UNKNOWN_ID))
        .send({ ply: 0, uci: 'e7e5' });
      expect(res.status).toBe(401);
    });
  });

  describe('404 — puzzle not found', () => {
    it('404 for unknown puzzle id', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(UNKNOWN_ID)).send({ ply: 0, uci: 'e7e5' });
      expect(res.status).toBe(404);
    });
  });

  describe('400 — validation', () => {
    it('missing ply → 400', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(puzzle.id)).send({ uci: 'e7e5' });
      expect(res.status).toBe(400);
    });

    it('missing uci → 400', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(puzzle.id)).send({ ply: 0 });
      expect(res.status).toBe(400);
    });

    it('ply beyond solution length → 400', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION }); // 3 moves (indices 0,1,2)
      const { agent } = await loginAs('student');
      const res = await agent.post(URL(puzzle.id)).send({ ply: 3, uci: 'e2e4' });
      expect(res.status).toBe(400);
    });
  });

  describe('correct move — not last ply', () => {
    it('correct move at ply 0 → { correct: true, replyUci }', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 0, uci: 'e7e5' });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.replyUci).toBe('g1f3');
      expect(res.body).not.toHaveProperty('solved');
      expect(res.body).not.toHaveProperty('expected');
    });

    it('correct move at ply 1 → { correct: true, replyUci }', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 1, uci: 'g1f3' });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.replyUci).toBe('b8c6');
    });
  });

  describe('correct move — last ply (solved)', () => {
    it('correct move at last ply → { correct: true, solved: true }', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 2, uci: 'b8c6' });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.solved).toBe(true);
      expect(res.body).not.toHaveProperty('replyUci');
      expect(res.body).not.toHaveProperty('expected');
    });

    it('single-ply puzzle solved on first move', async () => {
      const puzzle = await createPuzzle({ solutionUci: 'e2e4' });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 0, uci: 'e2e4' });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.solved).toBe(true);
    });
  });

  describe('wrong move', () => {
    it('wrong move → { correct: false, expected }', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 0, uci: 'd7d5' });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(false);
      expect(res.body.expected).toBe('e7e5');
      expect(res.body).not.toHaveProperty('replyUci');
      expect(res.body).not.toHaveProperty('solved');
    });

    it('wrong move at a later ply → correct: false with expected', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 2, uci: 'g8f6' });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(false);
      expect(res.body.expected).toBe('b8c6');
    });

    it('solutionUci never leaks in check-move response', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      const { agent } = await loginAs('student');

      const res = await agent.post(URL(puzzle.id)).send({ ply: 0, uci: 'd7d5' });

      expect(res.body).not.toHaveProperty('solutionUci');
      expect(res.body).not.toHaveProperty('solution_uci');
    });

    it('any authed role can call check-move', async () => {
      const puzzle = await createPuzzle({ solutionUci: SOLUTION });
      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.post(URL(puzzle.id)).send({ ply: 0, uci: 'e7e5' });
        expect(res.status).toBe(200);
      }
    });
  });
});
