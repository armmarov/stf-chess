import { prisma } from './db';

/** Creates a PreAttendance row directly (bypasses cutoff logic). */
export async function createPreAttendance(sessionId: string, studentId: string) {
  return prisma.preAttendance.create({
    data: { sessionId, studentId },
  });
}

/** Creates or upserts an Attendance row directly via Prisma. */
export async function createAttendance(
  sessionId: string,
  studentId: string,
  markedById: string,
  overrides: { present?: boolean; paidCash?: boolean } = {},
) {
  return prisma.attendance.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    create: {
      sessionId,
      studentId,
      markedById,
      present: overrides.present ?? false,
      paidCash: overrides.paidCash ?? false,
    },
    update: {
      markedById,
      present: overrides.present ?? false,
      paidCash: overrides.paidCash ?? false,
    },
  });
}
