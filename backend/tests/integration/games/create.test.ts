import request from 'supertest';
import { app } from '../../helpers/app';
import { loginAs, createUser } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { VALID_PGN } from '../../helpers/games';

const URL = '/api/games';

const VALID_BODY = {
  tournamentName: 'Test Open 2024',
  whitePlayer: 'Alice',
  blackPlayer: 'Bob',
  result: 'white_win',
  pgn: VALID_PGN,
};

describe('POST /api/games', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).post(URL).send(VALID_BODY);
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).send(VALID_BODY);
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).send(VALID_BODY);
      expect(res.status).toBe(403);
    });

    it('coach → 403', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.post(URL).send(VALID_BODY);
      expect(res.status).toBe(403);
    });
  });

  describe('400 — validation failures', () => {
    it('missing tournamentName → 400', async () => {
      const { agent } = await loginAs('admin');
      const { tournamentName: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('missing whitePlayer → 400', async () => {
      const { agent } = await loginAs('admin');
      const { whitePlayer: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('missing blackPlayer → 400', async () => {
      const { agent } = await loginAs('admin');
      const { blackPlayer: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('missing result → 400', async () => {
      const { agent } = await loginAs('admin');
      const { result: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('invalid result value → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({ ...VALID_BODY, result: '1-0' });
      expect(res.status).toBe(400);
    });

    it('missing pgn → 400', async () => {
      const { agent } = await loginAs('admin');
      const { pgn: _, ...rest } = VALID_BODY;
      const res = await agent.post(URL).send(rest);
      expect(res.status).toBe(400);
    });

    it('invalid date format → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({ ...VALID_BODY, eventDate: '20-01-2024' });
      expect(res.status).toBe(400);
    });

    it('Elo out of range → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({ ...VALID_BODY, whiteElo: 5000 });
      expect(res.status).toBe(400);
    });
  });

  describe('400 — invalid PGN', () => {
    it('malformed PGN string → 400 with Invalid PGN message', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({ ...VALID_BODY, pgn: 'not pgn at all !!!' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid PGN/);
    });

    it('PGN with 0 moves → 400', async () => {
      const { agent } = await loginAs('admin');
      const emptyPgn = '[Event "Test"]\n[Result "*"]\n\n*';
      const res = await agent.post(URL).send({ ...VALID_BODY, pgn: emptyPgn });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid PGN: PGN contains no moves/);
    });
  });

  describe('201 — successful creation', () => {
    it('admin creates game → 201 with game in response', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.game).toHaveProperty('id');
      expect(res.body.game.tournamentName).toBe('Test Open 2024');
      expect(res.body.game.whitePlayer).toBe('Alice');
      expect(res.body.game.blackPlayer).toBe('Bob');
      expect(res.body.game.result).toBe('white_win');
    });

    it('response includes pgn and notes', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({ ...VALID_BODY, notes: 'Nice game' });

      expect(res.status).toBe(201);
      expect(res.body.game).toHaveProperty('pgn');
      expect(res.body.game.notes).toBe('Nice game');
    });

    it('response includes createdBy with id and name', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const res = await agent.post(URL).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.game.createdBy.id).toBe(admin.id);
      expect(res.body.game.createdBy.name).toBe(admin.name);
    });

    it('game is persisted in DB after create', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(VALID_BODY);

      expect(res.status).toBe(201);
      const row = await prisma.game.findUnique({ where: { id: res.body.game.id } });
      expect(row).not.toBeNull();
      expect(row!.tournamentName).toBe('Test Open 2024');
    });

    it('optional fields null when not provided', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send(VALID_BODY);

      expect(res.status).toBe(201);
      const row = await prisma.game.findUnique({ where: { id: res.body.game.id } });
      expect(row!.whiteElo).toBeNull();
      expect(row!.blackElo).toBeNull();
      expect(row!.opening).toBeNull();
      expect(row!.notes).toBeNull();
    });

    it('full payload stored correctly', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).send({
        ...VALID_BODY,
        eventDate: '2024-06-01',
        whiteElo: 1900,
        blackElo: 1850,
        opening: 'King\'s Indian',
        notes: 'Annotated',
        result: 'draw',
      });

      expect(res.status).toBe(201);
      const row = await prisma.game.findUnique({ where: { id: res.body.game.id } });
      expect(row!.whiteElo).toBe(1900);
      expect(row!.blackElo).toBe(1850);
      expect(row!.opening).toBe('King\'s Indian');
      expect(row!.result).toBe('draw');
    });
  });
});
