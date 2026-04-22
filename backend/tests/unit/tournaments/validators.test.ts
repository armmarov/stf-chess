import {
  createTournamentSchema,
  updateTournamentSchema,
  interestSchema,
} from '../../../src/modules/tournaments/tournaments.validators';

describe('createTournamentSchema', () => {
  const valid = { name: 'Chess Open', description: 'Annual tournament' };

  it('valid minimal input passes', () => {
    expect(createTournamentSchema.safeParse(valid).success).toBe(true);
  });

  it('valid full input passes', () => {
    const result = createTournamentSchema.safeParse({
      ...valid,
      registrationLink: 'https://chess.example.com/register',
      startDate: '2025-06-01',
      endDate: '2025-06-03',
    });
    expect(result.success).toBe(true);
  });

  it('missing name → error', () => {
    expect(createTournamentSchema.safeParse({ description: 'Desc' }).success).toBe(false);
  });

  it('empty string name → error', () => {
    expect(createTournamentSchema.safeParse({ name: '', description: 'Desc' }).success).toBe(false);
  });

  it('name over 200 chars → error', () => {
    expect(
      createTournamentSchema.safeParse({ name: 'a'.repeat(201), description: 'Desc' }).success,
    ).toBe(false);
  });

  it('missing description → error', () => {
    expect(createTournamentSchema.safeParse({ name: 'Test' }).success).toBe(false);
  });

  it('empty string description → error', () => {
    expect(createTournamentSchema.safeParse({ name: 'Test', description: '' }).success).toBe(false);
  });

  it('invalid registrationLink (not a URL) → error', () => {
    const result = createTournamentSchema.safeParse({ ...valid, registrationLink: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('empty string registrationLink → undefined (preprocessed)', () => {
    const result = createTournamentSchema.safeParse({ ...valid, registrationLink: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.registrationLink).toBeUndefined();
    }
  });

  it('invalid startDate format → error', () => {
    const result = createTournamentSchema.safeParse({ ...valid, startDate: '01-06-2025' });
    expect(result.success).toBe(false);
  });

  it('invalid endDate format → error', () => {
    const result = createTournamentSchema.safeParse({ ...valid, endDate: '2025/06/01' });
    expect(result.success).toBe(false);
  });

  it('valid startDate and endDate pass', () => {
    const result = createTournamentSchema.safeParse({
      ...valid,
      startDate: '2025-06-01',
      endDate: '2025-06-03',
    });
    expect(result.success).toBe(true);
  });

  it('valid place passes', () => {
    expect(createTournamentSchema.safeParse({ ...valid, place: 'City Hall' }).success).toBe(true);
  });

  it('empty string place → error (min 1)', () => {
    expect(createTournamentSchema.safeParse({ ...valid, place: '' }).success).toBe(false);
  });

  it('place over 200 chars → error', () => {
    expect(
      createTournamentSchema.safeParse({ ...valid, place: 'a'.repeat(201) }).success,
    ).toBe(false);
  });

  it('valid resultUrl passes', () => {
    expect(
      createTournamentSchema.safeParse({ ...valid, resultUrl: 'https://results.example.com' }).success,
    ).toBe(true);
  });

  it('invalid resultUrl → error', () => {
    expect(
      createTournamentSchema.safeParse({ ...valid, resultUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('empty string resultUrl → undefined (preprocessed)', () => {
    const result = createTournamentSchema.safeParse({ ...valid, resultUrl: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.resultUrl).toBeUndefined();
  });
});

describe('updateTournamentSchema', () => {
  it('empty object is valid (all fields optional)', () => {
    expect(updateTournamentSchema.safeParse({}).success).toBe(true);
  });

  it('name update only is valid', () => {
    expect(updateTournamentSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('empty string name → error', () => {
    expect(updateTournamentSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('invalid registrationLink → error', () => {
    expect(updateTournamentSchema.safeParse({ registrationLink: 'bad-link' }).success).toBe(false);
  });

  it('empty string registrationLink → null (preprocessed)', () => {
    const result = updateTournamentSchema.safeParse({ registrationLink: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.registrationLink).toBeNull();
    }
  });

  it('invalid startDate format → error', () => {
    expect(updateTournamentSchema.safeParse({ startDate: '01/06/2025' }).success).toBe(false);
  });

  it('empty string startDate → null (preprocessed)', () => {
    const result = updateTournamentSchema.safeParse({ startDate: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeNull();
    }
  });

  it('empty string endDate → null (preprocessed)', () => {
    const result = updateTournamentSchema.safeParse({ endDate: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endDate).toBeNull();
    }
  });

  it('removeImage string value is valid', () => {
    expect(updateTournamentSchema.safeParse({ removeImage: 'true' }).success).toBe(true);
  });

  it('removeBskkLetter string value is valid', () => {
    expect(updateTournamentSchema.safeParse({ removeBskkLetter: 'true' }).success).toBe(true);
  });

  it('removeKpmLetter string value is valid', () => {
    expect(updateTournamentSchema.safeParse({ removeKpmLetter: 'true' }).success).toBe(true);
  });

  it('valid resultUrl passes', () => {
    expect(
      updateTournamentSchema.safeParse({ resultUrl: 'https://results.example.com' }).success,
    ).toBe(true);
  });

  it('invalid resultUrl → error', () => {
    expect(updateTournamentSchema.safeParse({ resultUrl: 'not-a-url' }).success).toBe(false);
  });

  it('empty string resultUrl → null (preprocessed)', () => {
    const result = updateTournamentSchema.safeParse({ resultUrl: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.resultUrl).toBeNull();
  });

  it('valid place passes', () => {
    expect(updateTournamentSchema.safeParse({ place: 'Sports Complex' }).success).toBe(true);
  });

  it('empty string place → null (preprocessed)', () => {
    const result = updateTournamentSchema.safeParse({ place: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.place).toBeNull();
  });
});

describe('interestSchema', () => {
  it('{ interested: true } is valid', () => {
    expect(interestSchema.safeParse({ interested: true }).success).toBe(true);
  });

  it('{ interested: false } is valid', () => {
    expect(interestSchema.safeParse({ interested: false }).success).toBe(true);
  });

  it('missing interested → error', () => {
    expect(interestSchema.safeParse({}).success).toBe(false);
  });

  it('string "true" instead of boolean → error', () => {
    expect(interestSchema.safeParse({ interested: 'true' }).success).toBe(false);
  });

  it('number 1 instead of boolean → error', () => {
    expect(interestSchema.safeParse({ interested: 1 }).success).toBe(false);
  });
});
