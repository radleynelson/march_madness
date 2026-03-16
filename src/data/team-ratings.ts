// Fallback seed-based ratings (approximate AdjEM) used when Torvik data is unavailable
export const SEED_RATINGS: Record<number, number> = {
  1: 28,
  2: 24,
  3: 21,
  4: 18,
  5: 16,
  6: 14,
  7: 12,
  8: 10,
  9: 8,
  10: 7,
  11: 6,
  12: 5,
  13: 2,
  14: -1,
  15: -4,
  16: -8,
};

export function getRatingForSeed(seed: number): number {
  return SEED_RATINGS[seed] ?? 0;
}
