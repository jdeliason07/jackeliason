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
    name: "Main Residence",
    baseName: "Timber Cottage",
    purpose: "Home base. Each tier adds a decoration slot on the grounds and changes the house itself.",
    decorationSlotsPerTier: 1,
    tiers: [
      { tier: 1, name: "Stone Farmhouse", cost: 200, minLevel: 2, requires: {}, preview: "Stone walls, a second chimney, and a porch light." },
      { tier: 2, name: "Gabled Manor", cost: 670, minLevel: 4, requires: {}, preview: "A second story, tall windows, and a slate roof." },
      { tier: 3, name: "Hilltop Hall", cost: 1750, minLevel: 8, requires: { gardens: 2 }, preview: "A grand hall with a clock tower and lit terrace." },
    ],
  },
  {
    id: "office",
    name: "Office",
    baseName: "Folding Desk",
    purpose: "Ventures HQ. Higher tiers add starting Capital in every business battle (+1 at tier 2, +2 at tier 3).",
    capitalByTier: [0, 0, 1, 2],
    tiers: [
      { tier: 1, name: "Corner Office", cost: 220, minLevel: 2, requires: { residence: 1 }, preview: "A small brick office with a brass nameplate." },
      { tier: 2, name: "Studio Office", cost: 720, minLevel: 5, requires: { residence: 1 }, preview: "Glass front, a meeting table, and a whiteboard wall." },
      { tier: 3, name: "Headquarters", cost: 1890, minLevel: 9, requires: { residence: 2, library: 2 }, preview: "Three floors with a rooftop flag." },
    ],
  },
  {
    id: "library",
    name: "Library",
    baseName: "Book Crate",
    purpose: "Research. Research tactics in Ventures gain +1 per tier.",
    tacticBonus: "research",
    tiers: [
      { tier: 1, name: "Reading Nook", cost: 180, minLevel: 2, requires: {}, preview: "A cozy room with a round window and full shelves." },
      { tier: 2, name: "Study Library", cost: 620, minLevel: 4, requires: { office: 1 }, preview: "Two stories of shelves and a rolling ladder." },
      { tier: 3, name: "Domed Library", cost: 1680, minLevel: 7, requires: { residence: 2 }, preview: "A copper dome and a reading room under it." },
    ],
  },
  {
    id: "gym",
    name: "Gym",
    baseName: "Pull-up Bar",
    purpose: "Stamina. Delivery tactics in Ventures gain +1 per tier.",
    tacticBonus: "execute",
    tiers: [
      { tier: 1, name: "Yard Gym", cost: 180, minLevel: 2, requires: {}, preview: "A covered rack, kettlebells, and a chalk bucket." },
      { tier: 2, name: "Training Barn", cost: 650, minLevel: 4, requires: {}, preview: "A red barn with a turf lane and rings." },
      { tier: 3, name: "Athletic Club", cost: 1680, minLevel: 7, requires: { residence: 2 }, preview: "A clubhouse with a track ringing the grounds." },
    ],
  },
  {
    id: "workshop",
    name: "Workshop",
    baseName: "Tool Bench",
    purpose: "Making. Investment tactics in Ventures gain +1 per tier, and each tier adds collection display slots.",
    tacticBonus: "invest",
    collectionSlotsPerTier: 3,
    tiers: [
      { tier: 1, name: "Tool Shed", cost: 200, minLevel: 3, requires: { residence: 1 }, preview: "A shed with pegboards and a workbench light." },
      { tier: 2, name: "Maker's Workshop", cost: 700, minLevel: 5, requires: {} , preview: "A brick workshop with a skylight and lathe." },
      { tier: 3, name: "Foundry", cost: 1820, minLevel: 9, requires: { office: 2 }, preview: "A foundry with a tall stack and glowing windows." },
    ],
  },
  {
    id: "gardens",
    name: "Gardens",
    baseName: "Wild Lot",
    purpose: "Hospitality. Negotiation tactics in Ventures gain +1 per tier, and each tier adds a decoration slot.",
    tacticBonus: "negotiate",
    decorationSlotsPerTier: 1,
    tiers: [
      { tier: 1, name: "Kitchen Garden", cost: 160, minLevel: 2, requires: {}, preview: "Raised beds, a path, and a little gate." },
      { tier: 2, name: "Formal Garden", cost: 620, minLevel: 4, requires: { residence: 1 }, preview: "Hedges, a pergola, and a lily pond." },
      { tier: 3, name: "Botanical Terrace", cost: 1610, minLevel: 7, requires: { residence: 2 }, preview: "Terraced beds, a glasshouse, and an orchard." },
    ],
  },
];

export const AREAS_BY_ID = new Map(AREAS.map((a) => [a.id, a]));

export const BASE_DECORATION_SLOTS = 1;
export const BASE_COLLECTION_SLOTS = 3;
