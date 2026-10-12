import { RARITIES, type Rarity } from './rarity';

/** Starting drop weights for the rarity roll (65 / 25 / 9 / 1). Initial design values, not final balance. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  normal: 65,
  magic: 25,
  rare: 9,
  legendary: 1,
};

export interface LootTable {
  /** Probability that each roll produces an item. */
  dropChance: number;
  /** Number of independent drop rolls per kill. */
  rolls: number;
  rarityWeights: Record<Rarity, number>;
  /** Pity: at least `count` items of `minRarity` or better are always produced (extra items are added if needed). */
  guaranteed?: readonly { minRarity: Rarity; count: number }[];
}

export const LOOT_TABLES = {
  normalMonster: {
    dropChance: 0.5,
    rolls: 1,
    rarityWeights: RARITY_WEIGHTS,
  },
  /** Used by bosses from Phase 4: always drops several items, at least one rare or better. */
  boss: {
    dropChance: 1,
    rolls: 4,
    rarityWeights: RARITY_WEIGHTS,
    guaranteed: [{ minRarity: 'rare', count: 1 }],
  },
} as const satisfies Record<string, LootTable>;

export type LootTableId = keyof typeof LOOT_TABLES;

/** Rarities that are at least `min`, weakest first. */
export function raritiesAtLeast(min: Rarity): Rarity[] {
  return RARITIES.slice(RARITIES.indexOf(min));
}
