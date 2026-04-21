import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createGameRecord } from '../../helpers/games';

const URL = (id: string) => `/api/games/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('DELETE /api/games/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.delete(URL(game.id));
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.delete(URL(game.id));
      expect(res.status).toBe(403);
    });

    it('coach → 403', async () => {
      const admin = await createUser('admin');
      const game = await createGameRecord(admin.id);
      const { agent } = await loginAs('coach');
      const res = await agent.delete(URL(game.id));
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown game id', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('204 — successful delete', () => {
    it('admin deletes game → 204', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      const res = await agent.delete(URL(game.id));
      expect(res.status).toBe(204);
    });

    it('game row removed from DB after delete', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      await agent.delete(URL(game.id));

      const row = await prisma.game.findUnique({ where: { id: game.id } });
      expect(row).toBeNull();
    });

    it('deleted game returns 404 on subsequent GET', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      await agent.delete(URL(game.id));

      const res = await agent.get(URL(game.id));
      expect(res.status).toBe(404);
    });

    it('double delete returns 404 on second attempt', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const game = await createGameRecord(admin.id);

      await agent.delete(URL(game.id));
      const res = await agent.delete(URL(game.id));
      expect(res.status).toBe(404);
    });
  });
});
