import { describe, expect, it } from 'vitest';
import { AFFIXES, affixesForSlot, getAffix } from '../src/data/affixes';
import { EQUIP_SLOTS, LEGENDARIES, getBaseItem } from '../src/data/items';
import { LEGENDARY_EFFECT_TEXT } from '../src/data/legendaryEffects';
import { LOOT_TABLES, RARITY_WEIGHTS } from '../src/data/lootTables';
import { RARITIES, rarityRank, type Rarity } from '../src/data/rarity';
import { createPlainItem, generateItem, generateLegendary, rollLoot, rollRarity } from '../src/systems/LootSystem';
import { mulberry32 } from '../src/systems/rng';

describe('data integrity', () => {
  it('every affix range is valid and applies to at least one slot', () => {
    for (const a of AFFIXES) {
      expect(a.min).toBeGreaterThan(0);
      expect(a.max).toBeGreaterThanOrEqual(a.min);
      expect(a.slots.length).toBeGreaterThan(0);
      expect(a.text).toContain('{value}');
    }
  });

  it('every slot has base items and affixes to roll', () => {
    for (const slot of EQUIP_SLOTS) {
      expect(affixesForSlot(slot).length).toBeGreaterThanOrEqual(3); // enough for a 3-4 affix rare
      expect(generateItem('normal', mulberry32(1), slot).slot).toBe(slot);
    }
  });

  it('there are at least three legendaries, each with a unique effect and valid references', () => {
    expect(LEGENDARIES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(LEGENDARIES.map((l) => l.effect)).size).toBe(LEGENDARIES.length);
    for (const l of LEGENDARIES) {
      expect(getBaseItem(l.baseId)).toBeTruthy();
      expect(LEGENDARY_EFFECT_TEXT[l.effect]).toBeTruthy();
      for (const a of l.affixes) {
        const def = getAffix(a.affixId);
        expect(def.slots).toContain(getBaseItem(l.baseId).slot);
        expect(a.min).toBeGreaterThan(0);
      }
    }
  });

  it('rarity weights default to 65 / 25 / 9 / 1', () => {
    expect(RARITY_WEIGHTS).toEqual({ normal: 65, magic: 25, rare: 9, legendary: 1 });
  });
});

describe('rarity rolls', () => {
  it('follow the configured weights over many rolls (seeded, so reproducible)', () => {
    const rng = mulberry32(2024);
    const N = 100_000;
    const counts: Record<Rarity, number> = { normal: 0, magic: 0, rare: 0, legendary: 0 };
    for (let i = 0; i < N; i++) counts[rollRarity(RARITY_WEIGHTS, rng)]++;
    expect(counts.normal / N).toBeCloseTo(0.65, 1);
    expect(counts.magic / N).toBeCloseTo(0.25, 1);
    expect(counts.rare / N).toBeGreaterThan(0.08);
    expect(counts.rare / N).toBeLessThan(0.1);
    expect(counts.legendary / N).toBeGreaterThan(0.005);
    expect(counts.legendary / N).toBeLessThan(0.015);
  });

  it('the same seed yields the same loot', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: 50 }, () => {
        const it = generateItem(rollRarity(RARITY_WEIGHTS, rng), rng);
        return { ...it, uid: 'x' }; // uids contain a session counter
      });
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it('only allowed rarities are chosen when restricted', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      expect(rarityRank(rollRarity(RARITY_WEIGHTS, rng, ['rare', 'legendary']))).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('generateItem', () => {
  const rng = mulberry32(99);

  it('gives the right number of affixes per rarity, never duplicates, always in range and valid for the slot', () => {
    for (let i = 0; i < 400; i++) {
      for (const rarity of ['normal', 'magic', 'rare'] as const) {
        const item = generateItem(rarity, rng);
        const ranges: Record<'normal' | 'magic' | 'rare', [number, number]> = { normal: [0, 0], magic: [1, 2], rare: [3, 4] };
        const [lo, hi] = ranges[rarity];
        expect(item.mods.length).toBeGreaterThanOrEqual(lo);
        expect(item.mods.length).toBeLessThanOrEqual(hi);
        expect(new Set(item.mods.map((m) => m.affixId)).size).toBe(item.mods.length);
        for (const m of item.mods) {
          const def = getAffix(m.affixId);
          expect(def.slots).toContain(item.slot);
          expect(m.value).toBeGreaterThanOrEqual(def.min);
          expect(m.value).toBeLessThanOrEqual(def.max);
          expect(Number.isInteger(m.value)).toBe(true);
        }
        expect(item.rarity).toBe(rarity);
        expect(getBaseItem(item.baseId).slot).toBe(item.slot);
      }
    }
  });

  it('gives every item a unique uid', () => {
    const uids = new Set(Array.from({ length: 2000 }, () => generateItem('magic', rng).uid));
    expect(uids.size).toBe(2000);
  });

  it('names magic items after their first affix and rare items with a generated name', () => {
    const magic = generateItem('magic', rng, 'weapon');
    expect(magic.name.endsWith(getBaseItem(magic.baseId).name)).toBe(true);
    expect(magic.name).toBe(getAffix(magic.mods[0]!.affixId).name + getBaseItem(magic.baseId).name);
    const rare = generateItem('rare', rng, 'weapon');
    expect(rare.name).not.toBe(getBaseItem(rare.baseId).name);
  });

  it('legendary drops are real legendaries with their fixed affixes rolled in range', () => {
    for (let i = 0; i < 100; i++) {
      const item = generateItem('legendary', rng);
      expect(item.rarity).toBe('legendary');
      const def = LEGENDARIES.find((l) => l.id === item.legendaryId)!;
      expect(item.name).toBe(def.name);
      expect(item.mods).toHaveLength(def.affixes.length);
      item.mods.forEach((m, k) => {
        expect(m.value).toBeGreaterThanOrEqual(def.affixes[k]!.min);
        expect(m.value).toBeLessThanOrEqual(def.affixes[k]!.max);
      });
    }
  });

  it('asking for a legendary in a slot with none falls back to a rare instead of failing', () => {
    const item = generateItem('legendary', rng, 'helmet');
    expect(item.slot).toBe('helmet');
    expect(item.rarity).toBe('rare');
  });

  it('createPlainItem and generateLegendary build the exact requested item', () => {
    const sword = createPlainItem('sword_rusty', rng);
    expect(sword).toMatchObject({ baseId: 'sword_rusty', rarity: 'normal', mods: [], slot: 'weapon' });
    expect(generateLegendary('thunder_verdict', rng).legendaryId).toBe('thunder_verdict');
  });

  it('items are plain JSON (ready for the save file)', () => {
    const item = generateItem('rare', rng);
    expect(JSON.parse(JSON.stringify(item))).toEqual(item);
  });
});

describe('rollLoot', () => {
  it('drops about dropChance of the time for a normal monster', () => {
    const rng = mulberry32(11);
    let drops = 0;
    const N = 20_000;
    for (let i = 0; i < N; i++) drops += rollLoot(LOOT_TABLES.normalMonster, rng).length;
    expect(drops / N).toBeGreaterThan(0.47);
    expect(drops / N).toBeLessThan(0.53);
  });

  it('boss loot always drops several items and always includes a rare or better (pity)', () => {
    const rng = mulberry32(77);
    for (let i = 0; i < 2000; i++) {
      const items = rollLoot(LOOT_TABLES.boss, rng);
      expect(items.length).toBeGreaterThanOrEqual(LOOT_TABLES.boss.rolls);
      expect(items.some((it) => rarityRank(it.rarity) >= rarityRank('rare'))).toBe(true);
    }
  });

  it('with dropChance 0 and no guarantee nothing drops; with a guarantee it is still honoured', () => {
    const none = { dropChance: 0, rolls: 3, rarityWeights: RARITY_WEIGHTS };
    expect(rollLoot(none, mulberry32(1))).toEqual([]);
    const pity = { ...none, guaranteed: [{ minRarity: 'magic' as const, count: 2 }] };
    const items = rollLoot(pity, mulberry32(1));
    expect(items).toHaveLength(2);
    for (const it of items) expect(rarityRank(it.rarity)).toBeGreaterThanOrEqual(rarityRank('magic'));
  });

  it('every rarity exists in the rarity table', () => {
    expect(RARITIES).toHaveLength(4);
  });
});
