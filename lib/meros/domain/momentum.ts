import { type ConsequencePolicy, CONSEQUENCE_POLICY_V1 } from "../config";

/**
 * Per-quest momentum and miss state, and the vitality consequences of misses.
 *
 * Units: a daily/weekday quest's unit is one scheduled occurrence; a weekly-target quest's unit is
 * one week (met or missed). Units are evaluated strictly in chronological order (by close time).
 *
 * Momentum (daily/weekday): two consecutive successes activate a +5 Estate Credits bonus, starting
 * with the second success. Once active it survives one or two misses and applies to later successes;
 * the third consecutive miss suspends it. The next success is a comeback: no bonus on it, but
 * momentum is active again from the following occurrence.
 *
 * Momentum (weekly): two met weeks activate it; once active, every qualifying slot earns +5 until
 * three consecutive weeks are missed. Meeting the target again restores it for the following week.
 *
 * Misses: 1–2 no penalty; 3–4 momentum suspended; 5 → −2 vitality; 6 → −3; 7+ → −4 each. Rest days,
 * pauses, technical blocks, and unfinished optional work are not misses. Momentum bonuses are game
 * currency, never XP.
 */

export type MomentumStatus = "building" | "active" | "suspended";

export interface QuestMomentumState {
  status: MomentumStatus;
  /** Consecutive successful units while building. */
  consecutiveSuccesses: number;
  /** Consecutive missed units (resets on success). */
  consecutiveMisses: number;
}

export const INITIAL_MOMENTUM: QuestMomentumState = { status: "building", consecutiveSuccesses: 0, consecutiveMisses: 0 };

export type MomentumEvent = "momentum_activated" | "momentum_suspended" | "momentum_restored";

export interface SuccessResult {
  state: QuestMomentumState;
  /** Daily/weekday: credits earned by this success itself. Weekly units earn per slot instead (see slotBonus). */
  bonusCredits: number;
  event: MomentumEvent | null;
}

export function applySuccess(
  state: QuestMomentumState,
  mode: "occurrence" | "week",
  policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1,
): SuccessResult {
  const bonus = policy.momentumBonusCredits;
  if (state.status === "active") {
    return {
      state: { status: "active", consecutiveSuccesses: state.consecutiveSuccesses + 1, consecutiveMisses: 0 },
      bonusCredits: mode === "occurrence" ? bonus : 0,
      event: null,
    };
  }
  if (state.status === "suspended") {
    // Comeback: no bonus now; eligible again from the next unit.
    return {
      state: { status: "active", consecutiveSuccesses: 1, consecutiveMisses: 0 },
      bonusCredits: 0,
      event: "momentum_restored",
    };
  }
  const successes = state.consecutiveSuccesses + 1;
  if (successes >= policy.momentumActivateAfter) {
    return {
      state: { status: "active", consecutiveSuccesses: successes, consecutiveMisses: 0 },
      bonusCredits: mode === "occurrence" ? bonus : 0,
      event: "momentum_activated",
    };
  }
  return { state: { status: "building", consecutiveSuccesses: successes, consecutiveMisses: 0 }, bonusCredits: 0, event: null };
}

/** Weekly-target quests: bonus for each completed slot while momentum is active. */
export function slotBonus(state: QuestMomentumState, policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1): number {
  return state.status === "active" ? policy.momentumBonusCredits : 0;
}

export interface MissResult {
  state: QuestMomentumState;
  missCount: number;
  /** Vitality loss requested by this miss before the daily cap and floor. */
  requestedPenalty: number;
  event: MomentumEvent | null;
}

export function penaltyForMiss(missCount: number, policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1): number {
  if (missCount >= policy.penaltyBeyondFromMiss) return policy.penaltyBeyond;
  return policy.penaltyByMiss[missCount] ?? 0;
}

export function applyMiss(state: QuestMomentumState, policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1): MissResult {
  const missCount = state.consecutiveMisses + 1;
  let status = state.status;
  let event: MomentumEvent | null = null;
  if (status === "active" && missCount >= policy.momentumSuspendAtMiss) {
    status = "suspended";
    event = "momentum_suspended";
  }
  if (status === "building") {
    // Building momentum needs consecutive successes; a miss starts the count over.
  }
  return {
    state: { status, consecutiveSuccesses: status === "building" ? 0 : state.consecutiveSuccesses, consecutiveMisses: missCount },
    missCount,
    requestedPenalty: penaltyForMiss(missCount, policy),
    event,
  };
}

/** The penalty actually applied after the per-day cap and the vitality floor. */
export function cappedPenalty(
  requested: number,
  alreadyLostThatDay: number,
  vitality: number,
  policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1,
): number {
  const capRoom = Math.max(0, policy.dailyPenaltyCap - alreadyLostThatDay);
  const floorRoom = Math.max(0, vitality - policy.vitalityMin);
  return Math.min(requested, capRoom, floorRoom);
}

/** Vitality restored by one accepted minimum, after the daily restoration cap and the ceiling. */
export function restoration(
  vitality: number,
  restoredToday: number,
  policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1,
): number {
  const capRoom = Math.max(0, policy.restoreDailyCap - restoredToday);
  const ceilingRoom = Math.max(0, policy.vitalityMax - vitality);
  return Math.min(policy.restorePerMinimum, capRoom, ceilingRoom);
}

/** Bounded battle multiplier: 0.80 at vitality 40 to 1.00 at vitality 100. */
export function vitalityModifier(vitality: number, policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1): number {
  const v = Math.min(policy.vitalityMax, Math.max(policy.vitalityMin, vitality));
  const t = (v - policy.vitalityMin) / (policy.vitalityMax - policy.vitalityMin);
  return Math.round((policy.battleModifierAtMin + t * (policy.battleModifierAtMax - policy.battleModifierAtMin)) * 1000) / 1000;
}

export type EnergyBand = "radiant" | "steady" | "tired" | "drained";

/** Visible energy: shown as posture and color, never humiliation. */
export function energyBand(vitality: number): EnergyBand {
  if (vitality >= 90) return "radiant";
  if (vitality >= 75) return "steady";
  if (vitality >= 55) return "tired";
  return "drained";
}

export function describeMissConsequence(missCount: number, policy: ConsequencePolicy = CONSEQUENCE_POLICY_V1): string {
  if (missCount < policy.momentumSuspendAtMiss) return "No penalty. Rest happens.";
  const deteriorationStart = Math.min(...Object.keys(policy.penaltyByMiss).map(Number), policy.penaltyBeyondFromMiss);
  if (missCount < deteriorationStart) return "Momentum bonus paused until you complete this task's minimum again.";
  return `Vitality −${penaltyForMiss(missCount, policy)} (capped at ${policy.dailyPenaltyCap} per day, never below ${policy.vitalityMin}). One verified minimum restores ${policy.restorePerMinimum}.`;
}
