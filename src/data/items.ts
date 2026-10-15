import type { LegendaryEffectId } from './legendaryEffects';
import type { Rarity } from './rarity';

export type EquipSlot = 'weapon' | 'helmet' | 'chest' | 'boots' | 'ring';

export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'helmet', 'chest', 'boots', 'ring'];

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: '武器',
  helmet: '頭盔',
  chest: '胸甲',
  boots: '鞋子',
  ring: '戒指',
};

/**
 * Stat keys that equipment can modify. `...Pct` values are whole percentages (8 means +8%).
 * Flat keys add directly; see systems/stats.ts for exactly how each combines into final stats.
 */
export type StatKey =
  | 'maxHp'
  | 'damage'
  | 'armor'
  | 'attackSpeedPct'
  | 'critChancePct'
  | 'critDamagePct'
  | 'moveSpeedPct'
  // "increased damage" of one type, and the resistance against one type (whole percentages; physical is defended by armor, so it has no resistance)
  | 'physicalDamagePct'
  | 'fireDamagePct'
  | 'coldDamagePct'
  | 'lightningDamagePct'
  | 'corruptionDamagePct'
  | 'divineDamagePct'
  | 'fireResPct'
  | 'coldResPct'
  | 'lightningResPct'
  | 'corruptionResPct'
  | 'divineResPct'
  // status effects: the chance that an attack applies one (whole percentages), the freeze points an attack adds, more damage over time, longer effects
  | 'bleedChancePct'
  | 'burnChancePct'
  | 'corruptionChancePct'
  | 'shockChancePct'
  | 'armorBreakChancePct'
  | 'weakenChancePct'
  | 'slowChancePct'
  | 'freezeBuildup'
  | 'dotDamagePct'
  | 'statusDurationPct';

export type StatMods = Partial<Record<StatKey, number>>;

export interface BaseItemDef {
  id: string;
  name: string;
  slot: EquipSlot;
  /** Fixed stats every copy of this base provides. */
  base: StatMods;
  /** The level the character must have to wear it (the "tier" of the base: 1, 8, 16, 24, 32, 40, 50, 60, 70, 80). */
  level: number;
}

/** The levels at which a slot gets a new, better base item. */
export const BASE_TIER_LEVELS = [1, 8, 16, 24, 32, 40, 50, 60, 70, 80] as const;

/** How the flat numbers of gear grow with level: 6% a level, the same curve as the life of monsters (docs/design/level-system.md). */
export const ITEM_GROWTH = 1.06;
/** The stats that grow with the level (the rest are percentages and chances, which stay in their ranges). */
const FLAT_STATS: readonly StatKey[] = ['maxHp', 'damage', 'armor'];

export function isFlatStat(stat: StatKey): boolean {
  return FLAT_STATS.includes(stat);
}

/** How much a flat number is worth at an item level: 1 at level 1, 1.06 at level 2... */
export function levelScale(level: number): number {
  return Math.pow(ITEM_GROWTH, Math.max(0, level - 1));
}

/** A rolled number of a stat, grown to the item level (percentages are left as they are). */
export function scaleStat(stat: StatKey, value: number, ilvl: number): number {
  return isFlatStat(stat) ? Math.max(1, Math.round(value * levelScale(ilvl))) : value;
}

/** One rolled affix on an item. The affix definition (name, text, stat) lives in data/affixes.ts. */
export interface ItemMod {
  affixId: string;
  value: number;
}

/**
 * A concrete item. Plain serialisable data only (no functions, no references to definitions),
 * so it can go straight into a save file or onto the ground.
 */
export interface ItemInstance {
  uid: string;
  baseId: string;
  name: string;
  slot: EquipSlot;
  rarity: Rarity;
  mods: ItemMod[];
  legendaryId?: string;
  /** The item level: the level of the monster that dropped it (or of the character, from a shop). Its affixes were rolled for that level. Missing: 1. */
  ilvl?: number;
}

/** The item level of an item (1 when it does not say). */
export function itemLevel(item: Pick<ItemInstance, 'ilvl'>): number {
  return Math.max(1, Math.floor(item.ilvl ?? 1));
}

/** The bases the first two chapters have always had (tiers 1 to 3); better ones are made from them below. */
const FIRST_BASES: readonly BaseItemDef[] = [
  { id: 'sword_rusty', name: '鏽蝕鐵劍', slot: 'weapon', base: { damage: 4 }, level: 1 },
  { id: 'sword_steel', name: '鋼鐵長劍', slot: 'weapon', base: { damage: 7 }, level: 8 },
  { id: 'blade_ancient', name: '古神彎刃', slot: 'weapon', base: { damage: 10 }, level: 16 },
  { id: 'helm_leather', name: '皮革頭巾', slot: 'helmet', base: { armor: 4 }, level: 1 },
  { id: 'helm_iron', name: '鐵製頭盔', slot: 'helmet', base: { armor: 8 }, level: 8 },
  { id: 'chest_robe', name: '粗布長袍', slot: 'chest', base: { armor: 6, maxHp: 10 }, level: 1 },
  { id: 'chest_mail', name: '鎖子甲', slot: 'chest', base: { armor: 12 }, level: 8 },
  { id: 'boots_leather', name: '皮靴', slot: 'boots', base: { armor: 2 }, level: 1 },
  { id: 'boots_iron', name: '鐵靴', slot: 'boots', base: { armor: 5 }, level: 8 },
  { id: 'ring_copper', name: '銅戒', slot: 'ring', base: { maxHp: 5 }, level: 1 },
  { id: 'ring_silver', name: '銀戒', slot: 'ring', base: { maxHp: 8, critChancePct: 1 }, level: 8 },
];

/** The names of the better bases, one per tier level after the first bases of each slot. */
const LATER_BASES: Record<EquipSlot, readonly (readonly [number, string])[]> = {
  weapon: [[24, '玄鐵重劍'], [32, '斷罪長刀'], [40, '隕鐵戰劍'], [50, '蝕神之牙'], [60, '墜星彎刃'], [70, '無名神兵'], [80, '初胎古劍']],
  helmet: [[16, '銅鑄戰盔'], [24, '鱗片盔'], [32, '玄鐵面盔'], [40, '靈銀冠'], [50, '魂鑄鐵冠'], [60, '墜星盔'], [70, '古神冠'], [80, '無冕之冠']],
  chest: [[16, '鱗甲'], [24, '靈絲法袍'], [32, '玄鐵胸甲'], [40, '蒼鱗甲'], [50, '魂鑄鎧'], [60, '墜星鎧'], [70, '古神甲'], [80, '無名之鎧']],
  boots: [[16, '旅人靴'], [24, '靈絲履'], [32, '玄鐵戰靴'], [40, '蒼鱗靴'], [50, '魂鑄靴'], [60, '墜星靴'], [70, '古神履'], [80, '無名之靴']],
  ring: [[16, '靈玉戒'], [24, '墜金戒'], [32, '玄鐵戒'], [40, '蒼玉戒'], [50, '魂鑄戒'], [60, '墜星戒'], [70, '古神戒'], [80, '無名之戒']],
};

/** Every base item: the first ones, and for each slot the better ones, whose flat stats grow 6% a level from the best base before them. */
export const BASE_ITEMS: readonly BaseItemDef[] = (() => {
  const all: BaseItemDef[] = [...FIRST_BASES];
  for (const slot of EQUIP_SLOTS) {
    const anchor = FIRST_BASES.filter((b) => b.slot === slot).reduce((best, b) => (b.level > best.level ? b : best));
    for (const [level, name] of LATER_BASES[slot]) {
      const base: StatMods = {};
      for (const [key, value] of Object.entries(anchor.base) as [StatKey, number][]) {
        base[key] = isFlatStat(key) ? Math.round(value * Math.pow(ITEM_GROWTH, level - anchor.level)) : value;
      }
      all.push({ id: `${slot}_t${level}`, name, slot, base, level });
    }
  }
  return all;
})();

const BASE_BY_ID = new Map(BASE_ITEMS.map((b) => [b.id, b]));

/** The level a character must have to wear the item: the level of its base (a legendary asks for 3 more). */
export function requiredLevel(item: Pick<ItemInstance, 'baseId' | 'rarity'>): number {
  return getBaseItem(item.baseId).level + (item.rarity === 'legendary' ? 3 : 0);
}

export function getBaseItem(id: string): BaseItemDef {
  const b = BASE_BY_ID.get(id);
  if (!b) throw new Error(`Unknown base item "${id}"`);
  return b;
}

export interface LegendaryDef {
  id: string;
  name: string;
  baseId: string;
  /** Guaranteed affixes; each value is rolled within [min, max] when the item drops. */
  affixes: { affixId: string; min: number; max: number }[];
  effect: LegendaryEffectId;
  /** Flavour text shown in the tooltip. */
  lore: string;
}

export const LEGENDARIES: readonly LegendaryDef[] = [
  {
    id: 'thunder_verdict',
    name: '雷霆裁決',
    baseId: 'sword_steel',
    affixes: [
      { affixId: 'flatDamage', min: 4, max: 8 },
      { affixId: 'critChance', min: 3, max: 6 },
    ],
    effect: 'chainLightning',
    lore: '神明墜落時，最後一道審判的雷霆凝固在這把劍裡。',
  },
  {
    id: 'abyss_heart',
    name: '深淵之心',
    baseId: 'chest_mail',
    affixes: [
      { affixId: 'maxLife', min: 30, max: 50 },
      { affixId: 'armor', min: 8, max: 14 },
    ],
    effect: 'lifeOnKill',
    lore: '甲冑深處仍在跳動，貪婪地吞噬倒下者的生命。',
  },
  {
    id: 'fallen_boots',
    name: '神墜之靴',
    baseId: 'boots_iron',
    affixes: [
      { affixId: 'moveSpeed', min: 10, max: 18 },
      { affixId: 'maxLife', min: 10, max: 20 },
    ],
    effect: 'dodgeHaste',
    lore: '穿著它的人，總是比墜落的神明快一步。',
  },
  {
    id: 'meteor_ring',
    name: '殞星指環',
    baseId: 'ring_silver',
    affixes: [
      { affixId: 'attackSpeed', min: 8, max: 14 },
      { affixId: 'critDamage', min: 15, max: 30 },
    ],
    effect: 'killFrenzy',
    lore: '每一次殺戮，都讓星屑在指間燃燒得更亮。',
  },
];

const LEGENDARY_BY_ID = new Map(LEGENDARIES.map((l) => [l.id, l]));

export function getLegendary(id: string): LegendaryDef {
  const l = LEGENDARY_BY_ID.get(id);
  if (!l) throw new Error(`Unknown legendary "${id}"`);
  return l;
}
