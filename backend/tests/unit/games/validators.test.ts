import { createGameSchema, updateGameSchema } from '../../../src/modules/games/games.validators';

const VALID_PGN = '1. e4 e5 2. Nf3 Nc6 *';

const BASE = {
  tournamentName: 'City Open 2024',
  whitePlayer: 'Alice',
  blackPlayer: 'Bob',
  result: 'white_win' as const,
  pgn: VALID_PGN,
};

describe('createGameSchema', () => {
  it('valid minimal input passes', () => {
    expect(createGameSchema.safeParse(BASE).success).toBe(true);
  });

  it('valid full input passes', () => {
    expect(
      createGameSchema.safeParse({
        ...BASE,
        eventDate: '2024-05-20',
        whiteElo: 1800,
        blackElo: 1750,
        opening: 'Ruy Lopez',
        notes: 'An interesting game.',
      }).success,
    ).toBe(true);
  });

  describe('tournamentName', () => {
    it('missing tournamentName → error', () => {
      const { tournamentName: _, ...rest } = BASE;
      expect(createGameSchema.safeParse(rest).success).toBe(false);
    });

    it('empty tournamentName → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, tournamentName: '' }).success).toBe(false);
    });

    it('tournamentName over 200 chars → error', () => {
      expect(
        createGameSchema.safeParse({ ...BASE, tournamentName: 'a'.repeat(201) }).success,
      ).toBe(false);
    });
  });

  describe('whitePlayer / blackPlayer', () => {
    it('missing whitePlayer → error', () => {
      const { whitePlayer: _, ...rest } = BASE;
      expect(createGameSchema.safeParse(rest).success).toBe(false);
    });

    it('missing blackPlayer → error', () => {
      const { blackPlayer: _, ...rest } = BASE;
      expect(createGameSchema.safeParse(rest).success).toBe(false);
    });

    it('whitePlayer over 120 chars → error', () => {
      expect(
        createGameSchema.safeParse({ ...BASE, whitePlayer: 'a'.repeat(121) }).success,
      ).toBe(false);
    });

    it('blackPlayer over 120 chars → error', () => {
      expect(
        createGameSchema.safeParse({ ...BASE, blackPlayer: 'a'.repeat(121) }).success,
      ).toBe(false);
    });
  });

  describe('result', () => {
    it('white_win accepted', () => {
      expect(createGameSchema.safeParse({ ...BASE, result: 'white_win' }).success).toBe(true);
    });

    it('black_win accepted', () => {
      expect(createGameSchema.safeParse({ ...BASE, result: 'black_win' }).success).toBe(true);
    });

    it('draw accepted', () => {
      expect(createGameSchema.safeParse({ ...BASE, result: 'draw' }).success).toBe(true);
    });

    it('invalid result → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, result: '1-0' }).success).toBe(false);
    });

    it('missing result → error', () => {
      const { result: _, ...rest } = BASE;
      expect(createGameSchema.safeParse(rest).success).toBe(false);
    });
  });

  describe('pgn', () => {
    it('missing pgn → error', () => {
      const { pgn: _, ...rest } = BASE;
      expect(createGameSchema.safeParse(rest).success).toBe(false);
    });

    it('empty pgn → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, pgn: '' }).success).toBe(false);
    });
  });

  describe('eventDate', () => {
    it('valid YYYY-MM-DD passes', () => {
      expect(createGameSchema.safeParse({ ...BASE, eventDate: '2024-01-15' }).success).toBe(true);
    });

    it('invalid date format → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, eventDate: '15-01-2024' }).success).toBe(false);
    });

    it('non-date string → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, eventDate: 'yesterday' }).success).toBe(false);
    });

    it('omitted eventDate → valid (optional)', () => {
      const { eventDate: _, ...rest } = { ...BASE, eventDate: '2024-01-01' };
      expect(createGameSchema.safeParse(rest).success).toBe(true);
    });
  });

  describe('whiteElo / blackElo', () => {
    it('numeric Elo passes', () => {
      expect(createGameSchema.safeParse({ ...BASE, whiteElo: 1500 }).success).toBe(true);
    });

    it('string numeric Elo coerced to number', () => {
      const result = createGameSchema.safeParse({ ...BASE, whiteElo: '1500' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.whiteElo).toBe(1500);
    });

    it('empty string Elo → undefined', () => {
      const result = createGameSchema.safeParse({ ...BASE, whiteElo: '' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.whiteElo).toBeUndefined();
    });

    it('Elo below 0 → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, whiteElo: -1 }).success).toBe(false);
    });

    it('Elo above 4000 → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, blackElo: 4001 }).success).toBe(false);
    });

    it('non-integer Elo → error', () => {
      expect(createGameSchema.safeParse({ ...BASE, whiteElo: 1500.5 }).success).toBe(false);
    });
  });

  describe('opening', () => {
    it('opening over 120 chars → error', () => {
      expect(
        createGameSchema.safeParse({ ...BASE, opening: 'a'.repeat(121) }).success,
      ).toBe(false);
    });
  });

  describe('notes', () => {
    it('notes up to 10000 chars passes', () => {
      expect(
        createGameSchema.safeParse({ ...BASE, notes: 'x'.repeat(10_000) }).success,
      ).toBe(true);
    });

    it('notes over 10000 chars → error', () => {
      expect(
        createGameSchema.safeParse({ ...BASE, notes: 'x'.repeat(10_001) }).success,
      ).toBe(false);
    });
  });
});

describe('updateGameSchema', () => {
  it('empty object is valid (all optional)', () => {
    expect(updateGameSchema.safeParse({}).success).toBe(true);
  });

  it('partial update with valid fields passes', () => {
    expect(updateGameSchema.safeParse({ tournamentName: 'New Name', result: 'draw' }).success).toBe(true);
  });

  it('invalid result in update → error', () => {
    expect(updateGameSchema.safeParse({ result: 'unknown' }).success).toBe(false);
  });

  it('empty tournamentName in update → error', () => {
    expect(updateGameSchema.safeParse({ tournamentName: '' }).success).toBe(false);
  });

  it('invalid date format in update → error', () => {
    expect(updateGameSchema.safeParse({ eventDate: '01/01/2024' }).success).toBe(false);
  });

  it('Elo over 4000 in update → error', () => {
    expect(updateGameSchema.safeParse({ whiteElo: 5000 }).success).toBe(false);
  });
});
