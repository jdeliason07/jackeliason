import { DUPLICATE_CONVERSION, ITEMS, type ItemDefinition, type ItemKind, type Rarity } from "../content/items";
import { intBetween, type Rng, weightedPick } from "./random";

/**
 * One transparent, versioned loot table. Every chest contains Estate Credits plus one item of the
 * rolled rarity, so every chest has usable value. A duplicate of a unique item converts to a
 * documented number of credits. No XP, no real money, no paid retries, no scoring eligibility.
 */

export interface LootTable {
  version: number;
  rarityWeights: Record<Rarity, number>;
  credits: Record<Rarity, { min: number; max: number }>;
  itemKindWeights: Record<ItemKind, number>;
}

export const LOOT_TABLE_V1: LootTable = {
  version: 1,
  rarityWeights: { common: 65, uncommon: 25, rare: 9, legendary: 1 },
  credits: {
    common: { min: 20, max: 35 },
    uncommon: { min: 35, max: 55 },
    rare: { min: 60, max: 90 },
    legendary: { min: 120, max: 180 },
  },
  itemKindWeights: { cosmetic: 50, component: 30, decoration: 20 },
};

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "legendary"];

export interface ChestOutcome {
  lootTableVersion: number;
  rarity: Rarity;
  credits: number;
  itemId: string;
  itemKind: ItemKind;
  /** Set when the item is a unique the owner already has: converted to credits instead. */
  duplicateCredits: number;
}

export function itemPool(rarity: Rarity, kind: ItemKind, items: ItemDefinition[] = ITEMS): ItemDefinition[] {
  return items.filter((i) => i.rarity === rarity && i.kind === kind);
}

export function resolveChest(rng: Rng, ownedUniqueItemIds: ReadonlySet<string>, table: LootTable = LOOT_TABLE_V1): ChestOutcome {
  const rarity = weightedPick(
    RARITIES.map((r) => ({ r, weight: table.rarityWeights[r] })),
    rng,
  ).r;
  const credits = intBetween(table.credits[rarity].min, table.credits[rarity].max, rng);
  const kinds = (Object.keys(table.itemKindWeights) as ItemKind[]).filter((k) => itemPool(rarity, k).length > 0);
  const kind = weightedPick(
    kinds.map((k) => ({ k, weight: table.itemKindWeights[k] })),
    rng,
  ).k;
  const pool = itemPool(rarity, kind);
  const item = pool[Math.floor(rng() * pool.length)];
  const duplicate = item.unique && ownedUniqueItemIds.has(item.id);
  return {
    lootTableVersion: table.version,
    rarity,
    credits,
    itemId: item.id,
    itemKind: item.kind,
    duplicateCredits: duplicate ? DUPLICATE_CONVERSION[rarity] : 0,
  };
}

export interface OddsRow {
  rarity: Rarity;
  percent: number;
  credits: string;
  items: { kind: ItemKind; percent: number; count: number }[];
  duplicateCredits: number;
}

/** Displayed in the chest info view. Percentages sum to 100. */
export function oddsSummary(table: LootTable = LOOT_TABLE_V1): OddsRow[] {
  const total = RARITIES.reduce((s, r) => s + table.rarityWeights[r], 0);
  return RARITIES.map((rarity) => {
    const kinds = (Object.keys(table.itemKindWeights) as ItemKind[]).filter((k) => itemPool(rarity, k).length > 0);
    const kindTotal = kinds.reduce((s, k) => s + table.itemKindWeights[k], 0);
    return {
      rarity,
      percent: (table.rarityWeights[rarity] / total) * 100,
      credits: `${table.credits[rarity].min}–${table.credits[rarity].max}`,
      items: kinds.map((kind) => ({
        kind,
        percent: (table.itemKindWeights[kind] / kindTotal) * 100,
        count: itemPool(rarity, kind).length,
      })),
      duplicateCredits: DUPLICATE_CONVERSION[rarity],
    };
  });
}

/** Expected credits per chest before duplicate conversion, for the balance report. */
export function expectedChestCredits(table: LootTable = LOOT_TABLE_V1): number {
  const total = RARITIES.reduce((s, r) => s + table.rarityWeights[r], 0);
  return RARITIES.reduce(
    (s, r) => s + (table.rarityWeights[r] / total) * ((table.credits[r].min + table.credits[r].max) / 2),
    0,
  );
}
