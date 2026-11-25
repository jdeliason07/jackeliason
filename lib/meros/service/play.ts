import { BATTLE_REWARDS } from "../config";
import { SCENARIOS_BY_ID } from "../content/battles";
import type { AreaId } from "../content/estate";
import { itemById, type ItemDefinition } from "../content/items";
import type { BattleSessions } from "../db/schema";
import {
  applyChoice,
  type BattleLoadout,
  BattleRuleError,
  type BattleState,
  startBattle as engineStart,
} from "../domain/battle";
import { checkUpgrade, EMPTY_ESTATE, estateBonuses, type EstateTiers } from "../domain/estate";
import { resolveChest } from "../domain/loot";
import { vitalityModifier } from "../domain/momentum";
import { effectiveStats, type Focus } from "../domain/stats";
import { effortBonusXp, isValidEffortRating } from "../domain/xp";
import type { Tx } from "../store/types";
import { type GameDeps, GameError } from "./context";
import type { Ledger } from "./ledger";
import type { OccurrenceSnapshot } from "./quest-definition";
import { loadOwnedOccurrence } from "./verification";

// ───────────────────────── optional sessions ─────────────────────────

export async function startOptional(tx: Tx, deps: GameDeps, owner: string, occurrenceId: string) {
  const now = deps.now();
  const occ = await loadOwnedOccurrence(tx, owner, occurrenceId);
  if (occ.status !== "completed") throw new GameError("invalid_input", "Verify the minimum first; optional work comes after.", 409);
  const existing = await tx.find("optional_sessions", { occurrence_id: occ.id });
  if (existing[0]) return existing[0];
  if (occ.optional_status !== "none") throw new GameError("conflict", "Extra work is already closed for this task today.", 409);
  if (now.getTime() >= Date.parse(occ.closes_at)) {
    throw new GameError("window_closed", "This task's window has closed. Optional work counts only inside it.", 409);
  }
  const session = await tx.insert("optional_sessions", {
    id: deps.uuid(),
    owner_id: owner,
    occurrence_id: occ.id,
    status: "active",
    started_at: now.toISOString(),
    ends_at: occ.closes_at,
    finished_at: null,
    rating: null,
    bonus_xp: 0,
    created_at: now.toISOString(),
  });
  await tx.update("quest_occurrences", occ.id, { optional_status: "active" });
  return session;
}

/**
 * Finish optional work. A rating 1–10 awards round(rating/10 × maxXP/2) once; no rating ("Done for
 * today") awards nothing and loses nothing. The rating is self-reported, never verified.
 */
export async function finishOptional(tx: Tx, deps: GameDeps, ledger: Ledger, sessionId: string, rating: number | null) {
  const now = deps.now();
  const session = await tx.get("optional_sessions", sessionId);
  if (!session || session.owner_id !== ledger.profile.id) throw new GameError("not_found", "Session not found.", 404);
  if (session.status !== "active") return { session, bonusXp: session.bonus_xp, levelsGained: [] as number[] };
  if (rating !== null && !isValidEffortRating(rating)) throw new GameError("invalid_input", "Rate effort from 1 to 10.");
  const occ = await loadOwnedOccurrence(tx, ledger.profile.id, session.occurrence_id);
  if (now.getTime() >= Date.parse(session.ends_at)) {
    const expired = await tx.update("optional_sessions", session.id, { status: "expired", finished_at: session.ends_at });
    await tx.update("quest_occurrences", occ.id, { optional_status: "expired" });
    return { session: expired, bonusXp: 0, levelsGained: [] as number[] };
  }
  const snap = occ.snapshot as unknown as OccurrenceSnapshot;
  const bonus = rating === null ? 0 : effortBonusXp(rating, snap.maxXp);
  const updated = await tx.update("optional_sessions", session.id, {
    status: rating === null ? "abandoned" : "finished",
    finished_at: now.toISOString(),
    rating,
    bonus_xp: bonus,
  });
  await tx.update("quest_occurrences", occ.id, { optional_status: rating === null ? "abandoned" : "finished" });
  const xp = await ledger.grantXp({ kind: "effort_bonus", amount: bonus, sourceId: session.id, occurrenceId: occ.id, questId: occ.quest_id });
  return { session: updated, bonusXp: xp.amount, levelsGained: xp.levelsGained };
}

export async function declineOptional(tx: Tx, deps: GameDeps, owner: string, occurrenceId: string) {
  const occ = await loadOwnedOccurrence(tx, owner, occurrenceId);
  if (occ.status !== "completed") throw new GameError("invalid_input", "Nothing to close yet.", 409);
  if (occ.optional_status === "none") await tx.update("quest_occurrences", occ.id, { optional_status: "declined" });
  return { occurrenceId };
}

// ───────────────────────── chests ─────────────────────────

export async function openChest(tx: Tx, deps: GameDeps, ledger: Ledger, entitlementId: string) {
  const owner = ledger.profile.id;
  const ent = await tx.get("chest_entitlements", entitlementId);
  if (!ent || ent.owner_id !== owner) throw new GameError("not_found", "Chest not found.", 404);
  const prior = await tx.find("chest_openings", { entitlement_id: ent.id });
  if (prior[0]) return { opening: prior[0], replay: true };

  const inventory = await tx.find("inventory", { owner_id: owner });
  const owned = new Set(inventory.filter((i) => itemById(i.item_id)?.unique).map((i) => i.item_id));
  const outcome = resolveChest(deps.rng, owned);
  const now = deps.now().toISOString();
  // Save the outcome before anything is revealed; animations replay this saved result.
  const opening = await tx.insert("chest_openings", {
    id: deps.uuid(),
    owner_id: owner,
    entitlement_id: ent.id,
    loot_table_version: outcome.lootTableVersion,
    rarity: outcome.rarity,
    credits: outcome.credits,
    item_id: outcome.itemId,
    duplicate_credits: outcome.duplicateCredits,
    opened_at: now,
  });
  await tx.update("chest_entitlements", ent.id, { opened_at: now });
  await ledger.credits("chest", outcome.credits, ent.id, `Chest #${ent.seq}`);
  const item = itemById(outcome.itemId)!;
  if (outcome.duplicateCredits > 0) {
    await ledger.credits("duplicate", outcome.duplicateCredits, ent.id, `Duplicate ${item.name} converted`);
  } else {
    const have = inventory.find((i) => i.item_id === item.id);
    if (have) await tx.update("inventory", have.id, { quantity: have.quantity + 1, updated_at: now });
    else {
      await tx.insert("inventory", {
        id: deps.uuid(),
        owner_id: owner,
        item_id: item.id,
        kind: item.kind,
        slot: item.slot ?? null,
        quantity: 1,
        equipped: false,
        first_acquired_at: now,
        updated_at: now,
      });
    }
  }
  return { opening, replay: false };
}

// ───────────────────────── inventory ─────────────────────────

export async function setEquipped(tx: Tx, deps: GameDeps, owner: string, itemId: string, equipped: boolean) {
  const rows = await tx.find("inventory", { owner_id: owner, item_id: itemId });
  const row = rows[0];
  const item = itemById(itemId);
  if (!row || !item) throw new GameError("not_found", "You don't own that item.", 404);
  const now = deps.now().toISOString();
  if (item.kind === "component") throw new GameError("invalid_input", "Components go in your collection; they can't be equipped.");
  if (row.equipped === equipped) return row;
  if (equipped && item.kind === "cosmetic") {
    const same = await tx.find("inventory", { owner_id: owner, slot: item.slot!, equipped: true, kind: "cosmetic" });
    for (const other of same) await tx.update("inventory", other.id, { equipped: false, updated_at: now });
  }
  if (equipped && item.kind === "decoration") {
    const tiers = await estateTiers(tx, owner);
    const placed = await tx.find("inventory", { owner_id: owner, kind: "decoration", equipped: true });
    const slots = estateBonuses(tiers).decorationSlots;
    if (placed.length >= slots) {
      throw new GameError("locked", `All ${slots} decoration slots are used. Upgrade the Residence or Gardens for more, or remove one.`, 409);
    }
  }
  return tx.update("inventory", row.id, { equipped, updated_at: now });
}

export async function equippedItems(tx: Tx, owner: string): Promise<ItemDefinition[]> {
  const rows = await tx.find("inventory", { owner_id: owner, kind: "cosmetic", equipped: true });
  return rows.map((r) => itemById(r.item_id)).filter((x): x is ItemDefinition => Boolean(x));
}

// ───────────────────────── estate ─────────────────────────

export async function estateTiers(tx: Tx, owner: string): Promise<EstateTiers> {
  const rows = await tx.find("estate_buildings", { owner_id: owner });
  const tiers: EstateTiers = { ...EMPTY_ESTATE };
  for (const r of rows) tiers[r.area as AreaId] = Math.max(tiers[r.area as AreaId], r.tier);
  return tiers;
}

export async function upgradeBuilding(tx: Tx, deps: GameDeps, ledger: Ledger, area: string) {
  const owner = ledger.profile.id;
  const tiers = await estateTiers(tx, owner);
  const check = checkUpgrade(area, tiers, ledger.profile.level, ledger.profile.credits);
  if (!check.ok) {
    throw new GameError(check.code === "funds" ? "insufficient_funds" : "locked", check.reason, 409, { code: check.code });
  }
  const id = deps.uuid();
  await tx.insert("estate_buildings", {
    id,
    owner_id: owner,
    area: check.area.id,
    tier: check.tier,
    cost: check.cost,
    purchased_at: deps.now().toISOString(),
  });
  await ledger.credits("purchase", -check.cost, id, `${check.area.tiers[check.tier - 1].name}`);
  return { area: check.area.id, tier: check.tier, name: check.area.tiers[check.tier - 1].name };
}

// ───────────────────────── ventures ─────────────────────────

export async function loadoutFor(tx: Tx, ledger: Ledger): Promise<BattleLoadout> {
  const owner = ledger.profile.id;
  const mod = vitalityModifier(ledger.profile.vitality, ledger.policy);
  const items = await equippedItems(tx, owner);
  const bonuses = estateBonuses(await estateTiers(tx, owner));
  return {
    stats: effectiveStats(ledger.profile.level, ledger.profile.focus as Focus, items, mod),
    tactic: bonuses.tactic,
    startingCapital: bonuses.startingCapital,
    vitalityModifier: mod,
  };
}

export async function startBattle(tx: Tx, deps: GameDeps, ledger: Ledger, scenarioId: string, mode: "practice" | "rewarded") {
  const owner = ledger.profile.id;
  const scenario = SCENARIOS_BY_ID.get(scenarioId);
  if (!scenario) throw new GameError("not_found", "Unknown venture.", 404);
  const active = await tx.find("battle_sessions", { owner_id: owner, status: "active" });
  if (active[0]) {
    if (active[0].scenario_id === scenarioId && active[0].mode === mode) return { battle: active[0], resumed: true };
    throw new GameError("battle_in_progress", "Finish or forfeit your current venture first.", 409, { battleId: active[0].id });
  }
  const id = deps.uuid();
  if (mode === "rewarded") await ledger.spendTicket(id);
  const loadout = await loadoutFor(tx, ledger);
  const seed = deps.seed() >>> 0;
  const state = engineStart(scenario, loadout, seed);
  const battle = await tx.insert("battle_sessions", {
    id,
    owner_id: owner,
    scenario_id: scenario.id,
    scenario_version: scenario.version,
    mode,
    status: "active",
    seed,
    state: state as never,
    loadout: loadout as never,
    ticket_source_id: mode === "rewarded" ? id : null,
    reward_credits: 0,
    outcome: null,
    started_at: deps.now().toISOString(),
    finished_at: null,
  });
  return { battle, resumed: false };
}

export async function chooseBattle(tx: Tx, deps: GameDeps, ledger: Ledger, battleId: string, round: number, choiceId: string) {
  const owner = ledger.profile.id;
  const battle = await tx.get("battle_sessions", battleId);
  if (!battle || battle.owner_id !== owner) throw new GameError("not_found", "Venture not found.", 404);
  const played = await tx.find("battle_turns", { battle_id: battle.id, round });
  if (played[0]) {
    // A retried request for a round already played: same choice is a replay; a different one is refused.
    if (played[0].choice_id === choiceId) return { battle, replay: true };
    throw new GameError("battle_rule", "That round was already played.", 409);
  }
  if (battle.status !== "active") throw new GameError("battle_rule", "This venture is already decided.", 409);
  const scenario = SCENARIOS_BY_ID.get(battle.scenario_id)!;
  const state = battle.state as unknown as BattleState;
  const loadout = battle.loadout as unknown as BattleLoadout; // frozen at start: no mid-battle rerolls
  let next;
  try {
    next = applyChoice(scenario, state, loadout, round, choiceId);
  } catch (error) {
    if (error instanceof BattleRuleError) throw new GameError("battle_rule", error.message, 409, { code: error.code });
    throw error;
  }
  const now = deps.now().toISOString();
  await tx.insert("battle_turns", {
    id: deps.uuid(),
    owner_id: owner,
    battle_id: battle.id,
    round,
    intent_id: next.turn.intentId,
    choice_id: choiceId,
    result: next.turn as never,
    created_at: now,
  });
  const patch: Partial<BattleSessions> = { state: next.state as never };
  if (next.state.status === "finished") {
    patch.status = "finished";
    patch.outcome = next.state.outcome;
    patch.finished_at = now;
    if (battle.mode === "rewarded") {
      const bonus =
        next.state.outcome === "victory" ? BATTLE_REWARDS.victoryBonus : next.state.outcome === "partial" ? BATTLE_REWARDS.partialBonus : 0;
      const total = BATTLE_REWARDS.completion + bonus;
      await ledger.credits("battle", total, battle.id, `${scenario.title}: ${next.state.outcome}`);
      patch.reward_credits = total;
    }
  }
  const updated = await tx.update("battle_sessions", battle.id, patch);
  return { battle: updated, replay: false };
}

export async function forfeitBattle(tx: Tx, deps: GameDeps, owner: string, battleId: string) {
  const battle = await tx.get("battle_sessions", battleId);
  if (!battle || battle.owner_id !== owner) throw new GameError("not_found", "Venture not found.", 404);
  if (battle.status !== "active") return battle;
  return tx.update("battle_sessions", battle.id, { status: "abandoned", finished_at: deps.now().toISOString() });
}
