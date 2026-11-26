import {
  type AreaDefinition,
  type AreaId,
  AREAS,
  AREAS_BY_ID,
  BASE_COLLECTION_SLOTS,
  BASE_DECORATION_SLOTS,
  type BattleTag,
} from "../content/estate";
import { FURNISH_STEPS, homeOf } from "../content/home";

export type EstateTiers = Record<AreaId, number>;

export const EMPTY_ESTATE: EstateTiers = { residence: 0, office: 0, library: 0, gym: 0, workshop: 0, gardens: 0 };

export type UpgradeCheck =
  | { ok: true; area: AreaDefinition; tier: number; cost: number }
  | { ok: false; code: "max_tier" | "level" | "prerequisite" | "funds" | "unknown_area"; reason: string };

export function checkUpgrade(areaId: string, tiers: EstateTiers, level: number, credits: number): UpgradeCheck {
  const area = AREAS_BY_ID.get(areaId as AreaId);
  if (!area) return { ok: false, code: "unknown_area", reason: "That area doesn't exist." };
  const current = tiers[area.id] ?? 0;
  if (current >= area.tiers.length) return { ok: false, code: "max_tier", reason: area.id === "residence" ? "You've made it home." : `${area.name} is fully built.` };
  const next = area.tiers[current];
  if (level < next.minLevel) {
    return { ok: false, code: "level", reason: `${next.name} needs Level ${next.minLevel}.` };
  }
  for (const [req, tier] of Object.entries(next.requires) as [AreaId, number][]) {
    if ((tiers[req] ?? 0) < tier) {
      const reqArea = AREAS_BY_ID.get(req)!;
      return { ok: false, code: "prerequisite", reason: `Build ${reqArea.name} to ${reqArea.tiers[tier - 1].name} first.` };
    }
  }
  if (credits < next.cost) {
    return { ok: false, code: "funds", reason: `Needs ${next.cost} Estate Credits; you have ${credits}.` };
  }
  return { ok: true, area, tier: next.tier, cost: next.cost };
}

export interface EstateBonuses {
  tactic: Record<BattleTag, number>;
  startingCapital: number;
  decorationSlots: number;
  collectionSlots: number;
}

export function estateBonuses(tiers: EstateTiers): EstateBonuses {
  const tactic: Record<BattleTag, number> = { research: 0, execute: 0, negotiate: 0, defend: 0, invest: 0 };
  let startingCapital = 0;
  let decorationSlots = BASE_DECORATION_SLOTS;
  let collectionSlots = BASE_COLLECTION_SLOTS;
  for (const area of AREAS) {
    const t = tiers[area.id] ?? 0;
    if (area.tacticBonus) tactic[area.tacticBonus] += t;
    if (area.capitalByTier) startingCapital += area.capitalByTier[t];
    decorationSlots += (area.decorationSlotsPerTier ?? 0) * t;
    collectionSlots += (area.collectionSlotsPerTier ?? 0) * t;
  }
  return { tactic, startingCapital, decorationSlots, collectionSlots };
}

export function totalEstateCost(): number {
  return AREAS.reduce((s, a) => s + a.tiers.reduce((t, x) => t + x.cost, 0), 0);
}

export type FurnishCheck =
  | { ok: true; step: number; cost: number; name: string }
  | { ok: false; code: "max_tier" | "funds"; reason: string };

/** The next furnishing step for the home you live in now. Steps go in order; money is the only gate. */
export function checkFurnish(homeTier: number, stepsOwned: number, credits: number): FurnishCheck {
  const home = homeOf(homeTier);
  if (stepsOwned >= FURNISH_STEPS.length) return { ok: false, code: "max_tier", reason: `${home.name} is fully furnished.` };
  const cost = home.furnishCosts[stepsOwned];
  const name = FURNISH_STEPS[stepsOwned];
  if (credits < cost) return { ok: false, code: "funds", reason: `Needs ${cost} Estate Credits; you have ${credits}.` };
  return { ok: true, step: stepsOwned + 1, cost, name };
}
