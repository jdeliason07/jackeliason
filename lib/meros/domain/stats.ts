import { EQUIPMENT_STAT_CAP, type ItemDefinition, type Stat } from "../content/items";

/**
 * Character stats for Ventures. Deterministic: base stats come from level and the chosen focus;
 * equipment adds small bounded modifiers; vitality scales the result between 0.80 and 1.00.
 * Stats only affect battles. They never touch quest XP or verification.
 */

export type Focus = Stat;
export const STATS: Stat[] = ["insight", "execution", "influence"];

export const STAT_LABEL: Record<Stat, string> = { insight: "Insight", execution: "Execution", influence: "Influence" };
export const STAT_BLURB: Record<Stat, string> = {
  insight: "Research, reading the market, spotting weaknesses.",
  execution: "Shipping, operations, holding up under pressure.",
  influence: "Negotiating, partnerships, winning a room.",
};
export const FOCUS_BONUS = 2;
export const EQUIPMENT_STAT_FLOOR = -2;

export function baseStats(level: number, focus: Focus): Record<Stat, number> {
  const base = 3 + Math.floor((Math.max(1, level) - 1) / 3);
  return {
    insight: base + (focus === "insight" ? FOCUS_BONUS : 0),
    execution: base + (focus === "execution" ? FOCUS_BONUS : 0),
    influence: base + (focus === "influence" ? FOCUS_BONUS : 0),
  };
}

export function equipmentBonus(equipped: ItemDefinition[]): Record<Stat, number> {
  const sum: Record<Stat, number> = { insight: 0, execution: 0, influence: 0 };
  for (const item of equipped) {
    for (const stat of STATS) sum[stat] += item.stats?.[stat] ?? 0;
  }
  for (const stat of STATS) sum[stat] = Math.max(EQUIPMENT_STAT_FLOOR, Math.min(EQUIPMENT_STAT_CAP, sum[stat]));
  return sum;
}

export function effectiveStats(
  level: number,
  focus: Focus,
  equipped: ItemDefinition[],
  vitalityModifier: number,
): Record<Stat, number> {
  const base = baseStats(level, focus);
  const bonus = equipmentBonus(equipped);
  const out = {} as Record<Stat, number>;
  for (const stat of STATS) out[stat] = Math.round(Math.max(1, base[stat] + bonus[stat]) * vitalityModifier * 10) / 10;
  return out;
}
