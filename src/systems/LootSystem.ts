import { affixesForSlot, getAffix, type AffixDef } from '../data/affixes';
import {
  BASE_ITEMS,
  EQUIP_SLOTS,
  LEGENDARIES,
  getBaseItem,
  getLegendary,
  scaleStat,
  type EquipSlot,
  type ItemInstance,
  type ItemMod,
} from '../data/items';
import { raritiesAtLeast, type LootTable } from '../data/lootTables';
import { RARITIES, rarityRank, type Rarity } from '../data/rarity';
import type { Rng } from './rng';

const RARE_ADJECTIVES = ['殞神', '裂魂', '深淵', '蝕骨', '墮星', '殘光', '默示', '燼滅'];
const RARE_NOUNS: Record<EquipSlot, string[]> = {
  weapon: ['之刃', '之牙', '之鋒'],
  helmet: ['之冠', '之面'],
  chest: ['之甲', '之庇'],
  boots: ['之步', '之履'],
  ring: ['之環', '之印'],
};

let uidCounter = 0;

/** Unique within this session (and, with the random part, effectively across saves). */
function makeUid(rng: Rng): string {
  uidCounter++;
  return `${Math.floor(rng() * 0xffffffff).toString(36)}-${uidCounter.toString(36)}`;
}

/** Picks an index by relative weight. Zero / negative weights are never chosen. */
function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  let roll = rng() * total;
  for (const it of items) {
    roll -= Math.max(0, weightOf(it));
    if (roll < 0) return it;
  }
  return items[items.length - 1]!;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/** Integer in [min, max], inclusive. */
function rollInt(min: number, max: number, rng: Rng): number {
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

export function rollRarity(weights: Record<Rarity, number>, rng: Rng, allowed: readonly Rarity[] = RARITIES): Rarity {
  return pickWeighted(allowed, (r) => weights[r], rng);
}

/** Affix counts per rarity: [min, max]. Legendaries use their fixed affix list instead. */
const AFFIX_COUNT: Record<Exclude<Rarity, 'legendary'>, [number, number]> = {
  normal: [0, 0],
  magic: [1, 2],
  rare: [3, 4],
};

/** How many of the best bases that are not above the item level a drop chooses from (so a low base stops dropping once much better ones can). */
const BASES_IN_REACH = 3;

/**
 * Builds one item of item level `ilvl`. `slot` forces the equipment slot (otherwise random). The base is one of the best few that a character of that
 * level could wear, and the flat numbers of its affixes (life, damage, armor) are rolled in their range and then grown to the item level.
 * Fully determined by `rng`, so a seeded generator reproduces the same loot.
 */
export function generateItem(rarity: Rarity, rng: Rng, slot?: EquipSlot, ilvl = 1): ItemInstance {
  if (rarity === 'legendary') {
    const pool = slot ? LEGENDARIES.filter((l) => getBaseItem(l.baseId).slot === slot) : LEGENDARIES;
    if (pool.length > 0) return generateLegendary(pick(pool, rng).id, rng, ilvl);
    rarity = 'rare'; // no legendary exists for this slot: fall back rather than fail
  }

  const chosenSlot = slot ?? pick(EQUIP_SLOTS, rng);
  const reachable = BASE_ITEMS.filter((b) => b.slot === chosenSlot && b.level <= ilvl).sort((a, b) => b.level - a.level);
  const base = pick(reachable.slice(0, BASES_IN_REACH), rng);
  const [lo, hi] = AFFIX_COUNT[rarity];
  const wanted = rollInt(lo, hi, rng);

  const available: AffixDef[] = affixesForSlot(chosenSlot);
  const mods: ItemMod[] = [];
  const picked: AffixDef[] = [];
  for (let i = 0; i < wanted && available.length > 0; i++) {
    const affix = pickWeighted(available, (a) => a.weight, rng);
    available.splice(available.indexOf(affix), 1); // never roll the same affix twice
    picked.push(affix);
    mods.push({ affixId: affix.id, value: scaleStat(affix.stat, rollInt(affix.min, affix.max, rng), ilvl) });
  }

  let name = base.name;
  if (rarity === 'magic' && picked[0]) name = `${picked[0].name}${base.name}`;
  if (rarity === 'rare') name = `${pick(RARE_ADJECTIVES, rng)}${pick(RARE_NOUNS[chosenSlot], rng)}`;

  return { uid: makeUid(rng), baseId: base.id, name, slot: chosenSlot, rarity, mods, ilvl };
}

/** A specific base item with no affixes (e.g. the starter sword). */
export function createPlainItem(baseId: string, rng: Rng): ItemInstance {
  const base = getBaseItem(baseId);
  return { uid: makeUid(rng), baseId: base.id, name: base.name, slot: base.slot, rarity: 'normal', mods: [] };
}

export function generateLegendary(legendaryId: string, rng: Rng, ilvl = 1): ItemInstance {
  const def = getLegendary(legendaryId);
  const base = getBaseItem(def.baseId);
  return {
    uid: makeUid(rng),
    baseId: base.id,
    name: def.name,
    slot: base.slot,
    rarity: 'legendary',
    mods: def.affixes.map((a) => ({ affixId: a.affixId, value: scaleStat(getAffix(a.affixId).stat, rollInt(a.min, a.max, rng), ilvl) })),
    legendaryId: def.id,
    ilvl,
  };
}

/**
 * Rolls everything one kill drops from a loot table (items of item level `ilvl`, the level of the monster): `rolls` independent chances of an item,
 * then tops up with extra items if a guarantee (e.g. boss pity: at least one rare) was not met.
 */
export function rollLoot(table: LootTable, rng: Rng, ilvl = 1): ItemInstance[] {
  const items: ItemInstance[] = [];
  for (let i = 0; i < table.rolls; i++) {
    if (rng() < table.dropChance) items.push(generateItem(rollRarity(table.rarityWeights, rng), rng, undefined, ilvl));
  }
  for (const g of table.guaranteed ?? []) {
    const have = items.filter((it) => rarityRank(it.rarity) >= rarityRank(g.minRarity)).length;
    for (let n = have; n < g.count; n++) {
      const allowed = raritiesAtLeast(g.minRarity);
      items.push(generateItem(rollRarity(table.rarityWeights, rng, allowed), rng, undefined, ilvl));
    }
  }
  return items;
}

/** Looks up affix lines for an item (used by tests and tooltips). */
export function affixOf(mod: ItemMod): AffixDef {
  return getAffix(mod.affixId);
}
