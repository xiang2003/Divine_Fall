import { describe, expect, it, vi } from 'vitest';
import type { ItemInstance } from '../src/data/items';
import { Inventory, INVENTORY_SIZE } from '../src/systems/InventorySystem';
import { createPlainItem, generateItem, generateLegendary } from '../src/systems/LootSystem';
import { mulberry32 } from '../src/systems/rng';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { activeEffects, computeStats, emptyEquipment, itemMods, statsIfEquipped } from '../src/systems/stats';
import { describeItem, diffRows, formatMod } from '../src/systems/itemText';
import { Buffs, DodgeController } from '../src/systems/buffs';
import { DODGE_CONFIG } from '../src/config/gameConfig';

const rng = mulberry32(42);
const item = (baseId: string) => createPlainItem(baseId, rng);

function withAffixes(base: ItemInstance, mods: ItemInstance['mods']): ItemInstance {
  return { ...base, mods, uid: base.uid + '-m' };
}

describe('Inventory: adding', () => {
  it('fills slots in order and reports the index', () => {
    const inv = new Inventory();
    const a = item('sword_rusty');
    const b = item('helm_iron');
    expect(inv.add(a)).toEqual({ ok: true, index: 0 });
    expect(inv.add(b)).toEqual({ ok: true, index: 1 });
    expect(inv.slots[0]).toBe(a);
  });

  it('refuses when full and loses nothing', () => {
    const inv = new Inventory();
    const items = Array.from({ length: INVENTORY_SIZE }, () => generateItem('normal', rng));
    for (const it of items) expect(inv.add(it).ok).toBe(true);
    expect(inv.freeSlots).toBe(0);
    const extra = generateItem('legendary', rng);
    expect(inv.add(extra)).toEqual({ ok: false, reason: 'full' });
    expect(inv.slots).toEqual(items); // every original item still there, unchanged and in order
    expect(inv.has(extra.uid)).toBe(false);
  });

  it('refuses a second copy of the same item (duplicate pickup), in the backpack or equipped', () => {
    const inv = new Inventory();
    const sword = item('sword_rusty');
    inv.add(sword);
    expect(inv.add(sword)).toEqual({ ok: false, reason: 'duplicate' });
    inv.equip(0);
    expect(inv.add(sword)).toEqual({ ok: false, reason: 'duplicate' });
    expect(inv.freeSlots).toBe(INVENTORY_SIZE);
  });

  it('notifies on change only when something changed', () => {
    const onChange = vi.fn();
    const inv = new Inventory(onChange);
    inv.add(item('sword_rusty'));
    expect(onChange).toHaveBeenCalledTimes(1);
    inv.equip(5); // empty slot: no-op
    inv.unequip('boots'); // nothing worn: no-op
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Inventory: equip / unequip / drop', () => {
  it('equips into the matching slot and frees the backpack slot', () => {
    const inv = new Inventory();
    const sword = item('sword_steel');
    inv.add(sword);
    expect(inv.equip(0)).toEqual({ ok: true });
    expect(inv.equipment.weapon).toBe(sword);
    expect(inv.slots[0]).toBeNull();
  });

  it('swaps with the worn item, even when the backpack is completely full', () => {
    const inv = new Inventory();
    const worn = item('sword_rusty');
    inv.add(worn);
    inv.equip(0);
    const filler = Array.from({ length: INVENTORY_SIZE - 1 }, () => generateItem('normal', rng, 'helmet'));
    filler.forEach((f) => inv.add(f));
    const better = item('blade_ancient');
    inv.slots[INVENTORY_SIZE - 1] = better; // full backpack, the new weapon is in the last slot
    expect(inv.freeSlots).toBe(0);
    expect(inv.equip(INVENTORY_SIZE - 1)).toEqual({ ok: true });
    expect(inv.equipment.weapon).toBe(better);
    expect(inv.slots[INVENTORY_SIZE - 1]).toBe(worn); // took the vacated slot: nothing lost
  });

  it('fails cleanly on empty or out-of-range slots', () => {
    const inv = new Inventory();
    expect(inv.equip(3)).toEqual({ ok: false, reason: 'empty' });
    expect(inv.equip(-1)).toEqual({ ok: false, reason: 'invalid' });
    expect(inv.equip(INVENTORY_SIZE)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('unequips into the first free slot', () => {
    const inv = new Inventory();
    const ring = item('ring_copper');
    inv.add(ring);
    inv.equip(0);
    expect(inv.unequip('ring')).toEqual({ ok: true });
    expect(inv.equipment.ring).toBeNull();
    expect(inv.slots[0]).toBe(ring);
    expect(inv.unequip('ring')).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses to unequip into a full backpack and keeps the item equipped', () => {
    const inv = new Inventory();
    const boots = item('boots_iron');
    inv.add(boots);
    inv.equip(0);
    for (let i = 0; i < INVENTORY_SIZE; i++) inv.add(generateItem('normal', rng));
    expect(inv.freeSlots).toBe(0);
    expect(inv.unequip('boots')).toEqual({ ok: false, reason: 'full' });
    expect(inv.equipment.boots).toBe(boots);
  });

  it('take() removes exactly that item so it can be dropped', () => {
    const inv = new Inventory();
    const a = item('helm_leather');
    inv.add(a);
    expect(inv.take(0)).toBe(a);
    expect(inv.has(a.uid)).toBe(false);
    expect(inv.take(0)).toBeNull();
  });

  it('only one ring can be worn (five slots total)', () => {
    const inv = new Inventory();
    const r1 = item('ring_copper');
    const r2 = item('ring_silver');
    inv.add(r1);
    inv.add(r2);
    inv.equip(0);
    inv.equip(1);
    expect(inv.equipment.ring).toBe(r2);
    expect(inv.slots[1]).toBe(r1);
  });
});

describe('stats from equipment', () => {
  it('no equipment gives the base stats', () => {
    const s = computeStats(emptyEquipment());
    expect(s).toEqual({ ...PLAYER_CONFIG.baseStats });
  });

  it('wearing items changes the stats, taking them off reverts exactly', () => {
    const inv = new Inventory();
    const sword = withAffixes(item('sword_steel'), [
      { affixId: 'flatDamage', value: 5 },
      { affixId: 'attackSpeed', value: 10 },
      { affixId: 'critChance', value: 4 },
      { affixId: 'critDamage', value: 20 },
    ]);
    const boots = withAffixes(item('boots_iron'), [
      { affixId: 'moveSpeed', value: 10 },
      { affixId: 'maxLife', value: 20 },
    ]);
    inv.add(sword);
    inv.add(boots);
    const base = computeStats(inv.equipment);
    inv.equip(0);
    inv.equip(1);
    const geared = computeStats(inv.equipment);
    expect(geared.damage).toBe(base.damage + 7 + 5);
    expect(geared.attackSpeed).toBeCloseTo(base.attackSpeed * 1.1, 9);
    expect(geared.critChance).toBeCloseTo(base.critChance + 0.04, 9);
    expect(geared.critDamage).toBeCloseTo(base.critDamage + 0.2, 9);
    expect(geared.armor).toBe(base.armor + 5);
    expect(geared.maxHp).toBe(base.maxHp + 20);
    expect(geared.moveSpeed).toBeCloseTo(base.moveSpeed * 1.1, 9);
    inv.unequip('weapon');
    inv.unequip('boots');
    expect(computeStats(inv.equipment)).toEqual(base);
  });

  it('caps crit chance', () => {
    const stack = withAffixes(item('ring_silver'), [{ affixId: 'critChance', value: 500 }]);
    const eq = { ...emptyEquipment(), ring: stack };
    expect(computeStats(eq).critChance).toBeLessThanOrEqual(0.75);
  });

  it('itemMods merges base stats and affixes of the same stat', () => {
    const it2 = withAffixes(item('chest_mail'), [{ affixId: 'armor', value: 7 }]);
    expect(itemMods(it2).armor).toBe(12 + 7);
  });

  it('statsIfEquipped compares against the item currently in that slot, using the same formula as combat', () => {
    const worn = item('sword_rusty');
    const candidate = withAffixes(item('sword_steel'), [{ affixId: 'flatDamage', value: 3 }]);
    const eq = { ...emptyEquipment(), weapon: worn };
    const { before, after } = statsIfEquipped(eq, candidate);
    expect(before).toEqual(computeStats(eq));
    expect(after).toEqual(computeStats({ ...eq, weapon: candidate }));
    expect(after.damage - before.damage).toBe(7 + 3 - 4);
    const rows = diffRows(before, after);
    expect(rows.map((r) => r.key)).toEqual(['damage']);
  });

  it('activeEffects lists the effects of worn legendaries only', () => {
    const inv = new Inventory();
    inv.add(generateLegendary('thunder_verdict', rng));
    inv.add(generateLegendary('fallen_boots', rng));
    expect(activeEffects(inv.equipment)).toEqual([]);
    inv.equip(0);
    expect(activeEffects(inv.equipment)).toEqual(['chainLightning']);
    inv.equip(1);
    expect(activeEffects(inv.equipment).sort()).toEqual(['chainLightning', 'dodgeHaste']);
    inv.unequip('weapon');
    expect(activeEffects(inv.equipment)).toEqual(['dodgeHaste']);
  });
});

describe('item text', () => {
  it('describes affixes with their rolled values and legendaries with effect text', () => {
    expect(formatMod({ affixId: 'flatDamage', value: 5 })).toBe('攻擊力 +5');
    expect(formatMod({ affixId: 'attackSpeed', value: 8 })).toBe('攻擊速度 +8%');
    const legendary = describeItem(generateLegendary('abyss_heart', rng));
    expect(legendary.effect).toContain('擊殺');
    expect(legendary.lore).toBeTruthy();
    expect(legendary.color).toBe('#ff8a2a');
    expect(describeItem(item('sword_rusty')).effect).toBeUndefined();
  });
});

describe('DodgeController and Buffs', () => {
  const DT = 1 / 60;

  it('dash lasts its duration, grants invulnerability slightly longer, then cools down', () => {
    const d = new DodgeController();
    expect(d.start()).toBe(true);
    expect(d.start()).toBe(false); // can't dodge mid-dodge
    let moved = 0;
    for (let t = 0; t < DODGE_CONFIG.duration; t += DT) moved += d.update(DT);
    expect(moved).toBeCloseTo(DODGE_CONFIG.duration, 1);
    expect(moved * d.speed).toBeCloseTo(DODGE_CONFIG.distance, 0);
    expect(d.dashing).toBe(false);
    // invulnerability outlasts the dash
    expect(d.invulnerable).toBe(true);
    for (let t = 0; t < DODGE_CONFIG.invulnDuration - DODGE_CONFIG.duration + 0.02; t += DT) d.update(DT);
    expect(d.invulnerable).toBe(false);
    expect(d.ready).toBe(false); // still cooling down
    for (let t = 0; t < DODGE_CONFIG.cooldown; t += DT) d.update(DT);
    expect(d.ready).toBe(true);
  });

  it('never moves further than the dash distance in total', () => {
    const d = new DodgeController();
    d.start();
    let total = 0;
    for (let i = 0; i < 100; i++) total += d.update(0.05) * d.speed;
    expect(total).toBeLessThanOrEqual(DODGE_CONFIG.distance + 1e-9);
  });

  it('buffs apply while active, expire, and refresh instead of stacking', () => {
    const b = new Buffs();
    expect(b.moveMultiplier).toBe(1);
    b.hasteMove(2, 0.4);
    expect(b.moveMultiplier).toBeCloseTo(1.4, 9);
    b.update(1);
    b.hasteMove(2, 0.4); // refresh
    b.update(1.5);
    expect(b.moveMultiplier).toBeCloseTo(1.4, 9);
    b.update(1);
    expect(b.moveMultiplier).toBe(1);
    b.hasteAttack(3, 0.3);
    expect(b.attackSpeedMultiplier).toBeCloseTo(1.3, 9);
    b.clear();
    expect(b.attackSpeedMultiplier).toBe(1);
  });
});
