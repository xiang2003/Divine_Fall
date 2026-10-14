import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MapParseError, TileType, parseMap, tileAt, type MapData } from '../src/data/mapData';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { CollisionSystem } from '../src/systems/CollisionSystem';

describe('parseMap', () => {
  it('parses tiles, props and spawns', () => {
    const map = parseMap({
      id: 'x',
      name: 'X',
      layout: ['#####', '#Pm.#', '#ceB#', '#.X.#', '#####'],
    });
    expect(map.width).toBe(5);
    expect(map.height).toBe(5);
    expect(tileAt(map, 0, 0)).toBe(TileType.WALL);
    expect(tileAt(map, 1, 1)).toBe(TileType.FLOOR);
    expect(tileAt(map, 99, 0)).toBe(TileType.VOID);
    expect(map.spawns.player).toEqual({ x: 1.5, y: 1.5 });
    expect(map.spawns.monsters).toEqual([{ x: 2.5, y: 1.5 }]);
    expect(map.spawns.elites).toEqual([{ x: 2.5, y: 2.5 }]);
    expect(map.spawns.boss).toEqual({ x: 3.5, y: 2.5 });
    expect(map.spawns.exit).toEqual({ x: 2.5, y: 3.5 });
    expect(map.props).toHaveLength(1);
    expect(tileAt(map, 1, 2)).toBe(TileType.FLOOR); // a crate stands on floor
  });

  it.each([
    ['not an object', 'nope', /not an object/],
    ['missing id', { name: 'x', layout: ['P'] }, /"id" and "name"/],
    ['empty layout', { id: 'a', name: 'b', layout: [] }, /non-empty/],
    ['ragged rows', { id: 'a', name: 'b', layout: ['P..', '..'] }, /row 1/],
    ['unknown char', { id: 'a', name: 'b', layout: ['P?'] }, /Unknown map character "\?"/],
    ['no player', { id: 'a', name: 'b', layout: ['...'] }, /no player spawn/],
    ['two players', { id: 'a', name: 'b', layout: ['PP'] }, /more than one player/],
    ['two bosses', { id: 'a', name: 'b', layout: ['PBB'] }, /more than one boss/],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseMap(raw)).toThrow(MapParseError);
    expect(() => parseMap(raw)).toThrow(message);
  });
});

describe('public/maps/pure_ruins.json', () => {
  const raw = JSON.parse(readFileSync(new URL('../public/maps/pure_ruins.json', import.meta.url), 'utf8')) as unknown;
  const map = parseMap(raw);

  it('has every required spawn kind', () => {
    expect(map.spawns.monsters.length).toBeGreaterThanOrEqual(6);
    expect(map.spawns.elites.length).toBeGreaterThanOrEqual(1);
    expect(map.spawns.boss).not.toBeNull();
    expect(map.portals.length).toBeGreaterThanOrEqual(1);
  });

  it('is sealed: no floor tile touches the map edge or void', () => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) !== TileType.FLOOR) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          expect(tileAt(map, x + dx, y + dy)).not.toBe(TileType.VOID);
        }
      }
    }
  });

  it('does not snag when sliding along a wall through a long corridor', () => {
    const collision = new CollisionSystem(map);
    // Find a long straight stretch of floor with a wall along its north side, hug that wall and run +x along it.
    let best = { y: 0, x: 0, length: 0 };
    for (let y = 1; y < map.height; y++) {
      let x = 0;
      while (x < map.width) {
        let length = 0;
        while (x + length < map.width && tileAt(map, x + length, y) === TileType.FLOOR && tileAt(map, x + length, y - 1) === TileType.WALL) length++;
        if (length > best.length) best = { y, x, length };
        x += Math.max(1, length);
      }
    }
    expect(best.length).toBeGreaterThanOrEqual(8);
    const wallY = best.y + PLAYER_CONFIG.radius;
    const pos = { x: best.x + 0.5, y: wallY };
    const steps = Math.floor(((best.length - 2) / (PLAYER_CONFIG.baseStats.moveSpeed / 60)));
    for (let i = 0; i < steps; i++) collision.moveCircle(pos, PLAYER_CONFIG.radius, PLAYER_CONFIG.baseStats.moveSpeed / 60, 0);
    expect(pos.x).toBeGreaterThan(best.x + best.length - 2.5);
    expect(pos.y).toBeCloseTo(wallY, 5);
  });

  it('lets the player body physically walk from the start to every spawn and portal', () => {
    const collision = new CollisionSystem(map);
    const targets = [
      ...map.spawns.monsters,
      ...map.spawns.elites,
      map.spawns.boss!,
      ...map.portals.map((p) => ({ x: (p.rect.minX + p.rect.maxX) / 2, y: (p.rect.minY + p.rect.maxY) / 2 })),
    ];
    for (const target of targets) {
      const path = findTilePath(map, collision, map.spawns.player, target);
      expect(path, `no tile path to ${target.x},${target.y}`).not.toBeNull();
      // Actually drive a collision circle along the path and check it arrives.
      const pos = { ...map.spawns.player };
      for (const wp of path!) walkTo(collision, pos, wp);
      expect(Math.hypot(pos.x - target.x, pos.y - target.y), `stuck on the way to ${target.x},${target.y}`).toBeLessThan(0.2);
    }
  });
});

function findTilePath(
  map: MapData,
  collision: CollisionSystem,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  const key = (x: number, y: number) => y * map.width + x;
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  const crates = new Set(map.props.map((p) => key(p.tileX, p.tileY)));
  const prev = new Map<number, number>();
  prev.set(key(start.x, start.y), -1);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === goal.x && cur.y === goal.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (collision.isTileBlocked(nx, ny) || crates.has(key(nx, ny)) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!prev.has(key(goal.x, goal.y))) return null;
  const path: { x: number; y: number }[] = [{ x: to.x, y: to.y }];
  for (let k = prev.get(key(goal.x, goal.y))!; k !== -1 && k !== key(start.x, start.y); k = prev.get(k)!) {
    path.push({ x: (k % map.width) + 0.5, y: Math.floor(k / map.width) + 0.5 });
  }
  return path.reverse();
}

function walkTo(collision: CollisionSystem, pos: { x: number; y: number }, wp: { x: number; y: number }): void {
  const stepLen = PLAYER_CONFIG.baseStats.moveSpeed / 60;
  for (let i = 0; i < 600; i++) {
    const dx = wp.x - pos.x;
    const dy = wp.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.15) return;
    collision.moveCircle(pos, PLAYER_CONFIG.radius, (dx / d) * stepLen, (dy / d) * stepLen);
  }
}
