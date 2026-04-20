import fs from 'fs';
import path from 'path';
import { prisma } from './db';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/tmp/stf-test-uploads';
const RESOURCES_DIR = path.join(UPLOADS_DIR, 'resources');

export function cleanResourceUploads(): void {
  if (!fs.existsSync(RESOURCES_DIR)) return;
  for (const file of fs.readdirSync(RESOURCES_DIR)) {
    try { fs.unlinkSync(path.join(RESOURCES_DIR, file)); } catch {}
  }
}

export function writeResourceFixture(filename: string, content: Buffer): string {
  if (!fs.existsSync(RESOURCES_DIR)) fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESOURCES_DIR, filename), content);
  return `resources/${filename}`;
}

export function resourceFileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(UPLOADS_DIR, relativePath));
}

export async function createResourceRecord(
  createdById: string,
  overrides: {
    title?: string;
    type?: 'book' | 'homework' | 'app';
    description?: string | null;
    url?: string | null;
    isEnabled?: boolean;
    imagePath?: string | null;
    filePath?: string | null;
    fileName?: string | null;
    fileMime?: string | null;
  } = {},
) {
  return prisma.resource.create({
    data: {
      title: overrides.title ?? `Test Resource ${Date.now()}`,
      type: overrides.type ?? 'book',
      description: overrides.description !== undefined ? overrides.description : null,
      url: overrides.url !== undefined ? overrides.url : null,
      isEnabled: overrides.isEnabled !== undefined ? overrides.isEnabled : true,
      createdById,
      imagePath: overrides.imagePath !== undefined ? overrides.imagePath : null,
      filePath: overrides.filePath !== undefined ? overrides.filePath : null,
      fileName: overrides.fileName !== undefined ? overrides.fileName : null,
      fileMime: overrides.fileMime !== undefined ? overrides.fileMime : null,
    },
  });
}

/** 5 MB + 100 bytes — triggers the image-specific 5 MB post-multer check (global multer limit is 20 MB). */
export const IMAGE_OVERSIZED_BUFFER = Buffer.alloc(5 * 1024 * 1024 + 100);
