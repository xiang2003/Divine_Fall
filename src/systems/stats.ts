import { PLAYER_CONFIG } from '../config/gameConfig';
import { DAMAGE_TYPES, RESIST_TYPES, type DamageType, type ResistType } from '../data/damageTypes';
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
import type { StatusId } from '../data/statuses';
import type { StatusTrigger } from './status';
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
  /** "Increased damage" of each type as fractions (0.2 = +20%), from gear. */
  increased: Record<DamageType, number>;
  /** Resistance against each non-physical type as fractions (0.3 = 30%, negative = takes extra), before the cap that damage.ts applies. */
  resist: Record<ResistType, number>;
  /** The chance (a fraction) that an attack puts each effect on its target. */
  statusChance: Partial<Record<StatusId, number>>;
  /** Freeze points that each attack adds to the target's gauge. */
  freezeBuildup: number;
  /** Increased damage over time (a fraction): raises burning, bleeding and the other damage effects. */
  dotDamage: number;
  /** Longer effects (a fraction): what an attack puts on lasts this much longer. */
  statusDuration: number;
}

/** Which stat key holds the chance of each effect that gear can give. */
export const STATUS_CHANCE_KEY: Partial<Record<StatusId, StatKey>> = {
  bleeding: 'bleedChancePct',
  burning: 'burnChancePct',
  corruption: 'corruptionChancePct',
  shock: 'shockChancePct',
  armorBreak: 'armorBreakChancePct',
  weaken: 'weakenChancePct',
  slow: 'slowChancePct',
};

/** What the gear of a character puts on whatever it hits, as triggers for the status manager. */
export function gearTriggers(stats: Pick<PlayerStats, 'statusChance' | 'freezeBuildup'>): StatusTrigger[] {
  const out: StatusTrigger[] = [];
  for (const [id, chance] of Object.entries(stats.statusChance ?? {}) as [StatusId, number][]) if (chance > 0) out.push({ id, chance });
  if ((stats.freezeBuildup ?? 0) > 0) out.push({ id: 'freeze', buildup: stats.freezeBuildup });
  return out;
}

/** Which stat key holds the "increased damage" / the resistance of a type. */
export const INCREASED_KEY: Record<DamageType, StatKey> = {
  physical: 'physicalDamagePct',
  fire: 'fireDamagePct',
  cold: 'coldDamagePct',
  lightning: 'lightningDamagePct',
  corruption: 'corruptionDamagePct',
  divine: 'divineDamagePct',
};
export const RESIST_KEY: Record<ResistType, StatKey> = {
  fire: 'fireResPct',
  cold: 'coldResPct',
  lightning: 'lightningResPct',
  corruption: 'corruptionResPct',
  divine: 'divineResPct',
};

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
    physicalDamagePct: 0,
    fireDamagePct: 0,
    coldDamagePct: 0,
    lightningDamagePct: 0,
    corruptionDamagePct: 0,
    divineDamagePct: 0,
    fireResPct: 0,
    coldResPct: 0,
    lightningResPct: 0,
    corruptionResPct: 0,
    divineResPct: 0,
    bleedChancePct: 0,
    burnChancePct: 0,
    corruptionChancePct: 0,
    shockChancePct: 0,
    armorBreakChancePct: 0,
    weakenChancePct: 0,
    slowChancePct: 0,
    freezeBuildup: 0,
    dotDamagePct: 0,
    statusDurationPct: 0,
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
    increased: Object.fromEntries(DAMAGE_TYPES.map((t) => [t, sum[INCREASED_KEY[t]] / 100])) as Record<DamageType, number>,
    resist: Object.fromEntries(RESIST_TYPES.map((t) => [t, sum[RESIST_KEY[t]] / 100])) as Record<ResistType, number>,
    statusChance: Object.fromEntries(
      (Object.entries(STATUS_CHANCE_KEY) as [StatusId, StatKey][]).filter(([, key]) => sum[key] > 0).map(([id, key]) => [id, sum[key] / 100]),
    ) as Partial<Record<StatusId, number>>,
    freezeBuildup: sum.freezeBuildup,
    dotDamage: sum.dotDamagePct / 100,
    statusDuration: sum.statusDurationPct / 100,
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
