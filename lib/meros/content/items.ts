/**
 * Item catalog: cosmetic equipment (worn; small bounded battle modifiers), estate decorations
 * (placed on the estate; purely visual), and collectible components (stackable keepsakes shown in
 * the collection). Nothing here ever changes real-world XP or scoring eligibility.
 *
 * Equipment trades stats off against each other so no single loadout wins every scenario.
 */

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type Stat = "insight" | "execution" | "influence";
export type EquipSlot = "outfit" | "headwear" | "handheld" | "accessory";
export type ItemKind = "cosmetic" | "decoration" | "component";

export interface ItemDefinition {
  id: string;
  kind: ItemKind;
  name: string;
  rarity: Rarity;
  description: string;
  slot?: EquipSlot;
  stats?: Partial<Record<Stat, number>>;
  /** Unique items convert to Estate Credits when a duplicate drops. Components stack. */
  unique: boolean;
  /** Key into the art layer catalog (components/meros/art). */
  art: string;
  /** Primary color used by the art layer. */
  color: string;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

/** Duplicate unique items convert to this many Estate Credits (documented in the odds view). */
export const DUPLICATE_CONVERSION: Record<Rarity, number> = { common: 20, uncommon: 40, rare: 90, legendary: 220 };

/** Most bonus any one stat may receive from all equipped items together. */
export const EQUIPMENT_STAT_CAP = 5;

const c = (
  id: string,
  slot: EquipSlot,
  rarity: Rarity,
  name: string,
  description: string,
  stats: Partial<Record<Stat, number>>,
  art: string,
  color: string,
): ItemDefinition => ({ id, kind: "cosmetic", slot, rarity, name, description, stats, unique: true, art, color });

export const ITEMS: ItemDefinition[] = [
  // Outfits
  c("outfit-canvas-overshirt", "outfit", "common", "Canvas Overshirt", "Sturdy, unfussy, ready for work.", { execution: 1 }, "overshirt", "#3B4A5A"),
  c("outfit-oxford-shirt", "outfit", "common", "Oxford Shirt", "Crisp enough for a meeting, relaxed enough for the workshop.", { influence: 1 }, "oxford", "#E8E4DC"),
  c("outfit-knit-sweater", "outfit", "common", "Study Sweater", "Warm, quiet, good for long reading.", { insight: 1 }, "sweater", "#5A1A1F"),
  c("outfit-field-vest", "outfit", "uncommon", "Field Vest", "Pockets for every tool. Hands stay free.", { execution: 2, influence: -1 }, "vest", "#2F4F3E"),
  c("outfit-tailored-blazer", "outfit", "uncommon", "Tailored Blazer", "Cut to fit. People notice that you showed up prepared.", { influence: 2, execution: -1 }, "blazer", "#1A1A1E"),
  c("outfit-archivist-cardigan", "outfit", "uncommon", "Archivist Cardigan", "For the one who reads the appendix.", { insight: 2, influence: -1 }, "cardigan", "#4A4A52"),
  c("outfit-three-piece", "outfit", "rare", "Three-Piece Suit", "The full set. Commands a room, slows you down on the floor.", { influence: 3, insight: 1, execution: -1 }, "suit", "#14161B"),
  c("outfit-workshop-apron", "outfit", "rare", "Master's Apron", "Leather, brass rivets, years of use ahead.", { execution: 3, insight: 1, influence: -1 }, "apron", "#6B4A32"),
  c("outfit-founders-coat", "outfit", "legendary", "Founder's Coat", "Long, warm, unmistakable. Balanced for any table.", { influence: 2, execution: 2, insight: 1 }, "coat", "#8A0F1A"),
  // Headwear
  c("head-wool-beanie", "headwear", "common", "Wool Beanie", "Early mornings, cold gyms.", { execution: 1 }, "beanie", "#2E3440"),
  c("head-reading-band", "headwear", "common", "Focus Headband", "Keeps hair out of the way of the page.", { insight: 1 }, "headband", "#8A0F1A"),
  c("head-flat-cap", "headwear", "uncommon", "Flat Cap", "A tradesman's cap with a negotiator's smile.", { influence: 1, execution: 1 }, "flatcap", "#4A3A2A"),
  c("head-explorer-hat", "headwear", "uncommon", "Explorer Hat", "For walking new markets.", { insight: 2, execution: -1 }, "explorer", "#7A6A52"),
  c("head-fedora", "headwear", "rare", "Charcoal Fedora", "Classic and confident.", { influence: 2, insight: 1 }, "fedora", "#1A1A1E"),
  c("head-laurel", "headwear", "legendary", "Laurel of Constancy", "Woven from a hundred ordinary mornings.", { insight: 2, influence: 2 }, "laurel", "#D1AA55"),
  // Handheld
  c("hand-pocket-notebook", "handheld", "common", "Pocket Notebook", "Write it down before you forget it.", { insight: 1 }, "notebook", "#E8E4DC"),
  c("hand-steel-thermos", "handheld", "common", "Steel Thermos", "Hot coffee, long shift.", { execution: 1 }, "thermos", "#6B6B70"),
  c("hand-fountain-pen", "handheld", "uncommon", "Fountain Pen", "Signatures carry weight.", { influence: 2, insight: -1 }, "pen", "#14161B"),
  c("hand-multitool", "handheld", "uncommon", "Multitool", "Fix it now, not next week.", { execution: 2, influence: -1 }, "multitool", "#8A0F1A"),
  c("hand-ledger", "handheld", "rare", "Leather Ledger", "Every number in its place.", { insight: 3, execution: -1 }, "ledger", "#5A3A22"),
  c("hand-brass-compass", "handheld", "rare", "Brass Compass", "Points somewhere worth going.", { insight: 1, execution: 2 }, "compass", "#B08D57"),
  c("hand-gavel", "handheld", "legendary", "Chairman's Gavel", "Ends the debate, starts the work.", { influence: 3, execution: 1 }, "gavel", "#3A2414"),
  // Accessories
  c("acc-canvas-watch", "accessory", "common", "Canvas-Strap Watch", "On time, every time.", { execution: 1 }, "watch", "#2E3440"),
  c("acc-round-glasses", "accessory", "common", "Round Glasses", "See the fine print.", { insight: 1 }, "glasses", "#0E0E10"),
  c("acc-lapel-pin", "accessory", "uncommon", "Lapel Pin", "A small signal of membership.", { influence: 1, insight: 1 }, "pin", "#D1AA55"),
  c("acc-silk-scarf", "accessory", "uncommon", "Silk Scarf", "A flourish for the pitch.", { influence: 2, execution: -1 }, "scarf", "#8A0F1A"),
  c("acc-signet-ring", "accessory", "rare", "Signet Ring", "Your mark, pressed in wax.", { influence: 2, execution: 1 }, "ring", "#D1AA55"),
  c("acc-satchel", "accessory", "legendary", "Heritage Satchel", "Carries plans, carries weight, lasts a lifetime.", { insight: 2, execution: 2 }, "satchel", "#5A3A22"),

  // Decorations (placed on the estate; visual only)
  ...(
    [
      ["decor-lanterns", "common", "String Lanterns", "Warm light along the path.", "lanterns", "#FFB703"],
      ["decor-bench", "common", "Garden Bench", "A place to sit and plan.", "bench", "#8D6E63"],
      ["decor-flowerbeds", "common", "Flower Beds", "Color by the front walk.", "flowers", "#FF5D8F"],
      ["decor-birdbath", "uncommon", "Stone Birdbath", "Visitors with feathers.", "birdbath", "#A8DADC"],
      ["decor-weathervane", "uncommon", "Copper Weathervane", "Reads the wind on the roof.", "weathervane", "#B87333"],
      ["decor-banner", "uncommon", "House Banner", "Your colors on the gate.", "banner", "#E63946"],
      ["decor-fountain", "rare", "Courtyard Fountain", "Quiet water at the center of it all.", "fountain", "#4CC9F0"],
      ["decor-telescope", "rare", "Brass Telescope", "For clear nights on the terrace.", "telescope", "#C9A227"],
      ["decor-statue", "legendary", "Statue of the First Step", "A figure mid-stride. It never stops walking.", "statue", "#E9ECEF"],
      ["decor-observatory-dome", "legendary", "Rooftop Observatory", "A copper dome that opens to the stars.", "observatory", "#2EC4B6"],
    ] as const
  ).map(
    ([id, rarity, name, description, art, color]): ItemDefinition => ({
      id,
      kind: "decoration",
      rarity,
      name,
      description,
      unique: true,
      art,
      color,
    }),
  ),

  // Collectible components (stack; shown in the collection)
  ...(
    [
      ["comp-oak-plank", "common", "Oak Plank", "Seasoned timber from the estate grove.", "plank", "#A47148"],
      ["comp-brass-fitting", "common", "Brass Fitting", "A small, well-made part.", "fitting", "#C9A227"],
      ["comp-stained-glass", "uncommon", "Stained Glass Pane", "Light in colors.", "glass", "#7B2CBF"],
      ["comp-blueprint", "uncommon", "Blueprint Fragment", "Part of a larger plan.", "blueprint", "#3A86FF"],
      ["comp-gold-leaf", "rare", "Gold Leaf", "Thin as breath, bright as noon.", "goldleaf", "#FFD60A"],
      ["comp-keystone", "legendary", "Keystone", "The stone that holds the arch together.", "keystone", "#ADB5BD"],
    ] as const
  ).map(
    ([id, rarity, name, description, art, color]): ItemDefinition => ({
      id,
      kind: "component",
      rarity,
      name,
      description,
      unique: false,
      art,
      color,
    }),
  ),
];

export const ITEMS_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function itemById(id: string): ItemDefinition | undefined {
  return ITEMS_BY_ID.get(id);
}
