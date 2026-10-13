import { PLAYER_CONFIG } from '../config/gameConfig';
import { getAffix } from '../data/affixes';
import {
  EQUIP_SLOTS,
  getBaseItem,
  getLegendary,
  type EquipSlot,
  type ItemInstance,
  type StatKey,
  type StatMods,
} from '../data/items';
import type { LegendaryEffectId } from '../data/legendaryEffects';
import { levelBonus } from './progression';

export interface PlayerStats {
  maxHp: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  armor: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
}

export type Equipment = Record<EquipSlot, ItemInstance | null>;

export function emptyEquipment(): Equipment {
  return { weapon: null, helmet: null, chest: null, boots: null, ring: null };
}

/** Hard cap so stacked crit chance can never make every hit a crit. */
export const MAX_CRIT_CHANCE = 0.75;

/** All stat modifiers an item provides: its base stats plus every rolled affix. */
export function itemMods(item: ItemInstance): StatMods {
  const total: StatMods = { ...getBaseItem(item.baseId).base };
  for (const mod of item.mods) {
    const stat = getAffix(mod.affixId).stat;
    total[stat] = (total[stat] ?? 0) + mod.value;
  }
  return total;
}

/**
 * THE place final player stats are computed. Combat, the HUD and the item comparison tooltip all call this,
 * so what the tooltip promises is exactly what the fight uses.
 *
 * Flat stats (maxHp, damage, armor) add; `...Pct` stats are whole percentages that scale the base value
 * (attack speed, move speed) or add to the base probability / multiplier (crit chance, crit damage).
 * `level` adds the per-level bonus (max life, damage, armor) on top of the level-1 base.
 */
export function computeStats(equipment: Equipment, level = 1): PlayerStats {
  const sum: Record<StatKey, number> = {
    maxHp: 0,
    damage: 0,
    armor: 0,
    attackSpeedPct: 0,
    critChancePct: 0,
    critDamagePct: 0,
    moveSpeedPct: 0,
  };
  for (const slot of EQUIP_SLOTS) {
    const item = equipment[slot];
    if (!item) continue;
    for (const [key, value] of Object.entries(itemMods(item)) as [StatKey, number][]) sum[key] += value;
  }
  const base = PLAYER_CONFIG.baseStats;
  const lv = levelBonus(level);
  return {
    maxHp: base.maxHp + lv.maxHp + sum.maxHp,
    damage: base.damage + lv.damage + sum.damage,
    attackSpeed: base.attackSpeed * (1 + sum.attackSpeedPct / 100),
    attackRange: base.attackRange,
    armor: base.armor + lv.armor + sum.armor,
    critChance: Math.min(MAX_CRIT_CHANCE, base.critChance + sum.critChancePct / 100),
    critDamage: base.critDamage + sum.critDamagePct / 100,
    moveSpeed: base.moveSpeed * (1 + sum.moveSpeedPct / 100),
  };
}

/** Legendary effects currently active through equipped items. */
export function activeEffects(equipment: Equipment): LegendaryEffectId[] {
  const effects: LegendaryEffectId[] = [];
  for (const slot of EQUIP_SLOTS) {
    const item = equipment[slot];
    if (item?.legendaryId) effects.push(getLegendary(item.legendaryId).effect);
  }
  return effects;
}

export interface StatChange {
  before: PlayerStats;
  after: PlayerStats;
}

/** What the stats would be if `candidate` replaced whatever is in its slot. Used by the tooltip. */
export function statsIfEquipped(equipment: Equipment, candidate: ItemInstance, level = 1): StatChange {
  return {
    before: computeStats(equipment, level),
    after: computeStats({ ...equipment, [candidate.slot]: candidate }, level),
  };
}
