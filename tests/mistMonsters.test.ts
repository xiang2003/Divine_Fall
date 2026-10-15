import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TileType, parseMap, tileAt } from '../src/data/mapData';
import { MONSTERS } from '../src/data/monsters';
import { Monster, type MonsterHooks, type MonsterTarget } from '../src/entities/Monster';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { Pillar } from '../src/systems/PillarSystem';

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
    '#............................#',
    '#............................#',
    '##############################',
  ],
});
const DT = 1 / 60;

class Rig {
  melee = 0;
  projectiles = 0;
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
    split: () => {},
    summonPillars: () => {},
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

describe('wild wolf: the pack comes in from the sides', () => {
  const def = MONSTERS.wild_wolf;

  it('is a fast pack animal that flanks', () => {
    expect(def.flank).toBe(true);
    expect(def.packSize).toBeGreaterThan(1);
    expect(def.moveSpeed).toBeGreaterThan(MONSTERS.forest_wolf.moveSpeed);
  });

  it('two wolves swing out to opposite sides of the line to the player, then close in', () => {
    const r = rig(26, 4);
    const a = new Monster(def, { x: 17, y: 4 });
    const b = new Monster(def, { x: 17, y: 4 });
    r.run(a, 0.7);
    r.run(b, 0.7);
    // the player is straight to the east, so "to the side" is north or south
    expect(Math.abs(a.pos.y - 4)).toBeGreaterThan(0.4);
    expect(Math.abs(b.pos.y - 4)).toBeGreaterThan(0.4);
    expect(Math.sign(a.pos.y - 4)).toBe(-Math.sign(b.pos.y - 4));
    r.run(a, 3);
    expect(Math.hypot(a.pos.x - 26, a.pos.y - 4)).toBeLessThan(2); // it got there
  });

  it('goes straight at the player once it is close', () => {
    const r = rig(10, 4);
    const m = new Monster(def, { x: 7.5, y: 4 }); // 2.5 away: inside the "close" distance
    const y0 = m.pos.y;
    r.run(m, 0.2);
    expect(Math.abs(m.pos.y - y0)).toBeLessThan(0.05);
  });
});

describe('cleft boar: charges, and is dazed by what it runs into', () => {
  const def = MONSTERS.cleft_boar;
  const charge = def.charge;

  it('charges from a distance: crouches, then runs along the line and hurts the player once', () => {
    const r = rig(15, 4);
    const m = new Monster(def, { x: 8, y: 4 });
    r.untilAttack(m);
    expect(m.state).toBe('attack');
    const x0 = m.pos.x;
    r.run(m, charge.duration * 0.25);
    expect(m.pos.x).toBeCloseTo(x0, 2); // still crouching
    r.run(m, charge.duration * 0.6);
    expect(m.pos.x - x0).toBeGreaterThan(charge.rush * 0.8);
    expect(r.melee).toBe(1);
  });

  it('is not stunned when the run ends in open ground', () => {
    const r = rig(19, 4);
    const m = new Monster(def, { x: 12, y: 4 });
    r.untilAttack(m);
    let stunned = false;
    for (let t = 0; t < charge.duration; t += DT) {
      r.run(m, DT);
      stunned ||= m.state === 'hurt';
    }
    expect(stunned).toBe(false);
  });

  it('is left dazed for a while when it runs into a wall', () => {
    const r = rig(1.6, 4); // the player stands near the west wall; the boar charges straight at where they stood
    const m = new Monster(def, { x: 7, y: 4 });
    r.untilAttack(m);
    let dazedAt = -1;
    let t = 0;
    for (; t < charge.duration + 0.5 && dazedAt < 0; t += DT) {
      r.run(m, DT);
      if (m.state === 'hurt') dazedAt = t;
    }
    expect(dazedAt).toBeGreaterThan(0);
    expect(m.pos.x).toBeLessThan(2.2); // it is against the wall
    const x = m.pos.x;
    r.run(m, charge.stunSeconds - 0.3);
    expect(m.state).toBe('hurt');
    expect(m.pos.x).toBeCloseTo(x, 3); // it does not move while dazed
    r.run(m, 0.6);
    expect(m.state).not.toBe('hurt'); // and then it is back
  });
});

describe('drowned spirit: lies in wait in the water', () => {
  const def = MONSTERS.drowned_spirit;

  it('is hidden and cannot be hit or targeted until the player comes close', () => {
    const r = rig(20, 4);
    const m = new Monster(def, { x: 6, y: 4 });
    expect(m.hidden).toBe(true);
    expect(m.hittable).toBe(false);
    expect(m.takeDamage(10)).toBe(false);
    expect(m.hp).toBe(m.maxHp);
    r.run(m, 2);
    expect(m.hidden).toBe(true);
    expect(m.state).toBe('idle');
    expect(r.projectiles).toBe(0);
  });

  it('rises when the player is within its trigger range, does nothing while it rises, then throws blades', () => {
    const r = rig(6 + def.ambush!.triggerRange - 0.3, 4);
    const m = new Monster(def, { x: 6, y: 4 });
    r.run(m, DT);
    expect(m.hidden).toBe(false);
    expect(m.hittable).toBe(true);
    expect(m.emergeProgress).toBeLessThan(1);
    r.run(m, def.ambush!.emerge * 0.8);
    expect(r.projectiles).toBe(0);
    expect(m.emergeProgress).toBeLessThan(1);
    r.run(m, 0.5 + def.attackCooldown + 1);
    expect(m.emergeProgress).toBe(1);
    expect(r.projectiles).toBeGreaterThan(0);
  });

  it('stays hidden when there is a wall between it and the player', () => {
    const walled = parseMap({ id: 'w', name: 'w', layout: ['##########', '#P..#....#', '#...#....#', '##########'] });
    const r = new Rig(new CollisionSystem(walled), 6.5, 1.5);
    const m = new Monster(def, { x: 3.5, y: 1.5 });
    r.run(m, 1);
    expect(m.hidden).toBe(true);
  });
});

describe('wreck revenant and the burst', () => {
  it('is slow, and its burst is a warning circle that has no pillar', () => {
    expect(MONSTERS.wreck_revenant.moveSpeed).toBeLessThan(MONSTERS.forest_wolf.moveSpeed / 2);
    const burst = new Pillar({ x: 5, y: 5 }, 2.2, 0.9, 12, 'burst');
    const target = { pos: { x: 5.5, y: 5 }, radius: 0.28, isDead: false };
    let hits = 0;
    for (let s = 0; s < 0.85; s += DT) hits += burst.update(DT, target) ? 1 : 0;
    expect(hits).toBe(0);
    for (let s = 0; s < 0.1; s += DT) {
      hits += burst.update(DT, target) ? 1 : 0;
      expect(burst.height).toBe(0); // never a column
    }
    expect(hits).toBe(1);
    for (let s = 0; s < 0.5; s += DT) burst.update(DT, target);
    expect(burst.phase).toBe('gone');
  });
});

describe('public/maps/canglan_coast.json', () => {
  const map = parseMap(JSON.parse(readFileSync(new URL('../public/maps/canglan_coast.json', import.meta.url), 'utf8')) as unknown);
  const key = (x: number, y: number) => y * map.width + x;
  const floor = (x: number, y: number) => tileAt(map, x, y) === TileType.FLOOR;
  const reachable = (() => {
    const seen = new Set<number>();
    const queue = [{ x: Math.floor(map.spawns.player.x), y: Math.floor(map.spawns.player.y) }];
    seen.add(key(queue[0]!.x, queue[0]!.y));
    while (queue.length) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (floor(x + dx, y + dy) && !seen.has(key(x + dx, y + dy))) {
          seen.add(key(x + dx, y + dy));
          queue.push({ x: x + dx, y: y + dy });
        }
      }
    }
    return seen;
  })();
  const at = (p: { x: number; y: number }) => reachable.has(key(Math.floor(p.x), Math.floor(p.y)));

  it('is a foggy beach with a wreck, sea, grass woods, and all four kinds of monster', () => {
    expect(map.theme).toBe('mist');
    expect(map.fog).toBeGreaterThan(0.5);
    expect(map.buildings.map((b) => b.style)).toEqual(['wreck']);
    expect(new Set(map.population!.monsters)).toEqual(new Set(['wild_wolf', 'cleft_boar', 'drowned_spirit', 'wreck_revenant']));
    expect(map.spawns.monsters.length).toBe(map.population!.monsters.length);
    let water = 0;
    let grass = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) === TileType.WATER) water++;
        if (map.ground[key(x, y)] === 2) grass++;
      }
    }
    expect(water).toBeGreaterThan(200);
    expect(grass).toBeGreaterThan(200);
  });

  it('puts each kind where it belongs: spirits at the water, wolves and boars in the woods, revenants by the wreck', () => {
    const kinds = new Map<string, { x: number; y: number }[]>();
    const sorted = [...map.spawns.monsters].sort((a, b) => Math.floor(a.y) - Math.floor(b.y) || Math.floor(a.x) - Math.floor(b.x));
    sorted.forEach((p, i) => {
      const id = map.population!.monsters[i]!;
      kinds.set(id, [...(kinds.get(id) ?? []), p]);
    });
    const wreck = map.buildings[0]!;
    for (const p of kinds.get('drowned_spirit')!) {
      const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(map, Math.floor(p.x) + dx!, Math.floor(p.y) + dy!) === TileType.WATER);
      expect(nearWater, `spirit at ${p.x},${p.y}`).toBe(true);
    }
    for (const id of ['wild_wolf', 'cleft_boar']) for (const p of kinds.get(id)!) expect(map.ground[key(Math.floor(p.x), Math.floor(p.y))], `${id} at ${p.x},${p.y}`).toBe(2);
    for (const p of kinds.get('wreck_revenant')!) expect(Math.hypot(p.x - (wreck.x + wreck.w / 2), p.y - (wreck.y + wreck.h / 2))).toBeLessThan(9);
  });

  it('can be walked from the landing to every spawn, the elite, the trace, and the way back', () => {
    for (const p of [...map.spawns.monsters, ...map.spawns.elites, ...map.interactables.map((i) => i.pos), map.entrances.from_island!]) expect(at(p)).toBe(true);
    for (const portal of map.portals) expect(at({ x: (portal.rect.minX + portal.rect.maxX) / 2, y: (portal.rect.minY + portal.rect.maxY) / 2 })).toBe(true);
    expect(map.portals.map((p) => p.to)).toEqual([{ map: 'pure_coast', entrance: 'ferry_side' }]);
  });

  it('is sealed: no floor touches void or the map edge', () => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y);
        if (t === TileType.VOID || t === TileType.WALL || t === TileType.TREE) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(tileAt(map, x + dx, y + dy), `leak at ${x},${y}`).not.toBe(TileType.VOID);
      }
    }
  });
});

describe('map format: grass mask and fog', () => {
  const layout = ['#####', '#P.T#', '#...#', '#####'];

  it('reads a grass mask over floor and trees, and a fog thickness', () => {
    const map = parseMap({ id: 'a', name: 'A', layout, fog: 0.5, grass: ['     ', '  ggg', '  g  ', '     '] });
    expect(map.fog).toBe(0.5);
    expect(map.ground[1 * 5 + 2]).toBe(2); // floor on grass
    expect(map.ground[1 * 5 + 3]).toBe(2); // a tree on grass
    expect(map.ground[1 * 5 + 1]).toBe(0);
    expect(map.ground[0 * 5 + 2]).toBe(0); // walls are never grass
  });

  it.each([
    ['a mask of the wrong size', { grass: ['   '] }, /same size/],
    ['fog too thick', { fog: 1.5 }, /fog/],
  ])('rejects %s', (_name, extra, message) => {
    expect(() => parseMap({ id: 'a', name: 'A', layout, ...extra })).toThrow(message);
  });
});
