import { describe, expect, it } from "vitest";
import { cumulativeTable, levelForXp, levelProgress, levelsCrossed, marginalCost, xpToReach, estimateDaysToLevel } from "@/lib/meros/domain/levels";
import { attendanceXp, effortBonusXp, isValidMaxXp } from "@/lib/meros/domain/xp";

describe("level curve", () => {
  it("matches the authoritative table to Level 10", () => {
    const expected: [number, number, number, number][] = [
      [2, 70, 70, 2.3], [3, 90, 160, 5.3], [4, 125, 285, 9.5], [5, 165, 450, 15.0], [6, 225, 675, 22.5],
      [7, 305, 980, 32.7], [8, 410, 1390, 46.3], [9, 555, 1945, 64.8], [10, 755, 2700, 90.0],
    ];
    for (const [level, marginal, cumulative, referenceDay] of expected) {
      expect(marginalCost(level)).toBe(marginal);
      expect(xpToReach(level)).toBe(cumulative);
      expect(Math.round((cumulative / 30) * 10) / 10).toBe(referenceDay);
    }
    expect(xpToReach(10)).toBe(2700);
    expect(xpToReach(10) / 30).toBe(90);
  });

  it("keeps marginal costs strictly increasing through Level 20 and beyond", () => {
    const table = cumulativeTable();
    for (let l = 3; l <= 30; l++) expect(table[l] - table[l - 1]).toBeGreaterThan(table[l - 1] - table[l - 2]);
    expect(xpToReach(20)).toBeGreaterThan(xpToReach(10) * 4);
  });

  it("starts at level 1 with zero XP and derives level purely from XP", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(69)).toBe(1);
    expect(levelForXp(70)).toBe(2);
    expect(levelForXp(2699)).toBe(9);
    expect(levelForXp(2700)).toBe(10);
  });

  it("reports every level crossed by one award (multi-level jump)", () => {
    expect(levelsCrossed(60, 300)).toEqual([2, 3, 4]);
    expect(levelsCrossed(100, 110)).toEqual([]);
    const p = levelProgress(300);
    expect(p).toMatchObject({ level: 4, intoLevel: 15, levelSpan: 165, nextLevelAt: 450 });
  });

  it("estimates days from a schedule without promising", () => {
    expect(estimateDaysToLevel(0, 30, 10)).toBe(90);
    expect(estimateDaysToLevel(0, 0, 10)).toBeNull();
  });
});

describe("XP split", () => {
  it("requires a positive even max XP within limits", () => {
    expect(isValidMaxXp(20)).toBe(true);
    expect(isValidMaxXp(21)).toBe(false);
    expect(isValidMaxXp(0)).toBe(false);
    expect(isValidMaxXp(42)).toBe(false);
    expect(() => attendanceXp(19)).toThrow();
  });

  it("awards half for attendance", () => {
    expect(attendanceXp(20)).toBe(10);
    expect(attendanceXp(2)).toBe(1);
  });

  it("rounds the self-rated bonus half-up exactly once per formula", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => effortBonusXp(r, 20))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // maxXp 14 → half 7: 0.7→1, 1.4→1, 2.1→2, 2.8→3, 3.5→4 (half up), 4.2→4, 4.9→5, 5.6→6, 6.3→6, 7
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => effortBonusXp(r, 14))).toEqual([1, 1, 2, 3, 4, 4, 5, 6, 6, 7]);
    expect(effortBonusXp(null, 20)).toBe(0);
    expect(() => effortBonusXp(11, 20)).toThrow();
    expect(() => effortBonusXp(2.5, 20)).toThrow();
  });
});
