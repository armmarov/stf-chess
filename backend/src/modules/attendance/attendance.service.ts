import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { MarkAttendanceInput } from './attendance.validators';
import { createManyNotifications } from '../notifications/notifications.service';

const PRE_ATTENDANCE_CUTOFF_MS = 10 * 60 * 1000;

async function getActiveSession(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Session not found');
  return session;
}

export async function togglePreAttendance(
  sessionId: string,
  targetStudentId: string,
  confirmed: boolean,
  actor: { id: string; role: string; name: string },
) {
  const session = await getActiveSession(sessionId);

  if (session.isCancelled) {
    throw new AppError(409, 'Cannot pre-attend a cancelled session');
  }

  // Validate target is an active student
  const targetUser = await prisma.user.findUnique({
    where: { id: targetStudentId },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!targetUser || !targetUser.isActive || targetUser.role !== 'student') {
    throw new AppError(400, 'Target must be an active student');
  }

  // Cutoff applies only when a student acts on themselves; staff can bypass
  if (actor.role === 'student') {
    const cutoff = new Date(session.startTime.getTime() - PRE_ATTENDANCE_CUTOFF_MS);
    if (new Date() >= cutoff) {
      throw new AppError(409, 'Pre-attendance cutoff has passed');
    }
  }

  if (confirmed) {
    const isNew = !(await prisma.preAttendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: targetStudentId } },
    }));

    const record = await prisma.preAttendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: targetStudentId } },
      create: { sessionId, studentId: targetStudentId, confirmedAt: new Date() },
      update: { confirmedAt: new Date() },
    });

    if (isNew) {
      if (actor.role === 'student') {
        // Student confirmed own → notify staff
        prisma.user
          .findMany({ where: { role: { in: ['admin', 'teacher'] }, isActive: true }, select: { id: true } })
          .then((staff) =>
            createManyNotifications(
              staff.map((s) => s.id).filter((id) => id !== actor.id),
              'pre_attendance_set',
              'Student confirmed attendance',
              `${targetUser.name} will attend ${session.date.toISOString().slice(0, 10)}`,
              `/sessions/${sessionId}`,
            ),
          )
          .catch((err) => console.error('[notifications] togglePreAttendance emission failed:', err));
      } else {
        // Staff acting on behalf → notify the target student only
        createManyNotifications(
          [targetStudentId],
          'pre_attendance_set',
          'Pre-attendance confirmed',
          `Pre-attendance confirmed by ${actor.name}`,
          `/sessions/${sessionId}`,
        ).catch((err) => console.error('[notifications] togglePreAttendance emission failed:', err));
      }
    }

    return { sessionId: record.sessionId, studentId: record.studentId, confirmedAt: record.confirmedAt };
  } else {
    const existing = await prisma.preAttendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: targetStudentId } },
    });
    if (existing) {
      await prisma.preAttendance.delete({
        where: { sessionId_studentId: { sessionId, studentId: targetStudentId } },
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

  const [students, preAttendances, attendances, payments] = await Promise.all([
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
    prisma.payment.findMany({
      where: { sessionId },
      orderBy: { uploadedAt: 'desc' },
      select: { studentId: true, status: true },
    }),
  ]);

  const preAttendedSet = new Set(preAttendances.map((p) => p.studentId));
  const attendanceMap = new Map(
    attendances.map((a) => [a.studentId, { present: a.present, paidCash: a.paidCash }]),
  );
  const paymentByStudent = new Map<string, 'pending' | 'approved' | 'rejected'>();
  for (const p of payments) {
    if (!paymentByStudent.has(p.studentId)) paymentByStudent.set(p.studentId, p.status);
  }

  const roster = students.map((student) => ({
    student,
    preAttended: preAttendedSet.has(student.id),
    present: attendanceMap.get(student.id)?.present ?? false,
    paidCash: attendanceMap.get(student.id)?.paidCash ?? false,
    onlinePaymentStatus: paymentByStudent.get(student.id) ?? null,
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

  // Fetch existing rows before upsert for transition detection
  const existingRows = await prisma.attendance.findMany({
    where: { sessionId, studentId: { in: studentIds } },
    select: { studentId: true, present: true, paidCash: true },
  });
  const existingMap = new Map(existingRows.map((a) => [a.studentId, a]));

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

  // Fire-and-forget: notify students on present / paidCash transitions
  const presentTransitions: string[] = [];
  const paidCashTransitions: string[] = [];
  for (const entry of data.entries) {
    const prev = existingMap.get(entry.studentId);
    if (entry.present && !prev?.present) presentTransitions.push(entry.studentId);
    if (entry.paidCash && !prev?.paidCash) paidCashTransitions.push(entry.studentId);
  }

  if (presentTransitions.length > 0 || paidCashTransitions.length > 0) {
    const dateStr = session.date.toISOString().slice(0, 10);
    Promise.all([
      presentTransitions.length > 0
        ? createManyNotifications(
            presentTransitions,
            'attendance_marked_present',
            'You were marked present',
            `Session on ${dateStr}`,
            `/sessions/${sessionId}`,
          )
        : Promise.resolve(),
      paidCashTransitions.length > 0
        ? createManyNotifications(
            paidCashTransitions,
            'paid_cash',
            'Cash payment recorded',
            `Your teacher marked you as paid for ${dateStr}`,
            `/sessions/${sessionId}`,
          )
        : Promise.resolve(),
    ]).catch((err) => console.error('[notifications] markAttendance emission failed:', err));
  }

  return { updated: data.entries.length };
}
