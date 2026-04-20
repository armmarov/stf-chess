import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER, TEXT_BUFFER, OVERSIZED_BUFFER } from '../../helpers/payments';
import { cleanPollUploads, pollFileExists, isoFromNow } from '../../helpers/polls';

const drainEvents = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

const URL = '/api/polls';

const validBase = () => ({
  title: 'Best Opening?',
  description: 'Vote for your favourite chess opening.',
  startDate: isoFromNow(-60),
  endDate: isoFromNow(60),
  options: JSON.stringify([{ label: 'e4' }, { label: 'd4' }]),
});

describe('POST /api/polls', () => {
  beforeEach(async () => {
    await resetDb();
    cleanPollUploads();
  });

  afterEach(() => {
    cleanPollUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const b = validBase();
      const res = await request(app)
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const b = validBase();
      const { agent } = await loginAs('teacher');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const b = validBase();
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);
      expect(res.status).toBe(403);
    });
  });

  describe('400 — validation', () => {
    it('missing title → 400', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);
      expect(res.status).toBe(400);
    });

    it('missing startDate → 400', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('endDate', b.endDate)
        .field('options', b.options);
      expect(res.status).toBe(400);
    });

    it('missing endDate → 400', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('options', b.options);
      expect(res.status).toBe(400);
    });

    it('endDate not after startDate → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Bad dates')
        .field('startDate', isoFromNow(60))
        .field('endDate', isoFromNow(30))
        .field('options', JSON.stringify([{ label: 'A' }, { label: 'B' }]));
      expect(res.status).toBe(400);
    });

    it('only 1 option → 400 (min 2)', async () => {
      const { agent } = await loginAs('admin');
      const b = validBase();
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', JSON.stringify([{ label: 'Only one' }]));
      expect(res.status).toBe(400);
    });

    it('11 options → 400 (max 10)', async () => {
      const { agent } = await loginAs('admin');
      const b = validBase();
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ label: `Opt ${i}` }))));
      expect(res.status).toBe(400);
    });

    it('invalid MIME for option image → 400', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options)
        .attach('option_0', TEXT_BUFFER, { filename: 'bad.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
    });

    it('oversized option image → 400', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options)
        .attach('option_0', OVERSIZED_BUFFER, { filename: 'big.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
    });

    it('missing options → 400', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate);
      expect(res.status).toBe(400);
    });
  });

  describe('201 — happy path', () => {
    it('2 options, no images → 201, hasImage: false, voteCount: 0', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('description', b.description)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);

      expect(res.status).toBe(201);
      expect(res.body.poll).toBeDefined();
      expect(res.body.poll.title).toBe(b.title);
      expect(res.body.poll.options).toHaveLength(2);
      res.body.poll.options.forEach((o: { hasImage: boolean; voteCount: number }) => {
        expect(o.hasImage).toBe(false);
        expect(o.voteCount).toBe(0);
      });
      expect(res.body.poll.totalVotes).toBe(0);

      const row = await prisma.poll.findUnique({ where: { id: res.body.poll.id } });
      expect(row).not.toBeNull();
    });

    it('option_0 image → option[0].hasImage: true, file saved on disk', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options)
        .attach('option_0', JPEG_BUFFER, { filename: 'opt0.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.poll.options[0].hasImage).toBe(true);
      expect(res.body.poll.options[1].hasImage).toBe(false);

      const optRow = await prisma.pollOption.findFirst({
        where: { pollId: res.body.poll.id, order: 0 },
      });
      expect(optRow?.imagePath).not.toBeNull();
      expect(pollFileExists(optRow!.imagePath!)).toBe(true);
    });

    it('option_0 PNG, option_1 PNG → both hasImage: true', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options)
        .attach('option_0', PNG_BUFFER, { filename: 'a.png', contentType: 'image/png' })
        .attach('option_1', PNG_BUFFER, { filename: 'b.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.poll.options[0].hasImage).toBe(true);
      expect(res.body.poll.options[1].hasImage).toBe(true);
    });

    it('response includes createdBy with id and name', async () => {
      const b = validBase();
      const { agent, user: admin } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);

      expect(res.status).toBe(201);
      expect(res.body.poll.createdBy.id).toBe(admin.id);
    });

    it('10 options (max) → 201', async () => {
      const b = validBase();
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ label: `Opt ${i}` }))));
      expect(res.status).toBe(201);
      expect(res.body.poll.options).toHaveLength(10);
    });
  });

  describe('notifications — poll created', () => {
    it('all active users (except creator) notified', async () => {
      const activeStudent = await createUser('student');
      const activeTeacher = await createUser('teacher');
      await createUser('student', { isActive: false });

      const { agent, user: admin } = await loginAs('admin');
      const b = validBase();
      await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);
      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { type: 'session_created' },
      });
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(activeStudent.id);
      expect(userIds).toContain(activeTeacher.id);
      expect(userIds).not.toContain(admin.id);
    });

    it('inactive users not notified', async () => {
      const inactive = await createUser('student', { isActive: false });
      const { agent } = await loginAs('admin');
      const b = validBase();
      await agent
        .post(URL)
        .field('title', b.title)
        .field('startDate', b.startDate)
        .field('endDate', b.endDate)
        .field('options', b.options);
      await drainEvents();

      const count = await prisma.notification.count({ where: { userId: inactive.id } });
      expect(count).toBe(0);
    });
  });
});
