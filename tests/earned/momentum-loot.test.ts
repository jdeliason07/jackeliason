import { describe, expect, it } from "vitest";
import { ITEMS } from "@/lib/earned/content/items";
import { LOOT_TABLE_V1, oddsSummary, resolveChest } from "@/lib/earned/domain/loot";
import { applyMiss, applySuccess, cappedPenalty, INITIAL_MOMENTUM, penaltyForMiss, restoration, vitalityModifier } from "@/lib/earned/domain/momentum";
import { seededRng } from "@/lib/earned/domain/random";

describe("momentum", () => {
  it("activates on the second consecutive success, with the bonus on that success", () => {
    const a = applySuccess(INITIAL_MOMENTUM, "occurrence");
    expect(a.bonusCredits).toBe(0);
    const b = applySuccess(a.state, "occurrence");
    expect(b).toMatchObject({ bonusCredits: 5, event: "momentum_activated" });
    expect(applySuccess(b.state, "occurrence").bonusCredits).toBe(5);
  });

  it("survives one or two misses, suspends on the third, and comes back without a bonus on the comeback", () => {
    let s = applySuccess(applySuccess(INITIAL_MOMENTUM, "occurrence").state, "occurrence").state;
    s = applyMiss(s).state;
    s = applyMiss(s).state;
    expect(s.status).toBe("active");
    expect(applySuccess(s, "occurrence").bonusCredits).toBe(5);
    const third = applyMiss(s);
    expect(third).toMatchObject({ missCount: 3, event: "momentum_suspended" });
    const comeback = applySuccess(third.state, "occurrence");
    expect(comeback).toMatchObject({ bonusCredits: 0, event: "momentum_restored" });
    expect(applySuccess(comeback.state, "occurrence").bonusCredits).toBe(5);
  });

  it("weekly units never pay a bonus themselves (slots do)", () => {
    const s = applySuccess(applySuccess(INITIAL_MOMENTUM, "week").state, "week");
    expect(s).toMatchObject({ bonusCredits: 0, event: "momentum_activated" });
  });

  it("charges vitality only from the fifth consecutive miss", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map((m) => penaltyForMiss(m))).toEqual([0, 0, 0, 0, 2, 3, 4, 4, 4]);
  });

  it("caps penalties at 6 per day and never below 40", () => {
    expect(cappedPenalty(4, 0, 100)).toBe(4);
    expect(cappedPenalty(4, 4, 100)).toBe(2);
    expect(cappedPenalty(4, 6, 100)).toBe(0);
    expect(cappedPenalty(4, 0, 42)).toBe(2);
    expect(cappedPenalty(4, 0, 40)).toBe(0);
  });

  it("restores 10 per minimum, capped at 20 a day and 100 total", () => {
    expect(restoration(60, 0)).toBe(10);
    expect(restoration(60, 10)).toBe(10);
    expect(restoration(60, 20)).toBe(0);
    expect(restoration(95, 0)).toBe(5);
  });

  it("bounds the battle modifier between 0.80 and 1.00", () => {
    expect(vitalityModifier(40)).toBe(0.8);
    expect(vitalityModifier(100)).toBe(1);
    expect(vitalityModifier(70)).toBe(0.9);
    expect(vitalityModifier(10)).toBe(0.8);
  });
});

describe("loot table", () => {
  it("has odds summing to 100% with the specified weights", () => {
    const odds = oddsSummary();
    expect(odds.reduce((s, o) => s + o.percent, 0)).toBeCloseTo(100, 10);
    expect(odds.map((o) => o.percent)).toEqual([65, 25, 9, 1]);
    for (const o of odds) expect(o.items.reduce((s, i) => s + i.percent, 0)).toBeCloseTo(100, 10);
  });

  it("always gives credits plus a real item, and is deterministic for a seed", () => {
    const owned = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const o = resolveChest(seededRng(i), owned);
      expect(o.credits).toBeGreaterThanOrEqual(LOOT_TABLE_V1.credits[o.rarity].min);
      expect(ITEMS.some((x) => x.id === o.itemId && x.rarity === o.rarity)).toBe(true);
    }
    expect(resolveChest(seededRng(7), owned)).toEqual(resolveChest(seededRng(7), owned));
  });

  it("converts duplicate unique items to the documented credits", () => {
    const first = resolveChest(seededRng(3), new Set());
    const item = ITEMS.find((i) => i.id === first.itemId)!;
    const again = resolveChest(seededRng(3), new Set([first.itemId]));
    expect(again.duplicateCredits).toBe(item.unique ? { common: 20, uncommon: 40, rare: 90, legendary: 220 }[item.rarity] : 0);
  });

  it("roughly follows the weights over many rolls", () => {
    const rng = seededRng(99);
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    for (let i = 0; i < 20000; i++) counts[resolveChest(rng, new Set()).rarity]++;
    expect(counts.common / 20000).toBeCloseTo(0.65, 1);
    expect(counts.uncommon / 20000).toBeCloseTo(0.25, 1);
    expect(counts.legendary).toBeGreaterThan(80);
  });
});
