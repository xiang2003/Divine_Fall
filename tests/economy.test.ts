import { describe, expect, it } from 'vitest';
import { GOLD_DROPS, ITEM_VALUE, SELL_RATE, SHOPS } from '../src/data/economy';
import { EQUIP_SLOTS } from '../src/data/items';
import { LOOT_TABLES } from '../src/data/lootTables';
import { NPCS } from '../src/data/npcs';
import { RARITIES, type Rarity } from '../src/data/rarity';
import { buyEquipment, itemValue, rollGold, sellPrice } from '../src/systems/economy';
import { generateItem } from '../src/systems/LootSystem';
import { mulberry32 } from '../src/systems/rng';

describe('gold drops', () => {
  it('every loot table has a gold table, and a kill pays between min and max or nothing', () => {
    for (const id of Object.keys(LOOT_TABLES) as (keyof typeof LOOT_TABLES)[]) {
      const drop = GOLD_DROPS[id];
      expect(drop, id).toBeDefined();
      expect(drop.min).toBeGreaterThan(0);
      expect(drop.max).toBeGreaterThanOrEqual(drop.min);
      const rng = mulberry32(7);
      for (let i = 0; i < 300; i++) {
        const gold = rollGold(id, rng);
        expect(gold === 0 || (gold >= drop.min && gold <= drop.max), `${id}: ${gold}`).toBe(true);
      }
    }
  });

  it('elites and bosses always pay, and pay more than a normal monster', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      expect(rollGold('elite', rng)).toBeGreaterThan(0);
      expect(rollGold('boss', rng)).toBeGreaterThan(0);
    }
    expect(GOLD_DROPS.elite.min).toBeGreaterThan(GOLD_DROPS.normalMonster.max);
    expect(GOLD_DROPS.boss.min).toBeGreaterThan(GOLD_DROPS.elite.max);
  });

  it('a normal monster pays about 70% of the time', () => {
    const rng = mulberry32(11);
    let paid = 0;
    for (let i = 0; i < 2000; i++) if (rollGold('normalMonster', rng) > 0) paid++;
    expect(paid / 2000).toBeGreaterThan(0.65);
    expect(paid / 2000).toBeLessThan(0.75);
  });
});

describe('what items are worth', () => {
  it('a rarer item is worth more, and a merchant pays only a fraction', () => {
    const ranked = RARITIES.map((r) => ITEM_VALUE[r]);
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked);
    expect(new Set(ranked).size).toBe(RARITIES.length);
    expect(SELL_RATE).toBeLessThanOrEqual(0.25);
    for (const r of RARITIES) {
      const item = generateItem(r, mulberry32(5), 'ring');
      expect(itemValue(item)).toBe(ITEM_VALUE[item.rarity]);
      expect(sellPrice(item)).toBeLessThan(itemValue(item) / 3);
      expect(sellPrice(item)).toBeGreaterThanOrEqual(1);
    }
    const prices = RARITIES.map((r) => sellPrice(generateItem(r, mulberry32(5), 'weapon')));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('buying and selling back a piece of equipment loses most of the money, even in the best case', () => {
    for (const category of SHOPS.blacksmith!.categories) {
      const best = Math.max(...(['normal', 'magic', 'rare'] as Rarity[]).map((r) => sellPrice(generateItem(r, mulberry32(1), category.slot))));
      expect(best, category.slot).toBeLessThan(category.price);
    }
  });
});

describe('the blacksmith', () => {
  const shop = SHOPS.blacksmith!;

  it('sells every equipment slot, and the rarity weights are valid', () => {
    expect(shop.categories.map((c) => c.slot).sort()).toEqual([...EQUIP_SLOTS].sort());
    for (const c of shop.categories) expect(c.price).toBeGreaterThan(0);
    expect(Object.values(shop.rarityWeights).every((w) => w >= 0)).toBe(true);
    expect(shop.rarityWeights.normal).toBeGreaterThan(shop.rarityWeights.legendary);
  });

  it('gives an item of the chosen slot and charges its price', () => {
    for (const c of shop.categories) {
      const r = buyEquipment(shop, c.slot, 1000, 5, mulberry32(21));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.item.slot).toBe(c.slot);
        expect(r.price).toBe(c.price);
      }
    }
  });

  it('draws the rarity at random: all kinds turn up, the common ones most often', () => {
    const rng = mulberry32(99);
    const seen: Record<Rarity, number> = { normal: 0, magic: 0, rare: 0, legendary: 0 };
    for (let i = 0; i < 4000; i++) {
      const r = buyEquipment(shop, 'weapon', 1000, 5, rng);
      if (r.ok) seen[r.item.rarity]++;
    }
    expect(seen.normal).toBeGreaterThan(seen.magic);
    expect(seen.magic).toBeGreaterThan(seen.rare);
    expect(seen.rare).toBeGreaterThan(seen.legendary);
    expect(seen.legendary).toBeGreaterThan(0);
  });

  it('refuses, and draws nothing, when the player cannot pay or has no room', () => {
    let draws = 0;
    const rng = () => {
      draws++;
      return 0.5;
    };
    expect(buyEquipment(shop, 'weapon', 79, 5, rng)).toEqual({ ok: false, reason: 'gold' });
    expect(buyEquipment(shop, 'weapon', 500, 0, rng)).toEqual({ ok: false, reason: 'full' });
    expect(buyEquipment(shop, 'weapon', 500, 3, rng).ok).toBe(true);
    expect(draws).toBeGreaterThan(0);
    const before = draws;
    expect(buyEquipment(shop, 'weapon', 0, 3, rng).ok).toBe(false);
    expect(draws).toBe(before);
  });

  it('is run by Tieshan, whose menu offers it', () => {
    const topic = NPCS.blacksmith_tieshan!.conversation.topics.find((t) => t.kind === 'shop');
    expect(topic?.shop).toBe('blacksmith');
    expect(SHOPS[topic!.shop!]).toBeDefined();
  });
});
