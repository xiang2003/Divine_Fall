import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import { CHARGE_END, CHARGE_START, Monster, type MonsterHooks, type MonsterTarget } from '../src/entities/Monster';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { SlowEffect } from '../src/systems/buffs';
import { PACK_RADIUS, planSpawns } from '../src/systems/spawnPlan';

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

/** Stands in for the combat system: counts what the monster asks for. */
class Rig {
  melee = 0;
  novas: { radius: number; mult: number }[] = [];
  telegraphs: number[] = [];
  projectiles = 0;
  readonly target: MonsterTarget & { pos: { x: number; y: number }; isDead: boolean };
  readonly hooks: MonsterHooks = {
    meleeStrike: () => {
      this.melee++;
    },
    fireProjectile: () => {
      this.projectiles++;
    },
    novaStrike: (_m, radius, mult) => {
      this.novas.push({ radius, mult });
    },
    telegraph: (_m, radius) => {
      this.telegraphs.push(radius);
    },
    phaseChanged: () => {},
  };
  constructor(readonly collision: CollisionSystem, x: number, y: number) {
    this.target = { pos: { x, y }, radius: 0.28, isDead: false };
  }
  run(m: Monster, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / DT); i++) m.update(DT, this.target, this.collision, this.hooks);
  }
  untilAttack(m: Monster, max = 6): void {
    for (let t = 0; t < max && m.state !== 'attack'; t += DT) this.run(m, DT);
  }
}
const rig = (x: number, y: number) => new Rig(new CollisionSystem(HALL), x, y);
const at = (id: keyof typeof MONSTERS, x: number, y: number, rng?: () => number) => new Monster(MONSTERS[id], { x, y }, rng ? { rng } : {});

describe('slow', () => {
  it('slows to a fraction for a while and then wears off', () => {
    const s = new SlowEffect();
    expect(s.multiplier).toBe(1);
    s.apply(0.5, 2);
    expect(s.active).toBe(true);
    expect(s.multiplier).toBe(0.5);
    s.update(1.9);
    expect(s.multiplier).toBe(0.5);
    s.update(0.2);
    expect(s.active).toBe(false);
    expect(s.multiplier).toBe(1);
  });

  it('does not stack: the stronger slow and the longer time win', () => {
    const s = new SlowEffect();
    s.apply(0.7, 1);
    s.apply(0.4, 3);
    s.apply(0.9, 0.5);
    expect(s.multiplier).toBe(0.4);
    s.update(2.9);
    expect(s.active).toBe(true);
    s.clear();
    expect(s.multiplier).toBe(1);
  });
});

describe('spring gel', () => {
  const def = MONSTERS.spring_gel;

  it('is a slow, hopping ranged monster whose gel slows', () => {
    expect(def.behavior).toBe('ranged');
    expect(def.hop).toBeDefined();
    expect(def.slow!.factor).toBeLessThan(1);
    expect(def.slow!.duration).toBeGreaterThan(0);
  });

  it('only travels while it is in the air of a hop, and covers about its speed on average', () => {
    const r = rig(20, 3);
    // a melee copy that can see the far end of the hall, so it keeps walking
    const m = new Monster({ ...def, behavior: 'melee', detectRange: 40, attackRange: 0.35 }, { x: 4, y: 3 });
    const hop = def.hop!;
    // the first part of every hop is spent crouching on the ground
    r.run(m, hop.period * (1 - hop.air) * 0.8);
    expect(m.pos.x).toBeCloseTo(4, 3);
    expect(m.state).toBe('chase');
    // over whole hops it makes headway at its speed
    const x0 = m.pos.x;
    const seconds = hop.period * 5;
    r.run(m, seconds);
    const speed = (m.pos.x - x0) / seconds;
    expect(speed).toBeGreaterThan(def.moveSpeed * 0.7);
    expect(speed).toBeLessThan(def.moveSpeed * 1.3);
  });

  it('keeps a hop phase between 0 and 1 for the animation', () => {
    const r = rig(20, 3);
    const m = at('spring_gel', 4, 3);
    for (let i = 0; i < 120; i++) {
      r.run(m, DT);
      expect(m.hopPhase).toBeGreaterThanOrEqual(0);
      expect(m.hopPhase).toBeLessThan(1);
    }
  });

  it('lobs gel from a distance', () => {
    const r = rig(9.5, 3);
    const m = at('spring_gel', 4, 3);
    r.run(m, 6);
    expect(r.projectiles).toBeGreaterThan(0);
  });
});

describe('crystal bat', () => {
  const def = MONSTERS.crystal_bat;

  it('is fast, flies and comes in a flock', () => {
    expect(def.flyer).toBe(true);
    expect(def.packSize).toBeGreaterThan(1);
    expect(def.moveSpeed).toBeGreaterThan(MONSTERS.forest_wolf.moveSpeed);
    expect(def.behavior).toBe('ranged');
  });

  it('a spawn point puts the whole flock in a ring around it', () => {
    const spawns = { player: { x: 1, y: 1 }, monsters: [{ x: 10, y: 10 }], elites: [], boss: null, exit: null };
    const plan = planSpawns(spawns, () => 0.5, { monsters: ['crystal_bat'], elites: [], boss: undefined as never });
    expect(plan).toHaveLength(def.packSize!);
    for (const e of plan) {
      expect(e.def.id).toBe('crystal_bat');
      expect(Math.hypot(e.pos.x - 10, e.pos.y - 10)).toBeCloseTo(PACK_RADIUS, 5);
    }
    const spots = new Set(plan.map((e) => `${e.pos.x.toFixed(2)},${e.pos.y.toFixed(2)}`));
    expect(spots.size).toBe(plan.length); // not stacked on one spot
  });

  it('circles sideways at a distance instead of closing in, and shoots', () => {
    const r = rig(10, 3);
    const m = at('crystal_bat', 5.5, 3); // inside its range
    const startDist = Math.hypot(r.target.pos.x - m.pos.x, r.target.pos.y - m.pos.y);
    r.run(m, 1);
    const moved = { x: m.pos.x - 5.5, y: m.pos.y - 3 };
    // the target is straight to the right, so circling means mostly moving up or down
    expect(Math.abs(moved.y)).toBeGreaterThan(Math.abs(moved.x));
    expect(Math.abs(moved.y)).toBeGreaterThan(1);
    expect(Math.hypot(r.target.pos.x - m.pos.x, r.target.pos.y - m.pos.y)).toBeGreaterThan(startDist * 0.6);
    r.run(m, 3);
    expect(r.projectiles).toBeGreaterThan(0);
  });
});

describe('corroded deer (boss)', () => {
  const def = MONSTERS.corroded_deer;
  const charge = def.bossAttacks.find((a) => a.kind === 'charge')!;

  it('is a boss that can charge, blast the ground around itself and gore', () => {
    expect(def.isBoss).toBe(true);
    const kinds = new Set(def.bossAttacks.map((a) => a.kind));
    expect(kinds).toEqual(new Set(['charge', 'nova', 'cleave']));
    const novas = def.bossAttacks.filter((a) => a.kind === 'nova');
    expect(Math.max(...novas.map((a) => a.radius!))).toBeGreaterThan(MONSTERS.archon.bossAttacks.find((a) => a.kind === 'nova')!.radius!);
  });

  it('charges from a few steps away: stands for the windup, runs along the line, hurts once on the way', () => {
    const r = rig(10, 3);
    const m = at('corroded_deer', 4, 3, () => 0); // only the charge fits at this distance
    r.untilAttack(m);
    expect(m.state).toBe('attack');
    const x0 = m.pos.x;
    r.run(m, charge.duration * CHARGE_START * 0.8);
    expect(m.pos.x).toBeCloseTo(x0, 2); // winding up
    expect(r.melee).toBe(0);
    r.run(m, charge.duration * (CHARGE_END - CHARGE_START * 0.8) + 0.05);
    expect(m.pos.x - x0).toBeGreaterThan(charge.rush! * 0.8);
    expect(r.melee).toBe(1); // it ran into the player once, and does not hit again before the charge is over
    r.run(m, charge.duration * (1 - CHARGE_END) - 0.1);
    expect(r.melee).toBe(1);
  });

  it('commits to the line: a player who has stepped aside is missed', () => {
    const r = rig(10, 3);
    const m = at('corroded_deer', 4, 3, () => 0);
    r.untilAttack(m);
    r.run(m, charge.duration * (CHARGE_START + 0.05)); // it has set off along the line
    r.target.pos.y = 5; // out of the lane
    r.run(m, charge.duration * (1 - CHARGE_START - 0.05) - 0.1); // to the end of the charge
    expect(r.melee).toBe(0);
    expect(m.pos.y).toBeCloseTo(3, 1); // it did not turn
  });

  it('stops at a wall', () => {
    const r = rig(2, 3);
    const m = at('corroded_deer', 8, 3, () => 0);
    r.untilAttack(m);
    r.target.pos.x = -50; // so far that the line runs into the wall
    r.run(m, charge.duration * 2);
    expect(m.pos.x).toBeGreaterThan(1);
  });
});

describe('rock golem: slam', () => {
  const def = MONSTERS.rock_golem;

  it('is slow and tough with an area attack around itself', () => {
    expect(def.slam!.radius).toBeGreaterThan(2);
    expect(def.moveSpeed).toBeLessThan(MONSTERS.forest_wolf.moveSpeed / 2);
    expect(def.maxHp).toBeGreaterThan(MONSTERS.echo_guard.maxHp);
  });

  it('winds up with a warning of the blast radius, then blasts around itself', () => {
    const r = rig(5.2, 3);
    const m = at('rock_golem', 4, 3);
    r.untilAttack(m);
    expect(m.state).toBe('attack');
    expect(r.telegraphs).toEqual([def.slam!.radius]);
    expect(r.novas).toHaveLength(0);
    r.run(m, def.slam!.duration * def.slam!.hitFraction + 0.1);
    expect(r.novas).toEqual([{ radius: def.slam!.radius, mult: def.slam!.damageMult }]);
    expect(r.melee).toBe(0); // no swing: the blast is the attack
  });

  it('walks toward the player slowly', () => {
    const r = rig(9, 3);
    const m = at('rock_golem', 4, 3);
    r.run(m, 1);
    expect(m.pos.x - 4).toBeGreaterThan(def.moveSpeed * 0.8);
    expect(m.pos.x - 4).toBeLessThan(def.moveSpeed * 1.2);
  });
});
