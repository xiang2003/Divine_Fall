import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { parseMap } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import { NO_UPGRADE, SKILLS, getSkill } from '../src/data/skills';
import { Bolt } from '../src/entities/Bolt';
import { Monster } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { AttackTimer } from '../src/systems/AttackTimer';
import { Buffs } from '../src/systems/buffs';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';
import { MAX_COOLDOWN_REDUCTION, SkillCooldowns, getSkillStats } from '../src/systems/skills';
import { computeStats, emptyEquipment } from '../src/systems/stats';

describe('skill data', () => {
  it('defines Q, W and E with distinct kinds and valid numbers', () => {
    expect(SKILLS.map((s) => s.action)).toEqual(['skillQ', 'skillW', 'skillE']);
    expect(new Set(SKILLS.map((s) => s.kind)).size).toBe(3);
    for (const s of SKILLS) {
      expect(s.cooldown).toBeGreaterThan(s.castTime);
      expect(s.damageMult).toBeGreaterThan(0);
      expect(s.hitFraction).toBeGreaterThan(0);
      expect(s.hitFraction).toBeLessThan(1);
    }
    expect(() => getSkill('nope')).toThrow();
  });
});

describe('getSkillStats (enhancements)', () => {
  const bolt = getSkill('bolt');

  it('is the base definition without upgrades', () => {
    expect(getSkillStats(bolt)).toEqual({ damageMult: bolt.damageMult, cooldown: bolt.cooldown, count: 1 });
  });

  it('applies damage, cooldown and projectile-count upgrades', () => {
    const s = getSkillStats(bolt, { damagePct: 50, cooldownReductionPct: 25, extraProjectiles: 2 });
    expect(s.damageMult).toBeCloseTo(bolt.damageMult * 1.5, 9);
    expect(s.cooldown).toBeCloseTo(bolt.cooldown * 0.75, 9);
    expect(s.count).toBe(3);
  });

  it('caps cooldown reduction so a skill cannot be spammed', () => {
    const s = getSkillStats(bolt, { ...NO_UPGRADE, cooldownReductionPct: 500 });
    expect(s.cooldown).toBeCloseTo(bolt.cooldown * (1 - MAX_COOLDOWN_REDUCTION), 9);
    expect(s.cooldown).toBeGreaterThan(0);
  });

  it('ignores negative extra projectiles', () => {
    expect(getSkillStats(bolt, { ...NO_UPGRADE, extraProjectiles: -3 }).count).toBe(1);
  });
});

describe('SkillCooldowns', () => {
  it('cannot start a skill that is cooling down, and becomes ready exactly when the time is up', () => {
    const c = new SkillCooldowns();
    expect(c.ready('spin')).toBe(true);
    expect(c.start('spin', 6)).toBe(true);
    expect(c.ready('spin')).toBe(false);
    expect(c.start('spin', 6)).toBe(false); // no double cast
    c.update(5.9);
    expect(c.ready('spin')).toBe(false);
    expect(c.remainingOf('spin')).toBeCloseTo(0.1, 9);
    c.update(0.1);
    expect(c.ready('spin')).toBe(true);
    expect(c.start('spin', 6)).toBe(true);
  });

  it('tracks skills independently and reports the sweep length', () => {
    const c = new SkillCooldowns();
    c.start('spin', 6);
    expect(c.ready('bolt')).toBe(true);
    c.update(1);
    expect(c.totalOf('spin')).toBe(6);
    expect(c.anyActive).toBe(true);
    c.update(10);
    expect(c.anyActive).toBe(false);
    c.start('slam', 9);
    c.reset();
    expect(c.ready('slam')).toBe(true);
    expect(c.anyActive).toBe(false);
  });

  it('never goes negative', () => {
    const c = new SkillCooldowns();
    c.start('spin', 1);
    c.update(50);
    expect(c.remainingOf('spin')).toBe(0);
  });
});

describe('AttackTimer ignoreCooldown', () => {
  it('lets a skill start during basic-attack recovery but never during a swing', () => {
    const t = new AttackTimer();
    t.start(0.3, 0.6, 0.5); // basic attack with a long cooldown tail
    t.update(0.35); // swing over, cooldown still running
    expect(t.start(0.4, 0.4, 0.5)).toBe(false);
    expect(t.start(0.4, 0.4, 0.5, true)).toBe(true);
    expect(t.start(0.4, 0.4, 0.5, true)).toBe(false); // mid-swing: refused even when ignoring cooldown
  });
});

const ROOM = parseMap({
  id: 's',
  name: 's',
  layout: [
    '####################',
    '#P.................#',
    '#..................#',
    '#..................#',
    '#........#.........#',
    '#..................#',
    '####################',
  ],
});

describe('Bolt', () => {
  const collision = new CollisionSystem(ROOM);
  const DT = 1 / 60;
  const target = (x: number, y: number) => new Monster(MONSTERS.ghoul, { x, y });

  it('pierces: hits every enemy on its path exactly once and keeps flying', () => {
    const a = target(5.5, 1.5);
    const b = target(8.5, 1.5);
    const bolt = new Bolt<Monster>();
    bolt.launch(2, 1.5, 1, 0, 12, 2, 1);
    const hits: Monster[] = [];
    for (let i = 0; i < 60 && bolt.active; i++) bolt.update(DT, collision, [a, b], (t) => hits.push(t));
    expect(hits).toEqual([a, b]); // each once, in order, despite many frames of overlap
  });

  it('skips dead enemies', () => {
    const dead = target(5.5, 1.5);
    dead.takeDamage(9999);
    const bolt = new Bolt<Monster>();
    bolt.launch(2, 1.5, 1, 0, 12, 2, 1);
    const hits: Monster[] = [];
    for (let i = 0; i < 60 && bolt.active; i++) bolt.update(DT, collision, [dead], (t) => hits.push(t));
    expect(hits).toEqual([]);
  });

  it('stops at walls (even a fast bolt cannot tunnel through the pillar)', () => {
    const bolt = new Bolt<Monster>();
    bolt.launch(2.5, 4.5, 1, 0, 150, 5, 1);
    const behind = target(12.5, 4.5);
    const hits: Monster[] = [];
    for (let i = 0; i < 30 && bolt.active; i++) bolt.update(DT, collision, [behind], (t) => hits.push(t));
    expect(bolt.active).toBe(false);
    expect(hits).toEqual([]);
    expect(bolt.pos.x).toBeLessThan(9);
  });

  it('expires after its range', () => {
    const bolt = new Bolt<Monster>();
    bolt.launch(2, 1.5, 1, 0, 10, 0.3, 1); // 3 world units of range
    for (let i = 0; i < 60 && bolt.active; i++) bolt.update(DT, collision, [], () => {});
    expect(bolt.active).toBe(false);
    expect(bolt.pos.x).toBeLessThan(5.5);
  });
});

function setup(rngValue = 0.99) {
  const stats = { ...computeStats(emptyEquipment()), damage: 10 };
  const player = {
    pos: { x: 5.5, y: 2.5 },
    radius: PLAYER_CONFIG.radius,
    stats,
    hp: 100,
    isDead: false,
    buffs: new Buffs(),
    hasEffect: () => false,
    heal: () => 0,
    takeDamage: () => ({ amount: 0, died: false }),
  };
  const monsters: Monster[] = [];
  const dealt: { amount: number; crit: boolean }[] = [];
  const fx: { kind: string; x: number; y: number; radius: number }[] = [];
  const kills: Monster[] = [];
  const fired: { dx: number; dy: number; speed: number; range: number; mult: number }[] = [];
  const events: CombatEvents = {
    damageDealt: (_x, _y, amount, crit) => dealt.push({ amount, crit }),
    damageTaken: () => {},
    monsterKilled: (m) => kills.push(m),
    playerDied: () => {},
    healed: () => {},
    lightningArc: () => {},
    skillFx: (kind, x, y, radius) => fx.push({ kind, x, y, radius }),
    telegraph: () => {},
    novaFlash: () => {},
    phaseChanged: () => {},
  };
  const bolts = {
    fire: (_x: number, _y: number, dx: number, dy: number, speed: number, range: number, mult: number) => {
      fired.push({ dx, dy, speed, range, mult });
      return true;
    },
    update: () => {},
  } as unknown as SkillProjectileSystem;
  const combat = new CombatSystem(
    player as unknown as Player,
    () => monsters,
    { update: () => {}, fire: () => true } as unknown as ProjectileSystem,
    bolts,
    new CollisionSystem(ROOM),
    () => rngValue,
    events,
  );
  return { player, monsters, combat, dealt, fx, kills, fired };
}

describe('CombatSystem.castSkill', () => {
  it('spin hits every enemy within the radius (all around) and nobody outside it', () => {
    const { monsters, combat, dealt, fx } = setup();
    const spin = getSkill('spin');
    const near = new Monster(MONSTERS.ghoul, { x: 5.5 + 1.5, y: 2.5 });
    const behind = new Monster(MONSTERS.ghoul, { x: 5.5 - 1.5, y: 2.5 });
    const far = new Monster(MONSTERS.ghoul, { x: 5.5 + 5, y: 2.5 });
    monsters.push(near, behind, far);
    combat.castSkill(spin, getSkillStats(spin), 1, 0, 0, 0);
    expect(near.hp).toBeLessThan(near.def.maxHp);
    expect(behind.hp).toBeLessThan(behind.def.maxHp);
    expect(far.hp).toBe(far.def.maxHp);
    expect(dealt).toHaveLength(2);
    expect(dealt[0]!.amount).toBe(Math.round(10 * spin.damageMult));
    expect(fx).toEqual([{ kind: 'spin', x: 5.5, y: 2.5, radius: spin.radius }]);
  });

  it('skill damage scales with the multiplier, upgrades and crits', () => {
    const spin = getSkill('spin');
    const base = setup(0.99);
    base.monsters.push(new Monster(MONSTERS.ghoul, { x: 6.5, y: 2.5 }));
    base.combat.castSkill(spin, getSkillStats(spin), 1, 0, 0, 0);
    const upgraded = setup(0.99);
    upgraded.monsters.push(new Monster(MONSTERS.ghoul, { x: 6.5, y: 2.5 }));
    upgraded.combat.castSkill(spin, getSkillStats(spin, { ...NO_UPGRADE, damagePct: 100 }), 1, 0, 0, 0);
    expect(upgraded.dealt[0]!.amount).toBe(base.dealt[0]!.amount * 2);
    const crit = setup(0); // rng 0 always crits
    crit.monsters.push(new Monster(MONSTERS.ghoul, { x: 6.5, y: 2.5 }));
    crit.combat.castSkill(spin, getSkillStats(spin), 1, 0, 0, 0);
    expect(crit.dealt[0]!.crit).toBe(true);
    expect(crit.dealt[0]!.amount).toBeGreaterThan(base.dealt[0]!.amount);
  });

  it('skills can kill, and report the kill once', () => {
    const { monsters, combat, kills } = setup();
    const weak = new Monster(MONSTERS.hound, { x: 6.5, y: 2.5 });
    weak.hp = 1;
    monsters.push(weak);
    const spin = getSkill('spin');
    combat.castSkill(spin, getSkillStats(spin), 1, 0, 0, 0);
    combat.castSkill(spin, getSkillStats(spin), 1, 0, 0, 0);
    expect(kills).toEqual([weak]);
  });

  it('slam hits around the target point, stuns survivors, and clamps the target to its range', () => {
    const { monsters, combat, fx } = setup();
    const slam = getSkill('slam');
    const atTarget = new Monster(MONSTERS.ghoul, { x: 5.5 + 5, y: 2.5 });
    const nearPlayer = new Monster(MONSTERS.ghoul, { x: 5.5 + 1, y: 2.5 });
    monsters.push(atTarget, nearPlayer);
    combat.castSkill(slam, getSkillStats(slam), 1, 0, 5.5 + 5, 2.5); // cursor 5 away: within range 7
    expect(atTarget.hp).toBeLessThan(atTarget.def.maxHp);
    expect(atTarget.state).toBe('hurt'); // stunned
    expect(nearPlayer.hp).toBe(nearPlayer.def.maxHp); // outside the 2.2 radius around the target
    expect(fx.at(-1)).toEqual({ kind: 'slam', x: 10.5, y: 2.5, radius: slam.radius });

    combat.castSkill(slam, getSkillStats(slam), 1, 0, 5.5 + 50, 2.5); // cursor far away: clamped to 7
    expect(fx.at(-1)!.x).toBeCloseTo(5.5 + 7, 9);
  });

  it('a stunned enemy stays staggered for the stun duration, then resumes', () => {
    const { monsters, combat } = setup();
    const slam = getSkill('slam');
    const m = new Monster(MONSTERS.ghoul, { x: 8.5, y: 2.5 });
    monsters.push(m);
    combat.castSkill(slam, getSkillStats(slam), 1, 0, 8.5, 2.5);
    expect(m.state).toBe('hurt');
    const rig = { pos: { x: 5.5, y: 2.5 }, radius: 0.28, isDead: false };
    const hooks = { meleeStrike() {}, fireProjectile() {}, novaStrike() {}, telegraph() {}, phaseChanged() {} };
    const collision = new CollisionSystem(ROOM);
    for (let t = 0; t < slam.stunSeconds! - 0.1; t += 1 / 60) m.update(1 / 60, rig, collision, hooks as never);
    expect(m.state).toBe('hurt');
    for (let t = 0; t < 0.3; t += 1 / 60) m.update(1 / 60, rig, collision, hooks as never);
    expect(m.state).not.toBe('hurt');
  });

  it('bolt fires `count` bolts fanned symmetrically around the aim direction', () => {
    const { combat, fired } = setup();
    const bolt = getSkill('bolt');
    combat.castSkill(bolt, getSkillStats(bolt, { ...NO_UPGRADE, extraProjectiles: 2 }), 1, 0, 0, 0);
    expect(fired).toHaveLength(3);
    const angles = fired.map((f) => Math.atan2(f.dy, f.dx));
    expect(angles[1]).toBeCloseTo(0, 9);
    expect(angles[0]).toBeCloseTo(-angles[2]!, 9);
    expect(Math.abs(angles[2]! - angles[1]!)).toBeCloseTo(bolt.spread!, 9);
    for (const f of fired) {
      expect(Math.hypot(f.dx, f.dy)).toBeCloseTo(1, 9);
      expect(f.speed).toBe(bolt.speed);
      expect(f.range).toBe(bolt.range);
    }
  });

  it('boltHit damages the monster that was hit and ignores dead ones', () => {
    const { monsters, combat, dealt } = setup();
    const m = new Monster(MONSTERS.ghoul, { x: 8.5, y: 2.5 });
    monsters.push(m);
    combat.boltHit(m, 1.3);
    expect(dealt).toHaveLength(1);
    m.takeDamage(9999);
    combat.boltHit(m, 1.3);
    expect(dealt).toHaveLength(1);
  });
});
