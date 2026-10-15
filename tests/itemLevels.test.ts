import { describe, expect, it } from 'vitest';
import { AFFIXES } from '../src/data/affixes';
import { SHOPS } from '../src/data/economy';
import {
  BASE_ITEMS,
  BASE_TIER_LEVELS,
  EQUIP_SLOTS,
  ITEM_GROWTH,
  LEGENDARIES,
  getBaseItem,
  isFlatStat,
  itemLevel,
  levelScale,
  requiredLevel,
  scaleStat,
  type ItemInstance,
  type StatKey,
} from '../src/data/items';
import { LOOT_TABLES } from '../src/data/lootTables';
import { POTIONS } from '../src/data/potions';
import { monsterDamageMultiplier } from '../src/data/progression';
import { buyEquipment, itemValue, priceAtLevel, sellPrice } from '../src/systems/economy';
import { describeItem } from '../src/systems/itemText';
import { createPlainItem, generateItem, generateLegendary, rollLoot } from '../src/systems/LootSystem';
import { mulberry32 } from '../src/systems/rng';
import { computeStats, emptyEquipment, type Equipment } from '../src/systems/stats';

describe('base items and their tiers', () => {
  it('every slot has a base item at each of the ten tier levels, with unique ids', () => {
    const ids = BASE_ITEMS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const slot of EQUIP_SLOTS) {
      const levels = BASE_ITEMS.filter((b) => b.slot === slot).map((b) => b.level).sort((a, b) => a - b);
      expect(levels, slot).toEqual([...BASE_TIER_LEVELS]);
    }
  });

  it('a higher tier is never weaker: the flat stats of a slot do not fall from one tier to the next', () => {
    for (const slot of EQUIP_SLOTS) {
      const tiers = BASE_ITEMS.filter((b) => b.slot === slot).sort((a, b) => a.level - b.level);
      for (const stat of ['damage', 'armor', 'maxHp'] as StatKey[]) {
        for (let i = 1; i < tiers.length; i++) {
          const before = tiers[i - 1]!.base[stat];
          const after = tiers[i]!.base[stat];
          // (a tier that does not carry the stat at all is a different kind of piece: the robe has life, the mail has more armor)
          if (before !== undefined && after !== undefined) expect(after, `${slot} ${stat} at ${tiers[i]!.level}`).toBeGreaterThanOrEqual(before);
        }
      }
    }
  });

  it('the old bases are what they were, and the new ones grow 6% a level from the best before them', () => {
    expect(getBaseItem('sword_rusty')).toMatchObject({ level: 1, base: { damage: 4 } });
    expect(getBaseItem('sword_steel')).toMatchObject({ level: 8, base: { damage: 7 } });
    expect(getBaseItem('chest_mail')).toMatchObject({ level: 8, base: { armor: 12 } });
    expect(getBaseItem('weapon_t80').base.damage).toBe(Math.round(10 * Math.pow(ITEM_GROWTH, 64)));
    expect(getBaseItem('helmet_t16').base.armor).toBe(Math.round(8 * Math.pow(ITEM_GROWTH, 8)));
    // percentages do not grow: the ring keeps its one point of crit chance at every tier
    expect(getBaseItem('ring_t80').base.critChancePct).toBe(1);
    expect(getBaseItem('ring_t80').base.maxHp).toBeGreaterThan(getBaseItem('ring_silver').base.maxHp!);
  });

  it('every legendary stands on a base that exists, and asks for three levels more than it', () => {
    for (const l of LEGENDARIES) {
      const item = generateLegendary(l.id, mulberry32(1), 30);
      expect(requiredLevel(item)).toBe(getBaseItem(l.baseId).level + 3);
    }
  });
});

describe('item level', () => {
  it('flat numbers grow 6% a level and percentages stay as they are', () => {
    expect(levelScale(1)).toBe(1);
    expect(levelScale(11)).toBeCloseTo(Math.pow(1.06, 10), 9);
    expect(isFlatStat('maxHp') && isFlatStat('damage') && isFlatStat('armor')).toBe(true);
    for (const stat of ['critChancePct', 'attackSpeedPct', 'fireResPct', 'freezeBuildup', 'dotDamagePct'] as StatKey[]) {
      expect(isFlatStat(stat), stat).toBe(false);
      expect(scaleStat(stat, 9, 80), stat).toBe(9);
    }
    expect(scaleStat('maxHp', 20, 1)).toBe(20);
    expect(scaleStat('maxHp', 20, 51)).toBe(Math.round(20 * Math.pow(1.06, 50)));
    expect(scaleStat('damage', 1, 1)).toBeGreaterThanOrEqual(1);
  });

  it('an item remembers its level, an old one without a level counts as level 1, and the affixes are rolled for the level', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 80; i++) {
      const ilvl = 1 + Math.floor(rng() * 90);
      const item = generateItem(i % 2 ? 'rare' : 'magic', rng, undefined, ilvl);
      expect(item.ilvl).toBe(ilvl);
      for (const mod of item.mods) {
        const a = AFFIXES.find((x) => x.id === mod.affixId)!;
        const scale = isFlatStat(a.stat) ? levelScale(ilvl) : 1;
        expect(mod.value, `${a.id} at ${ilvl}`).toBeGreaterThanOrEqual(Math.max(1, Math.round(a.min * scale)));
        expect(mod.value, `${a.id} at ${ilvl}`).toBeLessThanOrEqual(Math.round(a.max * scale));
      }
    }
    expect(itemLevel({})).toBe(1);
    expect(itemLevel({ ilvl: 37 })).toBe(37);
    expect(generateItem('rare', mulberry32(1)).ilvl).toBe(1);
  });

  it('the base is one of the best few the level allows: nothing above the level, and an old base stops dropping once much better ones can', () => {
    const rng = mulberry32(21);
    for (const ilvl of [1, 5, 8, 15, 30, 60, 100]) {
      const seen = new Set<number>();
      for (let i = 0; i < 300; i++) {
        const item = generateItem('normal', rng, 'weapon', ilvl);
        seen.add(getBaseItem(item.baseId).level);
      }
      const allowed = BASE_TIER_LEVELS.filter((l) => l <= ilvl);
      expect(Math.max(...seen), `ilvl ${ilvl}`).toBeLessThanOrEqual(ilvl);
      expect(Math.min(...seen), `ilvl ${ilvl}`).toBeGreaterThanOrEqual(allowed[Math.max(0, allowed.length - 3)]!);
      expect(seen.has(allowed[allowed.length - 1]!), `ilvl ${ilvl} reaches its best base`).toBe(true);
    }
  });

  it('a kill drops items of the level of the monster, boss drops and guaranteed ones included', () => {
    const rng = mulberry32(5);
    for (const table of Object.values(LOOT_TABLES)) {
      for (let i = 0; i < 20; i++) for (const item of rollLoot(table, rng, 27)) expect(item.ilvl).toBe(27);
    }
    expect(rollLoot(LOOT_TABLES.boss, mulberry32(1)).every((i) => i.ilvl === 1)).toBe(true);
  });

  it('a plain starter item is level 1', () => {
    const sword = createPlainItem('sword_rusty', mulberry32(1));
    expect(itemLevel(sword)).toBe(1);
    expect(requiredLevel(sword)).toBe(1);
  });

  it('the tooltip says the item level and the level it needs', () => {
    const rare = generateItem('rare', mulberry32(2), 'helmet', 40);
    const d = describeItem(rare);
    expect(d.itemLevel).toBe(40);
    expect(d.requiredLevel).toBe(getBaseItem(rare.baseId).level);
    expect(d.requiredLevel).toBeLessThanOrEqual(40);
  });
});

describe('what the gold does with the level', () => {
  it('an item is worth more the higher its level, and a merchant still pays a fifth', () => {
    const low = generateItem('rare', mulberry32(3), 'ring', 1);
    const high = generateItem('rare', mulberry32(3), 'ring', 41);
    expect(itemValue(high)).toBe(Math.round(itemValue(low) * levelScale(41)));
    expect(sellPrice(high)).toBeGreaterThan(sellPrice(low) * 8);
    expect(sellPrice(high)).toBeLessThan(itemValue(high) / 4);
  });

  it('the price of equipment grows with the level of the character like the gold of monsters', () => {
    expect(priceAtLevel(80, 1)).toBe(80);
    expect(priceAtLevel(80, 31)).toBeCloseTo(80 * Math.pow(1.06, 30), 6);
  });

  it('what a shop sells is made for the level of the character, give or take two', () => {
    const shop = SHOPS.blacksmith!;
    const rng = mulberry32(31);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const r = buyEquipment(shop, 'weapon', 1e9, 5, rng, 1, 40);
      expect(r.ok).toBe(true);
      if (r.ok) seen.add(itemLevel(r.item));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([38, 39, 40, 41, 42]);
    const first = buyEquipment(shop, 'weapon', 1e9, 5, mulberry32(1), 1, 1);
    expect(first.ok && itemLevel(first.item)).toBeGreaterThanOrEqual(1); // never below level 1
  });
});

describe('potions heal a share of the maximum', () => {
  it('both potions restore a fraction, so that they stay worth drinking at every level', () => {
    expect(POTIONS.health.fraction).toBeGreaterThan(0);
    expect(POTIONS.health.fraction).toBeLessThanOrEqual(1);
    expect(POTIONS.mana.fraction).toBeGreaterThan(0);
    expect(POTIONS.health.description).toContain('%');
  });
});

describe('gear keeps up with the monsters', () => {
  /** A set of five items of a level, half magic and half rare, the best bases that level allows. */
  function randomSet(level: number, rng: () => number): Equipment {
    const eq = emptyEquipment();
    for (const slot of EQUIP_SLOTS) eq[slot] = generateItem(rng() < 0.5 ? 'magic' : 'rare', rng, slot, level);
    return eq;
  }
  const average = (level: number, pick: (s: ReturnType<typeof computeStats>) => number): number => {
    const rng = mulberry32(level * 7 + 1);
    let sum = 0;
    for (let i = 0; i < 300; i++) sum += pick(computeStats(randomSet(level, rng), level));
    return sum / 300;
  };

  it('a character of a level in gear of that level hits about as hard as the monsters of that level need (damage follows 12 x 1.06^(level - 1))', () => {
    for (const level of [1, 10, 20, 30, 40, 60, 80, 100]) {
      const expected = 12 * Math.pow(1.06, level - 1);
      const ratio = average(level, (s) => s.damage) / expected;
      expect(ratio, `level ${level}: damage ratio ${ratio.toFixed(2)}`).toBeGreaterThan(0.55);
      expect(ratio, `level ${level}: damage ratio ${ratio.toFixed(2)}`).toBeLessThan(3);
    }
  });

  it('and has about the life that the damage of monsters of that level asks for (life follows 100 x 1.045^(level - 1))', () => {
    for (const level of [1, 10, 20, 30, 40, 60, 80, 100]) {
      const expected = 100 * Math.pow(1.045, level - 1);
      const ratio = average(level, (s) => s.maxHp) / expected;
      expect(ratio, `level ${level}: life ratio ${ratio.toFixed(2)}`).toBeGreaterThan(0.6);
      expect(ratio, `level ${level}: life ratio ${ratio.toFixed(2)}`).toBeLessThan(3.5);
    }
    expect(monsterDamageMultiplier(1)).toBe(1);
  });

  it('gear of a much higher level is clearly stronger, and gear is never stronger than its level pays for', () => {
    expect(average(60, (s) => s.damage)).toBeGreaterThan(average(30, (s) => s.damage) * 3);
    expect(average(60, (s) => s.maxHp)).toBeGreaterThan(average(30, (s) => s.maxHp) * 2);
  });

  it('items that nothing in the game can drop are not made: no item has a base above its level', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 400; i++) {
      const level = 1 + Math.floor(rng() * 100);
      const item: ItemInstance = generateItem('rare', rng, undefined, level);
      expect(getBaseItem(item.baseId).level).toBeLessThanOrEqual(level);
    }
  });
});
