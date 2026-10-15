import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import {
  MELEE_STRIKE_SLACK,
  Monster,
  POUNCE_HIT_FRACTION,
  POUNCE_LEAP_START,
  type MonsterHooks,
  type MonsterTarget,
} from '../src/entities/Monster';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { StatusSet } from '../src/systems/status';

const HALL = parseMap({
  id: 'hall',
  name: 'hall',
  layout: [
    '##############################',
    '#P...........................#',
    '#............................#',
    '#............................#',
    '##############################',
  ],
});
const DT = 1 / 60;

class Rig {
  strikes = 0;
  strikeAt: number[] = [];
  projectiles = 0;
  time = 0;
  readonly target: MonsterTarget & { pos: { x: number; y: number }; isDead: boolean };
  readonly hooks: MonsterHooks = {
    meleeStrike: () => {
      this.strikes++;
      this.strikeAt.push(this.time);
    },
    fireProjectile: () => {
      this.projectiles++;
    },
    novaStrike: () => {},
    telegraph: () => {},
    phaseChanged: () => {},
    split: () => {},
    summonPillars: () => {},
  };
  constructor(
    readonly collision: CollisionSystem,
    x: number,
    y: number,
  ) {
    this.target = { pos: { x, y }, radius: 0.28, isDead: false };
  }
  run(m: Monster, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      this.time += DT;
      m.update(DT, this.target, this.collision, this.hooks);
    }
  }
  /** Runs until the monster starts an attack (or gives up after `max` seconds). */
  untilAttack(m: Monster, max = 5): void {
    for (let t = 0; t < max && m.state !== 'attack'; t += DT) this.run(m, DT);
  }
}

const wolfAt = (x: number, y: number) => new Monster(MONSTERS.forest_wolf, { x, y });
const viperAt = (x: number, y: number) => new Monster(MONSTERS.forest_viper, { x, y });
const distance = (m: Monster, t: MonsterTarget) => Math.hypot(m.pos.x - t.pos.x, m.pos.y - t.pos.y);

describe('wolf: pounce', () => {
  const pounce = MONSTERS.forest_wolf.pounce!;

  it('is defined as an ordinary forest animal with a leap', () => {
    expect(MONSTERS.forest_wolf.directional).toBe(true);
    expect(MONSTERS.forest_wolf.behavior).toBe('melee');
    expect(pounce.range).toBeGreaterThan(MONSTERS.forest_wolf.attackRange);
    expect(pounce.duration).toBeGreaterThanOrEqual(0.5);
  });

  it('runs at the player while far away, without attacking yet', () => {
    const rig = new Rig(new CollisionSystem(HALL), 14.5, 2.5);
    const m = wolfAt(6.5, 2.5); // 8 away: inside detect range, far outside pounce range
    rig.run(m, 0.5);
    expect(m.state).toBe('chase');
    expect(rig.strikes).toBe(0);
    expect(m.pos.x).toBeGreaterThan(6.5);
  });

  it('springs from a few steps away: crouches first, then covers the gap, and bites when it lands', () => {
    const rig = new Rig(new CollisionSystem(HALL), 9.0, 2.5);
    const m = wolfAt(6.5, 2.5); // edge to edge about 1.9: pounce range
    rig.untilAttack(m);
    expect(m.state).toBe('attack');
    const startX = m.pos.x;
    const t0 = rig.time;
    // crouching: it has not moved yet
    rig.run(m, pounce.duration * POUNCE_LEAP_START * 0.8);
    expect(m.pos.x).toBeCloseTo(startX, 2);
    // the bite lands once, at the end of the leap
    rig.run(m, pounce.duration * (POUNCE_HIT_FRACTION - POUNCE_LEAP_START * 0.8) - 0.05);
    expect(rig.strikes).toBe(0);
    rig.run(m, 0.1);
    expect(rig.strikes).toBe(1);
    expect(rig.strikeAt[0]! - t0).toBeCloseTo(pounce.duration * POUNCE_HIT_FRACTION, 1);
    // and it crossed most of the gap while leaping
    expect(distance(m, rig.target)).toBeLessThan(distance({ pos: { x: startX, y: 2.5 } } as Monster, rig.target) - 1);
    rig.run(m, pounce.duration);
    expect(rig.strikes).toBe(1); // one bite per pounce
  });

  it('commits to the leap: if the player steps away as it springs, it lands short and the bite cannot reach', () => {
    const rig = new Rig(new CollisionSystem(HALL), 9.0, 2.5);
    const m = wolfAt(6.5, 2.5);
    rig.untilAttack(m);
    rig.run(m, pounce.duration * (POUNCE_LEAP_START + 0.1));
    rig.target.pos.x = 20; // the player is gone
    rig.run(m, pounce.duration);
    expect(m.pos.x).toBeLessThan(11); // it did not chase the new position through the air
    expect(m.reachTo(rig.target)).toBeGreaterThan(MONSTERS.forest_wolf.attackRange + MELEE_STRIKE_SLACK);
  });

  it('a leap stops at a wall', () => {
    const rig = new Rig(new CollisionSystem(HALL), 1.5, 2.5);
    const m = wolfAt(3.6, 2.5);
    rig.run(m, 3);
    expect(m.pos.x).toBeGreaterThan(1);
  });

  it('bites without leaping when the player is already in reach', () => {
    const rig = new Rig(new CollisionSystem(HALL), 7.0, 2.5);
    const m = wolfAt(6.5, 2.5); // overlapping reach
    rig.untilAttack(m);
    const x = m.pos.x;
    rig.run(m, MONSTERS.forest_wolf.attackDuration * 0.4);
    expect(m.pos.x).toBeCloseTo(x, 1);
    rig.run(m, MONSTERS.forest_wolf.attackDuration);
    expect(rig.strikes).toBe(1);
  });
});

describe('viper: spits venom', () => {
  it('is a slow ranged animal whose hits poison', () => {
    const v = MONSTERS.forest_viper;
    expect(v.behavior).toBe('ranged');
    expect(v.poison?.dps).toBeGreaterThan(0);
    expect(v.poison?.duration).toBeGreaterThan(0);
    expect(v.moveSpeed).toBeLessThan(MONSTERS.forest_wolf.moveSpeed);
    expect(v.attackStyle).toBe('spit');
  });

  it('spits from a distance instead of biting, and backs off when the player comes close', () => {
    const rig = new Rig(new CollisionSystem(HALL), 11.0, 2.5);
    const m = viperAt(6.5, 2.5);
    rig.run(m, 3);
    expect(rig.projectiles).toBeGreaterThan(0);
    expect(rig.strikes).toBe(0);
    rig.target.pos.x = m.pos.x + 0.9;
    const x0 = m.pos.x;
    rig.run(m, 0.6);
    expect(m.pos.x).toBeLessThan(x0);
  });
});

describe('poison', () => {
  it('ticks on a fixed beat and runs out', () => {
    const p = new StatusSet();
    p.apply({ id: 'poison', dps: 4, duration: 2 });
    let total = 0;
    let ticks = 0;
    for (let i = 0; i < 60 * 3; i++) {
      const d = p.tick(DT)?.amount ?? 0;
      if (d > 0) {
        ticks++;
        total += d;
      }
    }
    expect(ticks).toBe(Math.floor(2 / 0.5));
    expect(total).toBe(4 * 2);
    expect(p.has('poison')).toBe(false);
    expect(p.tick(DT)).toBeNull();
  });

  it('does not stack: a second dose keeps the stronger rate and the longer time', () => {
    const p = new StatusSet();
    p.apply({ id: 'poison', dps: 2, duration: 4 });
    p.apply({ id: 'poison', dps: 6, duration: 1 });
    expect(p.remaining('poison')).toBeCloseTo(4, 9);
    let first = 0;
    for (let i = 0; first === 0 && i < 600; i++) first = p.tick(DT)?.amount ?? 0;
    expect(first).toBe(6 * 0.5);
  });

  it('carries a fraction of a point to the next tick, so a weak poison still adds up and nothing is lost; clear() ends it', () => {
    const p = new StatusSet();
    p.apply({ id: 'poison', dps: 0.4, duration: 5 });
    let total = 0;
    for (let i = 0; i < 60 * 6; i++) total += p.tick(DT)?.amount ?? 0;
    expect(total).toBe(2); // 0.4 per second for 5 seconds
    p.apply({ id: 'poison', dps: 5, duration: 5 });
    p.clear();
    expect(p.has('poison')).toBe(false);
  });
});
