import type { EliteAffixId } from '../data/eliteAffixes';
import type { MapSpawns, Population } from '../data/mapData';
import { MONSTERS, monsterForEliteIndex, monsterForSpawnIndex, type MonsterDef } from '../data/monsters';
import { monsterLevel } from '../data/progression';
import type { Vec2 } from '../game/iso';
import { rollEliteAffixes } from './elite';
import type { Rng } from './rng';

/** How far from the spawn point the members of a pack stand (world units). */
export const PACK_RADIUS = 0.7;

export interface SpawnEntry {
  def: MonsterDef;
  pos: Vec2;
  /** Non-empty for elites. */
  affixes: EliteAffixId[];
  /** The level of the monster: the level of the area, one more for an elite, three more for a boss. */
  level: number;
}

/**
 * Decides what stands on every spawn point of a map: normal monsters ("m"), elites with rolled affixes ("e")
 * and the boss ("B"). Pure; the same rng gives the same affixes.
 */
export function planSpawns(spawns: MapSpawns, rng: Rng, population: Population | null = null, areaLevel = 1): SpawnEntry[] {
  const plan: SpawnEntry[] = [];
  const pick = (ids: readonly string[] | undefined, index: number, fallback: () => MonsterDef): MonsterDef => {
    if (!ids || ids.length === 0) return fallback();
    const id = ids[index % ids.length]!;
    const def = (MONSTERS as Record<string, MonsterDef>)[id];
    if (!def) throw new Error(`Unknown monster "${id}" in a map population`);
    return def;
  };
  spawns.monsters.forEach((pos, i) => {
    const def = pick(population?.monsters, i, () => monsterForSpawnIndex(i));
    // a pack stands in a ring around its spawn point
    const size = def.packSize ?? 1;
    for (let n = 0; n < size; n++) {
      const angle = (n / size) * Math.PI * 2 + i;
      plan.push({ def, pos: size === 1 ? pos : { x: pos.x + Math.cos(angle) * PACK_RADIUS, y: pos.y + Math.sin(angle) * PACK_RADIUS }, affixes: [], level: monsterLevel(areaLevel, 'normal') });
    }
  });
  spawns.elites.forEach((pos, i) =>
    plan.push({ def: pick(population?.elites, i, () => monsterForEliteIndex(i)), pos, affixes: rollEliteAffixes(rng), level: monsterLevel(areaLevel, 'elite') }),
  );
  if (spawns.boss) {
    plan.push({ def: population?.boss ? pick([population.boss], 0, () => MONSTERS.archon) : MONSTERS.archon, pos: spawns.boss, affixes: [], level: monsterLevel(areaLevel, 'boss') });
  }
  return plan;
}
