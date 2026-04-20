import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PDF_BUFFER } from '../../helpers/payments';
import {
  cleanResourceUploads,
  createResourceRecord,
  resourceFileExists,
  writeResourceFixture,
} from '../../helpers/resources';

const URL = (id: string) => `/api/resources/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('DELETE /api/resources/:id', () => {
  beforeEach(async () => {
    await resetDb();
    cleanResourceUploads();
  });

  afterEach(() => {
    cleanResourceUploads();
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
      const resource = await createResourceRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.delete(URL(resource.id));
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.delete(URL(resource.id));
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown resource', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.delete(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('204 — successful delete', () => {
    it('admin deletes resource → 204, row removed from DB', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id);

      const res = await agent.delete(URL(resource.id));

      expect(res.status).toBe(204);
      const row = await prisma.resource.findUnique({ where: { id: resource.id } });
      expect(row).toBeNull();
    });

    it('admin deletes resource with image → image file removed from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const imgPath = writeResourceFixture('del-img.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: imgPath });

      expect(resourceFileExists(imgPath)).toBe(true);

      await agent.delete(URL(resource.id));

      expect(resourceFileExists(imgPath)).toBe(false);
    });

    it('admin deletes resource with file → file removed from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const docPath = writeResourceFixture('del-doc.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: docPath,
        fileName: 'del-doc.pdf',
      });

      expect(resourceFileExists(docPath)).toBe(true);

      await agent.delete(URL(resource.id));

      expect(resourceFileExists(docPath)).toBe(false);
    });

    it('DELETE removes both image and file from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const imgPath = writeResourceFixture('both-img.jpg', JPEG_BUFFER);
      const docPath = writeResourceFixture('both-doc.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        imagePath: imgPath,
        filePath: docPath,
        fileName: 'both-doc.pdf',
      });

      const res = await agent.delete(URL(resource.id));

      expect(res.status).toBe(204);
      expect(resourceFileExists(imgPath)).toBe(false);
      expect(resourceFileExists(docPath)).toBe(false);
    });

    it('DELETE with no files succeeds without error', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id);

      const res = await agent.delete(URL(resource.id));
      expect(res.status).toBe(204);
    });
  });
});
