import { getAffix } from '../data/affixes';
import { DAMAGE_TYPES, DAMAGE_TYPE_INFO, RESIST_TYPES } from '../data/damageTypes';
import { getBaseItem, getLegendary, SLOT_LABEL, type ItemInstance, type ItemMod, type StatKey } from '../data/items';
import { LEGENDARY_EFFECT_TEXT } from '../data/legendaryEffects';
import { RARITY_INFO } from '../data/rarity';
import type { PlayerStats } from './stats';

/** Tooltip line for a rolled affix, e.g. "攻擊力 +5". */
export function formatMod(mod: ItemMod): string {
  return getAffix(mod.affixId).text.replace('{value}', String(mod.value));
}

const STAT_TEXT: Record<StatKey, (v: number) => string> = {
  maxHp: (v) => `最大生命 +${v}`,
  damage: (v) => `攻擊力 +${v}`,
  armor: (v) => `護甲 +${v}`,
  attackSpeedPct: (v) => `攻擊速度 +${v}%`,
  critChancePct: (v) => `暴擊機率 +${v}%`,
  critDamagePct: (v) => `暴擊傷害 +${v}%`,
  moveSpeedPct: (v) => `移動速度 +${v}%`,
  physicalDamagePct: (v) => `增加物理傷害 ${v}%`,
  fireDamagePct: (v) => `增加火焰傷害 ${v}%`,
  coldDamagePct: (v) => `增加冰霜傷害 ${v}%`,
  lightningDamagePct: (v) => `增加雷電傷害 ${v}%`,
  corruptionDamagePct: (v) => `增加腐化傷害 ${v}%`,
  divineDamagePct: (v) => `增加神聖傷害 ${v}%`,
  fireResPct: (v) => `火焰抗性 +${v}%`,
  coldResPct: (v) => `冰霜抗性 +${v}%`,
  lightningResPct: (v) => `雷電抗性 +${v}%`,
  corruptionResPct: (v) => `腐化抗性 +${v}%`,
  divineResPct: (v) => `神聖抗性 +${v}%`,
};

/** Lines for the item's fixed base stats. */
export function baseLines(item: ItemInstance): string[] {
  return (Object.entries(getBaseItem(item.baseId).base) as [StatKey, number][]).map(([k, v]) => STAT_TEXT[k](v));
}

export interface ItemDescription {
  name: string;
  rarityLabel: string;
  color: string;
  slotLabel: string;
  baseName: string;
  base: string[];
  affixes: string[];
  effect?: string;
  lore?: string;
}

export function describeItem(item: ItemInstance): ItemDescription {
  const info = RARITY_INFO[item.rarity];
  const legendary = item.legendaryId ? getLegendary(item.legendaryId) : null;
  return {
    name: item.name,
    rarityLabel: info.label,
    color: info.color,
    slotLabel: SLOT_LABEL[item.slot],
    baseName: getBaseItem(item.baseId).name,
    base: baseLines(item),
    affixes: item.mods.map(formatMod),
    effect: legendary ? LEGENDARY_EFFECT_TEXT[legendary.effect] : undefined,
    lore: legendary?.lore,
  };
}

export interface StatRow {
  key: string;
  label: string;
  before: number;
  after: number;
  /** Text for a single value. */
  format: (v: number) => string;
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export interface StatRowDef {
  key: string;
  label: string;
  get: (stats: PlayerStats) => number;
  format: (v: number) => string;
  /** Only listed in the character's stats when it is not zero (damage and resistance of one type); the comparison always lists changes. */
  extra?: boolean;
}

const plain = (key: keyof PlayerStats): ((s: PlayerStats) => number) => (s) => s[key] as number;

/** Which stats to show, in what order and how. The attack range never changes with gear so it is omitted. */
export const STAT_ROWS: StatRowDef[] = [
  { key: 'damage', label: '攻擊力', get: plain('damage'), format: (v) => v.toFixed(0) },
  { key: 'attackSpeed', label: '攻擊速度', get: plain('attackSpeed'), format: (v) => `${v.toFixed(2)}/秒` },
  { key: 'critChance', label: '暴擊機率', get: plain('critChance'), format: pct },
  { key: 'critDamage', label: '暴擊傷害', get: plain('critDamage'), format: pct },
  { key: 'maxHp', label: '最大生命', get: plain('maxHp'), format: (v) => v.toFixed(0) },
  { key: 'armor', label: '護甲', get: plain('armor'), format: (v) => v.toFixed(0) },
  { key: 'moveSpeed', label: '移動速度', get: plain('moveSpeed'), format: (v) => v.toFixed(2) },
  ...DAMAGE_TYPES.map((t): StatRowDef => ({ key: `increased.${t}`, label: `${DAMAGE_TYPE_INFO[t].label}傷害增加`, get: (s) => s.increased?.[t] ?? 0, format: pct, extra: true })),
  ...RESIST_TYPES.map((t): StatRowDef => ({ key: `resist.${t}`, label: DAMAGE_TYPE_INFO[t].defenseLabel, get: (s) => s.resist?.[t] ?? 0, format: pct, extra: true })),
];

/** Rows where the value differs between two stat sets, for the "compare with equipped" section. */
export function diffRows(before: PlayerStats, after: PlayerStats): StatRow[] {
  const EPS = 1e-6;
  return STAT_ROWS.flatMap((r) => {
    const a = r.get(before);
    const b = r.get(after);
    return Math.abs(b - a) > EPS ? [{ key: r.key, label: r.label, before: a, after: b, format: r.format }] : [];
  });
}
