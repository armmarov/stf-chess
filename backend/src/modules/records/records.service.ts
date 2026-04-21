import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateRecordInput, UpdateRecordInput } from './records.validators';
import { Role } from '../../types';

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
  createdAt: true,
  updatedAt: true,
  student: {
    select: { id: true, name: true, username: true, className: true },
  },
  createdBy: {
    select: { id: true, name: true },
  },
} as const;

function formatRecord(record: {
  competitionDate: Date;
  [key: string]: unknown;
}) {
  return {
    ...record,
    competitionDate: record.competitionDate.toISOString().slice(0, 10),
  };
}

export async function listRecords(studentId?: string) {
  const records = await prisma.competitionRecord.findMany({
    where: studentId ? { studentId } : undefined,
    select: RECORD_SELECT,
    orderBy: [{ competitionDate: 'desc' }, { createdAt: 'desc' }],
  });
  return records.map(formatRecord);
}

export async function getRecord(id: string) {
  const record = await prisma.competitionRecord.findUnique({
    where: { id },
    select: RECORD_SELECT,
  });
  if (!record) throw new AppError(404, 'Record not found');
  return formatRecord(record);
}

export async function createRecord(
  data: CreateRecordInput,
  createdById: string,
  requestorId: string,
  requestorRole: Role,
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
      createdById,
    },
    select: RECORD_SELECT,
  });

  return formatRecord(record);
}

export async function updateRecord(
  id: string,
  data: UpdateRecordInput,
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

  const record = await prisma.competitionRecord.update({
    where: { id },
    data: updateData,
    select: RECORD_SELECT,
  });

  return formatRecord(record);
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

  await prisma.competitionRecord.delete({ where: { id } });
}
