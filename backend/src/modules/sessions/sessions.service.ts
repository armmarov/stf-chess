import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateSessionInput, UpdateSessionInput, ListSessionsQuery } from './sessions.validators';
import { createManyNotifications } from '../notifications/notifications.service';

function toDateTime(dateStr: string, timeStr: string): Date {
  const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${normalized}Z`);
}

const SESSION_SELECT = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  place: true,
  notes: true,
  isCancelled: true,
  cancelledAt: true,
  createdAt: true,
  createdById: true,
  cancelledById: true,
  _count: { select: { preAttendances: true } },
} as const;

const SESSION_DETAIL_SELECT = {
  ...SESSION_SELECT,
  createdBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} as const;

export async function listSessions(query: ListSessionsQuery, studentId?: string) {
  const where: Prisma.SessionWhereInput = {};

  if (!query.includeCancelled) {
    where.isCancelled = false;
  }
  if (query.from) {
    where.date = { ...((where.date as object) ?? {}), gte: new Date(query.from) };
  }
  if (query.to) {
    where.date = { ...((where.date as object) ?? {}), lte: new Date(query.to) };
  }

  const sessions = await prisma.session.findMany({
    where,
    select: SESSION_SELECT,
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });

  if (!studentId) return sessions;

  const preAttended = await prisma.preAttendance.findMany({
    where: { studentId, sessionId: { in: sessions.map((s) => s.id) } },
    select: { sessionId: true },
  });
  const preAttendedSet = new Set(preAttended.map((p) => p.sessionId));

  return sessions.map((s) => ({ ...s, myPreAttended: preAttendedSet.has(s.id) }));
}

export async function getSession(id: string, studentId?: string) {
  const session = await prisma.session.findUnique({
    where: { id },
    select: SESSION_DETAIL_SELECT,
  });
  if (!session) throw new AppError(404, 'Session not found');

  const [presentCount, paidCash, paidOnline] = await Promise.all([
    prisma.attendance.count({ where: { sessionId: id, present: true } }),
    prisma.attendance.findMany({
      where: { sessionId: id, present: true, paidCash: true },
      select: { studentId: true },
    }),
    prisma.payment.findMany({
      where: { sessionId: id, status: 'approved' },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
  ]);

  const paidCashCount = paidCash.length;
  const paidOnlineCount = paidOnline.length;
  const paidUnion = new Set([
    ...paidCash.map((p) => p.studentId),
    ...paidOnline.map((p) => p.studentId),
  ]);
  const unpaidCount = Math.max(0, presentCount - paidUnion.size);

  if (!studentId) return { ...session, presentCount, paidCashCount, paidOnlineCount, unpaidCount };

  const [preAttendance, attendance] = await Promise.all([
    prisma.preAttendance.findUnique({
      where: { sessionId_studentId: { sessionId: id, studentId } },
      select: { sessionId: true },
    }),
    prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: id, studentId } },
      select: { present: true, paidCash: true },
    }),
  ]);

  return {
    ...session,
    myPreAttended: preAttendance !== null,
    myAttended: attendance?.present === true,
    myPaidCash: attendance?.paidCash === true,
    presentCount,
    paidCashCount,
    paidOnlineCount,
    unpaidCount,
  };
}

export async function createSession(data: CreateSessionInput, createdById: string) {
  const startTime = toDateTime(data.date, data.startTime);
  const endTime = toDateTime(data.date, data.endTime);

  const session = await prisma.session.create({
    data: {
      date: new Date(data.date),
      startTime,
      endTime,
      place: data.place,
      notes: data.notes ?? null,
      createdById,
    },
    select: SESSION_DETAIL_SELECT,
  });

  console.log(`[sessions] created ${session.id} by ${createdById}`);

  // Fire-and-forget: notify all active students
  prisma.user
    .findMany({ where: { role: 'student', isActive: true }, select: { id: true } })
    .then((students) =>
      createManyNotifications(
        students.map((s) => s.id),
        'session_created',
        'New session added',
        `${session.date.toISOString().slice(0, 10)} at ${session.place}`,
        `/sessions/${session.id}`,
      ),
    )
    .catch((err) => console.error('[notifications] createSession emission failed:', err));

  return session;
}

export async function updateSession(
  id: string,
  data: UpdateSessionInput,
  requesterId: string,
  requesterRole: string,
) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Session not found');

  if (existing.isCancelled) {
    if (data.isCancelled === false) {
      // Un-cancel attempt: role-based check
      if (requesterRole !== 'admin') {
        throw new AppError(403, 'Only admin can un-cancel a session');
      }
      const session = await prisma.session.update({
        where: { id },
        data: { isCancelled: false, cancelledAt: null, cancelledById: null },
        select: SESSION_DETAIL_SELECT,
      });
      console.log(`[sessions] un-cancelled ${id} by ${requesterId}`);
      return session;
    }
    // Any other edit on a cancelled session: state-based rejection
    throw new AppError(409, 'Cannot edit a cancelled session; un-cancel it first');
  }

  // Strip server-managed fields from input
  const { isCancelled, ...fields } = data;

  const updateData: Record<string, unknown> = {};

  if (fields.date !== undefined) updateData.date = new Date(fields.date);
  if (fields.place !== undefined) updateData.place = fields.place;
  if (fields.notes !== undefined) updateData.notes = fields.notes;

  // Resolve final date/time strings for startTime/endTime
  const resolvedDate = fields.date ?? existing.date.toISOString().slice(0, 10);

  if (fields.startTime !== undefined) {
    updateData.startTime = toDateTime(resolvedDate, fields.startTime);
  }
  if (fields.endTime !== undefined) {
    updateData.endTime = toDateTime(resolvedDate, fields.endTime);
  }

  // Cross-validate resolved start/end if either is changing
  const finalStart =
    updateData.startTime instanceof Date
      ? updateData.startTime
      : existing.startTime;
  const finalEnd =
    updateData.endTime instanceof Date ? updateData.endTime : existing.endTime;

  if (finalStart >= finalEnd) {
    throw new AppError(400, 'startTime must be before endTime');
  }

  // Handle cancellation
  if (isCancelled === true) {
    updateData.isCancelled = true;
    updateData.cancelledAt = new Date();
    updateData.cancelledById = requesterId;
    console.log(`[sessions] cancelled ${id} by ${requesterId}`);
  }

  const session = await prisma.session.update({
    where: { id },
    data: updateData,
    select: SESSION_DETAIL_SELECT,
  });

  return session;
}
