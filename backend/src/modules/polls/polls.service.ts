import path from 'path';
import fs from 'fs';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { createManyNotifications } from '../notifications/notifications.service';
import { CreatePollInput, UpdatePollInput } from './polls.validators';

const UPLOADS_DIR = env.UPLOADS_DIR;
const POLLS_DIR = path.join(UPLOADS_DIR, 'polls');

function ensurePollsDir() {
  if (!fs.existsSync(POLLS_DIR)) fs.mkdirSync(POLLS_DIR, { recursive: true });
}

function tryDeleteFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`[polls] failed to delete file ${filePath}:`, err);
  }
}

function toImagePath(file: Express.Multer.File): string {
  return path.relative(UPLOADS_DIR, file.path);
}

type PollStatus = 'upcoming' | 'active' | 'expired';

// Poll start/end are stored as wall-clock tagged as UTC (FE appends 'Z' to
// the datetime-local input), so compare against "now as if it were UTC" to
// cancel the server-TZ offset. Same convention used by session / attendance.
function wallClockNowMs(): number {
  const n = new Date();
  return Date.UTC(
    n.getFullYear(),
    n.getMonth(),
    n.getDate(),
    n.getHours(),
    n.getMinutes(),
    n.getSeconds(),
    n.getMilliseconds(),
  );
}

function computeStatus(poll: { startDate: Date; endDate: Date }): PollStatus {
  const nowMs = wallClockNowMs();
  if (nowMs < poll.startDate.getTime()) return 'upcoming';
  if (nowMs > poll.endDate.getTime()) return 'expired';
  return 'active';
}

const OPTION_SELECT = {
  id: true,
  label: true,
  imagePath: true,
  order: true,
  _count: { select: { votes: true } },
} as const;

async function buildPollDetail(id: string, userId: string, role = 'student') {
  const includeVoters = role === 'admin' || role === 'teacher';

  const [poll, voterRows] = await Promise.all([
    prisma.poll.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        createdBy: { select: { id: true, name: true } },
        options: { orderBy: { order: 'asc' }, select: OPTION_SELECT },
        votes: { where: { userId }, select: { optionId: true } },
      },
    }),
    includeVoters
      ? prisma.vote.findMany({
          where: { pollId: id },
          orderBy: { user: { name: 'asc' } },
          select: {
            optionId: true,
            user: { select: { id: true, name: true, className: true } },
          },
        })
      : Promise.resolve([] as Array<{ optionId: string; user: { id: string; name: string; className: string | null } }>),
  ]);

  if (!poll) throw new AppError(404, 'Poll not found');

  const votersByOption = new Map<string, Array<{ id: string; name: string; className: string | null }>>();
  for (const v of voterRows) {
    const list = votersByOption.get(v.optionId) ?? [];
    list.push(v.user);
    votersByOption.set(v.optionId, list);
  }

  const myVote = poll.votes[0] ?? null;
  const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    startDate: poll.startDate,
    endDate: poll.endDate,
    status: computeStatus(poll),
    myVoted: !!myVote,
    myOptionId: myVote?.optionId ?? null,
    createdBy: poll.createdBy,
    options: poll.options.map(({ _count, imagePath, ...o }) => ({
      ...o,
      hasImage: imagePath !== null,
      voteCount: _count.votes,
      ...(includeVoters ? { voters: votersByOption.get(o.id) ?? [] } : {}),
    })),
    totalVotes,
  };
}

export async function listPolls(userId: string) {
  const polls = await prisma.poll.findMany({
    orderBy: { endDate: 'desc' },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      votes: { where: { userId }, select: { id: true } },
    },
  });

  return polls.map(({ votes, ...rest }) => ({
    ...rest,
    status: computeStatus(rest),
    myVoted: votes.length > 0,
  }));
}

export async function getPoll(id: string, userId: string, role: string) {
  return buildPollDetail(id, userId, role);
}

export async function createPoll(
  data: CreatePollInput,
  createdById: string,
  optionFiles: Record<number, Express.Multer.File>,
) {
  ensurePollsDir();

  const poll = await prisma.poll.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      createdById,
      options: {
        create: data.options.map((opt, idx) => ({
          label: opt.label,
          order: idx,
          imagePath: optionFiles[idx] ? toImagePath(optionFiles[idx]) : null,
        })),
      },
    },
    select: { id: true, title: true },
  });

  // Fire-and-forget: notify all active users (except creator)

  prisma.user
    .findMany({ where: { isActive: true }, select: { id: true } })
    .then((users) =>
      createManyNotifications(
        users.map((u) => u.id).filter((id) => id !== createdById),
        'poll_created',
        'New poll added',
        `Vote on: ${poll.title}`,
        `/polls/${poll.id}`,
      ),
    )
    .catch((err) => console.error('[notifications] createPoll emission failed:', err));

  return buildPollDetail(poll.id, createdById, 'admin');
}

export async function updatePoll(id: string, data: UpdatePollInput, role: string) {
  const existing = await prisma.poll.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Poll not found');

  const updateData: {
    title?: string;
    description?: string | null;
    startDate?: Date;
    endDate?: Date;
  } = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

  await prisma.poll.update({ where: { id }, data: updateData });
  return buildPollDetail(id, '', role);
}

export async function deletePoll(id: string) {
  const existing = await prisma.poll.findUnique({
    where: { id },
    select: { options: { select: { imagePath: true } } },
  });
  if (!existing) throw new AppError(404, 'Poll not found');

  for (const opt of existing.options) {
    if (opt.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, opt.imagePath));
  }

  await prisma.poll.delete({ where: { id } });
}

export async function getOptionImageFile(pollId: string, optionId: string) {
  const option = await prisma.pollOption.findUnique({
    where: { id: optionId },
    select: { pollId: true, imagePath: true },
  });
  if (!option || option.pollId !== pollId) throw new AppError(404, 'Option not found');
  if (!option.imagePath) throw new AppError(404, 'No image for this option');

  const filePath = path.join(UPLOADS_DIR, option.imagePath);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'Image file not found');

  return { filePath, filename: path.basename(filePath) };
}

export async function castVote(pollId: string, userId: string, optionId: string, role: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { startDate: true, endDate: true },
  });
  if (!poll) throw new AppError(404, 'Poll not found');

  const nowMs = wallClockNowMs();
  if (nowMs < poll.startDate.getTime()) throw new AppError(409, 'Poll has not started');
  if (nowMs > poll.endDate.getTime()) throw new AppError(409, 'Poll has ended');

  const option = await prisma.pollOption.findUnique({
    where: { id: optionId },
    select: { pollId: true },
  });
  if (!option || option.pollId !== pollId) {
    throw new AppError(400, 'Invalid option for this poll');
  }

  // Upsert — lets users change their vote while the poll is still active.
  // The composite unique constraint (pollId, userId) makes this atomic.
  await prisma.vote.upsert({
    where: { pollId_userId: { pollId, userId } },
    create: { pollId, optionId, userId },
    update: { optionId },
  });

  return buildPollDetail(pollId, userId, role);
}
