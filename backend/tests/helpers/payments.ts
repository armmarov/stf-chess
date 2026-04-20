import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from './db';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function cleanUploads(): void {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  for (const file of fs.readdirSync(UPLOADS_DIR)) {
    if (file === '.gitkeep') continue;
    try { fs.unlinkSync(path.join(UPLOADS_DIR, file)); } catch {}
  }
}

export function writeFixtureFile(filename: string, content: Buffer): string {
  ensureUploadsDir();
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), content);
  return filename;
}

export function deleteFixtureFile(filename: string): void {
  const fp = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

export async function setFeeConfig(fee: number, adminId: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: 'session_fee' },
    create: { key: 'session_fee', value: fee.toFixed(2), updatedById: adminId },
    update: { value: fee.toFixed(2), updatedById: adminId },
  });
}

export async function createPaymentRecord(
  studentId: string,
  sessionId: string,
  overrides: {
    amount?: number;
    status?: 'pending' | 'approved' | 'rejected';
    receiptFilePath?: string;
    reviewedById?: string | null;
    reviewedAt?: Date;
    uploadedAt?: Date;
  } = {},
) {
  const status = overrides.status ?? 'pending';
  return prisma.payment.create({
    data: {
      studentId,
      sessionId,
      amount: new Prisma.Decimal((overrides.amount ?? 50).toFixed(2)),
      receiptFilePath: overrides.receiptFilePath ?? 'test-receipt.jpg',
      status,
      uploadedAt: overrides.uploadedAt ?? new Date(),
      reviewedById: overrides.reviewedById ?? null,
      reviewedAt: overrides.reviewedAt ?? (status === 'approved' ? new Date() : null),
    },
  });
}

// Small binary buffers — multer reads mimetype from the request header, not file magic bytes
export const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
export const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const PDF_BUFFER = Buffer.from('%PDF-1.0\n');
export const TEXT_BUFFER = Buffer.from('hello world');
export const OVERSIZED_BUFFER = Buffer.alloc(5 * 1024 * 1024 + 100); // 5 MB + 100 bytes
