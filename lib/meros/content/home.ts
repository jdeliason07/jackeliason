/**
 * Where you live. You start small, in a rented basement room, and move up only as real progress
 * (level) and saved credits allow: a studio, a one-bedroom higher up, a big apartment near the top
 * of a tower, and finally a house of your own. Each place starts empty when you move in, and you
 * furnish it in three steps. Prices are tuned against the reference routine (about 110 credits a
 * day with Ventures, Level 10 near day 90): the studio comes in the first weeks, the house after
 * most of a year of showing up.
 */

export interface HomeDefinition {
  tier: number;
  name: string;
  /** One short line for the move button's preview. */
  blurb: string;
  minLevel: number;
  /** Credits to move in (0 for the starting room). */
  cost: number;
  /** Credits for each furnishing step, in order. */
  furnishCosts: [number, number, number];
}

export const HOMES: HomeDefinition[] = [
  { tier: 0, name: "Basement room", blurb: "A rented room below the street. It's a start.", minLevel: 1, cost: 0, furnishCosts: [40, 90, 160] },
  { tier: 1, name: "Studio walk-up", blurb: "Your own studio, third floor, one big window.", minLevel: 3, cost: 350, furnishCosts: [100, 225, 400] },
  { tier: 2, name: "One-bedroom, 8th floor", blurb: "A real bedroom and a view over the neighborhood.", minLevel: 6, cost: 1200, furnishCosts: [240, 540, 960] },
  { tier: 3, name: "Two-bedroom, 22nd floor", blurb: "Floor-to-ceiling glass near the top of a tower.", minLevel: 10, cost: 3200, furnishCosts: [480, 1080, 1920] },
  { tier: 4, name: "A house of your own", blurb: "A yard, a tree, and a front door that's yours.", minLevel: 15, cost: 7500, furnishCosts: [800, 1800, 3200] },
];

export const MAX_HOME_TIER = HOMES.length - 1;

/** The three furnishing steps every home goes through. */
export const FURNISH_STEPS = ["Basics", "Comfort", "Style"] as const;

export function homeOf(tier: number): HomeDefinition {
  return HOMES[Math.max(0, Math.min(MAX_HOME_TIER, tier))];
}

/**
 * How the city around you grows with your level. Each stage is the same photograph from the same
 * camera, with one more thing built (scripts/meros/generate-art.mts), so the map never jumps.
 */
export const CITY_STAGES = [1, 3, 5, 7, 10, 15, 20] as const;

export function cityStage(level: number): number {
  return [...CITY_STAGES].reverse().find((s) => level >= s) ?? 1;
}
