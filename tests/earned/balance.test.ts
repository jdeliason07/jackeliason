import { describe, expect, it } from "vitest";
import { ROUTINES, simulate } from "@/lib/earned/sim/balance";

describe("balance (simulated through the real rules)", () => {
  it("reference routine: XP comes only from minimums, chests daily, early upgrades, no instant estate", async () => {
    const r = await simulate(ROUTINES[0], 21);
    const last = r.days[r.days.length - 1];
    expect(last.xp).toBe(21 * 30); // attendance only: exactly 30 XP/day, nothing from chests/ventures/estate
    expect(r.dayReached[5]).toBe(15);
    expect(last.chestsEarned).toBe(21);
    expect(last.ticketsEarned).toBe(42);
    expect(r.firstUpgradeDay).not.toBeNull();
    expect(r.firstUpgradeDay!).toBeLessThanOrEqual(7);
    expect(last.upgrades).toBeLessThan(12); // meaningful progress, far from complete
    expect(r.battles.victories).toBeLessThan(r.battles.played); // ventures stay a decision
  }, 120_000);
});
