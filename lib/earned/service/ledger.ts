import { TICKET_RULES } from "../config";
import type { ConsequenceKind, Profiles, WalletKind } from "../db/schema";
import { levelForXp, levelsCrossed } from "../domain/levels";
import { cappedPenalty, restoration } from "../domain/momentum";
import type { Tx } from "../store/types";
import { type GameDeps, GameError, policyOf, profileDay } from "./context";

/**
 * Every balance change goes through here: an immutable ledger row with a unique source id, plus the
 * cached summary on the profile, inside the caller's transaction. Re-running with the same source id
 * is a no-op, so retries never double-award.
 */
export class Ledger {
  private dirty = false;
  readonly effects: Effect[] = [];

  private constructor(
    private tx: Tx,
    private deps: GameDeps,
    public profile: Profiles,
  ) {}

  static async open(tx: Tx, deps: GameDeps, ownerId: string): Promise<Ledger> {
    const profile = await tx.get("profiles", ownerId);
    if (!profile || !profile.onboarded_at) throw new GameError("not_onboarded", "Finish setup first.", 409);
    return new Ledger(tx, deps, profile);
  }

  get policy() {
    return policyOf(this.profile);
  }

  private now() {
    return this.deps.now().toISOString();
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    const { id, xp_total, level, credits, vitality, tickets, minimums_total, chests_earned } = this.profile;
    this.profile = await this.tx.update("profiles", id, {
      xp_total,
      level,
      credits,
      vitality,
      tickets,
      minimums_total,
      chests_earned,
      updated_at: this.now(),
    });
    this.dirty = false;
  }

  async grantXp(input: {
    kind: "attendance" | "effort_bonus";
    amount: number;
    sourceId: string;
    occurrenceId: string;
    questId: string;
  }): Promise<{ amount: number; levelsGained: number[] }> {
    if (input.amount <= 0) return { amount: 0, levelsGained: [] };
    const existing = await this.tx.find("xp_events", { owner_id: this.profile.id, kind: input.kind, source_id: input.sourceId });
    if (existing.length) return { amount: 0, levelsGained: [] };
    const before = this.profile.xp_total;
    const after = before + input.amount;
    const levelBefore = levelForXp(before);
    const levelAfter = levelForXp(after);
    await this.tx.insert("xp_events", {
      id: this.deps.uuid(),
      owner_id: this.profile.id,
      kind: input.kind,
      amount: input.amount,
      source_id: input.sourceId,
      occurrence_id: input.occurrenceId,
      quest_id: input.questId,
      level_before: levelBefore,
      level_after: levelAfter,
      created_at: this.now(),
    });
    this.profile.xp_total = after;
    this.profile.level = levelAfter;
    this.dirty = true;
    const levelsGained = levelsCrossed(before, after);
    this.effects.push({ type: "xp", amount: input.amount, kind: input.kind });
    if (levelsGained.length) this.effects.push({ type: "level_up", levels: levelsGained });
    return { amount: input.amount, levelsGained };
  }

  async credits(kind: WalletKind, delta: number, sourceId: string, note: string): Promise<number> {
    if (delta === 0) return 0;
    const existing = await this.tx.find("wallet_events", { owner_id: this.profile.id, kind, source_id: sourceId });
    if (existing.length) return 0;
    if (this.profile.credits + delta < 0) throw new GameError("insufficient_funds", "Not enough Estate Credits.", 409);
    await this.tx.insert("wallet_events", {
      id: this.deps.uuid(),
      owner_id: this.profile.id,
      kind,
      delta,
      source_id: sourceId,
      note,
      created_at: this.now(),
    });
    this.profile.credits += delta;
    this.dirty = true;
    this.effects.push({ type: "credits", amount: delta, kind, note });
    return delta;
  }

  /** Earn a ticket for an accepted minimum, within the daily and storage caps. */
  async earnTicket(sourceId: string): Promise<{ earned: boolean; reason: string | null }> {
    const day = profileDay(this.profile, this.deps.now());
    const existing = await this.tx.find("ticket_events", { owner_id: this.profile.id, kind: "earned", source_id: sourceId });
    if (existing.length) return { earned: false, reason: null };
    const today = await this.tx.find("ticket_events", { owner_id: this.profile.id, kind: "earned", local_date: day });
    if (today.length >= TICKET_RULES.maxNewPerDay) {
      return { earned: false, reason: `Ticket limit reached: ${TICKET_RULES.maxNewPerDay} new tickets per day.` };
    }
    if (this.profile.tickets >= TICKET_RULES.maxStored) {
      return { earned: false, reason: `You're holding the maximum of ${TICKET_RULES.maxStored} tickets.` };
    }
    await this.tx.insert("ticket_events", {
      id: this.deps.uuid(),
      owner_id: this.profile.id,
      kind: "earned",
      delta: 1,
      source_id: sourceId,
      local_date: day,
      created_at: this.now(),
    });
    this.profile.tickets += 1;
    this.dirty = true;
    this.effects.push({ type: "ticket", amount: 1 });
    return { earned: true, reason: null };
  }

  async spendTicket(sourceId: string): Promise<void> {
    const existing = await this.tx.find("ticket_events", { owner_id: this.profile.id, kind: "spent", source_id: sourceId });
    if (existing.length) return;
    if (this.profile.tickets < 1) {
      throw new GameError("insufficient_tickets", "No battle tickets. Each verified minimum earns one (up to 2 a day).", 409);
    }
    await this.tx.insert("ticket_events", {
      id: this.deps.uuid(),
      owner_id: this.profile.id,
      kind: "spent",
      delta: -1,
      source_id: sourceId,
      local_date: profileDay(this.profile, this.deps.now()),
      created_at: this.now(),
    });
    this.profile.tickets -= 1;
    this.dirty = true;
  }

  async consequence(input: {
    kind: ConsequenceKind;
    sourceId: string;
    questId: string | null;
    day: string;
    explanation: string;
    missCount?: number | null;
    vitalityRequested?: number;
    vitalityDelta?: number;
  }): Promise<boolean> {
    const existing = await this.tx.find("consequence_events", { owner_id: this.profile.id, kind: input.kind, source_id: input.sourceId });
    if (existing.length) return false;
    const delta = input.vitalityDelta ?? 0;
    await this.tx.insert("consequence_events", {
      id: this.deps.uuid(),
      owner_id: this.profile.id,
      quest_id: input.questId,
      kind: input.kind,
      source_id: input.sourceId,
      miss_count: input.missCount ?? null,
      vitality_requested: input.vitalityRequested ?? 0,
      vitality_delta: delta,
      day: input.day,
      policy_version: this.policy.version,
      explanation: input.explanation,
      created_at: this.now(),
    });
    if (delta !== 0) {
      this.profile.vitality += delta;
      this.dirty = true;
    }
    this.effects.push({ type: "consequence", kind: input.kind, delta, explanation: input.explanation });
    return true;
  }

  /** Vitality loss for a miss, after the per-day cap and the floor. Recorded even when capped to 0. */
  async vitalityLoss(sourceId: string, questId: string, day: string, requested: number, missCount: number, label: string) {
    if (requested <= 0) return 0;
    const sameDay = await this.tx.find("consequence_events", { owner_id: this.profile.id, kind: "vitality_loss", day });
    const lost = -sameDay.reduce((s, e) => s + e.vitality_delta, 0);
    const applied = cappedPenalty(requested, lost, this.profile.vitality, this.policy);
    const capped = applied < requested;
    await this.consequence({
      kind: "vitality_loss",
      sourceId,
      questId,
      day,
      missCount,
      vitalityRequested: requested,
      vitalityDelta: -applied,
      explanation:
        `${label}: miss ${missCount} in a row. Vitality −${applied}` +
        (capped ? ` (−${requested} capped: at most ${this.policy.dailyPenaltyCap} per day, never below ${this.policy.vitalityMin})` : "") +
        `. One verified minimum restores ${this.policy.restorePerMinimum}.`,
    });
    return applied;
  }

  async vitalityRestore(sourceId: string, questId: string, label: string) {
    const day = profileDay(this.profile, this.deps.now());
    const restored = await this.tx.find("consequence_events", { owner_id: this.profile.id, kind: "vitality_restored", day });
    const sum = restored.reduce((s, e) => s + e.vitality_delta, 0);
    const amount = restoration(this.profile.vitality, sum, this.policy);
    if (amount <= 0) return 0;
    await this.consequence({
      kind: "vitality_restored",
      sourceId,
      questId,
      day,
      vitalityDelta: amount,
      explanation: `${label}: verified minimum. Vitality +${amount}.`,
    });
    return amount;
  }

  markDirty() {
    this.dirty = true;
  }
}

export type Effect =
  | { type: "xp"; amount: number; kind: "attendance" | "effort_bonus" }
  | { type: "level_up"; levels: number[] }
  | { type: "credits"; amount: number; kind: WalletKind; note: string }
  | { type: "ticket"; amount: number }
  | { type: "chest"; seq: number }
  | { type: "consequence"; kind: ConsequenceKind; delta: number; explanation: string }
  | { type: "reward_unlocked"; title: string };
