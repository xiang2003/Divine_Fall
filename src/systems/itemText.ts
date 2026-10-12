import { getAffix } from '../data/affixes';
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
  key: keyof PlayerStats;
  label: string;
  before: number;
  after: number;
  /** Text for a single value. */
  format: (v: number) => string;
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/** Which stats to show, in what order and how. The attack range never changes with gear so it is omitted. */
export const STAT_ROWS: { key: keyof PlayerStats; label: string; format: (v: number) => string }[] = [
  { key: 'damage', label: '攻擊力', format: (v) => v.toFixed(0) },
  { key: 'attackSpeed', label: '攻擊速度', format: (v) => `${v.toFixed(2)}/秒` },
  { key: 'critChance', label: '暴擊機率', format: pct },
  { key: 'critDamage', label: '暴擊傷害', format: pct },
  { key: 'maxHp', label: '最大生命', format: (v) => v.toFixed(0) },
  { key: 'armor', label: '護甲', format: (v) => v.toFixed(0) },
  { key: 'moveSpeed', label: '移動速度', format: (v) => v.toFixed(2) },
];

/** Rows where the value differs between two stat sets, for the "compare with equipped" section. */
export function diffRows(before: PlayerStats, after: PlayerStats): StatRow[] {
  const EPS = 1e-6;
  return STAT_ROWS.flatMap((r) =>
    Math.abs(after[r.key] - before[r.key]) > EPS
      ? [{ key: r.key, label: r.label, before: before[r.key], after: after[r.key], format: r.format }]
      : [],
  );
}
