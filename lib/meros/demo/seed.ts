import { DEFAULT_APPEARANCE } from "../content/appearance";
import { TEMPLATES_BY_ID } from "../content/templates";
import { cryptoRng, randomSeed, seededRng } from "../domain/random";
import { addDays, localDateOf, zonedTimeToUtc } from "../domain/time";
import { createGame, completeWithSyntheticAcceptance, type Game } from "../service/game";
import type { QuestDefinition } from "../service/quest-definition";
import type { GameView } from "../service/view";
import { MemoryStore } from "../store/memory";

/**
 * Demo mode: the real game rules running in the browser on synthetic data. Nothing here talks to
 * a server, and demo attempts are flagged `demo` (the production database rejects such rows), so
 * demo play can never grant anything in a real account.
 */

export const DEMO_OWNER = "00000000-0000-4000-8000-00000000d3e0";
export const DEMO_STORAGE_KEY = "meros-demo-v2";

export interface DemoClock {
  offsetMs: number;
  now(): Date;
}

export function demoClock(offsetMs = 0): DemoClock {
  return {
    offsetMs,
    now() {
      return new Date(Date.now() + this.offsetMs);
    },
  };
}

export function demoGame(store: MemoryStore, clock: DemoClock, rngSeed?: number): Game {
  return createGame({
    store,
    now: () => clock.now(),
    rng: rngSeed === undefined ? cryptoRng() : seededRng(rngSeed),
    seed: randomSeed,
    uuid: () => globalThis.crypto.randomUUID(),
    mode: "demo",
  });
}

function defFor(templateId: string, overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  const t = TEMPLATES_BY_ID.get(templateId)!;
  return {
    title: t.title,
    category: t.category,
    purpose: t.purpose,
    why: "Demo quest",
    minimumAction: t.minimumAction,
    cue: t.cue,
    extension: t.extension,
    schedule: t.schedule,
    verification: {
      mode: t.verification.mode,
      criteria: t.verification.criteria,
      // Synthetic coordinates for the demo only (a public park). Real quests require the owner to set their own.
      gps: t.verification.mode === "gps" ? { lat: 40.2338, lng: -111.6585, radiusM: 150, label: "Demo gym" } : null,
    },
    maxXp: t.maxXp,
    reviewOn: null,
    reviewIntervalDays: t.reviewIntervalDays,
    ...overrides,
  };
}

let keyCounter = 0;
const key = () => `demo-seed-${Date.now().toString(36)}-${(keyCounter++).toString(36)}`;

/**
 * Builds a believable two-week history by actually playing it through the rules: daily check-ins
 * (a few missed), chests opened, an estate upgrade, one venture. The result is a level-4 founder.
 */
export async function seedDemo(timezone: string): Promise<MemoryStore> {
  const store = new MemoryStore();
  const realNow = Date.now();
  const startDay = addDays(localDateOf(realNow, timezone), -14);
  const clock = { offsetMs: zonedTimeToUtc(startDay, "07:00", timezone).getTime() - realNow, now() { return new Date(Date.now() + this.offsetMs); } };
  const game = demoGame(store, clock, 7);
  const run = (cmd: Parameters<Game["command"]>[1]) => game.command(DEMO_OWNER, cmd, key());

  await run({ type: "onboard", displayName: "Demo Founder", timezone, focus: "insight", appearance: { ...DEFAULT_APPEARANCE, outfitColor: "#1A1A1E", background: "crimson" } });
  const daily = { start: "05:00", end: "23:00" };
  for (const id of ["faith-open-scriptures", "learn-open-textbook", "biz-planning-notebook"]) {
    await run({ type: "createQuest", templateId: id, definition: defFor(id, { schedule: { kind: "daily", window: daily } }), confirmDistinct: true });
  }
  await run({
    type: "createQuest",
    templateId: "fit-enter-gym",
    definition: defFor("fit-enter-gym", { schedule: { kind: "weekly", timesPerWeek: 3, window: daily } }),
    confirmDistinct: true,
  });
  await run({
    type: "saveReward",
    reward: { id: null, title: "New running shoes", kind: "money", description: "Self-funded from the monthly allocation.", amountCents: 9000, targetLevel: 5, targetMinimums: null, notes: "" },
  });
  await run({
    type: "saveReward",
    reward: { id: null, title: "Day hike with friends", kind: "experience", description: "Pick a canyon and go.", amountCents: null, targetLevel: 3, targetMinimums: null, notes: "" },
  });

  const skip = new Set([3, 4, 9]); // a few honest misses
  for (let day = 0; day < 14; day++) {
    const date = addDays(startDay, day);
    clock.offsetMs = zonedTimeToUtc(date, "08:00", timezone).getTime() - Date.now();
    const view = (await game.view(DEMO_OWNER)) as GameView;
    for (const due of view.today.due.filter((d) => d.status === "open" && d.localDate === date)) {
      const isGym = due.title === "Walk into the gym";
      if (skip.has(day) && !isGym) continue;
      if (isGym && day % 2 === 1) continue;
      await completeWithSyntheticAcceptance(game, DEMO_OWNER, due.occurrenceId);
      if (day % 3 === 0 && due.title === "Open the assigned textbook") {
        const s = await run({ type: "startOptional", occurrenceId: due.occurrenceId });
        await run({ type: "finishOptional", sessionId: (s.result as { sessionId: string }).sessionId, rating: 7 });
      }
    }
    const after = (await game.view(DEMO_OWNER)) as GameView;
    for (const chest of after.chests.unopened.slice(0, day === 13 ? 0 : 3)) await run({ type: "openChest", entitlementId: chest.id });
    if (day === 6) await run({ type: "upgradeBuilding", area: "library" }).catch(() => undefined);
    if (day === 10) await run({ type: "upgradeBuilding", area: "residence" }).catch(() => undefined);
  }
  // Equip anything cosmetic we own, one per slot.
  const final = (await game.view(DEMO_OWNER)) as GameView;
  const seen = new Set<string>();
  const { itemById } = await import("../content/items");
  for (const inv of final.inventory) {
    const item = itemById(inv.itemId);
    if (item?.kind === "cosmetic" && item.slot && !seen.has(item.slot)) {
      seen.add(item.slot);
      await run({ type: "setEquipped", itemId: item.id, equipped: true });
    }
  }
  return store;
}
