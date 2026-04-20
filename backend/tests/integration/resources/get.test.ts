import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { createResourceRecord, writeResourceFixture } from '../../helpers/resources';
import { JPEG_BUFFER, PDF_BUFFER } from '../../helpers/payments';

const URL = (id: string) => `/api/resources/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/resources/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown id', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });

    it('404 for non-admin on disabled resource', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, { isEnabled: false });
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });

    it('404 for student on disabled resource', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, { isEnabled: false });
      const { agent } = await loginAs('student');
      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — visibility', () => {
    it('admin can access disabled resource', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id, { isEnabled: false });
      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(200);
      expect(res.body.resource.isEnabled).toBe(false);
    });

    it('any authed role can access enabled resource', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, { isEnabled: true });
      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL(resource.id));
        expect(res.status).toBe(200);
      }
    });
  });

  describe('200 — response shape', () => {
    it('returns all required fields', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id, {
        title: 'Chess Fundamentals',
        type: 'book',
        description: 'A great book',
        url: 'https://example.com',
      });

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      const r = res.body.resource;
      expect(r.id).toBe(resource.id);
      expect(r.title).toBe('Chess Fundamentals');
      expect(r.type).toBe('book');
      expect(r.description).toBe('A great book');
      expect(r.url).toBe('https://example.com');
      expect(r).toHaveProperty('isEnabled');
      expect(r).toHaveProperty('hasImage');
      expect(r).toHaveProperty('hasFile');
      expect(r).toHaveProperty('fileName');
      expect(r).toHaveProperty('createdBy');
      expect(r).toHaveProperty('createdAt');
      expect(r).toHaveProperty('updatedAt');
    });

    it('imagePath and filePath not exposed', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('img.jpg', JPEG_BUFFER);
      const filePath = writeResourceFixture('doc.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        imagePath: imgPath,
        filePath: filePath,
        fileName: 'doc.pdf',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      expect(res.body.resource.imagePath).toBeUndefined();
      expect(res.body.resource.filePath).toBeUndefined();
      expect(res.body.resource.fileMime).toBeUndefined();
    });

    it('hasImage: true when imagePath set', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('r-img.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: imgPath });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.body.resource.hasImage).toBe(true);
    });

    it('hasFile: true and fileName set when file uploaded', async () => {
      const admin = await createUser('admin');
      const fPath = writeResourceFixture('r-doc.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: fPath,
        fileName: 'homework.pdf',
        fileMime: 'application/pdf',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.body.resource.hasFile).toBe(true);
      expect(res.body.resource.fileName).toBe('homework.pdf');
    });

    it('hasImage: false and hasFile: false when no files', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id);
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.body.resource.hasImage).toBe(false);
      expect(res.body.resource.hasFile).toBe(false);
      expect(res.body.resource.fileName).toBeNull();
    });
  });
});
