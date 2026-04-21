import { prisma } from './db';

let _seq = 0;

interface RecordOverrides {
  studentId?: string;
  createdById?: string;
  competitionName?: string;
  competitionDate?: string; // YYYY-MM-DD
  level?: 'sekolah' | 'daerah' | 'negeri' | 'kebangsaan' | 'antarabangsa';
  category?: 'u13' | 'u14' | 'u15' | 'u16' | 'u17' | 'u18' | 'u21' | 'open';
  pajsk?: boolean;
  fideRated?: boolean;
  mcfRated?: boolean;
  placement?: number | null;
}

/**
 * Seeds a CompetitionRecord row directly in the DB.
 * Both studentId and createdById must reference existing user rows.
 */
export async function createRecord(overrides: RecordOverrides) {
  _seq++;
  const dateStr = overrides.competitionDate ?? '2026-01-15';

  return prisma.competitionRecord.create({
    data: {
      studentId: overrides.studentId!,
      createdById: overrides.createdById ?? overrides.studentId!,
      competitionName: overrides.competitionName ?? `Test Competition ${_seq}`,
      competitionDate: new Date(dateStr + 'T00:00:00Z'),
      level: overrides.level ?? 'sekolah',
      category: overrides.category ?? 'u18',
      pajsk: overrides.pajsk ?? false,
      fideRated: overrides.fideRated ?? false,
      mcfRated: overrides.mcfRated ?? false,
      placement: overrides.placement !== undefined ? overrides.placement : 1,
    },
  });
}
