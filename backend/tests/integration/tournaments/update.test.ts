import request from 'supertest';
import { app } from '../../helpers/app';
import { createUser, loginAs } from '../../helpers/auth';
import { resetDb } from '../../helpers/db';
import { JPEG_BUFFER, PNG_BUFFER, PDF_BUFFER, TEXT_BUFFER } from '../../helpers/payments';
import {
  cleanTournamentUploads,
  createTournamentRecord,
  tournamentFileExists,
  writeTournamentFixture,
} from '../../helpers/tournaments';

const URL = (id: string) => `/api/tournaments/${id}`;
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('PATCH /api/tournaments/:id', () => {
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
        .patch(URL(UNKNOWN_ID))
        .field('name', 'Updated');
      expect(res.status).toBe(401);
    });
  });

  describe('403 — non-admin', () => {
    it('teacher → 403', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('teacher');
      const res = await agent.patch(URL(tournament.id)).field('name', 'Updated');
      expect(res.status).toBe(403);
    });

    it('student → 403', async () => {
      const admin = await createUser('admin');
      const tournament = await createTournamentRecord(admin.id);
      const { agent } = await loginAs('student');
      const res = await agent.patch(URL(tournament.id)).field('name', 'Updated');
      expect(res.status).toBe(403);
    });
  });

  describe('404 — not found', () => {
    it('404 for unknown tournament', async () => {
      const { agent } = await loginAs('admin');
      const res = await agent.patch(URL(UNKNOWN_ID)).field('name', 'Updated');
      expect(res.status).toBe(404);
    });
  });

  describe('200 — partial update', () => {
    it('admin updates name only → 200, other fields unchanged', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, {
        name: 'Original Name',
        description: 'Original Desc',
      });

      const res = await agent.patch(URL(tournament.id)).field('name', 'Updated Name');

      expect(res.status).toBe(200);
      expect(res.body.tournament.name).toBe('Updated Name');
      expect(res.body.tournament.description).toBe('Original Desc');
    });

    it('admin updates description → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, { description: 'Old Desc' });

      const res = await agent
        .patch(URL(tournament.id))
        .field('description', 'New Desc');

      expect(res.status).toBe(200);
      expect(res.body.tournament.description).toBe('New Desc');
    });

    it('admin sets registrationLink → 200', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent
        .patch(URL(tournament.id))
        .field('registrationLink', 'https://new-link.example.com');

      expect(res.status).toBe(200);
      expect(res.body.tournament.registrationLink).toBe('https://new-link.example.com');
    });

    it('admin clears registrationLink with empty string → null', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, {
        registrationLink: 'https://existing.example.com',
      });

      const res = await agent.patch(URL(tournament.id)).field('registrationLink', '');

      expect(res.status).toBe(200);
      expect(res.body.tournament.registrationLink).toBeNull();
    });

    it('response includes interestCount', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent.patch(URL(tournament.id)).field('name', 'Updated');
      expect(res.status).toBe(200);
      expect(typeof res.body.tournament.interestCount).toBe('number');
    });
  });

  describe('200 — image replacement', () => {
    it('admin uploads new image → old file deleted, new file accessible', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const oldImagePath = writeTournamentFixture('old-image.jpg', JPEG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath: oldImagePath });

      expect(tournamentFileExists(oldImagePath)).toBe(true);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('image', PNG_BUFFER, { filename: 'new.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.tournament.imagePath).not.toBe(oldImagePath);
      expect(res.body.tournament.imagePath).toMatch(/\.png$/);
      expect(tournamentFileExists(oldImagePath)).toBe(false);
      expect(tournamentFileExists(res.body.tournament.imagePath)).toBe(true);
    });

    it('admin uses removeImage=true → imagePath null, old file deleted', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const oldImagePath = writeTournamentFixture('to-remove.jpg', JPEG_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { imagePath: oldImagePath });

      expect(tournamentFileExists(oldImagePath)).toBe(true);

      const res = await agent
        .patch(URL(tournament.id))
        .field('removeImage', 'true');

      expect(res.status).toBe(200);
      expect(res.body.tournament.imagePath).toBeNull();
      expect(tournamentFileExists(oldImagePath)).toBe(false);
    });

    it('admin sets place → 200, place returned', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent.patch(URL(tournament.id)).field('place', 'Sports Complex');

      expect(res.status).toBe(200);
      expect(res.body.tournament.place).toBe('Sports Complex');
    });

    it('admin clears place with empty string → null', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, { place: 'Old Venue' });

      const res = await agent.patch(URL(tournament.id)).field('place', '');

      expect(res.status).toBe(200);
      expect(res.body.tournament.place).toBeNull();
    });

    it('admin patches with no image field when no existing image → no error', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, { imagePath: null });

      const res = await agent
        .patch(URL(tournament.id))
        .field('name', 'Still no image');

      expect(res.status).toBe(200);
      expect(res.body.tournament.imagePath).toBeNull();
    });
  });

  describe('200 — resultUrl', () => {
    it('admin sets resultUrl → 200, value stored', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent
        .patch(URL(tournament.id))
        .field('resultUrl', 'https://results.example.com');

      expect(res.status).toBe(200);
      expect(res.body.tournament.resultUrl).toBe('https://results.example.com');
    });

    it('admin clears resultUrl with empty string → null', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id, {
        resultUrl: 'https://old-results.example.com',
      });

      const res = await agent.patch(URL(tournament.id)).field('resultUrl', '');

      expect(res.status).toBe(200);
      expect(res.body.tournament.resultUrl).toBeNull();
    });

    it('invalid resultUrl → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent.patch(URL(tournament.id)).field('resultUrl', 'not-a-url');
      expect(res.status).toBe(400);
    });
  });

  describe('200 — BSKK letter upload and remove', () => {
    it('new bskkLetter PDF → hasBskkLetter: true', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('bskkLetter', PDF_BUFFER, { filename: 'bskk.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body.tournament.hasBskkLetter).toBe(true);
    });

    it('new bskkLetter replaces old — old file deleted from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const oldPath = writeTournamentFixture('old-bskk.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { bskkLetterPath: oldPath });

      expect(tournamentFileExists(oldPath)).toBe(true);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('bskkLetter', PDF_BUFFER, { filename: 'new-bskk.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(tournamentFileExists(oldPath)).toBe(false);
    });

    it('removeBskkLetter=true → hasBskkLetter: false, file deleted from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const bskkPath = writeTournamentFixture('to-remove-bskk.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { bskkLetterPath: bskkPath });

      expect(tournamentFileExists(bskkPath)).toBe(true);

      const res = await agent.patch(URL(tournament.id)).field('removeBskkLetter', 'true');

      expect(res.status).toBe(200);
      expect(res.body.tournament.hasBskkLetter).toBe(false);
      expect(tournamentFileExists(bskkPath)).toBe(false);
    });

    it('non-PDF bskkLetter → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('bskkLetter', TEXT_BUFFER, { filename: 'letter.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
    });
  });

  describe('200 — KPM letter upload and remove', () => {
    it('new kpmLetter PDF → hasKpmLetter: true', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('kpmLetter', PDF_BUFFER, { filename: 'kpm.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body.tournament.hasKpmLetter).toBe(true);
    });

    it('new kpmLetter replaces old — old file deleted from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const oldPath = writeTournamentFixture('old-kpm.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { kpmLetterPath: oldPath });

      expect(tournamentFileExists(oldPath)).toBe(true);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('kpmLetter', PDF_BUFFER, { filename: 'new-kpm.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(tournamentFileExists(oldPath)).toBe(false);
    });

    it('removeKpmLetter=true → hasKpmLetter: false, file deleted from disk', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const kpmPath = writeTournamentFixture('to-remove-kpm.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, { kpmLetterPath: kpmPath });

      expect(tournamentFileExists(kpmPath)).toBe(true);

      const res = await agent.patch(URL(tournament.id)).field('removeKpmLetter', 'true');

      expect(res.status).toBe(200);
      expect(res.body.tournament.hasKpmLetter).toBe(false);
      expect(tournamentFileExists(kpmPath)).toBe(false);
    });

    it('non-PDF kpmLetter → 400', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const tournament = await createTournamentRecord(admin.id);

      const res = await agent
        .patch(URL(tournament.id))
        .attach('kpmLetter', TEXT_BUFFER, { filename: 'letter.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
    });
  });

  describe('200 — remove all files simultaneously', () => {
    it('removeBskkLetter and removeKpmLetter simultaneously → both cleared', async () => {
      const { agent, user: admin } = await loginAs('admin');
      const bskkPath = writeTournamentFixture('both-bskk.pdf', PDF_BUFFER);
      const kpmPath = writeTournamentFixture('both-kpm.pdf', PDF_BUFFER);
      const tournament = await createTournamentRecord(admin.id, {
        bskkLetterPath: bskkPath,
        kpmLetterPath: kpmPath,
      });

      const res = await agent
        .patch(URL(tournament.id))
        .field('removeBskkLetter', 'true')
        .field('removeKpmLetter', 'true');

      expect(res.status).toBe(200);
      expect(res.body.tournament.hasBskkLetter).toBe(false);
      expect(res.body.tournament.hasKpmLetter).toBe(false);
      expect(tournamentFileExists(bskkPath)).toBe(false);
      expect(tournamentFileExists(kpmPath)).toBe(false);
    });
  });
});
