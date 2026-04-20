import {
  createPollSchema,
  updatePollSchema,
  voteSchema,
} from '../../../src/modules/polls/polls.validators';

const now = new Date();
const isoFuture = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();

const validCreate = {
  title: 'Best Opening?',
  startDate: isoFuture(-3600000),
  endDate: isoFuture(3600000),
  options: [{ label: 'e4' }, { label: 'd4' }],
};

describe('createPollSchema', () => {
  it('valid input passes', () => {
    expect(createPollSchema.safeParse(validCreate).success).toBe(true);
  });

  it('with optional description passes', () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, description: 'Pick your opening' }).success,
    ).toBe(true);
  });

  it('missing title → error', () => {
    const { title: _, ...rest } = validCreate;
    expect(createPollSchema.safeParse(rest).success).toBe(false);
  });

  it('empty string title → error', () => {
    expect(createPollSchema.safeParse({ ...validCreate, title: '' }).success).toBe(false);
  });

  it('title over 200 chars → error', () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, title: 'a'.repeat(201) }).success,
    ).toBe(false);
  });

  it('missing startDate → error', () => {
    const { startDate: _, ...rest } = validCreate;
    expect(createPollSchema.safeParse(rest).success).toBe(false);
  });

  it('missing endDate → error', () => {
    const { endDate: _, ...rest } = validCreate;
    expect(createPollSchema.safeParse(rest).success).toBe(false);
  });

  it('non-ISO startDate → error', () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, startDate: '01-06-2025' }).success,
    ).toBe(false);
  });

  it('endDate not after startDate → error', () => {
    expect(
      createPollSchema.safeParse({
        ...validCreate,
        startDate: isoFuture(7200000),
        endDate: isoFuture(3600000),
      }).success,
    ).toBe(false);
  });

  it('endDate equal to startDate → error', () => {
    const same = isoFuture(3600000);
    expect(
      createPollSchema.safeParse({ ...validCreate, startDate: same, endDate: same }).success,
    ).toBe(false);
  });

  it('missing options → error', () => {
    const { options: _, ...rest } = validCreate;
    expect(createPollSchema.safeParse(rest).success).toBe(false);
  });

  it('1 option → error (min 2)', () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, options: [{ label: 'Only' }] }).success,
    ).toBe(false);
  });

  it('11 options → error (max 10)', () => {
    expect(
      createPollSchema.safeParse({
        ...validCreate,
        options: Array.from({ length: 11 }, (_, i) => ({ label: `Opt ${i}` })),
      }).success,
    ).toBe(false);
  });

  it('10 options → valid (max boundary)', () => {
    expect(
      createPollSchema.safeParse({
        ...validCreate,
        options: Array.from({ length: 10 }, (_, i) => ({ label: `Opt ${i}` })),
      }).success,
    ).toBe(true);
  });

  it('option with empty label → error', () => {
    expect(
      createPollSchema.safeParse({
        ...validCreate,
        options: [{ label: '' }, { label: 'B' }],
      }).success,
    ).toBe(false);
  });

  it('options as JSON string is preprocessed correctly', () => {
    const result = createPollSchema.safeParse({
      ...validCreate,
      options: JSON.stringify([{ label: 'A' }, { label: 'B' }]),
    });
    expect(result.success).toBe(true);
  });

  it('invalid JSON string for options → error', () => {
    expect(
      createPollSchema.safeParse({ ...validCreate, options: 'not json' }).success,
    ).toBe(false);
  });
});

describe('updatePollSchema', () => {
  it('empty object is valid (all optional)', () => {
    expect(updatePollSchema.safeParse({}).success).toBe(true);
  });

  it('title update only is valid', () => {
    expect(updatePollSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });

  it('empty string title → error', () => {
    expect(updatePollSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('description update is valid', () => {
    expect(updatePollSchema.safeParse({ description: 'Updated' }).success).toBe(true);
  });

  it('empty string description → null (preprocessed)', () => {
    const result = updatePollSchema.safeParse({ description: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeNull();
  });

  it('valid startDate + endDate (endDate after) passes', () => {
    expect(
      updatePollSchema.safeParse({
        startDate: isoFuture(-3600000),
        endDate: isoFuture(3600000),
      }).success,
    ).toBe(true);
  });

  it('endDate before startDate (both provided) → error', () => {
    expect(
      updatePollSchema.safeParse({
        startDate: isoFuture(7200000),
        endDate: isoFuture(3600000),
      }).success,
    ).toBe(false);
  });

  it('only startDate provided (no endDate) → passes (no cross-check)', () => {
    expect(updatePollSchema.safeParse({ startDate: isoFuture(3600000) }).success).toBe(true);
  });

  it('only endDate provided (no startDate) → passes', () => {
    expect(updatePollSchema.safeParse({ endDate: isoFuture(7200000) }).success).toBe(true);
  });
});

describe('voteSchema', () => {
  it('valid UUID passes', () => {
    expect(
      voteSchema.safeParse({ optionId: '00000000-0000-0000-0000-000000000001' }).success,
    ).toBe(true);
  });

  it('missing optionId → error', () => {
    expect(voteSchema.safeParse({}).success).toBe(false);
  });

  it('non-UUID string → error', () => {
    expect(voteSchema.safeParse({ optionId: 'not-a-uuid' }).success).toBe(false);
  });

  it('number instead of string → error', () => {
    expect(voteSchema.safeParse({ optionId: 123 }).success).toBe(false);
  });
});

describe('isActive boundary math', () => {
  it('now within range → isActive true', () => {
    const startDate = new Date(Date.now() - 1000);
    const endDate = new Date(Date.now() + 1000);
    const isActive = new Date() >= startDate && new Date() <= endDate;
    expect(isActive).toBe(true);
  });

  it('now before startDate → isActive false', () => {
    const startDate = new Date(Date.now() + 60000);
    const endDate = new Date(Date.now() + 120000);
    const isActive = new Date() >= startDate && new Date() <= endDate;
    expect(isActive).toBe(false);
  });

  it('now after endDate → isActive false', () => {
    const startDate = new Date(Date.now() - 120000);
    const endDate = new Date(Date.now() - 60000);
    const isActive = new Date() >= startDate && new Date() <= endDate;
    expect(isActive).toBe(false);
  });

  it('endDate exactly now → isActive true (inclusive)', () => {
    const startDate = new Date(Date.now() - 60000);
    const endDate = new Date();
    const isActive = new Date() >= startDate && new Date() <= endDate;
    expect(isActive).toBe(true);
  });
});
