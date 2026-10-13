import type { EliteAffixId } from '../data/eliteAffixes';
import type { MapSpawns, Population } from '../data/mapData';
import { MONSTERS, monsterForEliteIndex, monsterForSpawnIndex, type MonsterDef } from '../data/monsters';
import type { Vec2 } from '../game/iso';
import { rollEliteAffixes } from './elite';
import type { Rng } from './rng';

export interface SpawnEntry {
  def: MonsterDef;
  pos: Vec2;
  /** Non-empty for elites. */
  affixes: EliteAffixId[];
}

/**
 * Decides what stands on every spawn point of a map: normal monsters ("m"), elites with rolled affixes ("e")
 * and the boss ("B"). Pure; the same rng gives the same affixes.
 */
export function planSpawns(spawns: MapSpawns, rng: Rng, population: Population | null = null): SpawnEntry[] {
  const plan: SpawnEntry[] = [];
  const pick = (ids: readonly string[] | undefined, index: number, fallback: () => MonsterDef): MonsterDef => {
    if (!ids || ids.length === 0) return fallback();
    const id = ids[index % ids.length]!;
    const def = (MONSTERS as Record<string, MonsterDef>)[id];
    if (!def) throw new Error(`Unknown monster "${id}" in a map population`);
    return def;
  };
  spawns.monsters.forEach((pos, i) =>
    plan.push({ def: pick(population?.monsters, i, () => monsterForSpawnIndex(i)), pos, affixes: [] }),
  );
  spawns.elites.forEach((pos, i) =>
    plan.push({ def: pick(population?.elites, i, () => monsterForEliteIndex(i)), pos, affixes: rollEliteAffixes(rng) }),
  );
  if (spawns.boss) {
    plan.push({ def: population?.boss ? pick([population.boss], 0, () => MONSTERS.archon) : MONSTERS.archon, pos: spawns.boss, affixes: [] });
  }
  return plan;
}
