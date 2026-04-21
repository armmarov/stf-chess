import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createGameRecord, VALID_PGN } from '../../helpers/games';

const URL = (id: string) => `/api/games/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/games/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).send({ tournamentName: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(game.id)).send({ tournamentName: 'X' });
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.patch(URL(game.id)).send({ tournamentName: 'X' });
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown game id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(UNKNOWN_ID)).send({ tournamentName: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('400 — validation', () => {
    it('invalid result → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const res = await agent.patch(URL(game.id)).send({ result: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('Elo out of range → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const res = await agent.patch(URL(game.id)).send({ blackElo: -5 });
      expect(res.status).toBe(400);
    });

    it('invalid date format → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const res = await agent.patch(URL(game.id)).send({ eventDate: '2024/01/01' });
      expect(res.status).toBe(400);
    });
  });

  describe('400 — PGN re-validation on update', () => {
    it('invalid PGN on update → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const res = await agent.patch(URL(game.id)).send({ pgn: 'garbage pgn' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid PGN/);
    });

    it('PGN with 0 moves on update → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const emptyPgn = '[Event "Test"]\n[Result "*"]\n\n*';
      const res = await agent.patch(URL(game.id)).send({ pgn: emptyPgn });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid PGN: PGN contains no moves/);
    });

    it('valid PGN on update → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const res = await agent.patch(URL(game.id)).send({ pgn: VALID_PGN });
      expect(res.status).toBe(200);
    });

    it('update without pgn field does not re-validate PGN', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);
      const res = await agent.patch(URL(game.id)).send({ tournamentName: 'Updated Name' });
      expect(res.status).toBe(200);
    });
  });

  describe('200 — partial updates', () => {
    it('updates tournamentName only → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id, { tournamentName: 'Old' });

      const res = await agent.patch(URL(game.id)).send({ tournamentName: 'New' });

      expect(res.status).toBe(200);
      expect(res.body.game.tournamentName).toBe('New');
    });

    it('updates result → 200, persisted in DB', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id, { result: 'white_win' });

      const res = await agent.patch(URL(game.id)).send({ result: 'draw' });

      expect(res.status).toBe(200);
      expect(res.body.game.result).toBe('draw');

      const row = await prisma.game.findUnique({ where: { id: game.id } });
      expect(row!.result).toBe('draw');
    });

    it('updates opening and notes → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      const res = await agent
        .patch(URL(game.id))
        .send({ opening: 'French Defense', notes: 'Great game!' });

      expect(res.status).toBe(200);
      expect(res.body.game.opening).toBe('French Defense');
      expect(res.body.game.notes).toBe('Great game!');
    });

    it('updates whiteElo and blackElo → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      const res = await agent
        .patch(URL(game.id))
        .send({ whiteElo: 2100, blackElo: 1950 });

      expect(res.status).toBe(200);
      const row = await prisma.game.findUnique({ where: { id: game.id } });
      expect(row!.whiteElo).toBe(2100);
      expect(row!.blackElo).toBe(1950);
    });

    it('empty object update → 200, nothing changed', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id, { tournamentName: 'Unchanged' });

      const res = await agent.patch(URL(game.id)).send({});

      expect(res.status).toBe(200);
      expect(res.body.game.tournamentName).toBe('Unchanged');
    });

    it('response includes pgn and updatedAt', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      const res = await agent.patch(URL(game.id)).send({ opening: 'Caro-Kann' });

      expect(res.status).toBe(200);
      expect(res.body.game).toHaveProperty('pgn');
      expect(res.body.game).toHaveProperty('updatedAt');
    });
  });
});
