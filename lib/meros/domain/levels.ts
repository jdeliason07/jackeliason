/**
 * The level curve. Level 1 starts at 0 XP. Levels 2–10 use the authoritative table below
 * (≈1.35× increasing marginal cost, normalized so Level 10 is 2,700 XP: 90 days at the reference
 * pace of three 10-XP minimums a day). Beyond Level 10, a generator keeps marginal costs increasing.
 *
 * XP never resets when leveling; the level is a pure function of total XP.
 */

export interface LevelCurveConfig {
  version: number;
  /** Marginal XP to reach levels 2..10, in order. */
  explicitMarginals: number[];
  /** Growth factor for marginal costs after the explicit table. */
  beyondGrowth: number;
  roundTo: number;
  maxLevel: number;
}

export const LEVEL_CURVE_V1: LevelCurveConfig = {
  version: 1,
  explicitMarginals: [70, 90, 125, 165, 225, 305, 410, 555, 755],
  beyondGrowth: 1.12,
  roundTo: 5,
  maxLevel: 30,
};

/** Reference routine: three daily minimums at 10 XP each. */
export const REFERENCE_XP_PER_DAY = 30;

const cache = new Map<number, number[]>();

/** cumulative[L] = total XP required to reach level L (cumulative[1] = 0). Index 0 unused. */
export function cumulativeTable(config: LevelCurveConfig = LEVEL_CURVE_V1): number[] {
  const hit = cache.get(config.version);
  if (hit) return hit;
  const table = [0, 0];
  let marginal = 0;
  for (let level = 2; level <= config.maxLevel; level++) {
    const explicit = config.explicitMarginals[level - 2];
    if (explicit !== undefined) {
      marginal = explicit;
    } else {
      const next = Math.round((marginal * config.beyondGrowth) / config.roundTo) * config.roundTo;
      marginal = Math.max(next, marginal + config.roundTo); // strictly increasing
    }
    table.push(table[level - 1] + marginal);
  }
  cache.set(config.version, table);
  return table;
}

export function xpToReach(level: number, config: LevelCurveConfig = LEVEL_CURVE_V1): number {
  const table = cumulativeTable(config);
  if (level <= 1) return 0;
  return table[Math.min(level, config.maxLevel)];
}

export function marginalCost(level: number, config: LevelCurveConfig = LEVEL_CURVE_V1): number {
  return xpToReach(level, config) - xpToReach(level - 1, config);
}

export function levelForXp(xp: number, config: LevelCurveConfig = LEVEL_CURVE_V1): number {
  const table = cumulativeTable(config);
  let level = 1;
  for (let l = 2; l <= config.maxLevel; l++) {
    if (xp >= table[l]) level = l;
    else break;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  xpTotal: number;
  /** XP earned since reaching the current level. */
  intoLevel: number;
  /** XP the current level spans (0 at the max level). */
  levelSpan: number;
  /** Total XP at which the next level is reached (null at max). */
  nextLevelAt: number | null;
  /** 0..1 */
  fraction: number;
}

export function levelProgress(xpTotal: number, config: LevelCurveConfig = LEVEL_CURVE_V1): LevelProgress {
  const level = levelForXp(xpTotal, config);
  const start = xpToReach(level, config);
  if (level >= config.maxLevel) {
    return { level, xpTotal, intoLevel: xpTotal - start, levelSpan: 0, nextLevelAt: null, fraction: 1 };
  }
  const next = xpToReach(level + 1, config);
  return {
    level,
    xpTotal,
    intoLevel: xpTotal - start,
    levelSpan: next - start,
    nextLevelAt: next,
    fraction: (xpTotal - start) / (next - start),
  };
}

/** The levels newly reached by moving from `before` to `after` XP (ascending; may be several). */
export function levelsCrossed(before: number, after: number, config: LevelCurveConfig = LEVEL_CURVE_V1): number[] {
  const from = levelForXp(before, config);
  const to = levelForXp(after, config);
  const out: number[] = [];
  for (let l = from + 1; l <= to; l++) out.push(l);
  return out;
}

/**
 * Days to reach `targetLevel` from `xpTotal` at `xpPerDay`. An estimate for the selected schedule,
 * not a promise: optional effort, misses, and schedule changes move it.
 */
export function estimateDaysToLevel(
  xpTotal: number,
  xpPerDay: number,
  targetLevel: number,
  config: LevelCurveConfig = LEVEL_CURVE_V1,
): number | null {
  if (xpPerDay <= 0) return null;
  const remaining = Math.max(0, xpToReach(targetLevel, config) - xpTotal);
  return remaining / xpPerDay;
}
