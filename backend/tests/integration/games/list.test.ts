import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createGameRecord } from '../../helpers/games';

const URL = '/api/games';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/games', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — list games', () => {
    it('returns empty array when no games', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.games).toEqual([]);
    });

    it('any role can list games', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id);

      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL);
        expect(res.status).toBe(200);
        expect(res.body.games.length).toBeGreaterThan(0);
      }
    });

    it('list response excludes pgn and notes fields', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { notes: 'some notes' });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const game = res.body.games[0];
      expect(game).not.toHaveProperty('pgn');
      expect(game).not.toHaveProperty('notes');
    });

    it('list response includes expected fields', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, {
        tournamentName: 'City Open',
        whitePlayer: 'Alice',
        blackPlayer: 'Bob',
        result: 'draw',
        whiteElo: 1800,
        blackElo: 1750,
        opening: 'Ruy Lopez',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      const game = res.body.games[0];
      expect(game).toHaveProperty('id');
      expect(game).toHaveProperty('tournamentName', 'City Open');
      expect(game).toHaveProperty('whitePlayer', 'Alice');
      expect(game).toHaveProperty('blackPlayer', 'Bob');
      expect(game).toHaveProperty('result', 'draw');
      expect(game).toHaveProperty('whiteElo', 1800);
      expect(game).toHaveProperty('blackElo', 1750);
      expect(game).toHaveProperty('opening', 'Ruy Lopez');
      expect(game).toHaveProperty('createdAt');
      expect(game.createdBy).toHaveProperty('id');
      expect(game.createdBy).toHaveProperty('name');
    });

    it('ordered by createdAt desc', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { tournamentName: 'First' });
      await createGameRecord(admin.id, { tournamentName: 'Second' });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL);

      expect(res.status).toBe(200);
      expect(res.body.games[0].tournamentName).toBe('Second');
      expect(res.body.games[1].tournamentName).toBe('First');
    });
  });

  describe('?tournamentName filter', () => {
    it('filters by tournament name (case-insensitive contains)', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { tournamentName: 'City Open 2024' });
      await createGameRecord(admin.id, { tournamentName: 'Club Championship' });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL).query({ tournamentName: 'city' });

      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(1);
      expect(res.body.games[0].tournamentName).toBe('City Open 2024');
    });

    it('returns empty when no tournament matches', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { tournamentName: 'City Open' });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL).query({ tournamentName: 'nationals' });

      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(0);
    });
  });

  describe('?player filter', () => {
    it('filters by whitePlayer (case-insensitive contains)', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { whitePlayer: 'Magnus Carlsen', blackPlayer: 'Hikaru Nakamura' });
      await createGameRecord(admin.id, { whitePlayer: 'Fabiano Caruana', blackPlayer: 'Wesley So' });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL).query({ player: 'magnus' });

      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(1);
      expect(res.body.games[0].whitePlayer).toBe('Magnus Carlsen');
    });

    it('filters by blackPlayer (case-insensitive contains)', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { whitePlayer: 'Alice', blackPlayer: 'Hikaru Nakamura' });
      await createGameRecord(admin.id, { whitePlayer: 'Carol', blackPlayer: 'Dave' });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL).query({ player: 'hikaru' });

      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(1);
      expect(res.body.games[0].blackPlayer).toBe('Hikaru Nakamura');
    });

    it('matches player in either color', async () => {
      const admin = await createUser('admin');
      await createGameRecord(admin.id, { whitePlayer: 'Alice', blackPlayer: 'Bob' });
      await createGameRecord(admin.id, { whitePlayer: 'Bob', blackPlayer: 'Carol' });
      await createGameRecord(admin.id, { whitePlayer: 'Dave', blackPlayer: 'Eve' });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL).query({ player: 'bob' });

      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(2);
    });
  });
});

describe('GET /api/games/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(`/api/games/${UNKNOWN_ID}`);
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown game id', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(`/api/games/${UNKNOWN_ID}`);
      expect(res.status).toBe(404);
    });
  });

  describe('200 — game detail', () => {
    it('any role can get game detail', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id);

      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(`/api/games/${game.id}`);
        expect(res.status).toBe(200);
      }
    });

    it('detail response includes pgn and notes', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id, { notes: 'Brilliant sacrifice on move 18' });
      const { agent } = await loginAs('student');

      const res = await agent.get(`/api/games/${game.id}`);

      expect(res.status).toBe(200);
      expect(res.body.game).toHaveProperty('pgn');
      expect(res.body.game).toHaveProperty('notes', 'Brilliant sacrifice on move 18');
      expect(res.body.game).toHaveProperty('updatedAt');
    });

    it('detail response shape matches expected fields', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id, {
        tournamentName: 'Masters',
        whitePlayer: 'X',
        blackPlayer: 'Y',
        result: 'black_win',
        whiteElo: 2000,
        blackElo: 2100,
        opening: 'Sicilian',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(`/api/games/${game.id}`);

      expect(res.status).toBe(200);
      const g = res.body.game;
      expect(g.id).toBe(game.id);
      expect(g.tournamentName).toBe('Masters');
      expect(g.result).toBe('black_win');
      expect(g.whiteElo).toBe(2000);
      expect(g.opening).toBe('Sicilian');
      expect(g.createdBy).toHaveProperty('id');
    });
  });
});
