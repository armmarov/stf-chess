import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER, PDF_BUFFER, TEXT_BUFFER } from '../../helpers/payments';
import { cleanResourceUploads, resourceFileExists, IMAGE_OVERSIZED_BUFFER } from '../../helpers/resources';

const URL = '/api/resources';

describe('POST /api/resources', () => {
  beforeEach(async () => {
    await resetDb();
    cleanResourceUploads();
  });

  afterEach(() => {
    cleanResourceUploads();
  });

  describe('401 — unauthenticated', () => {
    it('401 without cookie', async () => {
      const res = await request(app)
        .post(URL)
        .field('title', 'Test')
        .field('type', 'book');
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const { agent } = await loginAs('teacher');
      const res = await agent.post(URL).field('title', 'Test').field('type', 'book');
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const { agent } = await loginAs('student');
      const res = await agent.post(URL).field('title', 'Test').field('type', 'book');
      expect(res.status).toBe(403);
    });

    it('coach → 403', async () => {
      const { agent } = await loginAs('coach');
      const res = await agent.post(URL).field('title', 'Test').field('type', 'book');
      expect(res.status).toBe(403);
    });
  });

  describe('400 — validation', () => {
    it('missing title → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).field('type', 'book');
      expect(res.status).toBe(400);
    });

    it('missing type → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).field('title', 'Test');
      expect(res.status).toBe(400);
    });

    it('invalid type value → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.post(URL).field('title', 'Test').field('type', 'video');
      expect(res.status).toBe(400);
    });

    it('invalid url (not a URL) → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Test')
        .field('type', 'book')
        .field('url', 'not-a-url');
      expect(res.status).toBe(400);
    });

    it('invalid MIME for image field → 400', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Test')
        .field('type', 'book')
        .attach('image', TEXT_BUFFER, { filename: 'img.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
    });

    it('PDF file in image field → 400 (wrong MIME)', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Test')
        .field('type', 'book')
        .attach('image', PDF_BUFFER, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
    });

    it('image > 5 MB → 400 (image-specific limit)', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Test')
        .field('type', 'book')
        .attach('image', IMAGE_OVERSIZED_BUFFER, { filename: 'big.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
    });
  });

  describe('201 — happy path', () => {
    it('no files → 201, hasImage: false, hasFile: false', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Chess Fundamentals')
        .field('type', 'book');

      expect(res.status).toBe(201);
      expect(res.body.resource.title).toBe('Chess Fundamentals');
      expect(res.body.resource.type).toBe('book');
      expect(res.body.resource.hasImage).toBe(false);
      expect(res.body.resource.hasFile).toBe(false);
      expect(res.body.resource.fileName).toBeNull();

      const row = await prisma.resource.findUnique({ where: { id: res.body.resource.id } });
      expect(row).not.toBeNull();
    });

    it('with JPEG image → 201, hasImage: true, file on disk', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'With Image')
        .field('type', 'book')
        .attach('image', JPEG_BUFFER, { filename: 'cover.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.resource.hasImage).toBe(true);

      const row = await prisma.resource.findUnique({ where: { id: res.body.resource.id } });
      expect(row?.imagePath).not.toBeNull();
      expect(resourceFileExists(row!.imagePath!)).toBe(true);
    });

    it('with PDF file → 201, hasFile: true, fileName = original name', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Homework Sheet')
        .field('type', 'homework')
        .attach('file', PDF_BUFFER, { filename: 'homework.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.resource.hasFile).toBe(true);
      expect(res.body.resource.fileName).toBe('homework.pdf');

      const row = await prisma.resource.findUnique({ where: { id: res.body.resource.id } });
      expect(row?.filePath).not.toBeNull();
      expect(row?.fileName).toBe('homework.pdf');
      expect(resourceFileExists(row!.filePath!)).toBe(true);
    });

    it('file field accepts non-image types (e.g. text buffer as any type)', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Text Resource')
        .field('type', 'app')
        .attach('file', TEXT_BUFFER, { filename: 'readme.txt', contentType: 'text/plain' });

      expect(res.status).toBe(201);
      expect(res.body.resource.hasFile).toBe(true);
      expect(res.body.resource.fileName).toBe('readme.txt');
    });

    it('isEnabled defaults to true when not provided', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Default Enabled')
        .field('type', 'book');

      expect(res.status).toBe(201);
      expect(res.body.resource.isEnabled).toBe(true);
    });

    it('isEnabled=\'false\' → isEnabled: false', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Disabled Resource')
        .field('type', 'book')
        .field('isEnabled', 'false');

      expect(res.status).toBe(201);
      expect(res.body.resource.isEnabled).toBe(false);
    });

    it('all optional fields round-trip correctly', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Full Resource')
        .field('type', 'app')
        .field('description', 'A description')
        .field('url', 'https://chess.example.com')
        .field('isEnabled', 'true');

      expect(res.status).toBe(201);
      expect(res.body.resource.description).toBe('A description');
      expect(res.body.resource.url).toBe('https://chess.example.com');
      expect(res.body.resource.createdBy.id).toBe(admin.id);
    });

    it('PNG image accepted', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'PNG Resource')
        .field('type', 'book')
        .attach('image', PNG_BUFFER, { filename: 'cover.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.resource.hasImage).toBe(true);
    });

    it('image + file together → both hasImage: true and hasFile: true', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent
        .post(URL)
        .field('title', 'Both Files')
        .field('type', 'homework')
        .attach('image', JPEG_BUFFER, { filename: 'thumb.jpg', contentType: 'image/jpeg' })
        .attach('file', PDF_BUFFER, { filename: 'sheet.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.resource.hasImage).toBe(true);
      expect(res.body.resource.hasFile).toBe(true);
      expect(res.body.resource.fileName).toBe('sheet.pdf');
    });
  });
});
