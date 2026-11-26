import { APP_NAME, CHEST_RULES, TICKET_RULES, TIMING_RULES } from "../config";
import { type Appearance, environmentFeatures, LEVEL_UNLOCKS, unlockLabel } from "../content/appearance";
import { CATEGORY_LABEL, SCENARIOS, SCENARIOS_BY_ID } from "../content/battles";
import { AREAS } from "../content/estate";
import { FURNISH_STEPS, HOMES, homeOf } from "../content/home";
import { itemById } from "../content/items";
import type { Places } from "../content/places";
import type { QuestCategory } from "../content/templates";
import type { AttemptStatus, OccurrenceStatus, OptionalStatus } from "../db/schema";
import {
  battleSummary,
  type BattleLoadout,
  type BattleState,
  choicesFor,
  currentIntent,
  type TurnResult,
} from "../domain/battle";
import { checkFurnish, checkUpgrade, EMPTY_ESTATE, estateBonuses } from "../domain/estate";
import { estimateDaysToLevel, levelProgress, type LevelProgress, REFERENCE_XP_PER_DAY, xpToReach } from "../domain/levels";
import { oddsSummary } from "../domain/loot";
import { energyBand, type QuestMomentumState, vitalityModifier } from "../domain/momentum";
import { describeSchedule, expectedCompletionsPerWeek } from "../domain/schedule";
import { baseStats, effectiveStats, equipmentBonus, type Focus } from "../domain/stats";
import { addDays, localDateOf } from "../domain/time";
import { attendanceXp } from "../domain/xp";
import type { Tx } from "../store/types";
import { type GameDeps, policyOf } from "./context";
import { budgetStatus, isMonetary } from "./manage";
import { Ledger } from "./ledger";
import { placesOf } from "./life";
import { equippedItems, estateTiers } from "./play";
import type { OccurrenceSnapshot, QuestDefinition } from "./quest-definition";

export interface DueView {
  occurrenceId: string;
  questId: string;
  title: string;
  category: QuestCategory;
  minimumAction: string;
  extension: string;
  mode: "photo" | "gps";
  criteria: string[];
  gpsLabel: string | null;
  opensAt: string;
  closesAt: string;
  localDate: string;
  phase: "upcoming" | "open" | "closed";
  status: OccurrenceStatus;
  optionalStatus: OptionalStatus;
  sessionId: string | null;
  sessionStartedAt: string | null;
  attendanceXp: number;
  maxXp: number;
  weekly: { completed: number; target: number } | null;
  momentum: QuestMomentumState;
  lastAttempt: { attemptId: string; status: AttemptStatus; reason: string; guidance: string | null; retryable: boolean } | null;
  inconclusiveCount: number;
  org: string;
  earns: boolean;
  /** Real money logged for this day of the task, or null if not logged yet. */
  earningCents: number | null;
  /** What this task brought in last time (to prefill), or null. */
  lastEarningCents: number | null;
}

export interface QuestView {
  id: string;
  status: "active" | "paused" | "archived";
  templateId: string | null;
  definition: QuestDefinition;
  versionNo: number;
  schedule: string;
  momentum: QuestMomentumState;
  reviewDue: boolean;
  createdAt: string;
  /** The last 28 days: scheduled days that counted (done or missed) and how many were done. */
  recent: { done: number; due: number };
}

export interface BattleView {
  id: string;
  scenarioId: string;
  mode: "practice" | "rewarded";
  status: "active" | "finished" | "abandoned";
  round: number;
  meter: number;
  capital: number;
  target: number;
  targetBonus: number;
  turns: TurnResult[];
  revealedIntent: { label: string; detail: string; weakTo: string[] } | null;
  weaknessKnown: boolean;
  choices: ReturnType<typeof choicesFor>;
  loadout: BattleLoadout;
  outcome: string | null;
  finalScore: number | null;
  rewardCredits: number;
  summary: { headline: string; notes: string[] } | null;
  startedAt: string;
}

export interface GameView {
  mode: "live" | "demo";
  appName: string;
  generatedAt: string;
  profile: {
    displayName: string;
    timezone: string;
    focus: Focus;
    appearance: Appearance;
    progress: LevelProgress;
    vitality: number;
    vitalityModifier: number;
    energy: ReturnType<typeof energyBand>;
    credits: number;
    tickets: number;
    minimumsTotal: number;
    chestProgress: number;
    schedulePaceXpPerDay: number;
    estimatedDaysToLevel10: number | null;
    referencePaceXpPerDay: number;
    deteriorationEnabled: boolean;
    dailyPenaltyCap: number;
    policyVersion: number;
    places: Places;
  };
  today: { localDate: string; due: DueView[] };
  /** Real money (never game currency), from what the owner logs. */
  money: {
    monthCents: number;
    totalCents: number;
    byOrg: { org: string; monthCents: number; totalCents: number }[];
    recent: { id: string; org: string; amountCents: number; note: string; localDate: string; title: string | null }[];
    orgs: string[];
  };
  consequences: { id: string; kind: string; explanation: string; delta: number; day: string; createdAt: string }[];
  chests: {
    unopened: { id: string; seq: number; earnedAt: string }[];
    recent: { entitlementId: string; seq: number; rarity: string; credits: number; itemId: string; duplicateCredits: number; openedAt: string }[];
    progress: number;
    perChest: number;
    odds: ReturnType<typeof oddsSummary>;
  };
  nextUnlock: { level: number; label: string; estate: string | null; xpNeeded: number } | null;
  quests: QuestView[];
  inventory: { itemId: string; quantity: number; equipped: boolean }[];
  stats: { base: Record<string, number>; equipment: Record<string, number>; effective: Record<string, number> };
  estate: {
    tiers: Record<string, number>;
    areas: { id: string; tier: number; nextCost: number | null; nextName: string | null; canUpgrade: boolean; reason: string | null }[];
    bonuses: ReturnType<typeof estateBonuses>;
    environment: string[];
    placedDecorations: string[];
    /** Where you live, how furnished it is, and what's next on the ladder. */
    home: {
      tier: number;
      name: string;
      furnished: number;
      nextFurnish: { step: number; name: string; cost: number; canBuy: boolean; reason: string | null } | null;
      nextHome: { tier: number; name: string; blurb: string; cost: number; minLevel: number; canMove: boolean; reason: string | null } | null;
    };
  };
  ventures: {
    tickets: number;
    maxStored: number;
    earnedToday: number;
    maxPerDay: number;
    scenarios: { id: string; title: string; category: string; opponent: string; objective: string; target: number }[];
    active: BattleView | null;
    recent: { id: string; scenarioId: string; mode: string; outcome: string | null; rewardCredits: number; finishedAt: string | null }[];
  };
  rewards: {
    list: {
      id: string;
      title: string;
      kind: string;
      description: string;
      amountCents: number | null;
      targetLevel: number | null;
      targetMinimums: number | null;
      unlockedAt: string | null;
      claimedAt: string | null;
      claimAmountCents: number | null;
      budgeted: boolean | null;
      notes: string;
      monetary: boolean;
    }[];
    nextLocked: { title: string; targetLevel: number | null; targetMinimums: number | null } | null;
    budget: { month: string; capCents: number | null; usedCents: number; remainingCents: number | null };
  };
  evidence: { attemptId: string; title: string; submittedAt: string; status: string; deleted: boolean; stored: boolean; reason: string }[];
  retentionDays: number;
  graceHours: number;
}

export function battleView(row: {
  id: string;
  scenario_id: string;
  mode: "practice" | "rewarded";
  status: "active" | "finished" | "abandoned";
  state: unknown;
  loadout: unknown;
  reward_credits: number;
  started_at: string;
}): BattleView {
  const scenario = SCENARIOS_BY_ID.get(row.scenario_id)!;
  const state = row.state as BattleState;
  const loadout = row.loadout as BattleLoadout;
  const active = state.status === "active" && row.status === "active";
  // Only reveal the current opponent move if the player scouted it.
  const revealed = active && state.revealedRounds.includes(state.round) ? currentIntent(scenario, state) : null;
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    mode: row.mode,
    status: row.status,
    round: state.round,
    meter: state.meter,
    capital: state.capital,
    target: state.target ?? scenario.target,
    targetBonus: state.targetBonus ?? 0,
    turns: state.turns,
    revealedIntent: revealed ? { label: revealed.label, detail: revealed.detail, weakTo: revealed.weakTo } : null,
    weaknessKnown: state.weaknessKnown,
    choices: active ? choicesFor(scenario, state, loadout) : [],
    loadout,
    outcome: state.outcome,
    finalScore: state.finalScore,
    rewardCredits: row.reward_credits,
    summary: state.status === "finished" ? battleSummary(scenario, state) : null,
    startedAt: row.started_at,
  };
}

export async function buildView(tx: Tx, deps: GameDeps, owner: string): Promise<GameView> {
  const now = deps.now();
  const ledger = await Ledger.open(tx, deps, owner);
  const p = ledger.profile;
  const policy = policyOf(p);
  const today = localDateOf(now, p.timezone);
  const progress = levelProgress(p.xp_total);

  const quests = await tx.find("quests", { owner_id: owner }, { orderBy: [["created_at", "asc"]] });
  const versionById = new Map<string, { def: QuestDefinition; versionNo: number }>();
  for (const q of quests) {
    if (q.current_version_id) {
      const v = await tx.get("quest_versions", q.current_version_id);
      if (v) versionById.set(q.id, { def: v.definition as unknown as QuestDefinition, versionNo: v.version_no });
    }
  }
  // Adherence over the last 28 days, per task: what the suggestions learn from.
  const window28 = await tx.find("quest_occurrences", { owner_id: owner, local_date: { $gte: addDays(today, -28) } });
  const recentByQuest = new Map<string, { done: number; due: number }>();
  for (const o of window28) {
    if (o.status !== "completed" && o.status !== "missed") continue;
    const r = recentByQuest.get(o.quest_id) ?? { done: 0, due: 0 };
    r.due++;
    if (o.status === "completed") r.done++;
    recentByQuest.set(o.quest_id, r);
  }
  const earnings = await tx.find("earnings", { owner_id: owner }, { orderBy: [["local_date", "desc"], ["created_at", "desc"]] });
  const earningByOcc = new Map(earnings.filter((e) => e.occurrence_id).map((e) => [e.occurrence_id!, e]));
  const lastEarningByQuest = new Map<string, number>();
  for (const e of earnings) if (e.quest_id && e.amount_cents > 0 && !lastEarningByQuest.has(e.quest_id)) lastEarningByQuest.set(e.quest_id, e.amount_cents);

  const questViews: QuestView[] = quests
    .filter((q) => versionById.has(q.id))
    .map((q) => {
      const { def, versionNo } = versionById.get(q.id)!;
      return {
        id: q.id,
        status: q.status,
        templateId: q.template_id,
        definition: def,
        versionNo,
        schedule: describeSchedule(def.schedule),
        momentum: q.momentum as QuestMomentumState,
        reviewDue: Boolean(def.reviewOn && def.reviewOn <= today && q.status !== "archived"),
        createdAt: q.created_at,
        recent: recentByQuest.get(q.id) ?? { done: 0, due: 0 },
      };
    });

  // Today's due list: windows for yesterday or today that are still relevant.
  const occs = await tx.find(
    "quest_occurrences",
    { owner_id: owner, local_date: { $gte: addDays(today, -1) } },
    { orderBy: [["opens_at", "asc"]] },
  );
  const due: DueView[] = [];
  for (const o of occs) {
    const closes = Date.parse(o.closes_at);
    const opens = Date.parse(o.opens_at);
    const isToday = o.local_date === today;
    const stillOpen = o.status === "open" && closes > now.getTime();
    const relevant = isToday || stillOpen || (o.status === "completed" && o.optional_status === "active");
    if (!relevant || (o.status === "excused" && o.resolution_note === "archived")) continue;
    const snap = o.snapshot as unknown as OccurrenceSnapshot;
    const attempts = await tx.find("verification_attempts", { occurrence_id: o.id, owner_id: owner }, { orderBy: [["submitted_at", "desc"]] });
    const last = attempts[0];
    const session = (await tx.find("optional_sessions", { occurrence_id: o.id }))[0];
    const week = o.week_id ? await tx.get("quest_weeks", o.week_id) : null;
    const quest = quests.find((q) => q.id === o.quest_id);
    due.push({
      occurrenceId: o.id,
      questId: o.quest_id,
      title: snap.title,
      category: snap.category,
      minimumAction: snap.minimumAction,
      extension: snap.extension,
      mode: snap.verification.mode,
      criteria: snap.verification.criteria,
      gpsLabel: snap.verification.gps?.label ?? null,
      opensAt: o.opens_at,
      closesAt: o.closes_at,
      localDate: o.local_date,
      phase: now.getTime() < opens ? "upcoming" : now.getTime() < closes ? "open" : "closed",
      status: o.status,
      optionalStatus: o.optional_status,
      sessionId: session?.id ?? null,
      sessionStartedAt: session?.status === "active" ? session.started_at : null,
      attendanceXp: attendanceXp(snap.maxXp),
      maxXp: snap.maxXp,
      weekly: week ? { completed: week.completed, target: week.target } : null,
      momentum: (quest?.momentum as QuestMomentumState) ?? { status: "building", consecutiveMisses: 0, consecutiveSuccesses: 0 },
      lastAttempt: last
        ? {
            attemptId: last.id,
            status: last.status,
            reason: last.reason,
            guidance: last.guidance,
            retryable:
              (last.status === "unavailable" || last.status === "pending") &&
              Boolean(last.image_path) &&
              now.getTime() < closes + TIMING_RULES.verificationGraceHours * 3_600_000,
          }
        : null,
      inconclusiveCount: attempts.filter((a) => a.status === "inconclusive").length,
      org: snap.org ?? "",
      earns: snap.earns ?? false,
      earningCents: earningByOcc.get(o.id)?.amount_cents ?? null,
      lastEarningCents: lastEarningByQuest.get(o.quest_id) ?? null,
    });
  }

  const consequences = (
    await tx.find("consequence_events", { owner_id: owner, day: { $gte: addDays(today, -14) } }, { orderBy: [["created_at", "desc"]], limit: 30 })
  ).map((c) => ({ id: c.id, kind: c.kind, explanation: c.explanation, delta: c.vitality_delta, day: c.day, createdAt: c.created_at }));

  const entitlements = await tx.find("chest_entitlements", { owner_id: owner }, { orderBy: [["seq", "asc"]] });
  const openings = await tx.find("chest_openings", { owner_id: owner }, { orderBy: [["opened_at", "desc"]], limit: 10 });
  const seqById = new Map(entitlements.map((e) => [e.id, e.seq]));

  const nextLevelUnlock = LEVEL_UNLOCKS.find((u) => u.level > progress.level && unlockLabel(u));

  const inventory = await tx.find("inventory", { owner_id: owner });
  const equipped = await equippedItems(tx, owner);
  const mod = vitalityModifier(p.vitality, policy);
  const tiers = await estateTiers(tx, owner);
  const bonuses = estateBonuses(tiers);

  const active = (await tx.find("battle_sessions", { owner_id: owner, status: "active" }))[0];
  const recentBattles = await tx.find("battle_sessions", { owner_id: owner, status: { $ne: "active" } }, {
    orderBy: [["started_at", "desc"]],
    limit: 8,
  });
  const ticketsToday = await tx.find("ticket_events", { owner_id: owner, kind: "earned", local_date: today });

  const rewards = await tx.find("rewards", { owner_id: owner, archived_at: { $null: true } }, { orderBy: [["created_at", "asc"]] });
  const claims = await tx.find("reward_claims", { owner_id: owner });
  const claimByReward = new Map(claims.map((c) => [c.reward_id, c]));
  const locked = rewards
    .filter((r) => !r.unlocked_at)
    .sort((a, b) => (a.target_level ?? 99) - (b.target_level ?? 99) || (a.target_minimums ?? 1e9) - (b.target_minimums ?? 1e9));

  const evidence = await tx.find("verification_attempts", { owner_id: owner, mode: "photo" }, { orderBy: [["submitted_at", "desc"]], limit: 30 });
  const occTitle = async (id: string) => {
    const o = await tx.get("quest_occurrences", id);
    return o ? (o.snapshot as unknown as OccurrenceSnapshot).title : "Task";
  };

  const pace = questViews
    .filter((q) => q.status === "active")
    .reduce((s, q) => s + (expectedCompletionsPerWeek(q.definition.schedule) / 7) * attendanceXp(q.definition.maxXp), 0);

  return {
    mode: deps.mode,
    appName: APP_NAME,
    generatedAt: now.toISOString(),
    profile: {
      displayName: p.display_name,
      timezone: p.timezone,
      focus: p.focus,
      appearance: p.appearance as unknown as Appearance,
      progress,
      vitality: p.vitality,
      vitalityModifier: mod,
      energy: energyBand(p.vitality),
      credits: p.credits,
      tickets: p.tickets,
      minimumsTotal: p.minimums_total,
      chestProgress: p.minimums_total % CHEST_RULES.minimumsPerChest,
      schedulePaceXpPerDay: Math.round(pace * 10) / 10,
      estimatedDaysToLevel10: progress.level >= 10 ? 0 : estimateDaysToLevel(p.xp_total, pace, 10),
      referencePaceXpPerDay: REFERENCE_XP_PER_DAY,
      deteriorationEnabled: Object.values(policy.penaltyByMiss).some((v) => v > 0) || policy.penaltyBeyond > 0,
      dailyPenaltyCap: policy.dailyPenaltyCap,
      policyVersion: policy.version,
      places: placesOf(p.places),
    },
    today: { localDate: today, due },
    money: moneyView(earnings, today, questViews),
    consequences,
    chests: {
      unopened: entitlements.filter((e) => !e.opened_at).map((e) => ({ id: e.id, seq: e.seq, earnedAt: e.earned_at })),
      recent: openings.map((o) => ({
        entitlementId: o.entitlement_id,
        seq: seqById.get(o.entitlement_id) ?? 0,
        rarity: o.rarity,
        credits: o.credits,
        itemId: o.item_id,
        duplicateCredits: o.duplicate_credits,
        openedAt: o.opened_at,
      })),
      progress: p.minimums_total % CHEST_RULES.minimumsPerChest,
      perChest: CHEST_RULES.minimumsPerChest,
      odds: oddsSummary(),
    },
    nextUnlock: nextLevelUnlock
      ? {
          level: nextLevelUnlock.level,
          label: unlockLabel(nextLevelUnlock) ?? nextLevelUnlock.label,
          estate: nextLevelUnlock.estate ?? null,
          xpNeeded: Math.max(0, xpToReach(nextLevelUnlock.level) - p.xp_total),
        }
      : null,
    quests: questViews,
    inventory: inventory.map((i) => ({ itemId: i.item_id, quantity: i.quantity, equipped: i.equipped })),
    stats: {
      base: baseStats(p.level, p.focus),
      equipment: equipmentBonus(equipped),
      effective: effectiveStats(p.level, p.focus, equipped, mod),
    },
    estate: {
      tiers,
      areas: AREAS.map((a) => {
        const tier = tiers[a.id];
        const next = a.tiers[tier];
        const check = checkUpgrade(a.id, tiers, p.level, p.credits);
        return {
          id: a.id,
          tier,
          nextCost: next?.cost ?? null,
          nextName: next?.name ?? null,
          canUpgrade: check.ok,
          reason: check.ok ? null : check.reason,
        };
      }),
      bonuses,
      environment: environmentFeatures(p.level),
      placedDecorations: inventory.filter((i) => i.kind === "decoration" && i.equipped).map((i) => i.item_id),
      home: await homeView(tx, owner, tiers.residence, p.level, p.credits),
    },
    ventures: {
      tickets: p.tickets,
      maxStored: TICKET_RULES.maxStored,
      earnedToday: ticketsToday.length,
      maxPerDay: TICKET_RULES.maxNewPerDay,
      scenarios: SCENARIOS.map((s) => ({
        id: s.id,
        title: s.title,
        category: CATEGORY_LABEL[s.category],
        opponent: s.opponent.name,
        objective: s.objective,
        target: s.target,
      })),
      active: active ? battleView(active) : null,
      recent: recentBattles.map((b) => ({
        id: b.id,
        scenarioId: b.scenario_id,
        mode: b.mode,
        outcome: b.outcome,
        rewardCredits: b.reward_credits,
        finishedAt: b.finished_at,
      })),
    },
    rewards: {
      list: rewards.map((r) => {
        const c = claimByReward.get(r.id);
        return {
          id: r.id,
          title: r.title,
          kind: r.kind,
          description: r.description,
          amountCents: r.amount_cents,
          targetLevel: r.target_level,
          targetMinimums: r.target_minimums,
          unlockedAt: r.unlocked_at,
          claimedAt: c?.claimed_at ?? null,
          claimAmountCents: c?.amount_cents ?? null,
          budgeted: c ? c.budgeted : null,
          notes: r.notes,
          monetary: isMonetary(r),
        };
      }),
      nextLocked: locked[0] ? { title: locked[0].title, targetLevel: locked[0].target_level, targetMinimums: locked[0].target_minimums } : null,
      budget: await budgetStatus(tx, ledger, now),
    },
    evidence: await Promise.all(
      evidence.map(async (a) => ({
        attemptId: a.id,
        title: await occTitle(a.occurrence_id),
        submittedAt: a.submitted_at,
        status: a.status,
        deleted: Boolean(a.image_deleted_at),
        stored: Boolean(a.image_path) && !a.image_deleted_at,
        reason: a.reason,
      })),
    ),
    retentionDays: TIMING_RULES.evidenceRetentionDays,
    graceHours: TIMING_RULES.verificationGraceHours,
  };
}

async function homeView(tx: Tx, owner: string, tier: number, level: number, credits: number): Promise<GameView["estate"]["home"]> {
  const furnished = (await tx.find("furnishings", { owner_id: owner, home_tier: tier })).length;
  const f = checkFurnish(tier, furnished, credits);
  const next = HOMES[tier + 1];
  const move = next ? checkUpgrade("residence", { ...EMPTY_ESTATE, residence: tier }, level, credits) : null;
  return {
    tier,
    name: homeOf(tier).name,
    furnished,
    nextFurnish:
      furnished >= FURNISH_STEPS.length
        ? null
        : { step: furnished + 1, name: FURNISH_STEPS[furnished], cost: homeOf(tier).furnishCosts[furnished], canBuy: f.ok, reason: f.ok ? null : f.reason },
    nextHome: next
      ? { tier: next.tier, name: next.name, blurb: next.blurb, cost: next.cost, minLevel: next.minLevel, canMove: Boolean(move?.ok), reason: move && !move.ok ? move.reason : null }
      : null,
  };
}

function moneyView(
  earnings: { id: string; org: string; amount_cents: number; note: string; local_date: string; quest_id: string | null }[],
  today: string,
  quests: QuestView[],
): GameView["money"] {
  const month = today.slice(0, 7);
  const byOrg = new Map<string, { org: string; monthCents: number; totalCents: number }>();
  let monthCents = 0;
  let totalCents = 0;
  for (const e of earnings) {
    const key = e.org || "Other";
    const o = byOrg.get(key) ?? { org: key, monthCents: 0, totalCents: 0 };
    o.totalCents += e.amount_cents;
    totalCents += e.amount_cents;
    if (e.local_date.startsWith(month)) {
      o.monthCents += e.amount_cents;
      monthCents += e.amount_cents;
    }
    byOrg.set(key, o);
  }
  const titleOf = new Map(quests.map((q) => [q.id, q.definition.title]));
  const orgs = new Set<string>();
  for (const q of quests) if (q.definition.org && q.status !== "archived") orgs.add(q.definition.org);
  for (const e of earnings) if (e.org) orgs.add(e.org);
  return {
    monthCents,
    totalCents,
    byOrg: [...byOrg.values()].filter((o) => o.totalCents > 0).sort((a, b) => b.monthCents - a.monthCents || b.totalCents - a.totalCents),
    recent: earnings
      .filter((e) => e.amount_cents > 0)
      .slice(0, 12)
      .map((e) => ({ id: e.id, org: e.org, amountCents: e.amount_cents, note: e.note, localDate: e.local_date, title: e.quest_id ? (titleOf.get(e.quest_id) ?? null) : null })),
    orgs: [...orgs].sort(),
  };
}

export function itemName(id: string) {
  return itemById(id)?.name ?? id;
}
