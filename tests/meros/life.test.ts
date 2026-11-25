import { describe, expect, it } from "vitest";
import { habitsOf, heuristicSuggestions, type HabitRecord } from "@/lib/meros/domain/suggest";
import { questDefinitionSchema } from "@/lib/meros/service/quest-definition";
import type { GameView } from "@/lib/meros/service/view";
import { dailyQuest, definitionFrom, makeGame, onboard, OWNER, template } from "./helpers";
import { addOwner, pgStore } from "./pg";

const GYM = { lat: 40.2518, lng: -111.6493, radiusM: 150, label: "Rec center" };

describe("places", () => {
  it("saves a building's real spot, and location tasks pointing at it move with it", async () => {
    const { game, run } = makeGame("2026-03-02T15:00:00Z");
    await onboard(run);
    await run({ type: "setPlace", area: "gym", location: GYM });
    const id = await dailyQuest(run, "fit-enter-gym");
    // The test helper gives GPS templates the same coordinates as GYM, so this task points at the gym.
    const moved = await run({ type: "setPlace", area: "gym", location: { ...GYM, lat: 40.26, label: "New gym" } });
    expect((moved.result as { moved: number }).moved).toBe(1);
    const v = (await game.view(OWNER))!;
    expect(v.profile.places.gym?.label).toBe("New gym");
    const q = v.quests.find((x) => x.id === id)!;
    expect(q.definition.verification.gps).toMatchObject({ lat: 40.26, label: "New gym" });
    expect(q.versionNo).toBe(2);
  });

  it("leaves tasks at other spots alone and rejects unknown places", async () => {
    const { game, run } = makeGame("2026-03-02T15:00:00Z");
    await onboard(run);
    await run({ type: "setPlace", area: "gym", location: { ...GYM, lat: 41 } });
    const id = await dailyQuest(run, "fit-enter-gym");
    const r = await run({ type: "setPlace", area: "gym", location: { ...GYM, lat: 42 } });
    expect((r.result as { moved: number }).moved).toBe(0);
    expect((await game.view(OWNER))!.quests.find((q) => q.id === id)!.versionNo).toBe(1);
    await expect(run({ type: "setPlace", area: "moon", location: GYM })).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("earnings", () => {
  async function korvo() {
    const g = makeGame("2026-03-02T15:00:00Z");
    await onboard(g.run);
    await g.run({
      type: "createQuest",
      templateId: null,
      definition: { ...definitionFrom(template("biz-planning-notebook"), { schedule: { kind: "daily", window: { start: "00:00", end: "24:00" } } }), title: "Pitch a Korvo client", org: "Korvo", earns: true },
      confirmDistinct: true,
    });
    const due = (await g.game.view(OWNER))!.today.due[0];
    return { ...g, due };
  }

  it("logs real money for a finished task, corrects it, and shows it on the view", async () => {
    const { game, run, complete, due } = await korvo();
    expect(due).toMatchObject({ org: "Korvo", earns: true, earningCents: null });
    await expect(run({ type: "logEarning", earning: { occurrenceId: due.occurrenceId, org: "", amountCents: 5000, note: "" } })).rejects.toMatchObject({ code: "invalid_input" });
    await complete(due.occurrenceId);
    await run({ type: "logEarning", earning: { occurrenceId: due.occurrenceId, org: "", amountCents: 25000, note: "" } });
    await run({ type: "logEarning", earning: { occurrenceId: due.occurrenceId, org: "", amountCents: 30000, note: "" } });
    const v = (await game.view(OWNER))!;
    expect(v.today.due[0].earningCents).toBe(30000);
    expect(v.money).toMatchObject({ monthCents: 30000, totalCents: 30000, orgs: ["Korvo"] });
    expect(v.money.byOrg).toEqual([{ org: "Korvo", monthCents: 30000, totalCents: 30000 }]);
    expect(v.money.recent[0]).toMatchObject({ amountCents: 30000, title: "Pitch a Korvo client" });
  });

  it("never touches XP or credits, and allows standalone income", async () => {
    const { game, run, complete, due } = await korvo();
    await complete(due.occurrenceId);
    const before = (await game.view(OWNER))!.profile;
    await run({ type: "logEarning", earning: { occurrenceId: null, org: "Nonprofit grant", amountCents: 120000, note: "Q1" } });
    const after = (await game.view(OWNER))!;
    expect(after.profile.progress.xpTotal).toBe(before.progress.xpTotal);
    expect(after.profile.credits).toBe(before.credits);
    expect(after.money.totalCents).toBe(120000);
    await expect(run({ type: "logEarning", earning: { occurrenceId: null, org: "x", amountCents: 0, note: "" } })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("round-trips through real SQL", async () => {
    const { db, store } = await pgStore();
    await addOwner(db, OWNER, "owner@example.com");
    const { game, run, complete } = makeGame("2026-03-02T15:00:00Z", { store, mode: "live" });
    await onboard(run);
    await run({ type: "setPlace", area: "office", location: { ...GYM, label: "Office" } });
    await run({
      type: "createQuest",
      templateId: null,
      definition: { ...definitionFrom(template("biz-planning-notebook"), { schedule: { kind: "daily", window: { start: "00:00", end: "24:00" } } }), org: "Korvo", earns: true },
      confirmDistinct: true,
    });
    const due = (await game.view(OWNER))!.today.due[0];
    const { completeWithSyntheticAcceptance } = await import("@/lib/meros/service/game");
    await completeWithSyntheticAcceptance(game, OWNER, due.occurrenceId, false);
    void complete;
    await run({ type: "logEarning", earning: { occurrenceId: due.occurrenceId, org: "", amountCents: 9900, note: "" } });
    const v = (await game.view(OWNER))!;
    expect(v.profile.places.office?.label).toBe("Office");
    expect(v.money.totalCents).toBe(9900);
    const drift = await db.query("select * from meros.ledger_drift($1)", [OWNER]);
    expect(drift.rows).toEqual([]);
  });
});

describe("suggestions", () => {
  const habit = (over: Partial<HabitRecord>): HabitRecord => ({
    title: "Open the assigned textbook",
    minimumAction: "Open your textbook",
    category: "learning",
    mode: "photo",
    window: { start: "06:00", end: "09:00" },
    scheduleKind: "daily",
    status: "active",
    templateId: "learn-open-textbook",
    org: "",
    done: 18,
    due: 20,
    ...over,
  });

  it("suggests more of what gets done, plus one experiment, all valid and new", () => {
    const habits = [habit({}), habit({ title: "Run", minimumAction: "Shoes on", category: "fitness", templateId: "fit-shoes-out", done: 2, due: 12, window: { start: "18:00", end: "22:00" } })];
    const list = heuristicSuggestions(habits, {}, "2026-03-02");
    expect(list).toHaveLength(3);
    expect(list.filter((s) => s.kind === "similar")).toHaveLength(2);
    expect(list.filter((s) => s.kind === "experiment")).toHaveLength(1);
    // The first "similar" builds on the task that actually gets done, at its time of day.
    expect(list[0].basedOn).toBe("Open the assigned textbook");
    expect(list[0].definition.category).toBe("learning");
    expect(list[0].definition.schedule.window).toEqual({ start: "06:00", end: "09:00" });
    // The experiment is a part of life not being worked on.
    expect(["learning", "fitness"]).not.toContain(list[2].definition.category);
    for (const s of list) {
      expect(s.definition.title).not.toBe("Open the assigned textbook");
      if (s.definition.verification.mode === "photo") expect(questDefinitionSchema.safeParse(s.definition).success).toBe(true);
    }
  });

  it("stays inside a building when asked, and is stable within a day", () => {
    const a = heuristicSuggestions([habit({})], {}, "2026-03-02", ["fitness"]);
    expect(a.every((s) => s.definition.category === "fitness")).toBe(true);
    expect(heuristicSuggestions([habit({})], {}, "2026-03-02", ["fitness"])).toEqual(a);
  });

  it("works for a brand-new account", () => {
    expect(heuristicSuggestions([], {}, "2026-03-02")).toHaveLength(3);
  });

  it("reads habits off the view", async () => {
    const { game, run, complete } = makeGame("2026-03-02T15:00:00Z");
    await onboard(run);
    await dailyQuest(run, "learn-open-textbook");
    const v = (await game.view(OWNER)) as GameView;
    await complete(v.today.due[0].occurrenceId);
    const habits = habitsOf((await game.view(OWNER))!.quests);
    expect(habits[0]).toMatchObject({ category: "learning", done: 1, due: 1 });
  });
});

describe("AI suggestion output", () => {
  const raw = {
    kind: "similar" as const,
    basedOn: "Open the assigned textbook",
    reason: "Same morning slot",
    title: "Open the lab notebook",
    category: "learning" as const,
    minimumAction: "Open your lab notebook to a blank page.",
    extension: "Write the day's plan.",
    cue: "After breakfast",
    why: "Labs go better with a plan.",
    scheduleKind: "weekdays" as const,
    days: [1, 3, 5, 9],
    timesPerWeek: 0,
    windowStart: "06:00",
    windowEnd: "09:00",
    proof: "photo" as const,
    photoShows: ["An open notebook on a desk"],
    org: "",
    earns: true,
  };

  it("becomes a valid task, dropping impossible values", async () => {
    const { toDefinition, summarize } = await import("@/lib/meros/server/suggest");
    const d = toDefinition(raw, {})!;
    expect(d.schedule).toEqual({ kind: "weekdays", days: [1, 3, 5], window: { start: "06:00", end: "09:00" } });
    expect(d.earns).toBe(false); // no org, no money
    expect(questDefinitionSchema.safeParse(d).success).toBe(true);
    const gps = toDefinition({ ...raw, category: "fitness", proof: "location", photoShows: [] }, { gym: GYM })!;
    expect(gps.verification).toEqual({ mode: "gps", criteria: [], gps: GYM });
    expect(toDefinition({ ...raw, title: "", minimumAction: "" }, {})).toBeNull();
    expect(summarize([])).toBe("No tasks yet.");
  });
});
