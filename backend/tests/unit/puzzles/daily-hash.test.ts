// Tests the deterministic-by-date hashing logic extracted from puzzles.service.ts
// The hash function: [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0)

function dateHash(dateStr: string): number {
  return [...dateStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
}

function startIndex(dateStr: string, totalPuzzles: number): number {
  return dateHash(dateStr) % totalPuzzles;
}

describe('daily puzzle date hash', () => {
  it('is deterministic for the same date', () => {
    expect(dateHash('2026-04-21')).toBe(dateHash('2026-04-21'));
  });

  it('different dates produce different hashes (high probability)', () => {
    expect(dateHash('2026-04-21')).not.toBe(dateHash('2026-04-22'));
    expect(dateHash('2026-04-21')).not.toBe(dateHash('2026-05-21'));
    expect(dateHash('2026-04-21')).not.toBe(dateHash('2025-04-21'));
  });

  it('hash is a non-negative 32-bit integer', () => {
    const h = dateHash('2026-04-21');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('startIndex is within [0, totalPuzzles)', () => {
    for (const total of [5, 10, 100, 1000]) {
      const idx = startIndex('2026-04-21', total);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(total);
    }
  });

  it('startIndex is stable across calls', () => {
    expect(startIndex('2026-01-01', 100)).toBe(startIndex('2026-01-01', 100));
    expect(startIndex('2026-06-15', 500)).toBe(startIndex('2026-06-15', 500));
  });

  it('different dates yield different start indices (for typical pool size)', () => {
    const total = 1000;
    const a = startIndex('2026-04-21', total);
    const b = startIndex('2026-04-22', total);
    const c = startIndex('2026-04-23', total);
    // Not guaranteed to differ for all values, but for 1000 puzzles collisions are rare
    // Assert at least two of three are different
    expect(a !== b || b !== c || a !== c).toBe(true);
  });
});
