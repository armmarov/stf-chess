import path from 'path';
import fs from 'fs';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { createManyNotifications } from '../notifications/notifications.service';
import { CreateTournamentInput, UpdateTournamentInput } from './tournaments.validators';

const UPLOADS_DIR = env.UPLOADS_DIR;
const TOURNAMENTS_DIR = path.join(UPLOADS_DIR, 'tournaments');

function ensureTournamentsDir() {
  if (!fs.existsSync(TOURNAMENTS_DIR)) fs.mkdirSync(TOURNAMENTS_DIR, { recursive: true });
}

function tryDeleteFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`[tournaments] failed to delete file ${filePath}:`, err);
  }
}

function toImagePath(file: Express.Multer.File): string {
  return path.relative(UPLOADS_DIR, file.path);
}

const TOURNAMENT_SELECT = {
  id: true,
  name: true,
  description: true,
  imagePath: true,
  registrationLink: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listTournaments(requesterId: string, role: string) {
  const rows = await prisma.tournament.findMany({
    orderBy: [{ startDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: {
      ...TOURNAMENT_SELECT,
      _count: { select: { interests: true } },
    },
  });

  if (role !== 'student') {
    return rows.map(({ _count, ...rest }) => ({ ...rest, interestCount: _count.interests }));
  }

  const myInterests = await prisma.tournamentInterest.findMany({
    where: { studentId: requesterId },
    select: { tournamentId: true },
  });
  const mySet = new Set(myInterests.map((i) => i.tournamentId));

  return rows.map(({ _count, ...rest }) => ({
    ...rest,
    interestCount: _count.interests,
    myInterested: mySet.has(rest.id),
  }));
}

export async function getTournament(id: string, requesterId: string, role: string) {
  const t = await prisma.tournament.findUnique({
    where: { id },
    select: {
      ...TOURNAMENT_SELECT,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { interests: true } },
      interests: {
        orderBy: { student: { name: 'asc' } },
        select: { student: { select: { id: true, name: true, className: true } } },
      },
    },
  });
  if (!t) throw new AppError(404, 'Tournament not found');

  const { _count, interests, ...rest } = t;
  const interestedStudents = interests.map((i) => i.student);
  const base = { ...rest, interestCount: _count.interests, interestedStudents };

  if (role !== 'student') return base;

  const myInterested = interestedStudents.some((s) => s.id === requesterId);
  return { ...base, myInterested };
}

export async function createTournament(
  data: CreateTournamentInput,
  createdById: string,
  file?: Express.Multer.File,
) {
  ensureTournamentsDir();
  const imagePath = file ? toImagePath(file) : null;

  const t = await prisma.tournament.create({
    data: {
      name: data.name,
      description: data.description,
      registrationLink: data.registrationLink ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdById,
      imagePath,
    },
    select: {
      ...TOURNAMENT_SELECT,
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Fire-and-forget: notify all active students

  prisma.user
    .findMany({ where: { role: 'student', isActive: true }, select: { id: true } })
    .then((students) =>
      createManyNotifications(
        students.map((s) => s.id),
        'tournament_added',
        'New tournament added',
        `${t.name} — check it out!`,
        `/tournaments/${t.id}`,
      ),
    )
    .catch((err) => console.error('[notifications] createTournament emission failed:', err));

  return { ...t, interestCount: 0 };
}

export async function updateTournament(
  id: string,
  data: UpdateTournamentInput,
  file?: Express.Multer.File,
) {
  const existing = await prisma.tournament.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Tournament not found');

  const removeImage = data.removeImage === 'true';

  const updateData: {
    name?: string;
    description?: string;
    registrationLink?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    imagePath?: string | null;
  } = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.registrationLink !== undefined) updateData.registrationLink = data.registrationLink;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

  if (removeImage) {
    if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
    updateData.imagePath = null;
  } else if (file) {
    if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
    ensureTournamentsDir();
    updateData.imagePath = toImagePath(file);
  }

  const t = await prisma.tournament.update({
    where: { id },
    data: updateData,
    select: {
      ...TOURNAMENT_SELECT,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { interests: true } },
    },
  });

  const { _count, ...rest } = t;
  return { ...rest, interestCount: _count.interests };
}

export async function deleteTournament(id: string) {
  const existing = await prisma.tournament.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Tournament not found');

  if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));

  await prisma.tournament.delete({ where: { id } });
}

export async function getImageFile(id: string) {
  const t = await prisma.tournament.findUnique({ where: { id }, select: { imagePath: true } });
  if (!t) throw new AppError(404, 'Tournament not found');
  if (!t.imagePath) throw new AppError(404, 'No image for this tournament');

  const filePath = path.join(UPLOADS_DIR, t.imagePath);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'Image file not found');

  return { filePath, filename: path.basename(filePath) };
}

export async function toggleInterest(
  tournamentId: string,
  studentId: string,
  interested: boolean,
) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } });
  if (!t) throw new AppError(404, 'Tournament not found');

  if (interested) {
    await prisma.tournamentInterest.upsert({
      where: { tournamentId_studentId: { tournamentId, studentId } },
      create: { tournamentId, studentId },
      update: {},
    });
  } else {
    await prisma.tournamentInterest.deleteMany({ where: { tournamentId, studentId } });
  }

  const interestCount = await prisma.tournamentInterest.count({ where: { tournamentId } });
  return { interested, interestCount };
}
