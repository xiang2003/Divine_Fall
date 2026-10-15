import { describe, expect, it } from 'vitest';
import { ELITE_AFFIXES, ELITE_AFFIX_IDS, ELITE_BASE, type EliteAffixId } from '../src/data/eliteAffixes';
import { LOOT_TABLES } from '../src/data/lootTables';
import { parseMap } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import { rarityRank } from '../src/data/rarity';
import { Monster, type MonsterHooks, type MonsterTarget } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { chooseBossAttack, availableBossAttacks, phaseForHpRatio } from '../src/systems/bossAI';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { computeMonsterStats, rollEliteAffixes } from '../src/systems/elite';
import { rollLoot } from '../src/systems/LootSystem';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { mulberry32 } from '../src/systems/rng';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';
import { planSpawns } from '../src/systems/spawnPlan';
import { Buffs } from '../src/systems/buffs';
import { applyArmor } from '../src/systems/combatMath';
import { computeStats, emptyEquipment } from '../src/systems/stats';

const BOSS = MONSTERS.archon;
const ATTACKS = BOSS.bossAttacks;
const THRESHOLDS = BOSS.phaseThresholds;

describe('elite stats and affixes', () => {
  it('a monster without affixes keeps its base numbers', () => {
    const s = computeMonsterStats(MONSTERS.ghoul, []);
    expect(s).toMatchObject({
      maxHp: MONSTERS.ghoul.maxHp,
      damage: MONSTERS.ghoul.damage,
      moveSpeed: MONSTERS.ghoul.moveSpeed,
      scale: 1,
      lightningRatio: 0,
      lifestealRatio: 0,
    });
  });

  it('every elite is tougher, hits harder and is bigger', () => {
    for (const id of ELITE_AFFIX_IDS) {
      const s = computeMonsterStats(MONSTERS.ghoul, [id]);
      expect(s.maxHp).toBeGreaterThanOrEqual(Math.round(MONSTERS.ghoul.maxHp * ELITE_BASE.hpMult));
      expect(s.damage).toBeGreaterThan(MONSTERS.ghoul.damage);
      expect(s.scale).toBe(ELITE_BASE.scale);
    }
  });

  it('each affix does what it says', () => {
    const base = computeMonsterStats(MONSTERS.ghoul, ['lightning']); // lightning changes neither hp nor speed
    const empowered = computeMonsterStats(MONSTERS.ghoul, ['empowered']);
    expect(empowered.maxHp).toBeGreaterThan(base.maxHp * 1.5);

    const frenzied = computeMonsterStats(MONSTERS.ghoul, ['frenzied']);
    expect(frenzied.attackDuration).toBeLessThan(base.attackDuration);
    expect(frenzied.attackCooldown).toBeLessThan(base.attackCooldown);
    expect(frenzied.moveSpeed).toBeGreaterThan(base.moveSpeed);

    expect(base.lightningRatio).toBe(ELITE_AFFIXES.lightning.lightningRatio);
    expect(base.lifestealRatio).toBe(0);
    expect(computeMonsterStats(MONSTERS.ghoul, ['vampiric']).lifestealRatio).toBe(ELITE_AFFIXES.vampiric.lifestealRatio);
  });

  it('affixes combine', () => {
    const both = computeMonsterStats(MONSTERS.ghoul, ['empowered', 'frenzied']);
    const one = computeMonsterStats(MONSTERS.ghoul, ['empowered']);
    expect(both.maxHp).toBe(one.maxHp);
    expect(both.attackDuration).toBeLessThan(one.attackDuration);
  });

  it('rollEliteAffixes gives one or two distinct valid affixes and reproduces with the same seed', () => {
    const rng = mulberry32(5);
    let singles = 0;
    let doubles = 0;
    for (let i = 0; i < 2000; i++) {
      const picked = rollEliteAffixes(rng);
      expect([1, 2]).toContain(picked.length);
      expect(new Set(picked).size).toBe(picked.length);
      for (const id of picked) expect(ELITE_AFFIX_IDS).toContain(id);
      if (picked.length === 1) singles++;
      else doubles++;
    }
    expect(singles).toBeGreaterThan(0);
    expect(doubles).toBeGreaterThan(singles); // 60% get a second affix
    expect(rollEliteAffixes(mulberry32(9))).toEqual(rollEliteAffixes(mulberry32(9)));
  });

  it('an elite Monster uses the scaled stats, drops from the elite table, and starts at full elite health', () => {
    const m = new Monster(MONSTERS.ghoul, { x: 1, y: 1 }, { affixes: ['empowered'] });
    expect(m.isElite).toBe(true);
    expect(m.maxHp).toBe(m.hp);
    expect(m.maxHp).toBeGreaterThan(MONSTERS.ghoul.maxHp * 2);
    expect(m.lootTable).toBe('elite');
    expect(new Monster(MONSTERS.ghoul, { x: 1, y: 1 }).lootTable).toBe('normalMonster');
  });
});

describe('loot tables for elites and bosses', () => {
  it('elites always drop two items including a magic or better', () => {
    const rng = mulberry32(31);
    for (let i = 0; i < 500; i++) {
      const items = rollLoot(LOOT_TABLES.elite, rng);
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.some((it) => rarityRank(it.rarity) >= rarityRank('magic'))).toBe(true);
    }
  });

  it('boss drops are strictly better than a normal monster: guaranteed, more items, a rare or better', () => {
    const rng = mulberry32(32);
    let boss = 0;
    let normal = 0;
    for (let i = 0; i < 1000; i++) {
      const b = rollLoot(LOOT_TABLES.boss, rng);
      boss += b.length;
      normal += rollLoot(LOOT_TABLES.normalMonster, rng).length;
      expect(b.some((it) => rarityRank(it.rarity) >= rarityRank('rare'))).toBe(true);
    }
    expect(boss / 1000).toBeGreaterThanOrEqual(4);
    expect(boss).toBeGreaterThan(normal * 5);
    expect(MONSTERS.archon.lootTable).toBe('boss');
  });
});

describe('boss attack selection', () => {
  const ctx = (reach: number, sees = true) => ({ reach, dist: reach + 0.83, sees, meleeRange: BOSS.attackRange });

  it('phase boundaries follow the HP thresholds', () => {
    expect(phaseForHpRatio(1, THRESHOLDS)).toBe(0);
    expect(phaseForHpRatio(0.67, THRESHOLDS)).toBe(0);
    expect(phaseForHpRatio(0.66, THRESHOLDS)).toBe(1);
    expect(phaseForHpRatio(0.5, THRESHOLDS)).toBe(1);
    expect(phaseForHpRatio(0.33, THRESHOLDS)).toBe(2);
    expect(phaseForHpRatio(0.01, THRESHOLDS)).toBe(2);
    expect(phaseForHpRatio(0.5, [])).toBe(0);
  });

  it('close up in phase 1 it can only cleave or blast; the fan is not available yet', () => {
    const ids = availableBossAttacks(ATTACKS, 0, ctx(0.2)).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['cleave', 'nova']));
    expect(ids).not.toContain('fan');
    expect(ids).not.toContain('barrage');
  });

  it('far away it only fires projectiles, and only once the fan is unlocked', () => {
    expect(availableBossAttacks(ATTACKS, 0, ctx(6))).toEqual([]); // phase 1: nothing to do at range, so it walks closer
    expect(availableBossAttacks(ATTACKS, 1, ctx(6)).map((a) => a.id)).toEqual(['fan']);
    expect(availableBossAttacks(ATTACKS, 2, ctx(6)).map((a) => a.id).sort()).toEqual(['barrage', 'fan']);
  });

  it('never fires without line of sight', () => {
    expect(availableBossAttacks(ATTACKS, 2, ctx(6, false))).toEqual([]);
  });

  it('chooses by weight among available attacks (seeded) and returns null when none fit', () => {
    const rng = mulberry32(8);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const a = chooseBossAttack(ATTACKS, 0, ctx(0.2), rng)!;
      counts[a.id] = (counts[a.id] ?? 0) + 1;
    }
    expect(counts.cleave! / counts.nova!).toBeGreaterThan(1.2); // weights 3 : 2
    expect(chooseBossAttack(ATTACKS, 0, ctx(6), rng)).toBeNull();
  });

  it('has at least two different attack modes and escalates across phases', () => {
    expect(new Set(ATTACKS.map((a) => a.kind)).size).toBeGreaterThanOrEqual(3);
    const kindsByPhase = [0, 1, 2].map((p) => ATTACKS.filter((a) => a.minPhase <= p).length);
    expect(kindsByPhase[1]).toBeGreaterThan(kindsByPhase[0]!);
    expect(kindsByPhase[2]).toBeGreaterThan(kindsByPhase[1]!);
  });
});

// A hall with a pillar so line of sight can be blocked.
const HALL = parseMap({
  id: 'hall',
  name: 'hall',
  layout: [
    '##############################',
    '#P...........................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '##############################',
  ],
});
const DT = 1 / 60;

class BossRig {
  melee: number[] = [];
  nova: { radius: number; mult: number }[] = [];
  telegraphs: { radius: number; duration: number }[] = [];
  shots: { dirX: number; dirY: number; mult: number }[] = [];
  phases: number[] = [];
  readonly hooks: MonsterHooks = {
    meleeStrike: (_m, mult) => this.melee.push(mult),
    fireProjectile: (_m, dirX, dirY, mult) => this.shots.push({ dirX, dirY, mult }),
    novaStrike: (_m, radius, mult) => this.nova.push({ radius, mult }),
    telegraph: (_m, radius, duration) => this.telegraphs.push({ radius, duration }),
    phaseChanged: (_m, phase) => this.phases.push(phase),
    split: () => {},
    summonPillars: () => {},
  };
  readonly collision = new CollisionSystem(HALL);
  target: MonsterTarget & { pos: { x: number; y: number }; isDead: boolean };
  constructor(tx: number, ty: number) {
    this.target = { pos: { x: tx, y: ty }, radius: 0.28, isDead: false };
  }
  run(m: Monster, seconds: number) {
    for (let i = 0; i < Math.round(seconds / DT); i++) m.update(DT, this.target, this.collision, this.hooks);
  }
}

/** A boss whose attack choices are forced: rng just above 0 always picks the first available option. */
const bossAt = (x: number, y: number, rng = () => 0.001) => new Monster(BOSS, { x, y }, { rng });

describe('boss behaviour', () => {
  it('engages when it notices the player, and is flagged for the boss bar', () => {
    const rig = new BossRig(10.5, 3.5);
    const boss = bossAt(5.5, 3.5);
    expect(boss.engaged).toBe(false);
    rig.run(boss, 0.2);
    expect(boss.engaged).toBe(true);
  });

  it('cleaves when the player is in reach: one strike, at the strike moment, with the move damage multiplier', () => {
    const rig = new BossRig(6.6, 3.5);
    const boss = bossAt(5.5, 3.5); // reach = 1.1 - 0.28 - 0.55 = 0.27 <= 0.7
    rig.run(boss, 0.05);
    expect(boss.state).toBe('attack');
    expect(rig.melee).toHaveLength(0);
    const cleave = ATTACKS.find((a) => a.id === 'cleave')!;
    rig.run(boss, cleave.duration * 0.55 - 0.1);
    expect(rig.melee).toHaveLength(0);
    rig.run(boss, 0.2);
    expect(rig.melee).toEqual([cleave.damageMult]);
  });

  it('a nova shows a ground warning first (for exactly the windup), then goes off once at its radius', () => {
    const rig = new BossRig(6.6, 3.5);
    // rng 0.9 skips cleave (weight 3 of 5 -> first 60%) and picks the nova
    const boss = bossAt(5.5, 3.5, () => 0.9);
    rig.run(boss, 0.05);
    const nova = ATTACKS.find((a) => a.id === 'nova')!;
    expect(rig.telegraphs).toEqual([{ radius: nova.radius, duration: nova.duration * nova.hitFraction! }]);
    expect(rig.nova).toHaveLength(0); // the warning comes before the blast
    rig.run(boss, nova.duration * nova.hitFraction! + 0.1);
    expect(rig.nova).toEqual([{ radius: nova.radius, mult: nova.damageMult }]);
    rig.run(boss, nova.duration);
    expect(rig.nova).toHaveLength(1);
  });

  it('the fan fires `count` projectiles spread symmetrically around the player direction', () => {
    const rig = new BossRig(14.5, 3.5);
    const boss = bossAt(5.5, 3.5);
    boss.takeDamage(Math.ceil(boss.maxHp * 0.4)); // below 66%: phase 2 unlocks the fan
    expect(boss.phase).toBe(1);
    // closes in until the fan is the only legal move at range, then fires
    let guard = 0;
    while (rig.shots.length === 0 && guard++ < 1200) rig.run(boss, DT);
    const fan = ATTACKS.find((a) => a.id === 'fan')!;
    expect(rig.shots).toHaveLength(fan.count!);
    const angles = rig.shots.map((s) => Math.atan2(s.dirY, s.dirX));
    const middle = angles[Math.floor(fan.count! / 2)]!;
    expect(angles[0]! - middle).toBeCloseTo(-(angles.at(-1)! - middle), 6); // symmetric
    expect(Math.abs(angles[1]! - angles[0]!)).toBeCloseTo(fan.spread!, 6);
    for (const s of rig.shots) {
      expect(Math.hypot(s.dirX, s.dirY)).toBeCloseTo(1, 9);
      expect(s.mult).toBe(fan.damageMult);
    }
  });

  it('changes phase exactly once per threshold, announces each, and never goes backwards (even when healed)', () => {
    const rig = new BossRig(25.5, 3.5);
    const boss = bossAt(5.5, 3.5);
    boss.takeDamage(Math.ceil(boss.maxHp * 0.36)); // 64% left -> phase 2
    rig.run(boss, 0.1);
    expect(rig.phases).toEqual([1]);
    boss.takeDamage(Math.ceil(boss.maxHp * 0.33)); // ~31% left -> phase 3
    rig.run(boss, 0.1);
    expect(rig.phases).toEqual([1, 2]);
    boss.heal(boss.maxHp); // healing back up does not undo a phase
    boss.takeDamage(1);
    rig.run(boss, 0.5);
    expect(boss.phase).toBe(2);
    expect(rig.phases).toEqual([1, 2]);
  });

  it('later phases are faster and attack more often', () => {
    const boss = bossAt(5.5, 3.5);
    const p0 = { speed: boss.moveSpeed, cooldown: boss.attackCooldown };
    boss.takeDamage(Math.ceil(boss.maxHp * 0.7));
    expect(boss.phase).toBe(2);
    expect(boss.moveSpeed).toBeGreaterThan(p0.speed);
    expect(boss.attackCooldown).toBeLessThan(p0.cooldown);
  });

  it('cannot be staggered or stunned, but still turns on whoever hits it', () => {
    const rig = new BossRig(25.5, 3.5);
    const boss = bossAt(5.5, 3.5);
    expect(boss.stun(5)).toBe(false);
    boss.takeDamage(1);
    expect(boss.state).toBe('chase');
    rig.run(boss, 0.5);
    boss.takeDamage(1);
    expect(boss.state).not.toBe('hurt');
  });

  it('dying mid-blast cancels everything: no blast goes off', () => {
    const rig = new BossRig(6.6, 3.5);
    const boss = bossAt(5.5, 3.5, () => 0.9);
    rig.run(boss, 0.3); // in the middle of the nova windup
    expect(rig.telegraphs).toHaveLength(1);
    boss.takeDamage(99999);
    rig.run(boss, 3);
    expect(rig.nova).toHaveLength(0);
    expect(boss.state).toBe('dead');
  });

  it('keeps closing in on a distant player in phase 1, where it has no ranged attack', () => {
    const rig = new BossRig(13.5, 3.5); // 8 away: inside detection range, far outside melee
    const boss = bossAt(5.5, 3.5);
    rig.run(boss, 0.2);
    const x0 = boss.pos.x;
    rig.run(boss, 1);
    expect(boss.pos.x).toBeGreaterThan(x0);
    expect(rig.shots).toHaveLength(0);
  });
});

describe('spawn plan', () => {
  const spawns = {
    player: { x: 1, y: 1 },
    monsters: [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }],
    elites: [{ x: 6, y: 6 }, { x: 7, y: 7 }],
    boss: { x: 8, y: 8 },
    exit: null,
  };

  it('places normal monsters, rolled elites and exactly one boss', () => {
    const plan = planSpawns(spawns, mulberry32(1));
    expect(plan).toHaveLength(7);
    const normals = plan.filter((p) => p.affixes.length === 0 && !p.def.isBoss);
    const elites = plan.filter((p) => p.affixes.length > 0);
    const bosses = plan.filter((p) => p.def.isBoss);
    expect(normals).toHaveLength(4);
    expect(elites).toHaveLength(2);
    expect(bosses).toHaveLength(1);
    expect(bosses[0]!.pos).toEqual({ x: 8, y: 8 });
    for (const e of elites) for (const id of e.affixes) expect(ELITE_AFFIX_IDS).toContain(id as EliteAffixId);
  });

  it('is deterministic for a seed and omits the boss on a map without one', () => {
    expect(planSpawns(spawns, mulberry32(4))).toEqual(planSpawns(spawns, mulberry32(4)));
    expect(planSpawns({ ...spawns, boss: null }, mulberry32(4)).some((p) => p.def.isBoss)).toBe(false);
  });
});

function combatRig(sourceAffixes: EliteAffixId[]) {
  const stats = { ...computeStats(emptyEquipment()), armor: 0 };
  const taken: number[] = [];
  const arcs: number[][] = [];
  let deaths = 0;
  const player = {
    pos: { x: 3, y: 3 },
    radius: 0.28,
    stats,
    hp: 500,
    isDead: false,
    buffs: new Buffs(),
    hasEffect: () => false,
    heal: () => 0,
    takeDamage(raw: number) {
      if (player.isDead) return { amount: 0, died: false };
      const amount = applyArmor(raw, stats.armor);
      player.hp -= amount;
      const died = player.hp <= 0;
      if (died) player.isDead = true;
      return { amount, died };
    },
  };
  const events: CombatEvents = {
    damageDealt: () => {},
    damageTaken: (_x, _y, a) => taken.push(a),
    monsterKilled: () => {},
    playerDied: () => deaths++,
    healed: () => {},
    lightningArc: (ax, ay, bx, by) => arcs.push([ax, ay, bx, by]),
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
    new CollisionSystem(HALL),
    () => 0.5,
    events,
  );
  const monster = new Monster(MONSTERS.ghoul, { x: 3.7, y: 3 }, { affixes: sourceAffixes });
  return { combat, monster, player, taken, arcs, deaths: () => deaths };
}

describe('elite effects in combat', () => {
  it('a lightning elite adds a second hit and an arc on every strike', () => {
    const { combat, monster, taken, arcs } = combatRig(['lightning']);
    combat.meleeStrike(monster, 1);
    expect(taken).toHaveLength(2);
    expect(taken[0]).toBe(Math.round(monster.damage));
    expect(taken[1]).toBe(Math.max(1, Math.round(monster.damage * ELITE_AFFIXES.lightning.lightningRatio)));
    expect(arcs).toHaveLength(1);
  });

  it('a normal monster hits once and draws no arc', () => {
    const { combat, taken, arcs, player } = combatRig([]);
    const plain = new Monster(MONSTERS.ghoul, { x: 3.7, y: 3 });
    combat.meleeStrike(plain, 1);
    expect(taken).toEqual([plain.damage]);
    expect(arcs).toHaveLength(0);
    expect(player.hp).toBe(500 - plain.damage);
  });

  it('a vampiric elite heals by a share of the damage it deals, never above its maximum', () => {
    const { combat, monster } = combatRig(['vampiric']);
    monster.hp = 10;
    combat.meleeStrike(monster, 1);
    expect(monster.hp).toBe(10 + Math.round(monster.damage * ELITE_AFFIXES.vampiric.lifestealRatio));
    monster.hp = monster.maxHp;
    combat.meleeStrike(monster, 1);
    expect(monster.hp).toBe(monster.maxHp);
  });

  it('the lightning hit that kills the player ends the fight once', () => {
    const { combat, monster, player, deaths } = combatRig(['lightning']);
    player.hp = 1;
    combat.meleeStrike(monster, 1);
    expect(player.isDead).toBe(true);
    expect(deaths()).toBe(1);
    combat.meleeStrike(monster, 1);
    expect(deaths()).toBe(1);
  });

  it('a boss blast hurts only a player inside its radius, and a boss strike scales with the move multiplier', () => {
    const inside = combatRig([]);
    const boss = new Monster(MONSTERS.archon, { x: 3, y: 3 });
    inside.player.pos.x = 5; // 2 tiles away, radius 3.4
    inside.combat.novaStrike(boss, 3.4, 1.4);
    expect(inside.taken).toEqual([Math.round(boss.damage * 1.4)]);

    const outside = combatRig([]);
    outside.player.pos.x = 9; // 6 tiles away
    outside.combat.novaStrike(boss, 3.4, 1.4);
    expect(outside.taken).toEqual([]);
  });

  it('a dodging (invulnerable) player takes nothing from a blast or elite lightning', () => {
    const { combat, monster, player, taken, arcs } = combatRig(['lightning']);
    player.takeDamage = () => ({ amount: 0, died: false });
    combat.meleeStrike(monster, 1);
    expect(taken).toEqual([]);
    expect(arcs).toEqual([]); // no hit landed, so no lightning rider either
  });
});
