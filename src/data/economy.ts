import type { EquipSlot } from './items';
import type { LootTableId } from './lootTables';
import type { Rarity } from './rarity';

/** The money of the continent: gold that fell with the gods ("fallen gold"). */
export const GOLD_NAME = '墜金';

/** What a kill drops, per loot table (so elites and bosses pay more). Initial design values, not final balance. */
export const GOLD_DROPS: Record<LootTableId, { chance: number; min: number; max: number }> = {
  normalMonster: { chance: 0.7, min: 2, max: 6 },
  elite: { chance: 1, min: 14, max: 26 },
  boss: { chance: 1, min: 100, max: 160 },
};

/** What an item is worth, by rarity. A merchant pays only SELL_RATE of it, so selling a find is a poor deal compared with keeping or wearing it. */
export const ITEM_VALUE: Record<Rarity, number> = {
  normal: 20,
  magic: 60,
  rare: 180,
  legendary: 700,
};
export const SELL_RATE = 0.2;

export interface ShopDef {
  id: string;
  /** What the merchant sells: the player picks a category and pays its price; the rarity of what comes out is drawn at random. */
  categories: readonly { slot: EquipSlot; price: number }[];
  /** Weights of the rarity draw (a slot without a legendary gives a rare instead). */
  rarityWeights: Record<Rarity, number>;
}

export const SHOPS: Record<string, ShopDef> = {
  blacksmith: {
    id: 'blacksmith',
    categories: [
      { slot: 'weapon', price: 80 },
      { slot: 'helmet', price: 50 },
      { slot: 'chest', price: 70 },
      { slot: 'boots', price: 50 },
      { slot: 'ring', price: 90 },
    ],
    rarityWeights: { normal: 55, magic: 32, rare: 12, legendary: 1 },
  },
};
