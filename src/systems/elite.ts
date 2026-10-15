import {
  ELITE_AFFIXES,
  ELITE_AFFIX_IDS,
  ELITE_BASE,
  ELITE_SECOND_AFFIX_CHANCE,
  type EliteAffixId,
} from '../data/eliteAffixes';
import type { MonsterDef } from '../data/monsters';
import { monsterDamageMultiplier, monsterHpMultiplier } from '../data/progression';
import type { Rng } from './rng';

/** A monster's effective numbers after elite bonuses and affixes. Boss phases are applied on top by Monster. */
export interface MonsterStats {
  maxHp: number;
  damage: number;
  moveSpeed: number;
  attackCooldown: number;
  attackDuration: number;
  /** Sprite size multiplier (elites are bigger). */
  scale: number;
  /** Extra lightning damage per hit as a fraction of the hit. */
  lightningRatio: number;
  /** Fraction of damage dealt that heals the monster. */
  lifestealRatio: number;
}

/**
 * Applies the level and the elite bonuses to a base definition. The numbers of a definition are those of level 1; a monster of a higher level has
 * more life and hits harder (see data/progression.ts). A level-1 monster without affixes gets the definition's own numbers unchanged.
 */
export function computeMonsterStats(def: MonsterDef, affixes: readonly EliteAffixId[], level = 1): MonsterStats {
  const stats: MonsterStats = {
    maxHp: Math.round(def.maxHp * monsterHpMultiplier(level)),
    damage: Math.round(def.damage * monsterDamageMultiplier(level)),
    moveSpeed: def.moveSpeed,
    attackCooldown: def.attackCooldown,
    attackDuration: def.attackDuration,
    scale: 1,
    lightningRatio: 0,
    lifestealRatio: 0,
  };
  if (affixes.length === 0) return stats;

  stats.maxHp *= ELITE_BASE.hpMult;
  stats.damage *= ELITE_BASE.damageMult;
  stats.scale = ELITE_BASE.scale;
  for (const id of affixes) {
    const a = ELITE_AFFIXES[id];
    stats.maxHp *= a.hpMult;
    stats.damage *= a.damageMult;
    stats.moveSpeed *= a.moveSpeedMult;
    stats.attackDuration /= a.attackSpeedMult;
    stats.attackCooldown /= a.attackSpeedMult;
    stats.lightningRatio += a.lightningRatio;
    stats.lifestealRatio += a.lifestealRatio;
  }
  stats.maxHp = Math.round(stats.maxHp);
  stats.damage = Math.round(stats.damage);
  return stats;
}

/** One affix always, a second with ELITE_SECOND_AFFIX_CHANCE; never the same affix twice. */
export function rollEliteAffixes(rng: Rng): EliteAffixId[] {
  const pool = [...ELITE_AFFIX_IDS];
  const count = rng() < ELITE_SECOND_AFFIX_CHANCE ? 2 : 1;
  const picked: EliteAffixId[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    picked.push(pool.splice(index, 1)[0]!);
  }
  return picked;
}
