import fs from 'fs';
import path from 'path';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { CreateRecordInput, UpdateRecordInput } from './records.validators';
import { Role } from '../../types';

const UPLOADS_DIR = env.UPLOADS_DIR;

const RECORD_SELECT = {
  id: true,
  competitionName: true,
  competitionDate: true,
  level: true,
  category: true,
  pajsk: true,
  fideRated: true,
  mcfRated: true,
  placement: true,
  imagePath: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: { id: true, name: true, username: true, className: true },
  },
  createdBy: {
    select: { id: true, name: true },
  },
} as const;

type RecordRow = { competitionDate: Date; imagePath: string | null; [key: string]: unknown };

// Strip imagePath; expose hasImage boolean (image served via /:id/image).
function toPublic(row: RecordRow) {
  const { imagePath, competitionDate, ...rest } = row;
  return {
    ...rest,
    competitionDate: competitionDate.toISOString().slice(0, 10),
    hasImage: imagePath !== null,
  };
}

function toImagePath(file: Express.Multer.File): string {
  return path.join('records', file.filename);
}

function tryDeleteFile(full: string): void {
  fs.promises.unlink(full).catch(() => { /* ignore — missing is fine */ });
}

export async function listRecords(studentId?: string) {
  const records = await prisma.competitionRecord.findMany({
    where: studentId ? { studentId } : undefined,
    select: RECORD_SELECT,
    orderBy: [{ competitionDate: 'desc' }, { createdAt: 'desc' }],
  });
  return records.map(toPublic);
}

export async function getRecord(id: string) {
  const record = await prisma.competitionRecord.findUnique({
    where: { id },
    select: RECORD_SELECT,
  });
  if (!record) throw new AppError(404, 'Record not found');
  return toPublic(record);
}

export async function createRecord(
  data: CreateRecordInput,
  createdById: string,
  requestorId: string,
  requestorRole: Role,
  file?: Express.Multer.File,
) {
  if (requestorRole === 'student') {
    if (data.studentId !== requestorId) {
      throw new AppError(403, 'Students may only create records for themselves');
    }
  } else if (requestorRole !== 'teacher' && requestorRole !== 'admin') {
    throw new AppError(403, 'Forbidden');
  }

  const record = await prisma.competitionRecord.create({
    data: {
      studentId: data.studentId,
      competitionName: data.competitionName,
      competitionDate: new Date(data.competitionDate + 'T00:00:00Z'),
      level: data.level,
      category: data.category,
      pajsk: data.pajsk,
      fideRated: data.fideRated,
      mcfRated: data.mcfRated,
      placement: data.placement ?? null,
      imagePath: file ? toImagePath(file) : null,
      createdById,
    },
    select: RECORD_SELECT,
  });

  return toPublic(record);
}

export async function updateRecord(
  id: string,
  data: UpdateRecordInput & { removeImage?: boolean },
  requestorId: string,
  requestorRole: Role,
  file?: Express.Multer.File,
) {
  const existing = await prisma.competitionRecord.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Record not found');

  const isCreator = existing.createdById === requestorId;
  const isPrivileged = requestorRole === 'teacher' || requestorRole === 'admin';

  if (!isCreator && !isPrivileged) {
    throw new AppError(403, 'Forbidden');
  }

  const updateData: Record<string, unknown> = {};
  if (data.competitionName !== undefined) updateData.competitionName = data.competitionName;
  if (data.competitionDate !== undefined) {
    updateData.competitionDate = new Date(data.competitionDate + 'T00:00:00Z');
  }
  if (data.level !== undefined) updateData.level = data.level;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.pajsk !== undefined) updateData.pajsk = data.pajsk;
  if (data.fideRated !== undefined) updateData.fideRated = data.fideRated;
  if (data.mcfRated !== undefined) updateData.mcfRated = data.mcfRated;
  if (data.placement !== undefined) updateData.placement = data.placement;

  if (file) {
    if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
    updateData.imagePath = toImagePath(file);
  } else if (data.removeImage) {
    if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
    updateData.imagePath = null;
  }

  const record = await prisma.competitionRecord.update({
    where: { id },
    data: updateData,
    select: RECORD_SELECT,
  });

  return toPublic(record);
}

export async function deleteRecord(
  id: string,
  requestorId: string,
  requestorRole: Role,
) {
  const existing = await prisma.competitionRecord.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Record not found');

  const isCreator = existing.createdById === requestorId;
  const isPrivileged = requestorRole === 'teacher' || requestorRole === 'admin';

  if (!isCreator && !isPrivileged) {
    throw new AppError(403, 'Forbidden');
  }

  if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));

  await prisma.competitionRecord.delete({ where: { id } });
}

export async function getImageFile(id: string): Promise<{ fullPath: string; filename: string }> {
  const r = await prisma.competitionRecord.findUnique({ where: { id }, select: { imagePath: true } });
  if (!r) throw new AppError(404, 'Record not found');
  if (!r.imagePath) throw new AppError(404, 'No image for this record');
  return { fullPath: path.join(UPLOADS_DIR, r.imagePath), filename: path.basename(r.imagePath) };
}
