/**
 * Randomness. Server outcomes (chests, battle seeds) use the platform CSPRNG; anything that must be
 * replayable (battle opponent choices) uses a seeded PRNG whose seed is stored with the battle, so a
 * reload re-derives the same decision instead of rerolling.
 */

export type Rng = () => number;

/** Uniform [0, 1) from crypto.getRandomValues (browser and Node 20+). */
export function cryptoRng(): Rng {
  return () => {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    // 53 random bits.
    return (buf[0] * 2 ** 21 + (buf[1] >>> 11)) / 2 ** 53;
  };
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

/** mulberry32: small, fast, good enough for authored game choices. Not for security. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a sub-seed (e.g. per battle round) so each decision has its own stable stream. */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function weightedPick<T extends { weight: number }>(items: readonly T[], rng: Rng): T {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
  if (total <= 0) return items[0];
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

export function intBetween(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}
