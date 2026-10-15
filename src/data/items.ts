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
}

export const BASE_ITEMS: readonly BaseItemDef[] = [
  { id: 'sword_rusty', name: '鏽蝕鐵劍', slot: 'weapon', base: { damage: 4 } },
  { id: 'sword_steel', name: '鋼鐵長劍', slot: 'weapon', base: { damage: 7 } },
  { id: 'blade_ancient', name: '古神彎刃', slot: 'weapon', base: { damage: 10 } },
  { id: 'helm_leather', name: '皮革頭巾', slot: 'helmet', base: { armor: 4 } },
  { id: 'helm_iron', name: '鐵製頭盔', slot: 'helmet', base: { armor: 8 } },
  { id: 'chest_robe', name: '粗布長袍', slot: 'chest', base: { armor: 6, maxHp: 10 } },
  { id: 'chest_mail', name: '鎖子甲', slot: 'chest', base: { armor: 12 } },
  { id: 'boots_leather', name: '皮靴', slot: 'boots', base: { armor: 2 } },
  { id: 'boots_iron', name: '鐵靴', slot: 'boots', base: { armor: 5 } },
  { id: 'ring_copper', name: '銅戒', slot: 'ring', base: { maxHp: 5 } },
  { id: 'ring_silver', name: '銀戒', slot: 'ring', base: { maxHp: 8, critChancePct: 1 } },
];

const BASE_BY_ID = new Map(BASE_ITEMS.map((b) => [b.id, b]));

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
