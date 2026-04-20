import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER, PDF_BUFFER, TEXT_BUFFER } from '../../helpers/payments';
import {
  cleanResourceUploads,
  createResourceRecord,
  resourceFileExists,
  writeResourceFixture,
} from '../../helpers/resources';

const URL = (id: string) => `/api/resources/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/resources/:id', () => {
  beforeEach(async () => {
    await resetDb();
    cleanResourceUploads();
  });

  afterEach(() => {
    cleanResourceUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).patch(URL(UNKNOWN_ID)).field('title', 'X');
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(resource.id)).field('title', 'X');
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.patch(URL(resource.id)).field('title', 'X');
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown resource', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(UNKNOWN_ID)).field('title', 'X');
      expect(res.status).toBe(404);
    });
  });

  describe('200 — partial updates', () => {
    it('admin updates title only → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id, { title: 'Old Title' });

      const res = await agent.patch(URL(resource.id)).field('title', 'New Title');

      expect(res.status).toBe(200);
      expect(res.body.resource.title).toBe('New Title');
    });

    it('admin sets isEnabled: false → 200, resource now hidden from non-admin', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id, { isEnabled: true });

      const res = await agent.patch(URL(resource.id)).field('isEnabled', 'false');

      expect(res.status).toBe(200);
      expect(res.body.resource.isEnabled).toBe(false);
    });

    it('admin clears url with empty string → null', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id, { url: 'https://old.example.com' });

      const res = await agent.patch(URL(resource.id)).field('url', '');

      expect(res.status).toBe(200);
      expect(res.body.resource.url).toBeNull();
    });

    it('admin clears description with empty string → null', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const resource = await createResourceRecord(admin.id, { description: 'Old desc' });

      const res = await agent.patch(URL(resource.id)).field('description', '');

      expect(res.status).toBe(200);
      expect(res.body.resource.description).toBeNull();
    });
  });

  describe('200 — image replace and remove', () => {
    it('new image replaces old — old file deleted, new on disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const oldPath = writeResourceFixture('old-img.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: oldPath });

      expect(resourceFileExists(oldPath)).toBe(true);

      const res = await agent
        .patch(URL(resource.id))
        .attach('image', PNG_BUFFER, { filename: 'new.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.resource.hasImage).toBe(true);
      expect(resourceFileExists(oldPath)).toBe(false);
    });

    it('removeImage=true → hasImage: false, file deleted from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const imgPath = writeResourceFixture('to-remove.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: imgPath });

      expect(resourceFileExists(imgPath)).toBe(true);

      const res = await agent.patch(URL(resource.id)).field('removeImage', 'true');

      expect(res.status).toBe(200);
      expect(res.body.resource.hasImage).toBe(false);
      expect(resourceFileExists(imgPath)).toBe(false);
    });
  });

  describe('200 — file replace and remove', () => {
    it('new file replaces old — old deleted, fileName updated', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const oldFilePath = writeResourceFixture('old.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: oldFilePath,
        fileName: 'old.pdf',
        fileMime: 'application/pdf',
      });

      expect(resourceFileExists(oldFilePath)).toBe(true);

      const res = await agent
        .patch(URL(resource.id))
        .attach('file', TEXT_BUFFER, { filename: 'new-doc.txt', contentType: 'text/plain' });

      expect(res.status).toBe(200);
      expect(res.body.resource.hasFile).toBe(true);
      expect(res.body.resource.fileName).toBe('new-doc.txt');
      expect(resourceFileExists(oldFilePath)).toBe(false);
    });

    it('removeFile=true → hasFile: false, fileName null, file deleted', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const filePath = writeResourceFixture('doc.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath,
        fileName: 'doc.pdf',
        fileMime: 'application/pdf',
      });

      expect(resourceFileExists(filePath)).toBe(true);

      const res = await agent.patch(URL(resource.id)).field('removeFile', 'true');

      expect(res.status).toBe(200);
      expect(res.body.resource.hasFile).toBe(false);
      expect(res.body.resource.fileName).toBeNull();
      expect(resourceFileExists(filePath)).toBe(false);
    });

    it('removeFile and removeImage simultaneously → both cleared', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const imgPath = writeResourceFixture('img2.jpg', JPEG_BUFFER);
      const docPath = writeResourceFixture('doc2.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        imagePath: imgPath,
        filePath: docPath,
        fileName: 'doc2.pdf',
      });

      const res = await agent
        .patch(URL(resource.id))
        .field('removeImage', 'true')
        .field('removeFile', 'true');

      expect(res.status).toBe(200);
      expect(res.body.resource.hasImage).toBe(false);
      expect(res.body.resource.hasFile).toBe(false);
      expect(resourceFileExists(imgPath)).toBe(false);
      expect(resourceFileExists(docPath)).toBe(false);
    });
  });
});
