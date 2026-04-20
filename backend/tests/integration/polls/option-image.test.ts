import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER } from '../../helpers/payments';
import {
  cleanPollUploads,
  createPollRecord,
  createPollOptionRecord,
  writePollFixture,
} from '../../helpers/polls';

const URL = (pollId: string, optionId: string) =>
  `/api/polls/${pollId}/options/${optionId}/image`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/polls/:id/options/:optionId/image', () => {
  beforeEach(async () => {
    await resetDb();
    cleanPollUploads();
  });

  afterEach(() => {
    cleanPollUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app).get(URL(UNKNOWN_ID, UNKNOWN_ID));
      expect(res.status).toBe(401);
    });
  });

  describe('404 — missing cases', () => {
    it('404 when poll not found (option belongs to different poll)', async () => {
      const admin = await createUser('admin');
      const pollA = await createPollRecord(admin.id);
      const pollB = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      // optionId from pollA, but pollId from pollB → 404
      const res = await agent.get(URL(pollB.id, pollA.options[0].id));
      expect(res.status).toBe(404);
    });

    it('404 when option has no image (imagePath null)', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(poll.id, poll.options[0].id));
      expect(res.status).toBe(404);
    });

    it('404 when imagePath set but file missing from disk', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const opt = await createPollOptionRecord(poll.id, 'Ghost', {
        imagePath: 'polls/nonexistent.jpg',
        order: 2,
      });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(poll.id, opt.id));
      expect(res.status).toBe(404);
    });

    it('404 for completely unknown optionId', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(poll.id, UNKNOWN_ID));
      expect(res.status).toBe(404);
    });
  });

  describe('200 — image streaming', () => {
    it('200 with image/jpeg Content-Type for .jpg file', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const imgPath = writePollFixture('opt.jpg', JPEG_BUFFER);
      const opt = await createPollOptionRecord(poll.id, 'With JPEG', {
        imagePath: imgPath,
        order: 2,
      });
      const { agent } = await loginAs('student');

      const res = await agent.get(URL(poll.id, opt.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    });

    it('200 with image/png Content-Type for .png file', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const imgPath = writePollFixture('opt.png', PNG_BUFFER);
      const opt = await createPollOptionRecord(poll.id, 'With PNG', {
        imagePath: imgPath,
        order: 2,
      });
      const { agent } = await loginAs('teacher');

      const res = await agent.get(URL(poll.id, opt.id));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
    });

    it('any authed role can download option image', async () => {
      const admin = await createUser('admin');
      const poll = await createPollRecord(admin.id);
      const imgPath = writePollFixture('any-role.jpg', JPEG_BUFFER);
      const opt = await createPollOptionRecord(poll.id, 'Img', { imagePath: imgPath, order: 2 });

      for (const role of ['admin', 'teacher', 'student', 'coach'] as const) {
        const { agent } = await loginAs(role);
        const res = await agent.get(URL(poll.id, opt.id));
        expect(res.status).toBe(200);
      }
    });
  });
});
