import prisma from '../../utils/prisma';
import { AuthUser } from '../../types';

export async function getStats(user: AuthUser) {
  if (user.role === 'student') {
    const [totalSessions, sessionsJoined, pendingPayments] = await prisma.$transaction([
      prisma.session.count({ where: { isCancelled: false } }),
      prisma.attendance.count({ where: { studentId: user.id, present: true } }),
      prisma.payment.count({ where: { studentId: user.id, status: 'pending' } }),
    ]);
    return { totalSessions, sessionsJoined, pendingPayments };
  }

  if (user.role === 'teacher') {
    const [totalSessions, totalStudents] = await prisma.$transaction([
      prisma.session.count({ where: { isCancelled: false } }),
      prisma.user.count({ where: { role: 'student', isActive: true } }),
    ]);
    return { totalSessions, totalStudents };
  }

  if (user.role === 'admin') {
    const [totalSessions, totalStudents, totalTeachers] = await prisma.$transaction([
      prisma.session.count({ where: { isCancelled: false } }),
      prisma.user.count({ where: { role: 'student', isActive: true } }),
      prisma.user.count({ where: { role: 'teacher', isActive: true } }),
    ]);
    return { totalSessions, totalStudents, totalTeachers };
  }

  return null;
}
