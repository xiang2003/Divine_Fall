import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { MONSTERS, monsterForSpawnIndex } from '../src/data/monsters';
import {
  CORPSE_LIFETIME,
  HURT_POISE_INTERVAL,
  Monster,
  MONSTER_HIT_FRACTION,
  type MonsterHooks,
  type MonsterTarget,
} from '../src/entities/Monster';
import { CollisionSystem } from '../src/systems/CollisionSystem';

// 20x5 hall with a full-height wall at x = 10 (tile column), a gap-free divider for line-of-sight tests.
const OPEN = parseMap({
  id: 'open',
  name: 'open',
  layout: [
    '##############################',
    '#P...........................#',
    '#............................#',
    '#............................#',
    '##############################',
  ],
});
const DIVIDED = parseMap({
  id: 'divided',
  name: 'divided',
  layout: [
    '##############################',
    '#P........#..................#',
    '#.........#..................#',
    '#.........#..................#',
    '##############################',
  ],
});

const DT = 1 / 60;

class Rig {
  strikes = 0;
  projectiles: { dirX: number; dirY: number }[] = [];
  readonly hooks: MonsterHooks = {
    meleeStrike: () => {
      this.strikes++;
    },
    fireProjectile: (_m, dirX, dirY) => {
      this.projectiles.push({ dirX, dirY });
    },
    novaStrike: () => {},
    telegraph: () => {},
    phaseChanged: () => {},
  };
  target: { pos: { x: number; y: number }; radius: number; isDead: boolean };
  constructor(
    readonly collision: CollisionSystem,
    targetX: number,
    targetY: number,
  ) {
    this.target = { pos: { x: targetX, y: targetY }, radius: 0.28, isDead: false };
  }
  run(m: Monster, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / DT); i++) m.update(DT, this.target as MonsterTarget, this.collision, this.hooks);
  }
}

const ghoulAt = (x: number, y: number) => new Monster(MONSTERS.ghoul, { x, y });

describe('monster spawning', () => {
  it('assigns monster types deterministically by spawn index', () => {
    expect(monsterForSpawnIndex(0).id).toBe('ghoul');
    expect(monsterForSpawnIndex(1).id).toBe('shade');
    expect(monsterForSpawnIndex(2).id).toBe('hound');
    expect(monsterForSpawnIndex(3).id).toBe('ghoul');
  });

  it('every attack lasts at least as long as its animation hit point needs and fits in its cooldown', () => {
    for (const def of Object.values(MONSTERS)) {
      expect(def.attackCooldown).toBeGreaterThanOrEqual(def.attackDuration);
      expect(def.maxHp).toBeGreaterThan(0);
    }
  });
});

describe('Monster state machine', () => {
  it('stays idle when the player is out of detection range', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 25, 2);
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 1);
    expect(m.state).toBe('idle');
  });

  it('notices a player in range with line of sight and chases', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 9.5, 2.5);
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 0.1);
    expect(m.state).toBe('chase');
    const before = m.pos.x;
    rig.run(m, 0.5);
    expect(m.pos.x).toBeGreaterThan(before);
  });

  it('does not notice a player behind a wall', () => {
    const rig = new Rig(new CollisionSystem(DIVIDED), 13.5, 2.5);
    const m = ghoulAt(8.5, 2.5);
    rig.run(m, 1);
    expect(m.state).toBe('idle');
  });

  it('closes in, attacks, and lands exactly one strike per attack at the strike moment', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 7.5, 2.5);
    const m = ghoulAt(5.5, 2.5);
    // walk until it begins attacking
    let guard = 0;
    while (m.state !== 'attack' && guard++ < 600) rig.run(m, DT);
    expect(m.state).toBe('attack');
    expect(rig.strikes).toBe(0); // windup: nothing has landed yet
    const strikeTime = MONSTERS.ghoul.attackDuration * MONSTER_HIT_FRACTION;
    rig.run(m, strikeTime - 0.03);
    expect(rig.strikes).toBe(0);
    rig.run(m, 0.06);
    expect(rig.strikes).toBe(1);
    rig.run(m, MONSTERS.ghoul.attackDuration); // finish the attack
    expect(rig.strikes).toBe(1);
  });

  it('respects the attack cooldown between attacks', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 6.4, 2.5);
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 10);
    // 10s of continuous contact at 1.2s cooldown: at most ceil(10 / 1.2) = 9 strikes, and several.
    expect(rig.strikes).toBeGreaterThanOrEqual(6);
    expect(rig.strikes).toBeLessThanOrEqual(Math.ceil(10 / MONSTERS.ghoul.attackCooldown));
  });

  it('a dead monster never moves or attacks again', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 6.2, 2.5);
    const m = ghoulAt(5.5, 2.5);
    let guard = 0;
    while (m.state !== 'attack' && guard++ < 300) rig.run(m, DT);
    expect(m.state).toBe('attack');
    expect(m.takeDamage(9999)).toBe(true); // killed mid-windup
    const pos = { ...m.pos };
    rig.run(m, 5);
    expect(rig.strikes).toBe(0);
    expect(m.state).toBe('dead');
    expect(m.pos).toEqual(pos);
  });

  it('reports a kill only once and ignores further damage', () => {
    const m = ghoulAt(5.5, 2.5);
    expect(m.takeDamage(MONSTERS.ghoul.maxHp)).toBe(true);
    expect(m.takeDamage(10)).toBe(false);
    expect(m.hp).toBe(0);
  });

  it('being hit interrupts a windup so the strike never lands', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 6.2, 2.5);
    const m = ghoulAt(5.5, 2.5);
    let guard = 0;
    while (m.state !== 'attack' && guard++ < 300) rig.run(m, DT);
    rig.run(m, 0.1); // partway through the windup
    expect(m.takeDamage(1)).toBe(false);
    expect(m.state).toBe('hurt');
    rig.run(m, 0.2);
    expect(rig.strikes).toBe(0);
  });

  it('cannot be stun-locked: a second hit inside the poise window does not re-stagger', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 6.2, 2.5);
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 0.1);
    m.takeDamage(1);
    expect(m.state).toBe('hurt');
    rig.run(m, 0.3); // stagger over, back to chasing / attacking
    expect(m.state).not.toBe('hurt');
    m.takeDamage(1);
    expect(m.state).not.toBe('hurt'); // within HURT_POISE_INTERVAL of the first stagger
    rig.run(m, HURT_POISE_INTERVAL);
    m.takeDamage(1);
    expect(m.state).toBe('hurt');
  });

  it('being hit while idle draws aggro even outside detection range (but inside the leash)', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 15.5, 2.5); // 10 away: beyond detectRange 7, within leash 14
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 0.2);
    expect(m.state).toBe('idle');
    m.takeDamage(1);
    rig.run(m, 0.5);
    expect(m.state).toBe('chase');
  });

  it('stops attacking and goes idle when the player dies', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 6.2, 2.5);
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 3);
    const strikesBefore = rig.strikes;
    expect(strikesBefore).toBeGreaterThan(0);
    rig.target.isDead = true;
    rig.run(m, 5);
    expect(rig.strikes).toBe(strikesBefore);
    expect(m.state).toBe('idle');
  });

  it('gives up the chase when the player gets far away, and walks home', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 9.5, 2.5);
    const m = ghoulAt(5.5, 2.5);
    rig.run(m, 0.5);
    expect(m.state).toBe('chase');
    rig.target.pos.x = 27.5; // far beyond detectRange * LEASH_FACTOR
    rig.run(m, 0.1);
    expect(m.state).toBe('idle');
    rig.run(m, 6);
    expect(Math.hypot(m.pos.x - m.home.x, m.pos.y - m.home.y)).toBeLessThan(0.4);
  });

  it('becomes removable only after its corpse has lain for the full lifetime', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 25, 2.5);
    const m = ghoulAt(5.5, 2.5);
    m.takeDamage(9999);
    expect(m.removable).toBe(false);
    rig.run(m, CORPSE_LIFETIME + 0.1);
    expect(m.removable).toBe(true);
  });

  it('never walks through walls while chasing', () => {
    const rig = new Rig(new CollisionSystem(DIVIDED), 13.5, 2.5);
    const m = ghoulAt(8.5, 2.5);
    m.takeDamage(1); // provoke it so it chases despite no line of sight
    rig.run(m, 6);
    expect(m.pos.x).toBeLessThanOrEqual(10 - MONSTERS.ghoul.radius + 1e-6);
  });
});

describe('ranged monster', () => {
  const shadeAt = (x: number, y: number) => new Monster(MONSTERS.shade, { x, y });

  it('shoots a projectile at range instead of meleeing, aimed at the player', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 10.5, 2.5);
    const m = shadeAt(5.5, 2.5);
    rig.run(m, 3);
    expect(rig.projectiles.length).toBeGreaterThan(0);
    expect(rig.strikes).toBe(0);
    const p = rig.projectiles[0]!;
    expect(p.dirX).toBeCloseTo(1, 1);
    expect(Math.hypot(p.dirX, p.dirY)).toBeCloseTo(1, 5);
  });

  it('backs away when the player gets too close', () => {
    const rig = new Rig(new CollisionSystem(OPEN), 7.0, 2.5);
    const m = shadeAt(6.2, 2.5); // edge gap far smaller than keepDistance
    rig.run(m, 0.1);
    const x0 = m.pos.x;
    rig.run(m, 0.5);
    expect(m.pos.x).toBeLessThan(x0);
  });

  it('does not fire when it cannot see the player', () => {
    const rig = new Rig(new CollisionSystem(DIVIDED), 13.5, 2.5);
    const m = shadeAt(8.5, 2.5);
    m.takeDamage(1);
    rig.run(m, 3);
    expect(rig.projectiles.length).toBe(0);
  });
});
