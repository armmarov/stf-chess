import fs from 'fs';
import path from 'path';
import { prisma } from './db';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/tmp/stf-test-uploads';
const POLLS_DIR = path.join(UPLOADS_DIR, 'polls');

export function cleanPollUploads(): void {
  if (!fs.existsSync(POLLS_DIR)) return;
  for (const file of fs.readdirSync(POLLS_DIR)) {
    try { fs.unlinkSync(path.join(POLLS_DIR, file)); } catch {}
  }
}

export function writePollFixture(filename: string, content: Buffer): string {
  if (!fs.existsSync(POLLS_DIR)) fs.mkdirSync(POLLS_DIR, { recursive: true });
  fs.writeFileSync(path.join(POLLS_DIR, filename), content);
  return `polls/${filename}`;
}

export function pollFileExists(imagePath: string): boolean {
  return fs.existsSync(path.join(UPLOADS_DIR, imagePath));
}

/** Creates a poll with at least 2 options. Default dates: active (started 1h ago, ends 1h from now). */
export async function createPollRecord(
  createdById: string,
  overrides: {
    title?: string;
    description?: string | null;
    startDate?: Date;
    endDate?: Date;
    options?: string[];
  } = {},
) {
  const now = Date.now();
  const labels = overrides.options ?? ['Option A', 'Option B'];
  return prisma.poll.create({
    data: {
      title: overrides.title ?? `Test Poll ${now}`,
      description: overrides.description !== undefined ? overrides.description : null,
      startDate: overrides.startDate ?? new Date(now - 60 * 60 * 1000),
      endDate: overrides.endDate ?? new Date(now + 60 * 60 * 1000),
      createdById,
      options: {
        create: labels.map((label, idx) => ({ label, order: idx, imagePath: null })),
      },
    },
    include: { options: { orderBy: { order: 'asc' } } },
  });
}

/** Adds an extra option to an existing poll (useful for image tests). */
export async function createPollOptionRecord(
  pollId: string,
  label: string,
  overrides: { imagePath?: string | null; order?: number } = {},
) {
  return prisma.pollOption.create({
    data: {
      pollId,
      label,
      imagePath: overrides.imagePath !== undefined ? overrides.imagePath : null,
      order: overrides.order ?? 99,
    },
  });
}

export async function createVoteRecord(pollId: string, optionId: string, userId: string) {
  return prisma.vote.create({ data: { pollId, optionId, userId } });
}

/** ISO datetime string offset minutes from now (positive = future, negative = past). */
export function isoFromNow(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}
