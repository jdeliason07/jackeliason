/**
 * Meros (pronounced MAY-ross): the one place for the product's name and its versioned balance rules.
 *
 * Change APP_NAME here and every screen and the manifest follow.
 *
 * Every number that decides rewards or consequences lives in a versioned object below. The server
 * mirrors these into the database (level_config_versions, policy rows) and records the version used
 * on each event, so changing a rule later affects the future, never history.
 */

export const APP_NAME = "Meros";
export const APP_SHORT_NAME = "Meros";
export const APP_PRONUNCIATION = "MAY-ross";
export const APP_TAGLINE = "Show up. Win the day.";
export const APP_BASE_PATH = "/meros";

/** XP rules (version 1). */
export const XP_RULES = {
  version: 1,
  defaultMaxXp: 20,
  /** Max XP per quest must be a positive even integer so the 50/50 split is exact. */
  minMaxXp: 2,
  /** Capped so one quest cannot outrun the reference curve. */
  maxMaxXp: 40,
  effortRating: { min: 1, max: 10 },
} as const;

/** Momentum, misses, vitality (version 1). See lib/meros/domain/momentum.ts and README "Consequences". */
export const CONSEQUENCE_POLICY_V1 = {
  version: 1,
  /** Consecutive misses at which the quest's momentum bonus is suspended. */
  momentumSuspendAtMiss: 3,
  /** Vitality lost on miss N (consecutive, per quest). Misses beyond the last listed use `penaltyBeyond`. */
  penaltyByMiss: { 5: 2, 6: 3 } as Record<number, number>,
  penaltyBeyond: 4,
  penaltyBeyondFromMiss: 7,
  /** Most vitality that can be lost on one profile-local day, across every quest. */
  dailyPenaltyCap: 6,
  vitalityMin: 40,
  vitalityMax: 100,
  restorePerMinimum: 10,
  restoreDailyCap: 20,
  momentumBonusCredits: 5,
  /** Consecutive successes (or met weeks) that activate momentum. */
  momentumActivateAfter: 2,
  /** Battle stat multiplier at vitalityMin and vitalityMax. */
  battleModifierAtMin: 0.8,
  battleModifierAtMax: 1.0,
} as const;

export type ConsequencePolicy = {
  version: number;
  momentumSuspendAtMiss: number;
  penaltyByMiss: Record<number, number>;
  penaltyBeyond: number;
  penaltyBeyondFromMiss: number;
  dailyPenaltyCap: number;
  vitalityMin: number;
  vitalityMax: number;
  restorePerMinimum: number;
  restoreDailyCap: number;
  momentumBonusCredits: number;
  momentumActivateAfter: number;
  battleModifierAtMin: number;
  battleModifierAtMax: number;
};

/**
 * How deterioration is interpreted (documented in the README): vitality, the character's visible
 * energy, and a bounded temporary battle-strength multiplier. Never XP, level, property, or items.
 */
export const DETERIORATION_SCOPE = {
  affects: ["vitality", "visible energy", "temporary battle strength"],
  neverAffects: ["character XP", "character level", "owned estate buildings", "earned items", "real-world rewards"],
} as const;

/** Occurrence timing (version 1). */
export const TIMING_RULES = {
  version: 1,
  /** Evidence submitted inside a window may still resolve this long after the window closes. */
  verificationGraceHours: 24,
  /** An occurrence is only created at activation/resume when at least this much of its window remains. */
  minimumRemainingWindowMinutes: 60,
  /** Photo capture challenges expire after this long. */
  captureChallengeMinutes: 10,
  /** Evidence images are deleted after this many days; decision records are kept. */
  evidenceRetentionDays: 7,
} as const;

/** GPS evidence rules (version 1). */
export const GPS_RULES = {
  version: 1,
  defaultRadiusM: 150,
  minRadiusM: 50,
  maxRadiusM: 1000,
  /** Readings older than this (by the device timestamp, against server time) are stale. */
  maxReadingAgeMs: 2 * 60_000,
  /** Allowed device-clock skew into the future. */
  maxFutureSkewMs: 30_000,
  /** Readings less precise than this are never conclusive. */
  maxUsableAccuracyM: 250,
  /** An accuracy of exactly 0 or below this is implausible for a phone fix. */
  minPlausibleAccuracyM: 1,
} as const;

/** Rate limits on verification, per owner. */
export const RATE_LIMITS = {
  verificationAttemptsPer10Min: 12,
  verificationAttemptsPerDay: 80,
} as const;

/** Chests (loot table itself: lib/meros/content/loot.ts). */
export const CHEST_RULES = {
  version: 1,
  minimumsPerChest: 3,
} as const;

/** Battle tickets. */
export const TICKET_RULES = {
  version: 1,
  maxNewPerDay: 2,
  maxStored: 6,
} as const;

/** Battle payouts (Estate Credits; never XP). */
export const BATTLE_REWARDS = {
  version: 1,
  completion: 10,
  victoryBonus: 15,
  partialBonus: 5,
} as const;

/** Photo evidence limits enforced server-side. */
export const IMAGE_RULES = {
  maxBytes: 6 * 1024 * 1024,
  minDimension: 320,
  maxDimension: 4096,
  /** Images are re-encoded to at most this long edge before storage and evaluation. */
  storedLongEdge: 1280,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
