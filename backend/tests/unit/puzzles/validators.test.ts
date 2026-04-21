import { attemptSchema, checkMoveSchema } from '../../../src/modules/puzzles/puzzles.validators';

describe('checkMoveSchema', () => {
  it('valid ply + 4-char uci passes', () => {
    expect(checkMoveSchema.safeParse({ ply: 0, uci: 'e2e4' }).success).toBe(true);
  });

  it('valid ply + 5-char uci (promotion) passes', () => {
    expect(checkMoveSchema.safeParse({ ply: 2, uci: 'e7e8q' }).success).toBe(true);
  });

  it('missing ply → error', () => {
    expect(checkMoveSchema.safeParse({ uci: 'e2e4' }).success).toBe(false);
  });

  it('missing uci → error', () => {
    expect(checkMoveSchema.safeParse({ ply: 0 }).success).toBe(false);
  });

  it('negative ply → error', () => {
    expect(checkMoveSchema.safeParse({ ply: -1, uci: 'e2e4' }).success).toBe(false);
  });

  it('non-integer ply → error', () => {
    expect(checkMoveSchema.safeParse({ ply: 0.5, uci: 'e2e4' }).success).toBe(false);
  });

  it('uci too short (3 chars) → error', () => {
    expect(checkMoveSchema.safeParse({ ply: 0, uci: 'e2e' }).success).toBe(false);
  });

  it('uci too long (6 chars) → error', () => {
    expect(checkMoveSchema.safeParse({ ply: 0, uci: 'e2e4xx' }).success).toBe(false);
  });
});

describe('attemptSchema', () => {
  const valid = { status: 'solved', movesTaken: 3, timeMs: 5000 };

  it('solved status passes', () => {
    expect(attemptSchema.safeParse(valid).success).toBe(true);
  });

  it('failed status passes', () => {
    expect(attemptSchema.safeParse({ ...valid, status: 'failed' }).success).toBe(true);
  });

  it('gave_up status passes', () => {
    expect(attemptSchema.safeParse({ ...valid, status: 'gave_up' }).success).toBe(true);
  });

  it('invalid status → error', () => {
    expect(attemptSchema.safeParse({ ...valid, status: 'quit' }).success).toBe(false);
  });

  it('missing status → error', () => {
    const { status: _, ...rest } = valid;
    expect(attemptSchema.safeParse(rest).success).toBe(false);
  });

  it('negative movesTaken → error', () => {
    expect(attemptSchema.safeParse({ ...valid, movesTaken: -1 }).success).toBe(false);
  });

  it('non-integer movesTaken → error', () => {
    expect(attemptSchema.safeParse({ ...valid, movesTaken: 1.5 }).success).toBe(false);
  });

  it('zero movesTaken passes', () => {
    expect(attemptSchema.safeParse({ ...valid, movesTaken: 0 }).success).toBe(true);
  });

  it('negative timeMs → error', () => {
    expect(attemptSchema.safeParse({ ...valid, timeMs: -1 }).success).toBe(false);
  });

  it('zero timeMs passes', () => {
    expect(attemptSchema.safeParse({ ...valid, timeMs: 0 }).success).toBe(true);
  });

  it('missing movesTaken → error', () => {
    const { movesTaken: _, ...rest } = valid;
    expect(attemptSchema.safeParse(rest).success).toBe(false);
  });

  it('missing timeMs → error', () => {
    const { timeMs: _, ...rest } = valid;
    expect(attemptSchema.safeParse(rest).success).toBe(false);
  });
});
