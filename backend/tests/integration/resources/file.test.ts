import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PDF_BUFFER, TEXT_BUFFER } from '../../helpers/payments';
import {
  cleanResourceUploads,
  createResourceRecord,
  writeResourceFixture,
} from '../../helpers/resources';

const URL = (id: string) => `/api/resources/${id}/file`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/resources/:id/file', () => {
  beforeEach(async () => {
    await resetDb();
    cleanResourceUploads();
  });

  afterEach(() => {
    cleanResourceUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — missing cases', () => {
    it('404 for unknown resource id', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.get(URL(UNKNOWN_ID));
      expect(res.status).toBe(404);
    });

    it('404 when resource has no file (filePath null)', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, { filePath: null });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });

    it('404 when filePath set but file missing from disk', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, {
        filePath: 'resources/ghost.pdf',
        fileName: 'ghost.pdf',
        fileMime: 'application/pdf',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });

    it('404 for non-admin on disabled resource file', async () => {
      const admin = await createUser('admin');
      const docPath = writeResourceFixture('hidden.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: docPath,
        fileName: 'hidden.pdf',
        fileMime: 'application/pdf',
        isEnabled: false,
      });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — file download', () => {
    it('200 with Content-Disposition: attachment and original filename', async () => {
      const admin = await createUser('admin');
      const docPath = writeResourceFixture('homework.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: docPath,
        fileName: 'homework.pdf',
        fileMime: 'application/pdf',
      });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.headers['content-disposition']).toMatch(/homework\.pdf/);
    });

    it('Content-Disposition uses fileName stored in DB', async () => {
      const admin = await createUser('admin');
      const docPath = writeResourceFixture('stored.txt', TEXT_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        title: 'My Textbook',
        filePath: docPath,
        fileName: 'chess-fundamentals.txt',
        fileMime: 'text/plain',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('chess-fundamentals.txt');
    });

    it('admin can download file of disabled resource', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const docPath = writeResourceFixture('admin-only.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: docPath,
        fileName: 'admin-only.pdf',
        fileMime: 'application/pdf',
        isEnabled: false,
      });

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(200);
    });

    it('any authed role can download file of enabled resource', async () => {
      const admin = await createUser('admin');
      const docPath = writeResourceFixture('shared.pdf', PDF_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        filePath: docPath,
        fileName: 'shared.pdf',
        fileMime: 'application/pdf',
        isEnabled: true,
      });

      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL(resource.id));
        expect(res.status).toBe(200);
      }
    });

    it('image file in image field, not confused with file download', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('thumb.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        imagePath: imgPath,
        filePath: null,
      });
      const { agent } = await loginAs('teacher');

      // file download endpoint with no file → 404
      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });
  });
});
