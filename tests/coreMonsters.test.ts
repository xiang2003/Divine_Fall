import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TileType, parseMap, tileAt } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import { Monster, type MonsterHooks, type MonsterTarget } from '../src/entities/Monster';
import { Projectile } from '../src/entities/Projectile';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { PILLAR_RISE, PILLAR_SINK, PILLAR_STAND, Pillar } from '../src/systems/PillarSystem';

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
  melee = 0;
  projectiles = 0;
  splits: { into: string; count: number }[] = [];
  pillars: { count: number; radius: number; delay: number; mult: number }[] = [];
  readonly target: MonsterTarget & { pos: { x: number; y: number }; isDead: boolean };
  readonly hooks: MonsterHooks = {
    meleeStrike: () => {
      this.melee++;
    },
    fireProjectile: () => {
      this.projectiles++;
    },
    novaStrike: () => {},
    telegraph: () => {},
    phaseChanged: () => {},
    split: (_m, into, count) => {
      this.splits.push({ into, count });
    },
    summonPillars: (_m, count, radius, delay, mult) => {
      this.pillars.push({ count, radius, delay, mult });
    },
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

describe('homing shots', () => {
  const fly = (homing: number | undefined) => {
    const collision = new CollisionSystem(HALL);
    const target = { pos: { x: 20, y: 1.6 }, radius: 0.28, isDead: false };
    const p = new Projectile();
    // fired along +x from (4, 3.5): a straight shot passes the target by two tiles
    p.launch(4, 3.5, 1, 0, 4.2, 5, 4, null, homing ? { homing } : null);
    let outcome: string | null = null;
    for (let t = 0; t < 4 && !outcome; t += DT) outcome = p.update(DT, collision, target);
    return outcome;
  };

  it('a plain shot flies straight and misses', () => {
    expect(fly(undefined)).not.toBe('hit');
  });

  it('a homing shot bends toward the target and hits it', () => {
    expect(fly(1.7)).toBe('hit');
  });

  it('turns no faster than its turn rate', () => {
    const collision = new CollisionSystem(HALL);
    const p = new Projectile();
    p.launch(5, 3, 1, 0, 4, 5, 4, null, { homing: 1 });
    p.update(0.5, collision, { pos: { x: 5, y: 5 }, radius: 0.28, isDead: false }); // the target is straight to the side (90 degrees)
    expect(Math.atan2(p.dirY, p.dirX)).toBeCloseTo(0.5, 5); // it only managed 1 rad/s * 0.5 s
  });
});

describe('stone attendant', () => {
  const def = MONSTERS.stone_attendant;

  it('is slow, tough, shatters, and punches once with a long windup', () => {
    expect(def.shatters).toBe(true);
    expect(def.moveSpeed).toBeLessThan(MONSTERS.forest_wolf.moveSpeed / 2);
    const r = rig(5.6, 3);
    const m = new Monster(def, { x: 4.5, y: 3 }); // already in reach
    r.untilAttack(m);
    r.run(m, def.attackDuration * 0.4);
    expect(r.melee).toBe(0); // still winding up
    r.run(m, def.attackDuration * 0.3);
    expect(r.melee).toBe(1);
  });
});

describe('mask spirit and its phantoms', () => {
  const def = MONSTERS.mask_spirit;

  it('floats, shoots homing bolts, and splits into two phantoms once, at low health', () => {
    expect(def.flyer).toBe(true);
    expect(def.homing).toBeGreaterThan(0);
    const r = rig(10, 3);
    const m = new Monster(def, { x: 5, y: 3 });
    m.takeDamage(Math.floor(m.maxHp * 0.5)); // not yet low
    r.run(m, 0.1);
    expect(r.splits).toEqual([]);
    m.takeDamage(Math.floor(m.maxHp * 0.2)); // 30 % left
    r.run(m, 0.1);
    expect(r.splits).toEqual([{ into: 'mask_phantom', count: 2 }]);
    m.takeDamage(1);
    r.run(m, 0.5);
    expect(r.splits).toHaveLength(1); // only the first time
  });

  it('a phantom takes one hit, shoots like the mask, and vanishes by itself without being "killed"', () => {
    const phantom = MONSTERS.mask_phantom;
    expect(phantom.phantom).toBe(true);
    expect(phantom.maxHp).toBe(1);
    expect(phantom.xp).toBe(0);
    expect('split' in phantom).toBe(false); // copies do not multiply
    const r = rig(30, 3);
    const m = new Monster(phantom, { x: 5, y: 3 });
    r.run(m, phantom.lifetime! - 0.5);
    expect(m.isDead).toBe(false);
    r.run(m, 1);
    expect(m.isDead).toBe(true);
    expect(m.hp).toBe(0);
  });

  it('engage() puts a newborn monster straight on the hunt', () => {
    const m = new Monster(MONSTERS.mask_phantom, { x: 5, y: 3 });
    expect(m.state).toBe('idle');
    m.engage();
    expect(m.state).toBe('chase');
  });
});

describe('core watcher (boss)', () => {
  const def = MONSTERS.core_watcher;
  const pillars = def.bossAttacks.filter((a) => a.kind === 'pillars');

  it('slashes and charges from the start, and gets the pillars in later phases', () => {
    expect(def.isBoss).toBe(true);
    expect(new Set(def.bossAttacks.map((a) => a.kind))).toEqual(new Set(['cleave', 'charge', 'pillars']));
    expect(Math.min(...pillars.map((a) => a.minPhase))).toBeGreaterThanOrEqual(1);
    expect(Math.max(...pillars.map((a) => a.pillars!))).toBeGreaterThan(Math.min(...pillars.map((a) => a.pillars!)));
  });

  it('never summons pillars in the first phase', () => {
    const r = rig(10, 3);
    const m = new Monster(def, { x: 5, y: 3 }, { rng: () => 0.99 });
    for (let i = 0; i < 12; i++) {
      r.run(m, 1);
      if (m.state === 'attack') r.run(m, 3);
    }
    expect(r.pillars).toEqual([]);
  });

  it('summons its pillars as soon as the move begins, with the warning time of the move', () => {
    const r = rig(10, 3);
    const m = new Monster(def, { x: 5, y: 3 }, { rng: () => 0.99 });
    m.takeDamage(Math.ceil(m.maxHp * 0.4)); // 60 %: the second phase
    expect(m.phase).toBe(1);
    r.untilAttack(m);
    const move = pillars[0]!;
    // the charge and the pillars are both available at this distance; with rng 0.99 the last one by weight wins
    expect(r.pillars).toEqual([{ count: move.pillars, radius: move.radius, delay: move.duration * (move.hitFraction ?? 0.55), mult: move.damageMult }]);
  });
});

describe('Pillar', () => {
  const target = (x: number, y: number) => ({ pos: { x, y }, radius: 0.28, isDead: false });

  it('waits out its warning, then hits whoever is inside the circle, once', () => {
    const p = new Pillar({ x: 5, y: 5 }, 1.3, 1, 20);
    const t = target(5.5, 5);
    let hits = 0;
    for (let s = 0; s < 0.95; s += DT) hits += p.update(DT, t) ? 1 : 0;
    expect(p.phase).toBe('warning');
    expect(hits).toBe(0);
    for (let s = 0; s < 3; s += DT) hits += p.update(DT, t) ? 1 : 0;
    expect(hits).toBe(1);
    expect(p.phase).toBe('gone');
  });

  it('misses someone who walked out of the circle during the warning', () => {
    const p = new Pillar({ x: 5, y: 5 }, 1.3, 1, 20);
    const t = target(5, 5);
    for (let s = 0; s < 0.8; s += DT) p.update(DT, t);
    t.pos.x = 9; // out
    let hits = 0;
    for (let s = 0; s < 3; s += DT) hits += p.update(DT, t) ? 1 : 0;
    expect(hits).toBe(0);
  });

  it('rises, stands and sinks', () => {
    const p = new Pillar({ x: 0, y: 0 }, 1, 0.5, 1);
    const far = target(50, 50);
    expect(p.height).toBe(0);
    for (let s = 0; s < 0.5 + PILLAR_RISE / 2; s += DT) p.update(DT, far);
    expect(p.height).toBeGreaterThan(0);
    expect(p.height).toBeLessThan(1);
    for (let s = 0; s < PILLAR_RISE; s += DT) p.update(DT, far);
    expect(p.height).toBe(1);
    for (let s = 0; s < PILLAR_STAND + PILLAR_SINK / 2; s += DT) p.update(DT, far);
    expect(p.height).toBeLessThan(1);
    expect(p.height).toBeGreaterThan(0);
  });
});

describe('public/maps/pure_core.json', () => {
  const map = parseMap(JSON.parse(readFileSync(new URL('../public/maps/pure_core.json', import.meta.url), 'utf8')) as unknown);
  const key = (x: number, y: number) => y * map.width + x;
  const walkable = (x: number, y: number) => tileAt(map, x, y) === TileType.FLOOR;
  const reachable = (() => {
    const seen = new Set<number>();
    const queue = [{ x: Math.floor(map.spawns.player.x), y: Math.floor(map.spawns.player.y) }];
    seen.add(key(queue[0]!.x, queue[0]!.y));
    while (queue.length) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (walkable(x + dx, y + dy) && !seen.has(key(x + dx, y + dy))) {
          seen.add(key(x + dx, y + dy));
          queue.push({ x: x + dx, y: y + dy });
        }
      }
    }
    return seen;
  })();
  const at = (p: { x: number; y: number }) => reachable.has(key(Math.floor(p.x), Math.floor(p.y)));

  it('is the core theme with its three kinds of monster, a boss, and a way back to the ruins', () => {
    expect(map.theme).toBe('core');
    expect(map.population).toEqual({ monsters: ['stone_attendant', 'mask_spirit'], elites: ['stone_attendant'], boss: 'core_watcher' });
    expect(map.spawns.boss).not.toBeNull();
    expect(map.portals.map((p) => p.to)).toEqual([{ map: 'pure_ruins', entrance: 'from_core' }]);
    expect(map.entrances.from_ruins).toBeDefined();
  });

  it('can be walked from the arrival to every spawn, the boss, the core and the way back', () => {
    for (const p of [...map.spawns.monsters, ...map.spawns.elites, map.spawns.boss!, ...map.interactables.map((i) => i.pos), map.entrances.from_ruins!]) expect(at(p)).toBe(true);
    for (const portal of map.portals) expect(at({ x: (portal.rect.minX + portal.rect.maxX) / 2, y: (portal.rect.minY + portal.rect.maxY) / 2 })).toBe(true);
  });

  it('is sealed: no floor touches void or the map edge', () => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) === TileType.VOID || tileAt(map, x, y) === TileType.WALL) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(tileAt(map, x + dx, y + dy), `leak at ${x},${y}`).not.toBe(TileType.VOID);
      }
    }
  });
});
