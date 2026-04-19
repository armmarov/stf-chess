import { createSessionSchema, updateSessionSchema } from '../../../src/modules/sessions/sessions.validators';
import {
  createSession,
  getSession,
  updateSession,
} from '../../../src/modules/sessions/sessions.service';
import { createUser } from '../../helpers/auth';
import { prisma, resetDb } from '../../helpers/db';
import { futureDate, pastDate, createSessionRecord } from '../../helpers/sessions';

// ---------------------------------------------------------------------------
// Schema validator tests — no DB required
// ---------------------------------------------------------------------------
describe('createSessionSchema validator', () => {
  const validBase = {
    date: futureDate(30),
    startTime: '09:00',
    endTime: '10:00',
    place: 'Test Room',
  };

  it('accepts valid input', () => {
    expect(createSessionSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects past date', () => {
    const result = createSessionSchema.safeParse({ ...validBase, date: pastDate(1) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('date');
    }
  });

  it('rejects startTime >= endTime', () => {
    const result = createSessionSchema.safeParse({ ...validBase, startTime: '10:00', endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('rejects startTime === endTime', () => {
    const result = createSessionSchema.safeParse({ ...validBase, startTime: '10:00', endTime: '10:00' });
    expect(result.success).toBe(false);
  });

  it('rejects badly formatted date', () => {
    expect(createSessionSchema.safeParse({ ...validBase, date: '19/04/2099' }).success).toBe(false);
  });

  it('rejects badly formatted time', () => {
    expect(createSessionSchema.safeParse({ ...validBase, startTime: '9:00' }).success).toBe(false);
  });

  it('rejects missing place', () => {
    const { place: _omit, ...noPlace } = validBase;
    expect(createSessionSchema.safeParse(noPlace).success).toBe(false);
  });
});

describe('updateSessionSchema validator', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(updateSessionSchema.safeParse({}).success).toBe(true);
  });

  it('rejects past date when date is provided', () => {
    const result = updateSessionSchema.safeParse({ date: pastDate(1) });
    expect(result.success).toBe(false);
  });

  it('rejects startTime >= endTime when both provided', () => {
    const result = updateSessionSchema.safeParse({ startTime: '11:00', endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('allows isCancelled:true without other fields', () => {
    expect(updateSessionSchema.safeParse({ isCancelled: true }).success).toBe(true);
  });

  it('allows isCancelled:false without other fields', () => {
    expect(updateSessionSchema.safeParse({ isCancelled: false }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Service function tests — require DB
// ---------------------------------------------------------------------------
describe('sessions.service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('getSession()', () => {
    it('throws AppError 404 for unknown id', async () => {
      await expect(getSession('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('returns session with createdBy and cancelledBy', async () => {
      const user = await createUser('teacher');
      const record = await createSessionRecord(user.id);

      const session = await getSession(record.id);
      expect(session.id).toBe(record.id);
      expect(session.createdBy.id).toBe(user.id);
      expect(session.cancelledBy).toBeNull();
    });
  });

  describe('createSession()', () => {
    it('creates session with correct createdById from caller', async () => {
      const user = await createUser('teacher');
      const input = {
        date: futureDate(10),
        startTime: '09:00',
        endTime: '10:00',
        place: 'Hall A',
      };

      const session = await createSession(input, user.id);

      expect(session.createdBy.id).toBe(user.id);
      expect(session.isCancelled).toBe(false);
      expect(session.cancelledBy).toBeNull();
    });

    it('stores startTime and endTime as UTC (toDateTime regression)', async () => {
      const user = await createUser('teacher');
      const date = '2099-06-15';
      const session = await createSession(
        { date, startTime: '14:00', endTime: '15:30', place: 'UTC Test Room' },
        user.id,
      );

      // Must be stored as UTC midnight interpretation — not local time
      expect(new Date(session.startTime).toISOString()).toBe('2099-06-15T14:00:00.000Z');
      expect(new Date(session.endTime).toISOString()).toBe('2099-06-15T15:30:00.000Z');
    });
  });

  describe('updateSession() — cancel flow', () => {
    it('sets cancelledAt + cancelledById from requesterId, ignoring client values', async () => {
      const user = await createUser('admin');
      const record = await createSessionRecord(user.id);
      const before = new Date();

      const session = await updateSession(
        record.id,
        { isCancelled: true },
        user.id,
        'admin',
      );

      const after = new Date();
      const db = await prisma.session.findUnique({ where: { id: record.id } });

      expect(session.isCancelled).toBe(true);
      expect(db!.cancelledById).toBe(user.id);
      expect(db!.cancelledAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(db!.cancelledAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('throws 409 when editing a cancelled session (non-admin-uncancel)', async () => {
      const user = await createUser('admin');
      const record = await createSessionRecord(user.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: user.id,
      });

      await expect(
        updateSession(record.id, { place: 'New Place' }, user.id, 'admin'),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('updateSession() — un-cancel permission matrix', () => {
    it('admin can un-cancel: clears cancelledAt and cancelledById', async () => {
      const user = await createUser('admin');
      const record = await createSessionRecord(user.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: user.id,
      });

      const session = await updateSession(record.id, { isCancelled: false }, user.id, 'admin');

      expect(session.isCancelled).toBe(false);
      const db = await prisma.session.findUnique({ where: { id: record.id } });
      expect(db!.cancelledAt).toBeNull();
      expect(db!.cancelledById).toBeNull();
    });

    it('teacher trying to un-cancel throws 403', async () => {
      const admin = await createUser('admin');
      const teacher = await createUser('teacher');
      const record = await createSessionRecord(admin.id, {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: admin.id,
      });

      await expect(
        updateSession(record.id, { isCancelled: false }, teacher.id, 'teacher'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('updateSession() — startTime/endTime cross-validation', () => {
    it('400 when updated start >= end resolved against existing times', async () => {
      const user = await createUser('teacher');
      // existing: 09:00 - 10:00; update only startTime to 11:00
      const record = await createSessionRecord(user.id);

      await expect(
        updateSession(record.id, { startTime: '11:00' }, user.id, 'teacher'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
