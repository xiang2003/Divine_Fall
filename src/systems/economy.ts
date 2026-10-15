import { GOLD_DROPS, ITEM_VALUE, SELL_RATE, type ShopDef } from '../data/economy';
import type { EquipSlot, ItemInstance } from '../data/items';
import type { LootTableId } from '../data/lootTables';
import { generateItem, rollRarity } from './LootSystem';
import type { Rng } from './rng';

/** How much gold a kill leaves behind (0 for nothing). */
export function rollGold(table: LootTableId, rng: Rng): number {
  const drop = GOLD_DROPS[table];
  if (rng() >= drop.chance) return 0;
  return drop.min + Math.min(drop.max - drop.min, Math.floor(rng() * (drop.max - drop.min + 1)));
}

/** What the item is worth (what a merchant would sell it for). */
export function itemValue(item: ItemInstance): number {
  return ITEM_VALUE[item.rarity];
}

/** What a merchant pays for the item: a fifth of its value, at least 1. */
export function sellPrice(item: ItemInstance): number {
  return Math.max(1, Math.floor(itemValue(item) * SELL_RATE));
}

export type BuyResult = { ok: true; item: ItemInstance; price: number } | { ok: false; reason: 'unknown' | 'gold' | 'full' };

/**
 * Buys one piece of equipment from a category: the price is fixed, the rarity (and so the item) is drawn at random.
 * Nothing is drawn, and nothing is charged, if the player cannot pay or has no room for it.
 */
export function buyEquipment(shop: ShopDef, slot: EquipSlot, gold: number, freeSlots: number, rng: Rng): BuyResult {
  const category = shop.categories.find((c) => c.slot === slot);
  if (!category) return { ok: false, reason: 'unknown' };
  if (gold < category.price) return { ok: false, reason: 'gold' };
  if (freeSlots < 1) return { ok: false, reason: 'full' };
  const rarity = rollRarity(shop.rarityWeights, rng);
  return { ok: true, item: generateItem(rarity, rng, slot), price: category.price };
}
