import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createResourceRecord } from '../../helpers/resources';

const URL = '/api/resources';

describe('GET /api/resources', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('200 — any authed role', () => {
    it('admin gets 200 with resources array', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createResourceRecord(admin.id);
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.resources)).toBe(true);
    });

    it('teacher gets 200', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('student gets 200', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
    });

    it('empty list when no resources exist', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(0);
    });
  });

  describe('visibility — isEnabled filter', () => {
    it('admin sees disabled resources', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createResourceRecord(admin.id, { isEnabled: false });
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(1);
      expect(res.body.resources[0].isEnabled).toBe(false);
    });

    it('teacher does not see disabled resources', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { isEnabled: false });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(0);
    });

    it('student does not see disabled resources', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { isEnabled: false });
      const { agent } = await loginAs('student');
      const res = await agent.get(URL);
      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(0);
    });

    it('non-admin sees enabled resources alongside disabled ones being hidden', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { title: 'Visible', isEnabled: true });
      await createResourceRecord(admin.id, { title: 'Hidden', isEnabled: false });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL);
      expect(res.body.resources).toHaveLength(1);
      expect(res.body.resources[0].title).toBe('Visible');
    });
  });

  describe('?type filter', () => {
    it('?type=book returns only books', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { type: 'book', title: 'Chess Book' });
      await createResourceRecord(admin.id, { type: 'homework', title: 'HW Sheet' });
      await createResourceRecord(admin.id, { type: 'app', title: 'Chess App' });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(`${URL}?type=book`);
      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(1);
      expect(res.body.resources[0].type).toBe('book');
    });

    it('?type=homework returns only homework', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { type: 'book' });
      await createResourceRecord(admin.id, { type: 'homework' });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(`${URL}?type=homework`);
      expect(res.status).toBe(200);
      expect(res.body.resources).toHaveLength(1);
      expect(res.body.resources[0].type).toBe('homework');
    });

    it('?type=app returns only apps', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { type: 'app' });
      const { agent } = await loginAs('student');

      const res = await agent.get(`${URL}?type=app`);
      expect(res.status).toBe(200);
      expect(res.body.resources.every((r: { type: string }) => r.type === 'app')).toBe(true);
    });

    it('no type filter returns all types', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id, { type: 'book' });
      await createResourceRecord(admin.id, { type: 'homework' });
      await createResourceRecord(admin.id, { type: 'app' });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);
      expect(res.body.resources).toHaveLength(3);
    });

    it('admin ?type filter still includes disabled', async () => {
      const { agent, user: admin } = await loginAs('admin');
      await createResourceRecord(admin.id, { type: 'book', isEnabled: false });
      const res = await agent.get(`${URL}?type=book`);
      expect(res.body.resources).toHaveLength(1);
    });
  });

  describe('response shape', () => {
    it('items do not expose imagePath or filePath', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);
      const item = res.body.resources[0];
      expect(item.imagePath).toBeUndefined();
      expect(item.filePath).toBeUndefined();
      expect(item.fileMime).toBeUndefined();
    });

    it('items have hasImage and hasFile fields', async () => {
      const admin = await createUser('admin');
      await createResourceRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL);
      const item = res.body.resources[0];
      expect(item).toHaveProperty('hasImage');
      expect(item).toHaveProperty('hasFile');
    });
  });
});
