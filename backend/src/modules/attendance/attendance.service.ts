import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { MarkAttendanceInput } from './attendance.validators';

const PRE_ATTENDANCE_CUTOFF_MS = 10 * 60 * 1000;

async function getActiveSession(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Session not found');
  return session;
}

export async function togglePreAttendance(
  sessionId: string,
  studentId: string,
  confirmed: boolean,
) {
  const session = await getActiveSession(sessionId);

  if (session.isCancelled) {
    throw new AppError(409, 'Cannot pre-attend a cancelled session');
  }

  const cutoff = new Date(session.startTime.getTime() - PRE_ATTENDANCE_CUTOFF_MS);
  if (new Date() >= cutoff) {
    throw new AppError(409, 'Pre-attendance cutoff has passed');
  }

  if (confirmed) {
    const record = await prisma.preAttendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: { sessionId, studentId, confirmedAt: new Date() },
      update: { confirmedAt: new Date() },
    });
    return { sessionId: record.sessionId, studentId: record.studentId, confirmedAt: record.confirmedAt };
  } else {
    const existing = await prisma.preAttendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    if (existing) {
      await prisma.preAttendance.delete({
        where: { sessionId_studentId: { sessionId, studentId } },
      });
    }
    return null;
  }
}

export async function getAttendanceRoster(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, date: true, startTime: true, endTime: true, place: true, isCancelled: true },
  });
  if (!session) throw new AppError(404, 'Session not found');

  const [students, preAttendances, attendances] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'student', isActive: true },
      select: { id: true, name: true, username: true },
      orderBy: { name: 'asc' },
    }),
    prisma.preAttendance.findMany({
      where: { sessionId },
      select: { studentId: true },
    }),
    prisma.attendance.findMany({
      where: { sessionId },
      select: { studentId: true, present: true, paidCash: true },
    }),
  ]);

  const preAttendedSet = new Set(preAttendances.map((p) => p.studentId));
  const attendanceMap = new Map(
    attendances.map((a) => [a.studentId, { present: a.present, paidCash: a.paidCash }]),
  );

  const roster = students.map((student) => ({
    student,
    preAttended: preAttendedSet.has(student.id),
    present: attendanceMap.get(student.id)?.present ?? false,
    paidCash: attendanceMap.get(student.id)?.paidCash ?? false,
  }));

  return { session, roster };
}

export async function markAttendance(
  sessionId: string,
  data: MarkAttendanceInput,
  markedById: string,
) {
  const session = await getActiveSession(sessionId);

  if (session.isCancelled) {
    throw new AppError(409, 'Cannot mark attendance for a cancelled session');
  }

  const studentIds = data.entries.map((e) => e.studentId);

  const validStudents = await prisma.user.findMany({
    where: { id: { in: studentIds }, role: 'student', isActive: true },
    select: { id: true },
  });
  const validSet = new Set(validStudents.map((s) => s.id));
  const invalid = studentIds.filter((id) => !validSet.has(id));
  if (invalid.length > 0) {
    throw new AppError(400, `Invalid or inactive student IDs: ${invalid.join(', ')}`);
  }

  const markedAt = new Date();

  await Promise.all(
    data.entries.map((entry) =>
      prisma.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: entry.studentId } },
        create: {
          sessionId,
          studentId: entry.studentId,
          present: entry.present,
          paidCash: entry.paidCash,
          markedById,
          markedAt,
        },
        update: {
          present: entry.present,
          paidCash: entry.paidCash,
          markedById,
          markedAt,
        },
      }),
    ),
  );

  return { updated: data.entries.length };
}
