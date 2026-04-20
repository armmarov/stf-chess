import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER, TEXT_BUFFER, OVERSIZED_BUFFER } from '../../helpers/payments';
import {
  cleanTournamentUploads,
  tournamentFileExists,
  WEBP_BUFFER,
} from '../../helpers/tournaments';

const drainEvents = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

const URL = '/api/tournaments';

describe('POST /api/tournaments', () => {
  beforeEach(async () => {
    await resetDb();
    cleanTournamentUploads();
  });

  afterEach(() => {
    cleanTournamentUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app)
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc');
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc');
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const { agent } = await loginAs('student');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc');
      expect(res.status).toBe(403);
    });

    it('coach → 403', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc');
      expect(res.status).toBe(403);
    });
  });

  describe('400 — validation', () => {
    it('missing name → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).field('description', 'Desc');
      expect(res.status).toBe(400);
    });

    it('missing description → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).field('name', 'Test Tournament');
      expect(res.status).toBe(400);
    });

    it('invalid registrationLink (not a URL) → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc')
        .field('registrationLink', 'not-a-url');
      expect(res.status).toBe(400);
    });

    it('invalid MIME type for image → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc')
        .attach('image', TEXT_BUFFER, { filename: 'file.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
    });

    it('PDF file (not allowed for tournaments) → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc')
        .attach('image', TEXT_BUFFER, { filename: 'r.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
    });

    it('oversized image → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc')
        .attach('image', OVERSIZED_BUFFER, { filename: 'big.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
    });
  });

  describe('201 — happy path', () => {
    it('admin creates tournament without image → 201, imagePath null', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Chess Open 2025')
        .field('description', 'Annual chess tournament');

      expect(res.status).toBe(201);
      expect(res.body.tournament).toBeDefined();
      expect(res.body.tournament.name).toBe('Chess Open 2025');
      expect(res.body.tournament.description).toBe('Annual chess tournament');
      expect(res.body.tournament.imagePath).toBeNull();
      expect(res.body.tournament.interestCount).toBe(0);

      const row = await prisma.tournament.findUnique({ where: { id: res.body.tournament.id } });
      expect(row).not.toBeNull();
    });

    it('admin creates tournament with JPEG image → 201, file saved on disk', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'JPEG Tournament')
        .field('description', 'Test')
        .attach('image', JPEG_BUFFER, { filename: 'poster.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.tournament.imagePath).not.toBeNull();
      expect(res.body.tournament.imagePath).toMatch(/^tournaments\//);
      expect(tournamentFileExists(res.body.tournament.imagePath)).toBe(true);
    });

    it('admin creates tournament with PNG image → 201, file saved on disk', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'PNG Tournament')
        .field('description', 'Test')
        .attach('image', PNG_BUFFER, { filename: 'poster.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.tournament.imagePath).toMatch(/\.png$/);
      expect(tournamentFileExists(res.body.tournament.imagePath)).toBe(true);
    });

    it('admin creates tournament with WebP image → 201', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'WebP Tournament')
        .field('description', 'Test')
        .attach('image', WEBP_BUFFER, { filename: 'poster.webp', contentType: 'image/webp' });

      expect(res.status).toBe(201);
      expect(res.body.tournament.imagePath).toMatch(/\.webp$/);
    });

    it('admin creates tournament with all optional fields', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Full Tournament')
        .field('description', 'Full description')
        .field('registrationLink', 'https://chess.example.com/register')
        .field('startDate', '2025-06-01')
        .field('endDate', '2025-06-03');

      expect(res.status).toBe(201);
      expect(res.body.tournament.registrationLink).toBe('https://chess.example.com/register');
      expect(res.body.tournament.startDate).toMatch(/2025-06-01/);
      expect(res.body.tournament.endDate).toMatch(/2025-06-03/);
    });

    it('response includes createdBy', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('name', 'Test')
        .field('description', 'Desc');

      expect(res.status).toBe(201);
      expect(res.body.tournament.createdBy).toBeDefined();
      expect(res.body.tournament.createdBy.id).toBe(admin.id);
    });
  });

  describe('notifications — tournament created', () => {
    it('active students are notified, inactive excluded', async () => {
      const activeStudent = await createUser('student');
      await createUser('student', { isActive: false });
      await createUser('teacher');

      const { agent } = await loginAs('admin');
      await agent
        .post(URL)
        .field('name', 'Notif Test')
        .field('description', 'Test');
      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { type: 'session_created' },
      });
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(activeStudent.id);
    });

    it('inactive students not notified', async () => {
      const inactive = await createUser('student', { isActive: false });

      const { agent } = await loginAs('admin');
      await agent
        .post(URL)
        .field('name', 'Notif Test 2')
        .field('description', 'Test');
      await drainEvents();

      const notifications = await prisma.notification.findMany({
        where: { userId: inactive.id, type: 'session_created' },
      });
      expect(notifications).toHaveLength(0);
    });
  });
});
