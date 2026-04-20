import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER } from '../../helpers/payments';
import {
  cleanResourceUploads,
  createResourceRecord,
  writeResourceFixture,
} from '../../helpers/resources';

const URL = (id: string) => `/api/resources/${id}/image`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/resources/:id/image', () => {
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

    it('404 when resource has no image (imagePath null)', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, { imagePath: null });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });

    it('404 when imagePath set but file missing from disk', async () => {
      const admin = await createUser('admin');
      const resource = await createResourceRecord(admin.id, {
        imagePath: 'resources/nonexistent.jpg',
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });

    it('404 for non-admin on disabled resource image', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('disabled-img.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        imagePath: imgPath,
        isEnabled: false,
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — image streaming', () => {
    it('200 with image/jpeg Content-Type for .jpg', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('res.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: imgPath });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    });

    it('200 with image/png Content-Type for .png', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('res.png', PNG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: imgPath });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
    });

    it('Content-Disposition is inline', async () => {
      const admin = await createUser('admin');
      const imgPath = writeResourceFixture('inline.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, { imagePath: imgPath });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(resource.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/inline/);
    });

    it('admin can access image of disabled resource', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const imgPath = writeResourceFixture('admin-only.jpg', JPEG_BUFFER);
      const resource = await createResourceRecord(admin.id, {
        imagePath: imgPath,
        isEnabled: false,
      });

      const res = await agent.get(URL(resource.id));
      expect(res.status).toBe(200);
    });
  });
});
