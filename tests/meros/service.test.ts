import { describe, expect, it } from "vitest";
import type { Game } from "@/lib/meros/service/game";
import type { GameView } from "@/lib/meros/service/view";
import { definitionFrom, makeGame, onboard, OWNER, template } from "./helpers";

const TZ = "America/Denver";
// Monday 2026-03-02, 08:00 MST.
const MON_8AM = "2026-03-02T15:00:00Z";

type Run = ReturnType<typeof makeGame>["run"];

async function view(game: Game): Promise<GameView> {
  return (await game.view(OWNER))!;
}

async function addQuest(run: Run, id: string, schedule?: unknown, extra: Record<string, unknown> = {}) {
  const t = template(id);
  const res = await run({
    type: "createQuest",
    templateId: id,
    definition: { ...definitionFrom(t), ...(schedule ? { schedule } : {}), ...extra },
    confirmDistinct: true,
  });
  return (res.result as { questId: string }).questId;
}

const allDay = (kind = "daily") => ({ kind, window: { start: "00:00", end: "24:00" } });

async function openDue(game: Game, title?: string) {
  const v = await view(game);
  return v.today.due.filter((d) => d.status === "open" && d.phase === "open" && (!title || d.title === title));
}

async function photoFlow(game: Game, occurrenceId: string, sha = "a".repeat(64), dhash: string | null = null) {
  const key = `k-${Math.random().toString(36).slice(2)}`;
  const ch = (await game.command(OWNER, { type: "issueChallenge", occurrenceId }, key)).result as { challengeId: string; token: string };
  return game.beginPhoto(OWNER, { challengeId: ch.challengeId, token: ch.token, sha256: sha, dhash, imagePath: `test/${sha}.jpg`, demo: true });
}

describe("minimum-only success and optional effort", () => {
  it("awards half of max XP immediately; stopping there costs nothing", async () => {
    const { game, run, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "faith-open-scriptures", allDay());
    const [due] = await openDue(game);
    const award = await complete(due.occurrenceId);
    expect(award).toMatchObject({ xp: 10, chestProgress: 1, ticketEarned: true, vitalityRestored: 0 });
    await run({ type: "declineOptional", occurrenceId: due.occurrenceId });
    const v = await view(game);
    expect(v.profile.progress.xpTotal).toBe(10);
    expect(v.today.due[0]).toMatchObject({ status: "completed", optionalStatus: "declined" });
  });

  it("rounds the self-rated bonus once; abandoning loses nothing; expiry ends with the window", async () => {
    const { game, run, complete, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "learn-open-textbook", allDay(), { maxXp: 14 });
    await addQuest(run, "biz-planning-notebook", allDay());
    await addQuest(run, "faith-open-scriptures", { kind: "daily", window: { start: "06:00", end: "09:00" } });
    const due = await openDue(game);
    for (const d of due) await complete(d.occurrenceId);
    const tb = due.find((d) => d.title === "Open the assigned textbook")!;
    const s1 = (await run({ type: "startOptional", occurrenceId: tb.occurrenceId })).result as { sessionId: string };
    const fin = await run({ type: "finishOptional", sessionId: s1.sessionId, rating: 5 }, "finish-once");
    expect(fin.result).toMatchObject({ bonusXp: 4 }); // round(0.5 × 7) = 3.5 → 4
    const replay = await run({ type: "finishOptional", sessionId: s1.sessionId, rating: 5 }, "finish-once");
    expect(replay.replayed).toBe(true);
    const again = await run({ type: "finishOptional", sessionId: s1.sessionId, rating: 10 });
    expect(again.result).toMatchObject({ bonusXp: 4 }); // already finished: no second award

    const pn = due.find((d) => d.title === "Open the planning notebook")!;
    const s2 = (await run({ type: "startOptional", occurrenceId: pn.occurrenceId })).result as { sessionId: string };
    await run({ type: "finishOptional", sessionId: s2.sessionId, rating: null });

    const sc = due.find((d) => d.title === "Open the scriptures")!;
    const s3 = (await run({ type: "startOptional", occurrenceId: sc.occurrenceId })).result as { sessionId: string };
    clock.set("2026-03-02T16:30:00Z"); // 09:30 local: window closed
    const late = await run({ type: "finishOptional", sessionId: s3.sessionId, rating: 10 });
    expect(late.result).toMatchObject({ status: "expired", bonusXp: 0 });

    const v = await view(game);
    expect(v.profile.progress.xpTotal).toBe(7 + 10 + 10 + 4);
    expect(v.today.due.every((d) => d.status === "completed")).toBe(true);
  });
});

describe("idempotency and concurrency", () => {
  it("replays a repeated key and never double-awards a minimum", async () => {
    const { game, run, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "fit-enter-gym", allDay());
    const [due] = await openDue(game);
    const reading = { lat: 40.2518, lng: -111.6493, accuracyM: 10, timestamp: Date.parse(MON_8AM) };
    const [a, b] = await Promise.all([
      game.command(OWNER, { type: "submitGps", occurrenceId: due.occurrenceId, reading }, "gps-key-1"),
      game.command(OWNER, { type: "submitGps", occurrenceId: due.occurrenceId, reading }, "gps-key-1"),
    ]);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    await expect(complete(due.occurrenceId)).rejects.toThrow(/already complete/);
    await expect(
      game.command(OWNER, { type: "submitGps", occurrenceId: due.occurrenceId, reading }, "gps-key-2"),
    ).rejects.toThrow(/Already verified/);
    const v = await view(game);
    expect(v.profile.progress.xpTotal).toBe(10);
    expect(v.profile.tickets).toBe(1);
  });

  it("refuses a key reused for a different command", async () => {
    const { run } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await run({ type: "setBudget", cents: 1000 }, "same-key-123");
    await expect(run({ type: "catchUp" }, "same-key-123")).rejects.toThrow(/already used/);
  });
});

describe("chests", () => {
  it("earns exactly one chest per three minimums, across days, and opens exactly once", async () => {
    const { game, run, complete, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "faith-open-scriptures", allDay());
    await addQuest(run, "learn-open-textbook", allDay());
    for (let day = 0; day < 4; day++) {
      for (const d of await openDue(game)) await complete(d.occurrenceId);
      clock.hours(24);
    }
    let v = await view(game);
    expect(v.profile.minimumsTotal).toBe(8);
    expect(v.chests.unopened.map((c) => c.seq)).toEqual([1, 2]);
    expect(v.chests.progress).toBe(2);
    const chestId = v.chests.unopened[0].id;
    const [x, y] = await Promise.all([
      run({ type: "openChest", entitlementId: chestId }),
      run({ type: "openChest", entitlementId: chestId }),
    ]);
    const ox = x.result as { credits: number; item_id: string; replay: boolean };
    const oy = y.result as { credits: number; item_id: string; replay: boolean };
    expect([ox.replay, oy.replay].sort()).toEqual([false, true]);
    expect(oy.item_id).toBe(ox.item_id);
    v = await view(game);
    const creditsAfter = v.profile.credits;
    await run({ type: "openChest", entitlementId: chestId });
    expect((await view(game)).profile.credits).toBe(creditsAfter);
    expect(v.profile.progress.xpTotal).toBe(80); // chests never add XP
  });
});

describe("misses, momentum, deterioration, recovery", () => {
  it("applies the miss ladder 2/3/4/5/6/7+ exactly once, chronologically, after a long absence", async () => {
    const { game, run, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "home-make-bed", { kind: "daily", window: { start: "06:00", end: "09:00" } });
    clock.set("2026-03-12T17:00:00Z"); // 10 local days later, never opened
    await view(game);
    await view(game); // repeated catch-up is a no-op
    const v = await view(game);
    const misses = v.consequences.filter((c) => c.kind === "miss");
    expect(misses).toHaveLength(11); // Mar 2 … Mar 12
    const losses = v.consequences
      .filter((c) => c.kind === "vitality_loss")
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((c) => c.delta);
    expect(losses).toEqual([-2, -3, -4, -4, -4, -4, -4]); // misses 5..11
    expect(v.profile.vitality).toBe(100 - 25);
    expect(v.consequences.filter((c) => c.kind === "momentum_suspended")).toHaveLength(0); // never was active
    expect(v.profile.progress.xpTotal).toBe(0);
  });

  it("caps loss at 6 per day across quests and floors vitality at 40", async () => {
    const { game, run, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    const w = { kind: "daily", window: { start: "06:00", end: "09:00" } };
    await addQuest(run, "home-make-bed", w);
    await addQuest(run, "faith-open-scriptures", w);
    await addQuest(run, "biz-planning-notebook", w);
    clock.set("2026-03-30T17:00:00Z");
    const v = await view(game);
    const byDay = new Map<string, number>();
    for (const c of v.consequences.filter((c) => c.kind === "vitality_loss")) byDay.set(c.day, (byDay.get(c.day) ?? 0) - c.delta);
    for (const lost of byDay.values()) expect(lost).toBeLessThanOrEqual(6);
    expect(v.profile.vitality).toBe(40);
    expect(v.profile.vitalityModifier).toBe(0.8);
    expect(v.profile.energy).toBe("drained");
  });

  it("restores vitality on return (+10 each, max +20 a day) with ordinary rewards", async () => {
    const { game, run, clock, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    const w = { kind: "daily", window: { start: "06:00", end: "22:00" } };
    for (const id of ["home-make-bed", "faith-open-scriptures", "biz-planning-notebook"]) await addQuest(run, id, w);
    clock.set("2026-03-20T16:00:00Z");
    const before = await view(game);
    const due = before.today.due.filter((d) => d.status === "open");
    const awards = [];
    for (const d of due) awards.push(await complete(d.occurrenceId));
    expect(awards.map((a) => a.vitalityRestored)).toEqual([10, 10, 0]);
    expect(awards.every((a) => a.xp === 10)).toBe(true);
    expect((await view(game)).profile.vitality).toBe(before.profile.vitality + 20);
  });

  it("momentum: +5 from the second success, survives two misses, suspends at three, comeback without bonus", async () => {
    const { game, run, clock, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "faith-open-scriptures", { kind: "daily", window: { start: "06:00", end: "22:00" } });
    const bonusFor = async () => {
      const [d] = await openDue(game);
      return (await complete(d.occurrenceId)).momentumBonus;
    };
    expect(await bonusFor()).toBe(0);
    clock.hours(24);
    expect(await bonusFor()).toBe(5);
    clock.hours(48); // one miss
    expect(await bonusFor()).toBe(5);
    clock.hours(24 * 4); // three misses
    await view(game);
    const v = await view(game);
    expect(v.quests[0].momentum.status).toBe("suspended");
    expect(await bonusFor()).toBe(0); // comeback
    clock.hours(24);
    expect(await bonusFor()).toBe(5);
  });
});

describe("weekly quotas", () => {
  it("offers one slot per day, counts an unmet week as one miss, and still rewards partial weeks", async () => {
    const { game, run, clock, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "fit-bike-ready", { kind: "weekly", timesPerWeek: 3, window: { start: "06:00", end: "22:00" } });
    const [mon] = await openDue(game);
    expect(mon.weekly).toEqual({ completed: 0, target: 3 });
    await complete(mon.occurrenceId);
    await expect(complete(mon.occurrenceId)).rejects.toThrow(); // one per day
    clock.hours(24);
    await complete((await openDue(game))[0].occurrenceId);
    clock.set("2026-03-09T16:00:00Z"); // next Monday
    const v = await view(game);
    expect(v.profile.progress.xpTotal).toBe(20); // partial week still rewarded
    expect(v.consequences.filter((c) => c.kind === "week_missed")).toHaveLength(1);
    expect(v.consequences.filter((c) => c.kind === "miss")).toHaveLength(0); // empty days aren't misses
    expect(v.quests[0].momentum.consecutiveMisses).toBe(1);
    // Meet the target this week: miss count resets only then.
    for (let i = 0; i < 3; i++) {
      await complete((await openDue(game))[0].occurrenceId);
      clock.hours(24);
    }
    const after = await view(game);
    expect(after.quests[0].momentum.consecutiveMisses).toBe(0);
    expect(after.consequences.filter((c) => c.kind === "week_met")).toHaveLength(1);
    expect(after.today.due.filter((d) => d.status === "open")).toHaveLength(0); // no slots once met
  });
});

describe("activation, pauses, edits", () => {
  it("never creates occurrences before activation or with too little window left", async () => {
    const { game, run } = makeGame("2026-03-02T15:30:00Z"); // 08:30 local
    await onboard(run, TZ);
    await addQuest(run, "home-make-bed", { kind: "daily", window: { start: "06:00", end: "09:00" } }); // 30 min left
    const v = await view(game);
    expect(v.today.due).toHaveLength(0);
    expect(v.consequences).toHaveLength(0);
  });

  it("pauses prospectively and never counts paused days as misses", async () => {
    const { game, run, clock, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    const q = await addQuest(run, "faith-open-scriptures", { kind: "daily", window: { start: "06:00", end: "22:00" } });
    await run({ type: "pauseQuest", questId: q });
    expect((await openDue(game)).length).toBe(1); // today's open window stays due
    clock.set("2026-03-10T16:00:00Z");
    let v = await view(game);
    expect(v.consequences.filter((c) => c.kind === "miss")).toHaveLength(1); // only Mar 2
    await run({ type: "resumeQuest", questId: q });
    const [d] = await openDue(game);
    expect(d.localDate).toBe("2026-03-10");
    await complete(d.occurrenceId);
    v = await view(game);
    expect(v.quests[0].momentum.consecutiveMisses).toBe(0);
  });

  it("applies edits to future occurrences only, keeping frozen snapshots", async () => {
    const { game, run, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    const q = await addQuest(run, "learn-open-textbook", { kind: "daily", window: { start: "06:00", end: "22:00" } });
    await run({
      type: "updateQuest",
      questId: q,
      definition: { ...definitionFrom(template("learn-open-textbook")), title: "Open the physics book", maxXp: 30, schedule: { kind: "daily", window: { start: "06:00", end: "22:00" } } },
    });
    expect((await openDue(game))[0]).toMatchObject({ title: "Open the assigned textbook", maxXp: 20 });
    clock.hours(24);
    expect((await openDue(game))[0]).toMatchObject({ title: "Open the physics book", maxXp: 30 });
  });
});

describe("photo verification outcomes", () => {
  it("leaves rejected and inconclusive attempts open for a retake; accepts once", async () => {
    const { game, run } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "learn-open-textbook", allDay());
    const [d] = await openDue(game);
    const r1 = await photoFlow(game, d.occurrenceId, "1".repeat(64));
    const res1 = await game.resolvePhoto(OWNER, r1.attempt.id, { kind: "verdict", verdict: { outcome: "rejected", reason: "The book is closed.", guidance: "Open it." }, provider: "test", model: "t" });
    expect(res1.status).toBe("rejected");
    const r2 = await photoFlow(game, d.occurrenceId, "2".repeat(64));
    await game.resolvePhoto(OWNER, r2.attempt.id, { kind: "verdict", verdict: { outcome: "inconclusive", reason: "Too dark.", guidance: "More light." }, provider: "test", model: "t" });
    expect((await openDue(game))[0].inconclusiveCount).toBe(1);
    const r3 = await photoFlow(game, d.occurrenceId, "3".repeat(64));
    const ok = await game.resolvePhoto(OWNER, r3.attempt.id, { kind: "verdict", verdict: { outcome: "accepted", reason: "Open book visible.", guidance: null }, provider: "test", model: "t" });
    expect(ok.award?.xp).toBe(10);
    const replay = await game.resolvePhoto(OWNER, r3.attempt.id, { kind: "verdict", verdict: { outcome: "accepted", reason: "x", guidance: null }, provider: "test", model: "t" });
    expect(replay.award).toBeNull();
    expect((await view(game)).profile.progress.xpTotal).toBe(10);
  });

  it("rejects reused image bytes without calling the provider; similar images are only flagged", async () => {
    const { game, run, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "learn-open-textbook", allDay());
    const [d] = await openDue(game);
    const a = await photoFlow(game, d.occurrenceId, "f".repeat(64), "00ff00ff00ff00ff");
    await game.resolvePhoto(OWNER, a.attempt.id, { kind: "verdict", verdict: { outcome: "accepted", reason: "ok", guidance: null }, provider: "test", model: "t" });
    clock.hours(24);
    const [d2] = await openDue(game);
    const reused = await photoFlow(game, d2.occurrenceId, "f".repeat(64));
    expect(reused.evaluate).toBe(false);
    expect(reused.attempt).toMatchObject({ status: "rejected" });
    expect(reused.attempt.reuse_of).toBe(a.attempt.id);
    const similar = await photoFlow(game, d2.occurrenceId, "e".repeat(64), "00ff00ff00ff00fe");
    expect(similar.evaluate).toBe(true);
    expect(similar.attempt.similar_to).toBe(a.attempt.id);
  });

  it("an outage is never success or failure: retry within grace awards once; past grace it's excused", async () => {
    const { game, run, clock } = makeGame(MON_8AM);
    await onboard(run, TZ);
    const w = { kind: "daily", window: { start: "06:00", end: "09:00" } };
    await addQuest(run, "learn-open-textbook", w);
    await addQuest(run, "faith-open-scriptures", w);
    const due = await openDue(game);
    const a = await photoFlow(game, due[0].occurrenceId, "a".repeat(64));
    const b = await photoFlow(game, due[1].occurrenceId, "b".repeat(64));
    for (const x of [a, b]) {
      const r = await game.resolvePhoto(OWNER, x.attempt.id, { kind: "unavailable", reason: "timeout", provider: "test", model: "t" });
      expect(r.status).toBe("unavailable");
    }
    clock.set("2026-03-02T20:00:00Z"); // window closed, inside the 24h grace
    let v = await view(game);
    expect(v.consequences.filter((c) => c.kind === "miss")).toHaveLength(0);
    const retry = await game.photoForRetry(OWNER, a.attempt.id);
    expect(retry.retry).toBe(true);
    const ok = await game.resolvePhoto(OWNER, a.attempt.id, { kind: "verdict", verdict: { outcome: "accepted", reason: "ok", guidance: null }, provider: "test", model: "t" });
    expect(ok.award?.xp).toBe(10);
    clock.set("2026-03-03T17:00:00Z"); // grace over for the other one
    v = await view(game);
    expect(v.consequences.filter((c) => c.kind === "technical_excuse")).toHaveLength(1);
    expect(v.consequences.filter((c) => c.kind === "miss" && c.day === "2026-03-02")).toHaveLength(0);
  });

  it("refuses demo evidence in a live game", async () => {
    const { game, run } = makeGame(MON_8AM, { mode: "live" });
    await onboard(run, TZ);
    await addQuest(run, "learn-open-textbook", allDay());
    const [d] = await openDue(game);
    await expect(photoFlow(game, d.occurrenceId)).rejects.toThrow(/Demo evidence/);
  });
});

describe("tickets and ventures", () => {
  it("earns at most 2 tickets a day and stores at most 6", async () => {
    const { game, run, clock, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    for (const id of ["home-make-bed", "faith-open-scriptures", "biz-planning-notebook"]) await addQuest(run, id, allDay());
    for (let day = 0; day < 4; day++) {
      for (const d of await openDue(game)) await complete(d.occurrenceId);
      const v = await view(game);
      expect(v.ventures.earnedToday).toBeLessThanOrEqual(2);
      clock.hours(24);
    }
    expect((await view(game)).profile.tickets).toBe(6);
  });

  it("consumes one ticket per rewarded venture, resumes without a second charge, pays exactly once", async () => {
    const { game, run, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "home-make-bed", allDay());
    await complete((await openDue(game))[0].occurrenceId);
    const xp = (await view(game)).profile.progress.xpTotal;
    const start = (await run({ type: "startBattle", scenarioId: "harbor-lease", mode: "rewarded" })).result as { battleId: string };
    const resume = (await run({ type: "startBattle", scenarioId: "harbor-lease", mode: "rewarded" })).result as { battleId: string; resumed: boolean };
    expect(resume).toMatchObject({ battleId: start.battleId, resumed: true });
    expect((await view(game)).profile.tickets).toBe(0);
    await expect(run({ type: "startBattle", scenarioId: "night-market", mode: "practice" })).rejects.toThrow(/Finish or forfeit/);
    await run({ type: "chooseBattle", battleId: start.battleId, round: 1, choiceId: "comps" }, "round-one-key");
    const retry = await run({ type: "chooseBattle", battleId: start.battleId, round: 1, choiceId: "comps" });
    expect((retry.result as { replay: boolean }).replay).toBe(true);
    await expect(run({ type: "chooseBattle", battleId: start.battleId, round: 1, choiceId: "walk-tour" })).rejects.toThrow(/already played/);
    await run({ type: "chooseBattle", battleId: start.battleId, round: 2, choiceId: "tenant-improvements" });
    const credits = (await view(game)).profile.credits;
    const end = await run({ type: "chooseBattle", battleId: start.battleId, round: 3, choiceId: "vacancy-leverage" });
    const battle = (end.result as { battle: { status: string; rewardCredits: number } }).battle;
    expect(battle.status).toBe("finished");
    const v = await view(game);
    expect(v.profile.credits).toBe(credits + battle.rewardCredits);
    expect(v.profile.progress.xpTotal).toBe(xp); // battles never grant XP
    expect(v.profile.tickets).toBe(0); // and never tickets
    await expect(run({ type: "startBattle", scenarioId: "harbor-lease", mode: "rewarded" })).rejects.toThrow(/No battle tickets/);
    const practice = await run({ type: "startBattle", scenarioId: "harbor-lease", mode: "practice" });
    expect(practice.result).toMatchObject({ resumed: false });
  });
});

describe("estate", () => {
  it("enforces level, prerequisites, and funds; concurrent purchases charge once", async () => {
    const { game, run, store } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await expect(run({ type: "upgradeBuilding", area: "library" })).rejects.toThrow(/Level 2/);
    // Grant level and credits directly in the store for this test.
    await store.transaction(async (tx) => {
      await tx.update("profiles", OWNER, { xp_total: 300, level: 4 });
      await tx.insert("wallet_events", { id: crypto.randomUUID(), owner_id: OWNER, kind: "chest", delta: 400, source_id: "test", note: "", created_at: MON_8AM });
      await tx.update("profiles", OWNER, { credits: 400 });
    });
    await expect(run({ type: "upgradeBuilding", area: "office" })).rejects.toThrow(/Residence/);
    const [a, b] = await Promise.allSettled([run({ type: "upgradeBuilding", area: "library" }), run({ type: "upgradeBuilding", area: "library" })]);
    const ok = [a, b].filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1); // second sees tier 2 needs Office tier 1
    const v = await view(game);
    expect(v.estate.tiers.library).toBe(1);
    expect(v.profile.credits).toBe(400 - 180);
    await run({ type: "upgradeBuilding", area: "residence" }); // 200 of the remaining 220
    await expect(run({ type: "upgradeBuilding", area: "gym" })).rejects.toThrow(/Needs 180 Estate Credits; you have 20/);
  });
});

describe("real-world rewards", () => {
  it("unlocks at milestones, claims idempotently, and enforces the monthly budget under a race", async () => {
    const { game, run, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    const reward = (title: string, amountCents: number | null) =>
      run({ type: "saveReward", reward: { id: null, title, kind: amountCents ? "money" : "experience", description: "", amountCents, targetLevel: null, targetMinimums: 1, notes: "" } });
    await reward("Shoes fund", 3000);
    await reward("Book fund", 3000);
    await reward("Hike", null);
    let v = await view(game);
    expect(v.rewards.list.every((r) => !r.unlockedAt)).toBe(true);
    expect(v.rewards.budget.capCents).toBeNull();
    await addQuest(run, "home-make-bed", allDay());
    const award = await complete((await openDue(game))[0].occurrenceId);
    expect(award.rewardsUnlocked).toHaveLength(3);
    await run({ type: "setBudget", cents: 5000 });
    v = await view(game);
    const [shoes, book, hike] = v.rewards.list;
    const results = await Promise.allSettled([
      run({ type: "claimReward", rewardId: shoes.id, note: "" }),
      run({ type: "claimReward", rewardId: book.id, note: "" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "budget_exceeded" } });
    await run({ type: "claimReward", rewardId: hike.id, note: "" }, "hike-claim");
    const replay = await run({ type: "claimReward", rewardId: hike.id, note: "" }, "hike-claim");
    expect(replay.replayed).toBe(true);
    v = await view(game);
    expect(v.rewards.budget).toMatchObject({ capCents: 5000, usedCents: 3000, remainingCents: 2000 });
    expect(v.profile.progress.xpTotal).toBe(10); // claims never touch XP
  });
});

describe("habit identity", () => {
  it("rejects an identical template clone, allows a different schedule but scores the habit once a day", async () => {
    const { game, run, complete } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "learn-open-textbook", allDay());
    await expect(addQuest(run, "learn-open-textbook", allDay())).rejects.toThrow(/exact schedule/);
    await addQuest(run, "learn-open-textbook", { kind: "daily", window: { start: "06:00", end: "22:00" } });
    const due = await openDue(game);
    expect(due).toHaveLength(2);
    await complete(due[0].occurrenceId);
    await expect(complete(due[1].occurrenceId)).rejects.toThrow(/already scored today/);
  });

  it("flags a similar custom goal for review instead of silently accepting it", async () => {
    const { run } = makeGame(MON_8AM);
    await onboard(run, TZ);
    await addQuest(run, "learn-open-textbook", allDay());
    const custom = { ...definitionFrom(template("learn-open-textbook")), title: "Open my textbook", minimumAction: "Open the assigned textbook to the chapter" };
    await expect(run({ type: "createQuest", templateId: null, definition: custom })).rejects.toMatchObject({ code: "similar_quest" });
    await run({ type: "createQuest", templateId: null, definition: custom, confirmDistinct: true });
  });
});

describe("DST", () => {
  it("keeps a 06:00–09:00 window on local time across the spring transition", async () => {
    const { game, run, clock } = makeGame("2026-03-06T15:00:00Z");
    await onboard(run, TZ);
    await addQuest(run, "home-make-bed", { kind: "daily", window: { start: "06:00", end: "09:00" } });
    clock.set("2026-03-09T15:00:00Z");
    await view(game);
    const occ = await game.deps.store.transaction((tx) => tx.find("quest_occurrences", { owner_id: OWNER }, { orderBy: [["local_date", "asc"]] }));
    const byDate = Object.fromEntries(occ.map((o) => [o.local_date, o.opens_at]));
    expect(byDate["2026-03-07"]).toBe("2026-03-07T13:00:00.000Z"); // MST
    expect(byDate["2026-03-08"]).toBe("2026-03-08T12:00:00.000Z"); // MDT
    expect(byDate["2026-03-09"]).toBe("2026-03-09T12:00:00.000Z");
  });
});
