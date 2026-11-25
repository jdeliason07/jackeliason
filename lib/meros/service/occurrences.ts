import { TIMING_RULES } from "../config";
import type { QuestOccurrences, Quests, QuestVersions, QuestWeeks } from "../db/schema";
import { applyMiss, applySuccess, INITIAL_MOMENTUM, type QuestMomentumState } from "../domain/momentum";
import {
  isOfferedOn,
  prorateWeeklyTarget,
  type Schedule,
  weekBounds,
  windowFor,
  windowStartsAfterActivation,
} from "../domain/schedule";
import { addDays, compareDates, localDateOf } from "../domain/time";
import type { Tx } from "../store/types";
import type { GameDeps } from "./context";
import type { Ledger } from "./ledger";
import { type QuestDefinition, snapshotOf } from "./quest-definition";

/**
 * Occurrence lifecycle.
 *
 * Materialization creates one occurrence per offered local date, from activation forward, never
 * before it, never during a pause, never after archive. It runs on every command and from the
 * scheduled maintenance job; both are idempotent (unique per quest + date).
 *
 * Evaluation walks closed units (daily occurrences, weekly-target weeks) in chronological order,
 * exactly once each (evaluated_at), applying momentum, misses, and vitality consequences. A unit
 * whose evidence is still pending verification blocks that quest's later units until it resolves
 * or its grace period ends, so streaks are always judged in the order they happened.
 */

const HOUR = 3_600_000;

export async function versionsOf(tx: Tx, quest: Quests): Promise<QuestVersions[]> {
  return tx.find("quest_versions", { quest_id: quest.id, owner_id: quest.owner_id }, { orderBy: [["version_no", "asc"]] });
}

function def(v: QuestVersions): QuestDefinition {
  return v.definition as unknown as QuestDefinition;
}

/** The version that governs a window: the latest effective by its opening, else the first if activated mid-window. */
function versionForDate(versions: QuestVersions[], date: string): { version: QuestVersions; opensAt: Date; closesAt: Date } | null {
  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i];
    const w = windowFor(date, def(v).schedule.window, v.timezone);
    if (Date.parse(v.effective_from) <= w.opensAt.getTime()) return { version: v, ...w };
  }
  const first = versions[0];
  if (!first) return null;
  const w = windowFor(date, def(first).schedule.window, first.timezone);
  if (windowStartsAfterActivation(w.closesAt, new Date(first.effective_from))) return { version: first, ...w };
  return null;
}

interface Pause {
  paused_at: string;
  resumed_at: string | null;
}

function pausedDuring(pauses: Pause[], opensAt: Date, closesAt: Date): boolean {
  return pauses.some((p) => {
    if (Date.parse(p.paused_at) > opensAt.getTime()) return false; // prospective: open windows stay due
    if (!p.resumed_at) return true;
    return !windowStartsAfterActivation(closesAt, new Date(p.resumed_at));
  });
}

function pauseOverlaps(pauses: Pause[], from: Date, to: Date): boolean {
  return pauses.some((p) => Date.parse(p.paused_at) < to.getTime() && (!p.resumed_at || Date.parse(p.resumed_at) > from.getTime()));
}

export async function materializeQuest(tx: Tx, deps: GameDeps, quest: Quests, now: Date): Promise<number> {
  const versions = await versionsOf(tx, quest);
  if (!versions.length) return 0;
  const latest = versions[versions.length - 1];
  const today = localDateOf(now, latest.timezone);
  const start = quest.materialized_through
    ? addDays(quest.materialized_through, 1)
    : addDays(localDateOf(new Date(quest.activated_at), versions[0].timezone), -1);
  if (compareDates(start, today) > 0) return 0;
  const pauses = await tx.find("quest_pauses", { quest_id: quest.id, owner_id: quest.owner_id });
  const archivedAt = quest.archived_at ? Date.parse(quest.archived_at) : Infinity;
  let created = 0;

  for (let date = start; compareDates(date, today) <= 0; date = addDays(date, 1)) {
    const hit = versionForDate(versions, date);
    if (!hit) continue;
    const { version, opensAt, closesAt } = hit;
    const d = def(version);
    const schedule: Schedule = d.schedule;
    if (opensAt.getTime() >= archivedAt) continue;
    if (!isOfferedOn(schedule, date)) continue;
    if (pausedDuring(pauses, opensAt, closesAt)) continue;
    const existing = await tx.find("quest_occurrences", { quest_id: quest.id, local_date: date });
    if (existing.length) continue;

    let weekId: string | null = null;
    if (schedule.kind === "weekly") {
      const week = await ensureWeek(tx, deps, quest, version, date, versions, pauses);
      if (week.status !== "open" || week.completed >= week.target) continue;
      weekId = week.id;
    }

    await tx.insert("quest_occurrences", {
      id: deps.uuid(),
      owner_id: quest.owner_id,
      quest_id: quest.id,
      quest_version_id: version.id,
      habit_key: quest.habit_key,
      kind: schedule.kind === "weekly" ? "weekly_slot" : "scheduled",
      local_date: date,
      week_id: weekId,
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      timezone: version.timezone,
      snapshot: snapshotOf(d, version.version_no) as never,
      status: "open",
      optional_status: "none",
      completed_at: null,
      verification_attempt_id: null,
      evaluated_at: null,
      resolution_note: null,
      created_at: now.toISOString(),
    });
    created++;
  }
  await tx.update("quests", quest.id, { materialized_through: today, updated_at: now.toISOString() });
  return created;
}

async function ensureWeek(
  tx: Tx,
  deps: GameDeps,
  quest: Quests,
  version: QuestVersions,
  date: string,
  versions: QuestVersions[],
  pauses: Pause[],
): Promise<QuestWeeks> {
  const d = def(version);
  const schedule = d.schedule as Extract<Schedule, { kind: "weekly" }>;
  const bounds = weekBounds(date, schedule.window, version.timezone);
  const found = await tx.find("quest_weeks", { quest_id: quest.id, week_start: bounds.weekStart });
  if (found[0]) return found[0];
  const firstActive = new Date(versions[0].effective_from);
  const activeFrom = firstActive > bounds.opensAt ? firstActive : bounds.opensAt;
  let target = prorateWeeklyTarget(schedule.timesPerWeek, bounds.weekStart, activeFrom, schedule.window, version.timezone);
  // A pause that overlaps the week excuses it unless the target is still met.
  const excused = pauseOverlaps(pauses, bounds.opensAt, bounds.closesAt);
  if (target <= 0) target = 0;
  return tx.insert("quest_weeks", {
    id: deps.uuid(),
    owner_id: quest.owner_id,
    quest_id: quest.id,
    quest_version_id: version.id,
    week_start: bounds.weekStart,
    target,
    completed: 0,
    opens_at: bounds.opensAt.toISOString(),
    closes_at: bounds.closesAt.toISOString(),
    timezone: version.timezone,
    status: target === 0 ? "excused" : excused ? "open" : "open",
    evaluated_at: target === 0 ? deps.now().toISOString() : null,
    created_at: deps.now().toISOString(),
  });
}

type Unit =
  | { type: "occurrence"; questId: string; at: number; occ: QuestOccurrences }
  | { type: "week"; questId: string; at: number; week: QuestWeeks };

const graceMs = () => TIMING_RULES.verificationGraceHours * HOUR;

/** Resolve closed occurrences, then evaluate units chronologically. Idempotent. */
export async function evaluateOwner(tx: Tx, deps: GameDeps, ledger: Ledger, now: Date): Promise<void> {
  const owner = ledger.profile.id;
  const quests = await tx.find("quests", { owner_id: owner });
  const questById = new Map(quests.map((q) => [q.id, q]));
  const nowMs = now.getTime();

  // Expire optional sessions whose occurrence window closed.
  const sessions = await tx.find("optional_sessions", { owner_id: owner, status: "active", ends_at: { $lte: now.toISOString() } });
  for (const s of sessions) {
    await tx.update("optional_sessions", s.id, { status: "expired", finished_at: s.ends_at });
    await tx.update("quest_occurrences", s.occurrence_id, { optional_status: "expired" });
  }

  const units: Unit[] = [];
  const blocked = new Set<string>();

  // Occurrences: completed-but-unevaluated, or closed-and-open.
  const occs = await tx.find("quest_occurrences", { owner_id: owner, evaluated_at: { $null: true } }, { orderBy: [["closes_at", "asc"]] });
  for (const occ of occs) {
    const closes = Date.parse(occ.closes_at);
    if (occ.status === "open" && closes <= nowMs) {
      const attempts = await tx.find("verification_attempts", { occurrence_id: occ.id, owner_id: owner });
      const unresolved = attempts.filter(
        (a) => (a.status === "pending" || a.status === "unavailable") && Date.parse(a.submitted_at) < closes,
      );
      if (unresolved.length && nowMs < closes + graceMs()) {
        blocked.add(occ.quest_id); // waits: evidence submitted in time is still resolving
        continue;
      }
      if (unresolved.length) {
        for (const a of unresolved) {
          await tx.update("verification_attempts", a.id, {
            status: "excused",
            reason: "Verification couldn't complete before the grace period ended. No XP, and not counted as a miss.",
            decided_at: now.toISOString(),
          });
        }
        occ.status = "excused";
        occ.resolution_note = "technical";
        await tx.update("quest_occurrences", occ.id, { status: "excused", resolution_note: "technical" });
        await ledger.consequence({
          kind: "technical_excuse",
          sourceId: occ.id,
          questId: occ.quest_id,
          day: localDateOf(closes, ledger.profile.timezone),
          explanation: `${(occ.snapshot as { title: string }).title}: verification was unavailable, so this day is excused (no XP, no miss).`,
        });
      } else if (occ.kind === "weekly_slot") {
        occ.status = "lapsed";
        await tx.update("quest_occurrences", occ.id, { status: "lapsed", evaluated_at: now.toISOString() });
        continue; // empty weekly slots are never misses on their own
      } else {
        occ.status = "missed";
        await tx.update("quest_occurrences", occ.id, { status: "missed" });
      }
    }
    if (occ.kind === "weekly_slot") {
      if (occ.status !== "open") await tx.update("quest_occurrences", occ.id, { evaluated_at: now.toISOString() });
      continue;
    }
    if (occ.status === "open") continue; // still in its window
    units.push({ type: "occurrence", questId: occ.quest_id, at: closes, occ });
  }

  // Weeks: met-but-unevaluated, or closed.
  const weeks = await tx.find("quest_weeks", { owner_id: owner, evaluated_at: { $null: true } }, { orderBy: [["closes_at", "asc"]] });
  for (const week of weeks) {
    const closes = Date.parse(week.closes_at);
    if (week.status === "met") {
      units.push({ type: "week", questId: week.quest_id, at: closes, week });
      continue;
    }
    if (closes > nowMs) continue;
    // Wait for evidence still resolving in that week.
    const slots = await tx.find("quest_occurrences", { week_id: week.id, owner_id: owner });
    if (slots.some((s) => s.status === "open")) {
      blocked.add(week.quest_id);
      continue;
    }
    const pauses = await tx.find("quest_pauses", { quest_id: week.quest_id, owner_id: owner });
    const excused = pauseOverlaps(pauses, new Date(week.opens_at), new Date(week.closes_at));
    const status = week.completed >= week.target ? "met" : excused ? "excused" : "missed";
    week.status = status;
    await tx.update("quest_weeks", week.id, { status });
    units.push({ type: "week", questId: week.quest_id, at: closes, week });
  }

  units.sort((a, b) => a.at - b.at);
  const stopped = new Set<string>();
  for (const unit of units) {
    const quest = questById.get(unit.questId);
    if (!quest) continue;
    if (stopped.has(quest.id)) continue;
    // Strict order: a blocked earlier unit stops later ones for that quest.
    if (blocked.has(quest.id) && (await hasEarlierBlocked(tx, owner, quest.id, unit.at, nowMs))) {
      stopped.add(quest.id);
      continue;
    }
    await evaluateUnit(tx, deps, ledger, quest, unit, now);
  }
}

async function hasEarlierBlocked(tx: Tx, owner: string, questId: string, at: number, nowMs: number): Promise<boolean> {
  const open = await tx.find("quest_occurrences", {
    owner_id: owner,
    quest_id: questId,
    status: "open",
    closes_at: { $lte: new Date(Math.min(at, nowMs)).toISOString() },
  });
  return open.length > 0;
}

async function evaluateUnit(tx: Tx, deps: GameDeps, ledger: Ledger, quest: Quests, unit: Unit, now: Date) {
  const policy = ledger.policy;
  let state: QuestMomentumState = (quest.momentum as QuestMomentumState) ?? INITIAL_MOMENTUM;
  const title = unit.type === "occurrence" ? (unit.occ.snapshot as { title: string }).title : await questTitle(tx, quest);
  const day = localDateOf(unit.at, ledger.profile.timezone);
  const sourceId = unit.type === "occurrence" ? unit.occ.id : unit.week.id;
  const status = unit.type === "occurrence" ? unit.occ.status : unit.week.status;

  if (status === "completed" || status === "met") {
    const result = applySuccess(state, unit.type === "occurrence" ? "occurrence" : "week", policy);
    if (result.bonusCredits > 0) {
      await ledger.credits("momentum", result.bonusCredits, sourceId, `${title}: momentum bonus`);
    }
    if (unit.type === "week") {
      await ledger.consequence({ kind: "week_met", sourceId, questId: quest.id, day, explanation: `${title}: weekly target met (${unit.week.completed}/${unit.week.target}). Miss count reset.` });
    }
    if (result.event === "momentum_activated") {
      await ledger.consequence({
        kind: "momentum_activated",
        sourceId,
        questId: quest.id,
        day,
        explanation: `${title}: momentum active. +${policy.momentumBonusCredits} Estate Credits on ${unit.type === "occurrence" ? "each success" : "each slot from next week"}.`,
      });
    }
    if (result.event === "momentum_restored") {
      await ledger.consequence({
        kind: "momentum_restored",
        sourceId,
        questId: quest.id,
        day,
        explanation: `${title}: comeback! Momentum bonus returns ${unit.type === "occurrence" ? "from the next occurrence" : "next week"}.`,
      });
    }
    state = result.state;
  } else if (status === "missed") {
    const miss = applyMiss(state, policy);
    await ledger.consequence({
      kind: unit.type === "occurrence" ? "miss" : "week_missed",
      sourceId,
      questId: quest.id,
      day,
      missCount: miss.missCount,
      explanation:
        unit.type === "occurrence"
          ? `${title}: missed (${miss.missCount} in a row).`
          : `${title}: week ended at ${unit.week.completed}/${unit.week.target} (${miss.missCount} week${miss.missCount === 1 ? "" : "s"} in a row).`,
    });
    if (miss.event === "momentum_suspended") {
      await ledger.consequence({
        kind: "momentum_suspended",
        sourceId,
        questId: quest.id,
        day,
        missCount: miss.missCount,
        explanation: `${title}: momentum bonus paused after ${miss.missCount} misses. Complete the minimum once to bring it back.`,
      });
    }
    if (miss.requestedPenalty > 0) {
      await ledger.vitalityLoss(sourceId, quest.id, day, miss.requestedPenalty, miss.missCount, title);
    }
    state = miss.state;
  }
  // excused: no state change.

  if (unit.type === "occurrence") await tx.update("quest_occurrences", unit.occ.id, { evaluated_at: now.toISOString() });
  else await tx.update("quest_weeks", unit.week.id, { evaluated_at: now.toISOString() });
  quest.momentum = state as never;
  await tx.update("quests", quest.id, { momentum: state as never, updated_at: now.toISOString() });
}

async function questTitle(tx: Tx, quest: Quests): Promise<string> {
  if (!quest.current_version_id) return "Quest";
  const v = await tx.get("quest_versions", quest.current_version_id);
  return v ? def(v).title : "Quest";
}

/** Materialize every quest and evaluate. Called at the start of every command and by maintenance. */
export async function catchUp(tx: Tx, deps: GameDeps, ledger: Ledger, now: Date): Promise<void> {
  const quests = await tx.find("quests", { owner_id: ledger.profile.id });
  for (const quest of quests) {
    if (quest.status === "archived" && quest.materialized_through && quest.archived_at) {
      // Archived quests only need materializing up to the archive moment.
      const latestDate = localDateOf(new Date(quest.archived_at), "UTC");
      if (compareDates(quest.materialized_through, addDays(latestDate, 1)) >= 0) continue;
    }
    await materializeQuest(tx, deps, quest, now);
  }
  await evaluateOwner(tx, deps, ledger, now);
  await tx.update("profiles", ledger.profile.id, { last_catchup_at: now.toISOString() });
  ledger.profile.last_catchup_at = now.toISOString();
}
