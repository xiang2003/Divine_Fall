import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import type { MonsterDef } from '../src/data/monsters';
import { MONSTERS } from '../src/data/monsters';
import { Monster, type MonsterHooks, type MonsterTarget } from '../src/entities/Monster';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { POOL_POISON_SECONDS, PoisonPool } from '../src/systems/PoolSystem';

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

class Rig {
  melee: number[] = [];
  pools: { x: number; y: number }[] = [];
  splits: { into: string; count: number }[] = [];
  pillars: { style?: string; count: number }[] = [];
  time = 0;
  readonly target: MonsterTarget & { pos: { x: number; y: number }; isDead: boolean };
  readonly hooks: MonsterHooks = {
    meleeStrike: () => {
      this.melee.push(this.time);
    },
    fireProjectile: () => {},
    novaStrike: () => {},
    telegraph: () => {},
    phaseChanged: () => {},
    split: (_m, into, count) => {
      this.splits.push({ into, count });
    },
    summonPillars: (_m, count, _r, _d, _mult, style) => {
      this.pillars.push({ count, style });
    },
    dropPool: (_m, x, y) => {
      this.pools.push({ x, y });
    },
  };
  constructor(readonly collision: CollisionSystem, x: number, y: number) {
    this.target = { pos: { x, y }, radius: 0.28, isDead: false };
  }
  run(m: Monster, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      this.time += DT;
      m.update(DT, this.target, this.collision, this.hooks);
    }
  }
  untilAttack(m: Monster, max = 6): void {
    for (let t = 0; t < max && m.state !== 'attack'; t += DT) this.run(m, DT);
  }
}
const rig = (x: number, y: number) => new Rig(new CollisionSystem(HALL), x, y);
const make = (def: MonsterDef, x = 4, y = 3, options = {}) => new Monster(def, { x, y }, options);

describe('combos', () => {
  const def = { ...MONSTERS.exiled_swordsman, pounce: undefined };

  it('deal their extra blows one gap apart after the first, and no more than the combo holds', () => {
    const r = rig(4.9, 3);
    const m = make(def);
    r.untilAttack(m);
    const t0 = r.time;
    r.run(m, def.attackDuration);
    expect(r.melee).toHaveLength(def.combo!.hits);
    const gaps = r.melee.slice(1).map((t, i) => t - r.melee[i]!);
    for (const g of gaps) expect(g).toBeCloseTo(def.combo!.gap, 1);
    expect(r.melee[0]! - t0).toBeGreaterThan(0.2); // the first blow lands after the windup
  });

  it('stop when the target dies in the middle of them', () => {
    const r = rig(4.9, 3);
    const m = make(def);
    r.untilAttack(m);
    r.run(m, def.attackDuration * 0.55 + 0.05);
    const dealt = r.melee.length;
    r.target.isDead = true;
    r.run(m, def.attackDuration);
    expect(r.melee).toHaveLength(dealt);
  });

  it('a mountain blade wolf pounces and then claws on landing', () => {
    const wolf = MONSTERS.mountain_blade_wolf;
    expect(wolf.pounce).toBeDefined();
    expect(wolf.combo!.hits).toBeGreaterThanOrEqual(3);
    const r = rig(8, 3);
    const m = make(wolf, 4, 3);
    r.untilAttack(m);
    r.run(m, wolf.pounce!.duration + 0.1);
    expect(r.melee.length).toBeGreaterThanOrEqual(wolf.combo!.hits - 1);
  });
});

describe('berserk', () => {
  const def = MONSTERS.fallen_cultivator;
  const b = def.berserk!;

  it('is calm at first, and moves, attacks and hits harder once badly hurt', () => {
    const m = make(def);
    expect(m.berserk).toBe(false);
    const speed = m.moveSpeed;
    const cooldown = m.attackCooldown;
    const damage = m.damage;
    m.takeDamage(Math.ceil(m.maxHp * (1 - b.hpFraction)) + 1);
    expect(m.berserk).toBe(true);
    expect(m.moveSpeed).toBeCloseTo(speed * b.speedMult);
    expect(m.attackCooldown).toBeCloseTo(cooldown * b.cooldownMult);
    expect(m.damage).toBeCloseTo(damage * b.damageMult);
  });

  it('a dead monster is not berserk', () => {
    const m = make(def);
    m.takeDamage(m.maxHp);
    expect(m.berserk).toBe(false);
  });
});

describe('calling for help', () => {
  const def = MONSTERS.green_fang_wolf;

  it('a wolf calls its pack the first time it is badly hurt, and only then', () => {
    expect(def.split!.into).not.toBe(def.id); // the called ones are a separate, plain kind
    const r = rig(15, 3);
    const m = make(def);
    m.takeDamage(Math.floor(m.maxHp * 0.3));
    r.run(m, 0.1);
    expect(r.splits).toEqual([]);
    m.takeDamage(Math.ceil(m.maxHp * 0.45));
    r.run(m, 0.1);
    expect(r.splits).toEqual([{ into: def.split!.into, count: def.split!.count }]);
    m.takeDamage(1);
    r.run(m, 0.5);
    expect(r.splits).toHaveLength(1);
  });

  it('a monster that was called in never calls for help itself', () => {
    const helper = MONSTERS[def.split!.into as keyof typeof MONSTERS] as MonsterDef;
    expect(helper).toBeDefined();
    expect(helper.phantom).toBeUndefined(); // real reinforcements: they count and give experience
    const r = rig(15, 3);
    const m = make(MONSTERS.green_fang_wolf, 4, 3, { summoned: true });
    m.takeDamage(m.maxHp - 1);
    r.run(m, 0.2);
    expect(r.splits).toEqual([]);
  });
});

describe('poison cloud', () => {
  const stand = (x: number, y: number) => ({ pos: { x, y }, radius: 0.28, isDead: false });

  it('shows a warning first, then poisons whoever is inside while it lingers, then goes', () => {
    const pool = new PoisonPool({ x: 5, y: 5 }, 1.6, 0.8, 5, 3);
    const t = stand(5.5, 5);
    let touches = 0;
    for (let s = 0; s < 0.75; s += DT) touches += pool.update(DT, t) ? 1 : 0;
    expect(pool.phase).toBe('warning');
    expect(touches).toBe(0); // the warning does not hurt
    for (let s = 0; s < 1; s += DT) touches += pool.update(DT, t) ? 1 : 0;
    expect(pool.phase).toBe('active');
    expect(touches).toBeGreaterThan(30); // every tick while inside
    t.pos.x = 9; // walks out
    expect(pool.update(DT, t)).toBe(false);
    for (let s = 0; s < 6; s += DT) pool.update(DT, t);
    expect(pool.phase).toBe('gone');
  });

  it('the poison it gives is short, so leaving the cloud ends it soon', () => {
    expect(POOL_POISON_SECONDS).toBeLessThanOrEqual(2);
  });

  it('a rot flower lobs the cloud onto where the player stands', () => {
    const flower = MONSTERS.rot_flower;
    expect(flower.pool).toBeDefined();
    const r = rig(12, 4);
    const m = make(flower, 6, 3);
    r.run(m, 4);
    expect(r.pools.length).toBeGreaterThan(0);
    expect(r.pools[0]).toEqual({ x: 12, y: 4 });
  });
});

describe('boss ground strikes', () => {
  it('the old wood warden calls root spikes, the colossus calls stone', () => {
    const warden = MONSTERS.old_wood_warden.bossAttacks.filter((a) => a.kind === 'pillars');
    expect(warden.length).toBeGreaterThan(0);
    expect(warden.every((a) => a.strike === 'root')).toBe(true);
    const colossus = MONSTERS.broken_sword_colossus.bossAttacks;
    expect(colossus.some((a) => a.kind === 'nova' && (a.radius ?? 0) >= 5)).toBe(true); // the heavy slam
    const slam = colossus.find((a) => a.id === 'heavy_slam')!;
    expect(slam.duration).toBeGreaterThanOrEqual(2); // a long, readable windup
  });

  it('a boss passes the kind of strike along when it starts the move', () => {
    const r = rig(11, 3);
    const m = make(MONSTERS.old_wood_warden, 5, 3, { rng: () => 0.99 });
    m.takeDamage(Math.ceil(m.maxHp * 0.4));
    r.untilAttack(m);
    expect(r.pillars.some((p) => p.style === 'root')).toBe(true);
  });
});
