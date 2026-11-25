import { describe, expect, it } from "vitest";
import { dailyQuest, makeGame, onboard, OWNER } from "./helpers";

describe("service smoke", () => {
  it("runs a full day: complete three minimums, earn a chest, open it", async () => {
    const { game, run, complete, clock } = makeGame("2026-03-02T15:00:00Z");
    await onboard(run);
    const a = await dailyQuest(run, "faith-open-scriptures");
    const b = await dailyQuest(run, "learn-open-textbook");
    const c = await dailyQuest(run, "biz-planning-notebook");
    let view = (await game.view(OWNER))!;
    expect(view.today.due.length).toBe(3);
    for (const due of view.today.due) await complete(due.occurrenceId);
    view = (await game.view(OWNER))!;
    expect(view.profile.progress.xpTotal).toBe(30);
    expect(view.chests.unopened.length).toBe(1);
    expect(view.profile.tickets).toBe(2);
    const opened = await run({ type: "openChest", entitlementId: view.chests.unopened[0].id });
    expect((opened.result as { credits: number }).credits).toBeGreaterThan(0);
    view = (await game.view(OWNER))!;
    expect(view.chests.unopened.length).toBe(0);
    expect(view.profile.credits).toBeGreaterThan(0);
    clock.hours(24);
    view = (await game.view(OWNER))!;
    expect(view.today.due.filter((d) => d.status === "open").length).toBe(3);
    void a; void b; void c;
  });
});
