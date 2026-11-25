import { CHEST_RULES } from "../config";
import type { QuestOccurrences, VerificationAttempts } from "../db/schema";
import { attendanceXp } from "../domain/xp";
import { slotBonus, type QuestMomentumState, INITIAL_MOMENTUM } from "../domain/momentum";
import type { Tx } from "../store/types";
import { type GameDeps, GameError } from "./context";
import type { Effect, Ledger } from "./ledger";
import { evaluateOwner } from "./occurrences";
import type { OccurrenceSnapshot } from "./quest-definition";

export interface AwardSummary {
  occurrenceId: string;
  xp: number;
  levelsGained: number[];
  chestEarned: boolean;
  chestProgress: number;
  ticketEarned: boolean;
  ticketNote: string | null;
  vitalityRestored: number;
  momentumBonus: number;
  rewardsUnlocked: string[];
  effects: Effect[];
}

/**
 * The attendance award for an accepted minimum: exactly once per occurrence. Awards half of max XP,
 * progress toward a chest (one per three minimums), a battle ticket (capped), vitality restoration
 * (capped), and the momentum bonus when it applies. Optional work never triggers any of these.
 */
export async function completeMinimum(
  tx: Tx,
  deps: GameDeps,
  ledger: Ledger,
  occ: QuestOccurrences,
  attempt: VerificationAttempts,
): Promise<AwardSummary> {
  const now = deps.now();
  const snap = occ.snapshot as unknown as OccurrenceSnapshot;
  if (occ.status === "completed") throw new GameError("already_completed", "This minimum is already complete.", 409);

  const sameHabit = await tx.find("quest_occurrences", {
    owner_id: occ.owner_id,
    habit_key: occ.habit_key,
    local_date: occ.local_date,
    status: "completed",
  });
  if (sameHabit.length) {
    throw new GameError("habit_already_scored", "This habit already scored today through another copy of the task.", 409);
  }

  await tx.update("quest_occurrences", occ.id, {
    status: "completed",
    completed_at: now.toISOString(),
    verification_attempt_id: attempt.id,
  });
  occ.status = "completed";

  const effectsBefore = ledger.effects.length;
  const xp = await ledger.grantXp({
    kind: "attendance",
    amount: attendanceXp(snap.maxXp),
    sourceId: occ.id,
    occurrenceId: occ.id,
    questId: occ.quest_id,
  });

  ledger.profile.minimums_total += 1;
  ledger.markDirty();
  let chestEarned = false;
  if (ledger.profile.minimums_total % CHEST_RULES.minimumsPerChest === 0) {
    const seq = ledger.profile.minimums_total / CHEST_RULES.minimumsPerChest;
    await tx.insert("chest_entitlements", {
      id: deps.uuid(),
      owner_id: occ.owner_id,
      seq,
      source_occurrence_id: occ.id,
      earned_at: now.toISOString(),
      opened_at: null,
    });
    ledger.profile.chests_earned += 1;
    ledger.effects.push({ type: "chest", seq });
    chestEarned = true;
  }

  const ticket = await ledger.earnTicket(occ.id);
  const vitalityRestored = await ledger.vitalityRestore(occ.id, occ.quest_id, snap.title);

  let momentumBonus = 0;
  if (occ.kind === "weekly_slot" && occ.week_id) {
    const quest = await tx.get("quests", occ.quest_id);
    const state = (quest?.momentum as QuestMomentumState) ?? INITIAL_MOMENTUM;
    const bonus = slotBonus(state, ledger.policy);
    if (bonus > 0) momentumBonus += await ledger.credits("momentum", bonus, occ.id, `${snap.title}: momentum bonus`);
    const week = await tx.get("quest_weeks", occ.week_id);
    if (week && week.status === "open") {
      const completed = Math.min(week.target, week.completed + 1);
      await tx.update("quest_weeks", week.id, { completed, status: completed >= week.target ? "met" : "open" });
    }
  }

  // Evaluate now so a daily success's momentum bonus lands immediately (in chronological order).
  const beforeEval = ledger.effects.length;
  await evaluateOwner(tx, deps, ledger, now);
  for (const e of ledger.effects.slice(beforeEval)) {
    if (e.type === "credits" && e.kind === "momentum") momentumBonus += e.amount;
  }

  const rewardsUnlocked = await unlockRewards(tx, deps, ledger);
  await ledger.flush();

  return {
    occurrenceId: occ.id,
    xp: xp.amount,
    levelsGained: xp.levelsGained,
    chestEarned,
    chestProgress: ledger.profile.minimums_total % CHEST_RULES.minimumsPerChest,
    ticketEarned: ticket.earned,
    ticketNote: ticket.reason,
    vitalityRestored,
    momentumBonus,
    rewardsUnlocked,
    effects: ledger.effects.slice(effectsBefore),
  };
}

/** Mark configured real-world rewards unlocked when their level or minimum-count milestone is reached. */
export async function unlockRewards(tx: Tx, deps: GameDeps, ledger: Ledger): Promise<string[]> {
  const rewards = await tx.find("rewards", { owner_id: ledger.profile.id, unlocked_at: { $null: true }, archived_at: { $null: true } });
  const unlocked: string[] = [];
  for (const r of rewards) {
    const levelOk = r.target_level !== null && ledger.profile.level >= r.target_level;
    const countOk = r.target_minimums !== null && ledger.profile.minimums_total >= r.target_minimums;
    if (levelOk || countOk) {
      await tx.update("rewards", r.id, { unlocked_at: deps.now().toISOString(), updated_at: deps.now().toISOString() });
      unlocked.push(r.title);
      ledger.effects.push({ type: "reward_unlocked", title: r.title });
    }
  }
  return unlocked;
}
