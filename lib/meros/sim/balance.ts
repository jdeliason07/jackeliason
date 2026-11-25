import { randomUUID } from "node:crypto";
import { AREAS } from "../content/estate";
import { TEMPLATES_BY_ID } from "../content/templates";
import { xpToReach } from "../domain/levels";
import { seededRng } from "../domain/random";
import { addDays, zonedTimeToUtc } from "../domain/time";
import { completeWithSyntheticAcceptance, createGame, type Game } from "../service/game";
import type { QuestDefinition } from "../service/quest-definition";
import type { GameView } from "../service/view";
import { MemoryStore } from "../store/memory";

/**
 * Balance simulator: plays the real rules (in memory) day by day for a routine, using every ticket
 * on a rewarded venture with an informed strategy, opening every chest, and buying the cheapest
 * available estate upgrade whenever affordable. Used by `npm run meros:balance` and by tests.
 */

export interface Routine {
  name: string;
  quests: number;
  /** Probability each scheduled minimum is completed on a given day. */
  consistency: number;
  /** Self-rated optional effort (null = attendance only). */
  effortRating: number | null;
  /** [startDay, endDay) with no activity at all. */
  absence?: [number, number];
  playVentures: boolean;
  seed: number;
}

export interface DayRecord {
  day: number;
  level: number;
  xp: number;
  vitality: number;
  credits: number;
  chestsEarned: number;
  ticketsEarned: number;
  upgrades: number;
}

export interface SimResult {
  routine: Routine;
  days: DayRecord[];
  dayReached: Record<number, number | null>;
  creditSources: Record<string, number>;
  firstUpgradeDay: number | null;
  upgradesBy: Record<number, number>;
  battles: { played: number; victories: number };
}

const OWNER = "00000000-0000-4000-8000-0000000051a0";
const TZ = "America/Denver";
const QUESTS = ["faith-open-scriptures", "learn-open-textbook", "biz-planning-notebook", "fit-weights-out", "home-make-bed"];

function def(id: string): QuestDefinition {
  const t = TEMPLATES_BY_ID.get(id)!;
  return {
    title: t.title, category: t.category, purpose: t.purpose, why: "", minimumAction: t.minimumAction, cue: t.cue,
    extension: t.extension, schedule: { kind: "daily", window: { start: "05:00", end: "23:00" } },
    verification: { mode: "photo", criteria: t.verification.criteria.length ? t.verification.criteria : ["x visible"], gps: null },
    maxXp: 20, reviewOn: null, reviewIntervalDays: 30,
  };
}

export async function simulate(routine: Routine, totalDays = 120): Promise<SimResult> {
  const store = new MemoryStore();
  let t = zonedTimeToUtc("2026-01-05", "08:00", TZ).getTime();
  let seed = routine.seed;
  const game: Game = createGame({ store, now: () => new Date(t), rng: seededRng(routine.seed), seed: () => seed++, uuid: randomUUID, mode: "demo" });
  let k = 0;
  const run = (cmd: Parameters<Game["command"]>[1]) => game.command(OWNER, cmd, `sim-${k++}-key`);
  const roll = seededRng(routine.seed * 7 + 1);
  await run({ type: "onboard", displayName: "Sim", timezone: TZ, focus: "insight" });
  for (const id of QUESTS.slice(0, routine.quests)) await run({ type: "createQuest", templateId: id, definition: def(id), confirmDistinct: true });

  const days: DayRecord[] = [];
  const credits: Record<string, number> = { chest: 0, duplicate: 0, momentum: 0, battle: 0 };
  let firstUpgradeDay: number | null = null;
  const battles = { played: 0, victories: 0 };
  let chestsEarned = 0;
  let ticketsEarned = 0;

  for (let day = 0; day < totalDays; day++) {
    t = zonedTimeToUtc(addDays("2026-01-05", day), "08:00", TZ).getTime();
    const absent = routine.absence && day >= routine.absence[0] && day < routine.absence[1];
    let v = (await game.view(OWNER)) as GameView;
    if (!absent) {
      for (const due of v.today.due.filter((d) => d.status === "open" && d.phase === "open")) {
        if (roll() > routine.consistency) continue;
        const award = await completeWithSyntheticAcceptance(game, OWNER, due.occurrenceId);
        if (award.chestEarned) chestsEarned++;
        if (award.ticketEarned) ticketsEarned++;
        if (routine.effortRating !== null) {
          const s = await run({ type: "startOptional", occurrenceId: due.occurrenceId });
          await run({ type: "finishOptional", sessionId: (s.result as { sessionId: string }).sessionId, rating: routine.effortRating });
        }
      }
      v = (await game.view(OWNER)) as GameView;
      for (const c of v.chests.unopened) await run({ type: "openChest", entitlementId: c.id });
      v = (await game.view(OWNER)) as GameView;
      while (routine.playVentures && v.profile.tickets > 0) {
        const scenario = v.ventures.scenarios[(battles.played * 5) % v.ventures.scenarios.length];
        await run({ type: "startBattle", scenarioId: scenario.id, mode: "rewarded" });
        v = (await game.view(OWNER)) as GameView;
        while (v.ventures.active) {
          const b = v.ventures.active;
          const options = b.choices.filter((c) => c.affordable && !c.locked);
          let choice = options[0];
          if (b.revealedIntent) {
            const intent = b.revealedIntent;
            choice = options.sort((x, y) => Number(intent.weakTo.includes(y.tag)) * 10 + y.estimate - y.cost - (Number(intent.weakTo.includes(x.tag)) * 10 + x.estimate - x.cost))[0];
          } else {
            choice = options.find((c) => c.reveals && b.round < 3) ?? options.sort((x, y) => y.estimate - y.cost - (x.estimate - x.cost))[0];
          }
          const res = await run({ type: "chooseBattle", battleId: b.id, round: b.round, choiceId: choice.id });
          const done = (res.result as { battle: { status: string; outcome: string } }).battle;
          if (done.status === "finished") {
            battles.played++;
            if (done.outcome === "victory") battles.victories++;
          }
          v = (await game.view(OWNER)) as GameView;
        }
      }
      // Buy the cheapest available upgrade(s).
      for (;;) {
        const candidates = v.estate.areas.filter((a) => a.canUpgrade).sort((a, b) => a.nextCost! - b.nextCost!);
        if (!candidates.length) break;
        await run({ type: "upgradeBuilding", area: candidates[0].id });
        firstUpgradeDay ??= day + 1;
        v = (await game.view(OWNER)) as GameView;
      }
    }
    days.push({
      day: day + 1,
      level: v.profile.progress.level,
      xp: v.profile.progress.xpTotal,
      vitality: v.profile.vitality,
      credits: v.profile.credits,
      chestsEarned,
      ticketsEarned,
      upgrades: Object.values(v.estate.tiers).reduce((s, x) => s + x, 0),
    });
  }

  const wallet = await store.transaction((tx) => tx.find("wallet_events", { owner_id: OWNER }));
  for (const w of wallet) if (w.delta > 0) credits[w.kind] = (credits[w.kind] ?? 0) + w.delta;
  const dayReached: Record<number, number | null> = {};
  for (const level of [2, 5, 10, 15]) dayReached[level] = days.find((d) => d.xp >= xpToReach(level))?.day ?? null;
  const upgradesBy: Record<number, number> = {};
  for (const d of [7, 14, 30, 60, 90, 120]) upgradesBy[d] = days[Math.min(d, days.length) - 1]?.upgrades ?? 0;
  return { routine, days, dayReached, creditSources: credits, firstUpgradeDay, upgradesBy, battles };
}

export const TOTAL_UPGRADES = AREAS.length * 3;

export const ROUTINES: Routine[] = [
  { name: "Reference: 3 daily minimums, attendance only", quests: 3, consistency: 1, effortRating: null, playVentures: true, seed: 1 },
  { name: "3 daily minimums + optional effort (rating 7)", quests: 3, consistency: 1, effortRating: 7, playVentures: true, seed: 2 },
  { name: "3 daily, ~80% consistency", quests: 3, consistency: 0.8, effortRating: null, playVentures: true, seed: 3 },
  { name: "3 daily with a 9-day absence (days 30–38)", quests: 3, consistency: 1, effortRating: null, absence: [30, 39], playVentures: true, seed: 4 },
  { name: "3 daily, never plays Ventures", quests: 3, consistency: 1, effortRating: null, playVentures: false, seed: 5 },
  { name: "5 daily minimums, attendance only", quests: 5, consistency: 1, effortRating: null, playVentures: true, seed: 6 },
];
