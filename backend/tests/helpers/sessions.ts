import { prisma } from './db';

/** Returns a YYYY-MM-DD date string daysAhead days from today. */
export function futureDate(daysAhead = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Returns a YYYY-MM-DD date string daysAgo days in the past. */
export function pastDate(daysAgo = 1): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

interface SessionOverrides {
  date?: Date;
  startTime?: Date;
  endTime?: Date;
  place?: string;
  notes?: string | null;
  isCancelled?: boolean;
  cancelledAt?: Date | null;
  cancelledById?: string | null;
}

/** Creates a session record directly via Prisma — bypasses API validators. */
export async function createSessionRecord(
  createdById: string,
  overrides: SessionOverrides = {},
) {
  const dateStr = futureDate(30);
  return prisma.session.create({
    data: {
      date: overrides.date ?? new Date(dateStr),
      startTime: overrides.startTime ?? new Date(`${dateStr}T09:00:00`),
      endTime: overrides.endTime ?? new Date(`${dateStr}T10:00:00`),
      place: overrides.place ?? 'Test Venue',
      notes: overrides.notes ?? null,
      isCancelled: overrides.isCancelled ?? false,
      cancelledAt: overrides.cancelledAt ?? null,
      cancelledById: overrides.cancelledById ?? null,
      createdById,
    },
  });
}

/**
 * Creates a session whose startTime is `minutesFromNow` minutes in the future.
 * Used for pre-attendance cutoff boundary tests.
 */
export async function futureSessionInMinutes(
  createdById: string,
  minutesFromNow: number,
) {
  const start = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
  return prisma.session.create({
    data: {
      date: new Date(start.toISOString().slice(0, 10)),
      startTime: start,
      endTime: end,
      place: 'Cutoff Test Venue',
      isCancelled: false,
      cancelledAt: null,
      cancelledById: null,
      createdById,
    },
  });
}

/** Returns a valid POST /api/sessions body with a future date. */
export function validSessionBody(daysAhead = 30) {
  const date = futureDate(daysAhead);
  return {
    date,
    startTime: '09:00',
    endTime: '10:30',
    place: 'Chess Hall A',
    notes: 'Regular session',
  };
}
