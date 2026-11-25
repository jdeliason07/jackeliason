import { describe, expect, it } from "vitest";
import { dailyQuest, makeGame, onboard, OWNER } from "./helpers";
import { addOwner, pgStore } from "./pg";

describe("postgres store smoke", () => {
  it("applies migrations and runs the same day on real SQL", async () => {
    const { db, store } = await pgStore();
    await addOwner(db, OWNER, "owner@example.com");
    const { game, run, complete } = makeGame("2026-03-02T15:00:00Z", { store, mode: "live" });
    await onboard(run);
    await dailyQuest(run, "faith-open-scriptures");
    await dailyQuest(run, "learn-open-textbook");
    await dailyQuest(run, "biz-planning-notebook");
    let view = (await game.view(OWNER))!;
    expect(view.today.due.length).toBe(3);
    const { completeWithSyntheticAcceptance } = await import("@/lib/meros/service/game");
    for (const due of view.today.due) await completeWithSyntheticAcceptance(game, OWNER, due.occurrenceId, false);
    view = (await game.view(OWNER))!;
    expect(view.profile.progress.xpTotal).toBe(30);
    expect(view.chests.unopened.length).toBe(1);
    await run({ type: "openChest", entitlementId: view.chests.unopened[0].id });
    const drift = await db.query("select * from meros.ledger_drift($1)", [OWNER]);
    expect(drift.rows).toEqual([]);
    void complete;
  });
});
