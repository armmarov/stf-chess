import fs from 'fs';
import path from 'path';
import { prisma } from './db';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/tmp/stf-test-uploads';
const TOURNAMENTS_DIR = path.join(UPLOADS_DIR, 'tournaments');

export function cleanTournamentUploads(): void {
  if (!fs.existsSync(TOURNAMENTS_DIR)) return;
  for (const file of fs.readdirSync(TOURNAMENTS_DIR)) {
    try { fs.unlinkSync(path.join(TOURNAMENTS_DIR, file)); } catch {}
  }
}

export function writeTournamentFixture(filename: string, content: Buffer): string {
  if (!fs.existsSync(TOURNAMENTS_DIR)) fs.mkdirSync(TOURNAMENTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(TOURNAMENTS_DIR, filename), content);
  return `tournaments/${filename}`;
}

export function tournamentFileExists(imagePath: string): boolean {
  return fs.existsSync(path.join(UPLOADS_DIR, imagePath));
}

export async function createTournamentRecord(
  createdById: string,
  overrides: {
    name?: string;
    description?: string;
    imagePath?: string | null;
    registrationLink?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    place?: string | null;
  } = {},
) {
  return prisma.tournament.create({
    data: {
      name: overrides.name ?? `Test Tournament ${Date.now()}`,
      description: overrides.description ?? 'Test description',
      imagePath: overrides.imagePath !== undefined ? overrides.imagePath : null,
      registrationLink: overrides.registrationLink !== undefined ? overrides.registrationLink : null,
      startDate: overrides.startDate !== undefined ? overrides.startDate : null,
      endDate: overrides.endDate !== undefined ? overrides.endDate : null,
      place: overrides.place !== undefined ? overrides.place : null,
      createdById,
    },
  });
}

export async function createInterestRecord(tournamentId: string, studentId: string) {
  return prisma.tournamentInterest.create({
    data: { tournamentId, studentId },
  });
}

export const WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
