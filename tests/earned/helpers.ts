import { randomUUID } from "node:crypto";
import { QUEST_TEMPLATES, type QuestTemplate } from "@/lib/earned/content/templates";
import { seededRng } from "@/lib/earned/domain/random";
import { createGame, completeWithSyntheticAcceptance, type Game } from "@/lib/earned/service/game";
import type { QuestDefinition } from "@/lib/earned/service/quest-definition";
import { MemoryStore } from "@/lib/earned/store/memory";
import type { Store } from "@/lib/earned/store/types";

export const OWNER = "00000000-0000-4000-8000-000000000001";
export const OTHER = "00000000-0000-4000-8000-000000000002";

export class Clock {
  constructor(public t: number) {}
  now = () => new Date(this.t);
  set(iso: string) {
    this.t = Date.parse(iso);
  }
  advance(ms: number) {
    this.t += ms;
  }
  hours(h: number) {
    this.advance(h * 3_600_000);
  }
}

export function makeGame(start: string, options: { store?: Store; mode?: "live" | "demo"; seed?: number } = {}) {
  const clock = new Clock(Date.parse(start));
  const store = options.store ?? new MemoryStore();
  let battleSeed = 12345;
  const game = createGame({
    store,
    now: clock.now,
    rng: seededRng(options.seed ?? 42),
    seed: () => battleSeed++,
    uuid: () => randomUUID(),
    mode: options.mode ?? "demo",
  });
  let n = 0;
  const run = (cmd: Parameters<Game["command"]>[1], key = `key-${++n}-${Math.random().toString(36).slice(2)}`) =>
    game.command(OWNER, cmd, key);
  return { game, clock, store, run, complete: (occurrenceId: string) => completeWithSyntheticAcceptance(game, OWNER, occurrenceId) };
}

export function definitionFrom(t: QuestTemplate, overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    title: t.title,
    category: t.category,
    purpose: t.purpose,
    why: "",
    minimumAction: t.minimumAction,
    cue: t.cue,
    extension: t.extension,
    schedule: t.schedule,
    verification: {
      mode: t.verification.mode,
      criteria: t.verification.criteria,
      gps: t.verification.mode === "gps" ? { lat: 40.2518, lng: -111.6493, radiusM: 150, label: "Test spot" } : null,
    },
    maxXp: t.maxXp,
    reviewOn: null,
    reviewIntervalDays: t.reviewIntervalDays,
    ...overrides,
  };
}

export const template = (id: string) => QUEST_TEMPLATES.find((t) => t.id === id)!;

export async function onboard(run: ReturnType<typeof makeGame>["run"], timezone = "America/Denver") {
  await run({ type: "onboard", displayName: "Jack", timezone, focus: "insight" });
}

export async function dailyQuest(run: ReturnType<typeof makeGame>["run"], id: string, window = { start: "00:00", end: "24:00" }, maxXp = 20) {
  const t = template(id);
  const res = await run({
    type: "createQuest",
    templateId: id,
    definition: definitionFrom(t, { schedule: { kind: "daily", window }, maxXp }),
    confirmDistinct: true,
  });
  return (res.result as { questId: string }).questId;
}
