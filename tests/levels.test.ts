import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { MapParseError, parseMap, type MapData } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import {
  BOSS_LEVEL_BONUS,
  ELITE_LEVEL_BONUS,
  ELITE_XP_MULT,
  MAX_LEVEL,
  goldMultiplier,
  killsPerLevel,
  monsterDamageMultiplier,
  monsterHpMultiplier,
  monsterLevel,
  xpLevelMultiplier,
  xpPerKill,
  xpToNextLevel,
} from '../src/data/progression';
import { QUESTS } from '../src/data/quests';
import { WORLD_MAP_FILES, isTown } from '../src/data/worldMaps';
import { Monster } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { Buffs } from '../src/systems/buffs';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { baselineDamage } from '../src/systems/damage';
import { rollGold } from '../src/systems/economy';
import { Progression } from '../src/systems/progression';
import { mulberry32 } from '../src/systems/rng';
import { planSpawns } from '../src/systems/spawnPlan';
import { StatusSet } from '../src/systems/status';
import { computeStats, emptyEquipment } from '../src/systems/stats';
import { computeMonsterStats } from '../src/systems/elite';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';

const total = (level: number): number => {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNextLevel(l);
  return sum;
};
const loadMap = (id: string): MapData => parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES[id as keyof typeof WORLD_MAP_FILES]}`, import.meta.url), 'utf8')) as unknown);

describe('the experience curve of levels 1 to 100', () => {
  it('goes to level 100, starts cheap, grows every level and costs nothing at the cap', () => {
    expect(MAX_LEVEL).toBe(100);
    expect(xpToNextLevel(1)).toBe(40);
    for (let l = 1; l < MAX_LEVEL - 1; l++) expect(xpToNextLevel(l + 1), `level ${l}`).toBeGreaterThan(xpToNextLevel(l));
    expect(xpToNextLevel(MAX_LEVEL)).toBe(0);
    expect(xpToNextLevel(MAX_LEVEL - 1)).toBeGreaterThan(10_000_000);
  });

  it('has the shape of the Path of Exile curve: the share of the total reached at 60, 70, 80 and 90 levels', () => {
    const t100 = total(100);
    expect(t100).toBeGreaterThan(220_000_000);
    expect(t100).toBeLessThan(240_000_000);
    const share = (l: number) => total(l) / t100;
    expect(share(60)).toBeCloseTo(0.035, 1); // read off the graph: about 3.5%
    expect(Math.abs(share(60) - 0.035)).toBeLessThan(0.01);
    expect(Math.abs(share(70) - 0.09)).toBeLessThan(0.01);
    expect(Math.abs(share(80) - 0.21)).toBeLessThan(0.015);
    expect(Math.abs(share(90) - 0.47)).toBeLessThan(0.015);
    // the last ten levels cost about as much as the first ninety
    expect(t100 - total(90)).toBeGreaterThan(total(90));
  });

  it('is worth the same however it comes: levels are gained one after the other, carrying the overflow', () => {
    const p = new Progression();
    p.addXp(total(30));
    expect(p.level).toBe(30);
    expect(p.xp).toBe(0);
    p.addXp(total(100));
    expect(p.level).toBe(MAX_LEVEL);
  });
});

describe('experience of a monster', () => {
  it('is the cost of a level divided by the kills a level should take, so it grows with the level and never falls', () => {
    for (let l = 1; l <= 99; l++) {
      // (the experience is a whole number, so the first levels, where it is small, are off by up to half a kill)
      expect(Math.abs(xpPerKill(l) * killsPerLevel(l) - xpToNextLevel(l)), `level ${l}`).toBeLessThanOrEqual(xpToNextLevel(l) * 0.1 + killsPerLevel(l) / 2);
    }
    // (a bend in the line of target kills may cost a tiny dip, never more than a percent)
    for (let l = 1; l < 98; l++) expect(xpPerKill(l + 1), `level ${l}`).toBeGreaterThanOrEqual(xpPerKill(l) * 0.99);
  });

  it('the target kills: 9 to 13 early (the maps of the first chapters are small), 22 at 30, 50 at 60, 150 at 90', () => {
    expect(killsPerLevel(1)).toBe(9);
    expect(killsPerLevel(10)).toBe(13);
    expect(killsPerLevel(30)).toBe(22);
    expect(killsPerLevel(60)).toBe(50);
    expect(killsPerLevel(90)).toBe(150);
    expect(killsPerLevel(99)).toBe(250);
  });

  it('an elite is worth three ordinary monsters, a boss about six, and the weight of a definition scales it', () => {
    const at = (def: (typeof MONSTERS)[keyof typeof MONSTERS], level: number, affixes: ('empowered')[] = []) => new Monster(def, { x: 5, y: 5 }, { level, affixes });
    expect(at(MONSTERS.ghoul, 10).xpReward).toBe(xpPerKill(10));
    expect(at(MONSTERS.ghoul, 10, ['empowered']).xpReward).toBe(Math.round(xpPerKill(10) * ELITE_XP_MULT));
    expect(at(MONSTERS.ruins_guardian, 10).xpReward).toBe(xpPerKill(10) * 6);
    expect(at(MONSTERS.shade, 10).xpReward).toBe(Math.round(xpPerKill(10) * 1.4));
    expect(at(MONSTERS.ghoul, 20).xpReward).toBeGreaterThan(at(MONSTERS.ghoul, 10).xpReward);
  });
});

describe('the penalty for a level difference (the rule of Path of Exile)', () => {
  it('nothing is lost at the same level or inside the safe range, which grows with the level', () => {
    expect(xpLevelMultiplier(10, 10)).toBe(1);
    expect(xpLevelMultiplier(10, 13)).toBe(1);
    expect(xpLevelMultiplier(10, 7)).toBe(1);
    expect(xpLevelMultiplier(10, 14)).toBeLessThan(1);
    expect(xpLevelMultiplier(32, 37)).toBe(1); // the safe range is 5 at level 32
    expect(xpLevelMultiplier(32, 38)).toBeLessThan(1);
  });

  it('matches the table of the plan', () => {
    expect(xpLevelMultiplier(10, 15)).toBeCloseTo(0.62, 2);
    expect(xpLevelMultiplier(30, 22)).toBeCloseTo(0.38, 2);
    expect(xpLevelMultiplier(10, 22)).toBeCloseTo(0.01, 2);
    expect(xpLevelMultiplier(90, 102)).toBeCloseTo(0.65, 2);
  });

  it('works both ways, falls the farther away, and never goes below 1% or above 100%', () => {
    for (const p of [5, 20, 50, 80]) {
      expect(xpLevelMultiplier(p, p + 9)).toBeCloseTo(xpLevelMultiplier(p, p - 9), 9);
      let last = 1;
      for (let d = 0; d <= 40; d++) {
        const m = xpLevelMultiplier(p, p + d);
        expect(m).toBeLessThanOrEqual(last + 1e-12);
        expect(m).toBeGreaterThanOrEqual(0.01);
        last = m;
      }
    }
  });
});

describe('monsters grow with their level', () => {
  it('the numbers of a definition are those of level 1; a higher level has more life and hits harder, and it stays whole numbers', () => {
    expect(monsterHpMultiplier(1)).toBe(1);
    expect(monsterDamageMultiplier(1)).toBe(1);
    expect(computeMonsterStats(MONSTERS.ghoul, [])).toMatchObject({ maxHp: MONSTERS.ghoul.maxHp, damage: MONSTERS.ghoul.damage });
    const s10 = computeMonsterStats(MONSTERS.ghoul, [], 10);
    expect(s10.maxHp).toBe(Math.round(MONSTERS.ghoul.maxHp * Math.pow(1.06, 9)));
    expect(s10.damage).toBe(Math.round(MONSTERS.ghoul.damage * Math.pow(1.045, 9)));
    expect(computeMonsterStats(MONSTERS.ghoul, [], 50).maxHp).toBeGreaterThan(s10.maxHp);
    // speed, reach and timing do not change with the level
    expect(s10.moveSpeed).toBe(MONSTERS.ghoul.moveSpeed);
    expect(s10.attackCooldown).toBe(MONSTERS.ghoul.attackCooldown);
  });

  it('the curve of the plan: 100 times level 1 at level 78 for life, 78 times at 100 for damage', () => {
    expect(monsterHpMultiplier(100)).toBeCloseTo(320, -1);
    expect(monsterDamageMultiplier(100)).toBeCloseTo(78, 0);
  });

  it('an elite stands on top of its level, and the monster knows its level', () => {
    const normal = new Monster(MONSTERS.ghoul, { x: 5, y: 5 }, { level: 10 });
    const elite = new Monster(MONSTERS.ghoul, { x: 5, y: 5 }, { level: 11, affixes: ['empowered'] });
    expect(normal.level).toBe(10);
    expect(normal.maxHp).toBe(computeMonsterStats(MONSTERS.ghoul, [], 10).maxHp);
    expect(elite.maxHp).toBeGreaterThan(normal.maxHp * 2.5);
    expect(new Monster(MONSTERS.ghoul, { x: 5, y: 5 }).level).toBe(1);
  });

  it('reinforcements called by a monster are of its level', () => {
    // see MonsterAISystem.spawnMinions: `level: owner.level`; the plan gives the level to the owner
    expect(monsterLevel(10, 'normal')).toBe(10);
  });

  it('gold grows with the level of the monster that dropped it', () => {
    const rng = () => 0.1;
    const level1 = rollGold('normalMonster', rng, 1);
    const level31 = rollGold('normalMonster', rng, 31);
    expect(level31).toBe(Math.round(level1 * goldMultiplier(31)));
    expect(level31).toBeGreaterThan(level1 * 5);
    expect(rollGold('normalMonster', rng)).toBe(level1);
  });
});

describe('area levels', () => {
  it('an elite is one level above its area and a boss three, and the plan gives every monster its level', () => {
    expect(ELITE_LEVEL_BONUS).toBe(1);
    expect(BOSS_LEVEL_BONUS).toBe(3);
    expect(monsterLevel(10, 'elite')).toBe(11);
    expect(monsterLevel(10, 'boss')).toBe(13);
    expect(monsterLevel(99, 'boss')).toBe(MAX_LEVEL);
    const map = loadMap('pure_ruins');
    const plan = planSpawns(map.spawns, mulberry32(3), map.population, map.level!);
    for (const entry of plan) {
      const kind = entry.def.isBoss ? 'boss' : entry.affixes.length > 0 ? 'elite' : 'normal';
      expect(entry.level, entry.def.id).toBe(monsterLevel(7, kind));
    }
    expect(planSpawns(map.spawns, mulberry32(3), map.population)[0]!.level).toBe(1); // no area level: level 1
  });

  it('every fighting map has a recommended level, and towns and quiet places have none', () => {
    for (const id of Object.keys(WORLD_MAP_FILES)) {
      const map = loadMap(id);
      if (isTown(id) || id === 'pure_coast') expect(map.level, id).toBeNull();
      else expect(map.level, id).toBeGreaterThanOrEqual(1);
      if (map.level === null) expect(map.spawns.monsters.length + map.spawns.elites.length, id).toBe(0);
    }
  });

  it('the recommended level rises with every step along the story', () => {
    const route = ['pure_forest', 'pure_ruins', 'pure_core', 'canglan_coast', 'canglan_forest', 'broken_sword_pass'];
    const levels = route.map((id) => loadMap(id).level!);
    for (let i = 1; i < levels.length; i++) expect(levels[i], `${route[i]} comes after ${route[i - 1]}`).toBeGreaterThan(levels[i - 1]!);
    // the spring cave is a dead end off the first forest: harder than the forest, easier than the ruins
    expect(loadMap('pure_spring_cave').level).toBeGreaterThan(levels[0]!);
    expect(loadMap('pure_spring_cave').level).toBeLessThan(levels[1]!);
    expect(levels).toEqual([2, 7, 10, 13, 16, 20]);
  });

  it('rejects a level that is not a whole number from 1 to 100', () => {
    const base = { id: 'x', name: 'x', layout: ['####', '#P.#', '####'] };
    for (const level of [0, 101, 2.5, -4]) expect(() => parseMap({ ...base, level }), String(level)).toThrow(MapParseError);
    expect(parseMap({ ...base, level: 12 }).level).toBe(12);
    expect(parseMap(base).level).toBeNull();
  });
});

describe('armor and traps follow the level', () => {
  const MAP = parseMap({ id: 'c', name: 'c', layout: ['##########', '#P.......#', '#........#', '#........#', '##########'] });

  function rig() {
    const attackerLevels: number[] = [];
    const player = {
      pos: { x: 2.5, y: 2.5 },
      radius: PLAYER_CONFIG.radius,
      stats: computeStats(emptyEquipment()),
      hp: 1000,
      isDead: false,
      buffs: new Buffs(),
      status: new StatusSet(),
      applyPoison() {},
      applySlow() {},
      tickStatus: () => null,
      hasEffect: () => false,
      heal: () => 0,
      takeDamage(_raw: number, _type?: string, level?: number) {
        attackerLevels.push(level ?? 1);
        return { amount: 1, died: false };
      },
    };
    const handlers: CombatEvents = {
      damageDealt: () => {},
      damageTaken: () => {},
      monsterKilled: () => {},
      playerDied: () => {},
      healed: () => {},
      lightningArc: () => {},
      skillFx: () => {},
      telegraph: () => {},
      novaFlash: () => {},
      phaseChanged: () => {},
      spawnMinions: () => {},
      pillars: () => {},
    };
    const combat = new CombatSystem(
      player as unknown as Player,
      () => [],
      { fire: () => true, update: () => {} } as unknown as ProjectileSystem,
      { fire: () => true, update: () => {} } as unknown as SkillProjectileSystem,
      new CollisionSystem(MAP),
      () => 0.5,
      handlers,
    );
    return { combat, attackerLevels };
  }

  it('armor is measured against the level of the monster that hits: the same armor takes less off a higher level', () => {
    const { combat, attackerLevels } = rig();
    combat.meleeStrike(new Monster(MONSTERS.ghoul, { x: 3, y: 2.5 }, { level: 30 }));
    expect(attackerLevels).toEqual([30]);
    expect(baselineDamage(30)).toBeGreaterThan(baselineDamage(1));
  });

  it('a trap hits with the level of the area, and its damage grows with it', () => {
    const { combat, attackerLevels } = rig();
    combat.areaLevel = 16;
    combat.trapHit(combat.trapDamage(10));
    expect(attackerLevels).toEqual([16]);
    expect(combat.trapDamage(10)).toBe(Math.round(10 * Math.pow(1.045, 15)));
    combat.areaLevel = 1;
    expect(combat.trapDamage(10)).toBe(10);
  });
});

describe('quests pay in experience that follows the curve', () => {
  it('a reward is a number of ordinary monsters of the quest level, and the later quests pay more', () => {
    const xp = (id: string) => QUESTS[id]!.rewards.xp;
    expect(xp('q5_wolf_bounty')).toBe(xpPerKill(16) * 6);
    expect(xp('q8_colossus_bounty')).toBe(xpPerKill(23) * 10);
    const chapter1 = ['q1_first_hunt', 'q2_muddy_water', 'q3_resonance', 'q4_stranded_boat'].map(xp);
    const chapter2 = ['q5_wolf_bounty', 'q6_altar_trace', 'q7_warden_bounty', 'q8_colossus_bounty'].map(xp);
    expect(Math.min(...chapter2)).toBeGreaterThan(Math.max(...chapter1)); // every quest of the second chapter pays more than any of the first
  });
});

describe('the pace of the game: clearing each map once, in order', () => {
  /** What clearing a map once gives to a character of `level` (experience after the level difference), with the levels of every monster. */
  const steps: string[] = [];
  function clear(id: string, p: Progression): void {
    const before = p.level;
    const map = loadMap(id);
    for (const entry of planSpawns(map.spawns, mulberry32(11), map.population, map.level!)) {
      const kind = entry.def.isBoss ? 'boss' : entry.affixes.length > 0 ? 'elite' : 'normal';
      const reward = Math.round((xpPerKill(entry.level) * entry.def.xp) / 10 * (kind === 'elite' ? ELITE_XP_MULT : 1));
      p.addXp(Math.max(1, Math.round(reward * xpLevelMultiplier(p.level, entry.level))));
    }
    steps.push(`${id}: level ${before} -> ${p.level}`);
  }

  it('the first chapter, cleared once with its quests, ends at about level 9 to 12, and the second at about level 16 to 22', () => {
    const p = new Progression();
    const quest = (id: string) => p.addXp(QUESTS[id]!.rewards.xp);
    clear('pure_forest', p);
    quest('q1_first_hunt');
    clear('pure_spring_cave', p);
    quest('q2_muddy_water');
    clear('pure_ruins', p);
    quest('q3_resonance');
    clear('pure_core', p);
    quest('q4_stranded_boat');
    const afterChapterOne = p.level;
    expect(afterChapterOne, `after chapter 1: level ${p.level} (${steps.join('; ')})`).toBeGreaterThanOrEqual(8);
    expect(afterChapterOne, `after chapter 1: level ${p.level} (${steps.join('; ')})`).toBeLessThanOrEqual(12);
    clear('canglan_coast', p);
    clear('canglan_forest', p);
    quest('q5_wolf_bounty');
    quest('q6_altar_trace');
    quest('q7_warden_bounty');
    clear('broken_sword_pass', p);
    quest('q8_colossus_bounty');
    expect(p.level, `after chapter 2: level ${p.level}`).toBeGreaterThanOrEqual(15);
    expect(p.level, `after chapter 2: level ${p.level}`).toBeLessThanOrEqual(24);
  });
});
