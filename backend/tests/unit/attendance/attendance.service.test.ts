import {
  togglePreAttendance,
  getAttendanceRoster,
  markAttendance,
} from '../../../src/modules/attendance/attendance.service';
import { preAttendanceSchema, markAttendanceSchema } from '../../../src/modules/attendance/attendance.validators';
import { createUser } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { createSessionRecord, futureSessionInMinutes } from '../../helpers/sessions';
import { createPreAttendance, createAttendance } from '../../helpers/attendance';

// ---------------------------------------------------------------------------
// Schema validator tests — no DB required
// ---------------------------------------------------------------------------
describe('preAttendanceSchema', () => {
  it('accepts confirmed:true', () => {
    expect(preAttendanceSchema.safeParse({ confirmed: true }).success).toBe(true);
  });

  it('accepts confirmed:false', () => {
    expect(preAttendanceSchema.safeParse({ confirmed: false }).success).toBe(true);
  });

  it('rejects missing confirmed', () => {
    expect(preAttendanceSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-boolean confirmed', () => {
    expect(preAttendanceSchema.safeParse({ confirmed: 'true' }).success).toBe(false);
  });
});

describe('markAttendanceSchema', () => {
  const validEntry = { studentId: 'some-id', present: true, paidCash: false };

  it('accepts valid entries array', () => {
    expect(markAttendanceSchema.safeParse({ entries: [validEntry] }).success).toBe(true);
  });

  it('rejects empty entries array', () => {
    expect(markAttendanceSchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it('rejects entry with missing studentId', () => {
    expect(
      markAttendanceSchema.safeParse({ entries: [{ present: true, paidCash: false }] }).success,
    ).toBe(false);
  });

  it('rejects entry with non-boolean present', () => {
    expect(
      markAttendanceSchema.safeParse({ entries: [{ ...validEntry, present: 1 }] }).success,
    ).toBe(false);
  });

  it('rejects missing entries field', () => {
    expect(markAttendanceSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Service tests — require DB
// ---------------------------------------------------------------------------
describe('attendance.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('togglePreAttendance() — 10-min cutoff math', () => {
    it('allows toggle when startTime is 11 min away', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await futureSessionInMinutes(teacher.id, 11);

      const result = await togglePreAttendance(session.id, student.id, true);
      expect(result).not.toBeNull();
      expect(result!.studentId).toBe(student.id);
    });

    it('blocks toggle when startTime is 5 min away (within cutoff)', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await futureSessionInMinutes(teacher.id, 5);

      await expect(togglePreAttendance(session.id, student.id, true)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/cutoff/i),
      });
    });

    it('blocks at exactly the 10-min boundary (now >= cutoff)', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      // startTime = now + 10min → cutoff = now → now >= now → blocked
      const session = await futureSessionInMinutes(teacher.id, 10);

      await expect(togglePreAttendance(session.id, student.id, true)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('togglePreAttendance() — upsert / delete logic', () => {
    it('confirmed:true creates row; confirmed:true again is idempotent', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await futureSessionInMinutes(teacher.id, 60);

      await togglePreAttendance(session.id, student.id, true);
      await togglePreAttendance(session.id, student.id, true);

      const rows = await prisma.preAttendance.findMany({
        where: { sessionId: session.id, studentId: student.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('confirmed:false deletes existing row', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await futureSessionInMinutes(teacher.id, 60);
      await createPreAttendance(session.id, student.id);

      const result = await togglePreAttendance(session.id, student.id, false);

      expect(result).toBeNull();
      const row = await prisma.preAttendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      });
      expect(row).toBeNull();
    });

    it('confirmed:false with no row is a no-op (no error)', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await futureSessionInMinutes(teacher.id, 60);

      const result = await togglePreAttendance(session.id, student.id, false);
      expect(result).toBeNull();
    });

    it('throws 409 for cancelled session', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: teacher.id,
      });

      await expect(togglePreAttendance(session.id, student.id, true)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('throws 404 for unknown session', async () => {
      const student = await createUser('student');
      await expect(
        togglePreAttendance('00000000-0000-0000-0000-000000000000', student.id, true),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getAttendanceRoster() — roster composition', () => {
    it('returns only active students', async () => {
      const teacher = await createUser('teacher');
      const active = await createUser('student');
      const inactive = await createUser('student', { isActive: false });
      const session = await createSessionRecord(teacher.id);

      const { roster } = await getAttendanceRoster(session.id);
      const ids = roster.map((r) => r.student.id);

      expect(ids).toContain(active.id);
      expect(ids).not.toContain(inactive.id);
    });

    it('defaults preAttended/present/paidCash to false when no rows', async () => {
      const teacher = await createUser('teacher');
      await createUser('student');
      const session = await createSessionRecord(teacher.id);

      const { roster } = await getAttendanceRoster(session.id);

      for (const entry of roster) {
        expect(entry.preAttended).toBe(false);
        expect(entry.present).toBe(false);
        expect(entry.paidCash).toBe(false);
      }
    });

    it('preAttended is true when PreAttendance row exists', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      await createPreAttendance(session.id, student.id);

      const { roster } = await getAttendanceRoster(session.id);
      const entry = roster.find((r) => r.student.id === student.id);
      expect(entry!.preAttended).toBe(true);
    });

    it('present/paidCash reflect Attendance row', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      await createAttendance(session.id, student.id, teacher.id, { present: true, paidCash: true });

      const { roster } = await getAttendanceRoster(session.id);
      const entry = roster.find((r) => r.student.id === student.id);
      expect(entry!.present).toBe(true);
      expect(entry!.paidCash).toBe(true);
    });

    it('throws 404 for unknown session', async () => {
      await expect(
        getAttendanceRoster('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('markAttendance() — upsert logic', () => {
    it('creates Attendance rows with correct markedById and markedAt', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const before = new Date();

      await markAttendance(
        session.id,
        { entries: [{ studentId: student.id, present: true, paidCash: false }] },
        teacher.id,
      );
      const after = new Date();

      const row = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      });
      expect(row!.present).toBe(true);
      expect(row!.markedById).toBe(teacher.id);
      expect(row!.markedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(row!.markedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('second call with same data is idempotent — still one row', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);
      const payload = { entries: [{ studentId: student.id, present: true, paidCash: true }] };

      await markAttendance(session.id, payload, teacher.id);
      await markAttendance(session.id, payload, teacher.id);

      const rows = await prisma.attendance.findMany({
        where: { sessionId: session.id, studentId: student.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('second call with different values updates the row', async () => {
      const teacher = await createUser('teacher');
      const student = await createUser('student');
      const session = await createSessionRecord(teacher.id);

      await markAttendance(
        session.id,
        { entries: [{ studentId: student.id, present: false, paidCash: false }] },
        teacher.id,
      );
      await markAttendance(
        session.id,
        { entries: [{ studentId: student.id, present: true, paidCash: true }] },
        teacher.id,
      );

      const row = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      });
      expect(row!.present).toBe(true);
      expect(row!.paidCash).toBe(true);
    });

    it('rejects entire batch when one entry has invalid studentId', async () => {
      const teacher = await createUser('teacher');
      const validStudent = await createUser('student');
      const session = await createSessionRecord(teacher.id);

      await expect(
        markAttendance(
          session.id,
          {
            entries: [
              { studentId: validStudent.id, present: true, paidCash: false },
              { studentId: '00000000-0000-0000-0000-000000000000', present: false, paidCash: false },
            ],
          },
          teacher.id,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      // Valid student must not be marked (atomic rejection)
      const row = await prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: validStudent.id } },
      });
      expect(row).toBeNull();
    });

    it('throws 409 on cancelled session', async () => {
      const admin = await createUser('admin');
      const student = await createUser('student');
      const session = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });

      await expect(
        markAttendance(
          session.id,
          { entries: [{ studentId: student.id, present: true, paidCash: false }] },
          admin.id,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
