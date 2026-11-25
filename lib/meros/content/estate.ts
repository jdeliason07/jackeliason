/**
 * The estate: six areas, each with a base state (tier 0, owned from the start) and three
 * purchasable tiers. Prices and level gates are tuned by scripts/meros/balance.ts against the
 * reference routine (three daily minimums) so early upgrades are reachable in the first week or
 * two while the full estate takes months of real attendance.
 *
 * Buildings never grant quest XP or bypass verification. Their bonuses are small and capped:
 * decoration/collection slots, or +1 per tier to one battle tactic.
 */

export type AreaId = "residence" | "office" | "library" | "gym" | "workshop" | "gardens";
export type BattleTag = "research" | "execute" | "negotiate" | "defend" | "invest";

export interface TierDefinition {
  tier: 1 | 2 | 3;
  name: string;
  cost: number;
  minLevel: number;
  /** Other areas that must be at least this tier first. */
  requires: Partial<Record<AreaId, number>>;
  preview: string;
}

export interface AreaDefinition {
  id: AreaId;
  name: string;
  baseName: string;
  purpose: string;
  /** Battle tactic this area strengthens (+1 per tier), if any. */
  tacticBonus?: BattleTag;
  /** Extra starting capital in Ventures at each tier (office). */
  capitalByTier?: [number, number, number, number];
  decorationSlotsPerTier?: number;
  collectionSlotsPerTier?: number;
  tiers: [TierDefinition, TierDefinition, TierDefinition];
}

export const ESTATE_VERSION = 1;

export const AREAS: AreaDefinition[] = [
  {
    id: "residence",
    name: "House",
    baseName: "Studio Walk-up",
    purpose: "Home base. Each tier adds a decoration slot and changes the home itself.",
    decorationSlotsPerTier: 1,
    tiers: [
      { tier: 1, name: "Brownstone", cost: 200, minLevel: 2, requires: {}, preview: "A restored brownstone with a stoop and tall front windows." },
      { tier: 2, name: "Loft Residence", cost: 670, minLevel: 4, requires: {}, preview: "A converted loft with steel windows and a roof deck." },
      { tier: 3, name: "Penthouse", cost: 1750, minLevel: 8, requires: { gardens: 2 }, preview: "A glass penthouse with a wraparound terrace over the skyline." },
    ],
  },
  {
    id: "office",
    name: "Office",
    baseName: "Café Table",
    purpose: "Ventures HQ. Higher tiers add starting Capital in every business battle (+1 at tier 2, +2 at tier 3).",
    capitalByTier: [0, 0, 1, 2],
    tiers: [
      { tier: 1, name: "Coworking Desk", cost: 220, minLevel: 2, requires: { residence: 1 }, preview: "A dedicated desk in a bright coworking space." },
      { tier: 2, name: "Corner Office", cost: 720, minLevel: 5, requires: { residence: 1 }, preview: "A glass-walled corner office with a meeting table and a view." },
      { tier: 3, name: "Headquarters", cost: 1890, minLevel: 9, requires: { residence: 2, library: 2 }, preview: "Your own glass tower, with your name in the lobby." },
    ],
  },
  {
    id: "library",
    name: "Library",
    baseName: "Book Stack",
    purpose: "Research. Research tactics in Ventures gain +1 per tier.",
    tacticBonus: "research",
    tiers: [
      { tier: 1, name: "Reading Nook", cost: 180, minLevel: 2, requires: {}, preview: "A reading chair, a floor lamp, and a full wall of shelves." },
      { tier: 2, name: "Private Library", cost: 620, minLevel: 4, requires: { office: 1 }, preview: "Two stories of walnut shelves and a rolling ladder." },
      { tier: 3, name: "Research Atrium", cost: 1680, minLevel: 7, requires: { residence: 2 }, preview: "A skylit atrium of books, screens, and quiet desks." },
    ],
  },
  {
    id: "gym",
    name: "Gym",
    baseName: "Pull-up Bar",
    purpose: "Stamina. Delivery tactics in Ventures gain +1 per tier.",
    tacticBonus: "execute",
    tiers: [
      { tier: 1, name: "Home Gym", cost: 180, minLevel: 2, requires: {}, preview: "A squat rack, kettlebells, and rubber floor in a spare room." },
      { tier: 2, name: "Training Studio", cost: 650, minLevel: 4, requires: {}, preview: "A street-level studio with a turf lane and rings." },
      { tier: 3, name: "Athletic Club", cost: 1680, minLevel: 7, requires: { residence: 2 }, preview: "A members club with a rooftop running track." },
    ],
  },
  {
    id: "workshop",
    name: "Workshop",
    baseName: "Workbench",
    purpose: "Making. Investment tactics in Ventures gain +1 per tier, and each tier adds collection display slots.",
    tacticBonus: "invest",
    collectionSlotsPerTier: 3,
    tiers: [
      { tier: 1, name: "Garage Workshop", cost: 200, minLevel: 3, requires: { residence: 1 }, preview: "A garage with pegboards, a 3D printer, and good light." },
      { tier: 2, name: "Maker Studio", cost: 700, minLevel: 5, requires: {} , preview: "A brick studio with a skylight, a laser cutter, and a lathe." },
      { tier: 3, name: "Fabrication Lab", cost: 1820, minLevel: 9, requires: { office: 2 }, preview: "A glass-front lab with robotic arms and prototypes on display." },
    ],
  },
  {
    id: "gardens",
    name: "Rooftop",
    baseName: "Bare Roof",
    purpose: "Hospitality. Negotiation tactics in Ventures gain +1 per tier, and each tier adds a decoration slot.",
    tacticBonus: "negotiate",
    decorationSlotsPerTier: 1,
    tiers: [
      { tier: 1, name: "Rooftop Planters", cost: 160, minLevel: 2, requires: {}, preview: "Cedar planters, string lights, and a few chairs on the roof." },
      { tier: 2, name: "Roof Garden", cost: 620, minLevel: 4, requires: { residence: 1 }, preview: "Lawn, a pergola, and a long dinner table above the street." },
      { tier: 3, name: "Sky Garden", cost: 1610, minLevel: 7, requires: { residence: 2 }, preview: "Terraced trees, a glasshouse bar, and a skyline view." },
    ],
  },
];

export const AREAS_BY_ID = new Map(AREAS.map((a) => [a.id, a]));

export const BASE_DECORATION_SLOTS = 1;
export const BASE_COLLECTION_SLOTS = 3;
