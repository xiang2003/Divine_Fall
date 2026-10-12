import type { EliteAffixId } from '../data/eliteAffixes';
import type { MapSpawns } from '../data/mapData';
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
export function planSpawns(spawns: MapSpawns, rng: Rng): SpawnEntry[] {
  const plan: SpawnEntry[] = [];
  spawns.monsters.forEach((pos, i) => plan.push({ def: monsterForSpawnIndex(i), pos, affixes: [] }));
  spawns.elites.forEach((pos, i) => plan.push({ def: monsterForEliteIndex(i), pos, affixes: rollEliteAffixes(rng) }));
  if (spawns.boss) plan.push({ def: MONSTERS.archon, pos: spawns.boss, affixes: [] });
  return plan;
}
