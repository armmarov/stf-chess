import { createRecordSchema, updateRecordSchema } from '../../../src/modules/records/records.validators';

const VALID_CREATE = {
  studentId: 'student-uuid-1',
  competitionName: 'Malaysian Junior Chess Championship',
  competitionDate: '2026-03-15',
  level: 'kebangsaan' as const,
  category: 'u18' as const,
  pajsk: true,
  fideRated: false,
  mcfRated: true,
  placement: 1,
};

describe('createRecordSchema', () => {
  describe('happy paths', () => {
    it('accepts a fully-formed body with all valid enum values', () => {
      expect(createRecordSchema.safeParse(VALID_CREATE).success).toBe(true);
    });

    it('accepts placement = null (participation)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, placement: null }).success).toBe(true);
    });

    it('accepts placement = 30 (boundary max)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, placement: 30 }).success).toBe(true);
    });

    it('accepts all valid level values', () => {
      for (const level of ['sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa'] as const) {
        expect(createRecordSchema.safeParse({ ...VALID_CREATE, level }).success).toBe(true);
      }
    });

    it('accepts all valid category values', () => {
      for (const category of ['u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u21', 'open'] as const) {
        expect(createRecordSchema.safeParse({ ...VALID_CREATE, category }).success).toBe(true);
      }
    });

    it('accepts pajsk, fideRated, mcfRated all false', () => {
      expect(
        createRecordSchema.safeParse({ ...VALID_CREATE, pajsk: false, fideRated: false, mcfRated: false }).success,
      ).toBe(true);
    });
  });

  describe('placement validation', () => {
    it('rejects placement = 0 (below min)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, placement: 0 }).success).toBe(false);
    });

    it('rejects placement = 31 (above max)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, placement: 31 }).success).toBe(false);
    });

    it('rejects placement = -1 (negative)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, placement: -1 }).success).toBe(false);
    });

    it('rejects placement = 3.5 (non-integer)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, placement: 3.5 }).success).toBe(false);
    });
  });

  describe('enum validation', () => {
    it('rejects unknown level ("abc")', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, level: 'abc' }).success).toBe(false);
    });

    it('rejects unknown category ("u12")', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, category: 'u12' }).success).toBe(false);
    });

    it('rejects unknown level (empty string)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, level: '' }).success).toBe(false);
    });

    it('rejects unknown category (empty string)', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, category: '' }).success).toBe(false);
    });
  });

  describe('competitionName validation', () => {
    it('rejects empty competitionName', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, competitionName: '' }).success).toBe(false);
    });

    it('rejects competitionName longer than 200 characters', () => {
      const tooLong = 'a'.repeat(201);
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, competitionName: tooLong }).success).toBe(false);
    });

    it('accepts competitionName of exactly 200 characters', () => {
      const maxLen = 'a'.repeat(200);
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, competitionName: maxLen }).success).toBe(true);
    });
  });

  describe('competitionDate validation', () => {
    it('rejects non-ISO date string ("15/03/2026")', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, competitionDate: '15/03/2026' }).success).toBe(false);
    });

    it('rejects datetime string with time component', () => {
      expect(
        createRecordSchema.safeParse({ ...VALID_CREATE, competitionDate: '2026-03-15T00:00:00Z' }).success,
      ).toBe(false);
    });

    it('rejects invalid date like "2026-13-01"', () => {
      expect(createRecordSchema.safeParse({ ...VALID_CREATE, competitionDate: '2026-13-01' }).success).toBe(false);
    });

    it('rejects free-form date string', () => {
      expect(
        createRecordSchema.safeParse({ ...VALID_CREATE, competitionDate: 'March 15 2026' }).success,
      ).toBe(false);
    });
  });

  describe('missing required fields', () => {
    it('rejects missing pajsk', () => {
      const { pajsk: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing fideRated', () => {
      const { fideRated: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing mcfRated', () => {
      const { mcfRated: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing studentId', () => {
      const { studentId: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing competitionName', () => {
      const { competitionName: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing competitionDate', () => {
      const { competitionDate: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing placement (not present, not null)', () => {
      const { placement: _, ...rest } = VALID_CREATE;
      expect(createRecordSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects empty object', () => {
      expect(createRecordSchema.safeParse({}).success).toBe(false);
    });
  });
});

describe('updateRecordSchema', () => {
  describe('happy paths — accepts any single field (partial update)', () => {
    it('accepts { competitionName } only', () => {
      expect(updateRecordSchema.safeParse({ competitionName: 'Updated Name' }).success).toBe(true);
    });

    it('accepts { competitionDate } only', () => {
      expect(updateRecordSchema.safeParse({ competitionDate: '2026-04-01' }).success).toBe(true);
    });

    it('accepts { level } only', () => {
      expect(updateRecordSchema.safeParse({ level: 'negeri' }).success).toBe(true);
    });

    it('accepts { category } only', () => {
      expect(updateRecordSchema.safeParse({ category: 'open' }).success).toBe(true);
    });

    it('accepts { pajsk } only', () => {
      expect(updateRecordSchema.safeParse({ pajsk: true }).success).toBe(true);
    });

    it('accepts { fideRated } only', () => {
      expect(updateRecordSchema.safeParse({ fideRated: true }).success).toBe(true);
    });

    it('accepts { mcfRated } only', () => {
      expect(updateRecordSchema.safeParse({ mcfRated: false }).success).toBe(true);
    });

    it('accepts { placement: null }', () => {
      expect(updateRecordSchema.safeParse({ placement: null }).success).toBe(true);
    });

    it('accepts { placement: 5 }', () => {
      expect(updateRecordSchema.safeParse({ placement: 5 }).success).toBe(true);
    });

    it('accepts all editable fields together', () => {
      const full = {
        competitionName: 'Updated',
        competitionDate: '2026-05-01',
        level: 'daerah',
        category: 'u15',
        pajsk: false,
        fideRated: true,
        mcfRated: false,
        placement: 2,
      };
      expect(updateRecordSchema.safeParse(full).success).toBe(true);
    });
  });

  describe('empty body rejection', () => {
    it('rejects empty body {}', () => {
      expect(updateRecordSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('ignores unknown keys (strip behavior)', () => {
    it('silently ignores studentId key — schema still passes', () => {
      const result = updateRecordSchema.safeParse({ competitionName: 'Updated', studentId: 'other-id' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('studentId');
      }
    });

    it('silently ignores createdById key — schema still passes', () => {
      const result = updateRecordSchema.safeParse({ competitionName: 'Updated', createdById: 'hacker-id' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('createdById');
      }
    });
  });

  describe('field-level validation still applies', () => {
    it('rejects invalid level in partial update', () => {
      expect(updateRecordSchema.safeParse({ level: 'unknown' }).success).toBe(false);
    });

    it('rejects placement = 0 in partial update', () => {
      expect(updateRecordSchema.safeParse({ placement: 0 }).success).toBe(false);
    });

    it('rejects empty competitionName in partial update', () => {
      expect(updateRecordSchema.safeParse({ competitionName: '' }).success).toBe(false);
    });
  });
});
