import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MapParseError, parseMap, type MapData } from '../src/data/mapData';
import { START_MAP_ID, WORLD_MAP_FILES, checkWorldLinks } from '../src/data/worldMaps';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { findPortalAt, portalBlockedReason, resolveEntrance } from '../src/systems/portals';

const base = { id: 'a', name: 'A' };
const room = ['######', '#P...#', '#....#', '#....#', '######'];

describe('parseMap: entrances and portals', () => {
  it('parses named entrances (tile centre) and portal rectangles', () => {
    const map = parseMap({
      ...base,
      layout: room,
      entrances: { from_b: { x: 3, y: 2 } },
      portals: [{ id: 'to_b', x: 4, y: 1, w: 1, h: 2, to: { map: 'b', entrance: 'start' }, requiresFlag: 'f', blockedText: 'no' }],
    });
    expect(map.entrances.from_b).toEqual({ x: 3.5, y: 2.5 });
    expect(map.portals).toEqual([
      { id: 'to_b', rect: { minX: 4, minY: 1, maxX: 5, maxY: 3 }, to: { map: 'b', entrance: 'start' }, requiresFlag: 'f', blockedText: 'no' },
    ]);
  });

  it('maps without entrances or portals still parse', () => {
    const map = parseMap({ ...base, layout: room });
    expect(map.entrances).toEqual({});
    expect(map.portals).toEqual([]);
  });

  it.each([
    ['entrance on a wall', { entrances: { x: { x: 0, y: 0 } } }, /not on a floor tile/],
    ['entrance outside the map', { entrances: { x: { x: 50, y: 1 } } }, /not on a floor tile/],
    ['reserved entrance name', { entrances: { start: { x: 1, y: 1 } } }, /reserved/],
    ['portal over a wall', { portals: [{ id: 'p', x: 5, y: 1, to: { map: 'b', entrance: 'start' } }] }, /not a floor tile/],
    ['portal without a target', { portals: [{ id: 'p', x: 2, y: 1 }] }, /"to"/],
    ['duplicate portal id', {
      portals: [
        { id: 'p', x: 2, y: 1, to: { map: 'b', entrance: 'start' } },
        { id: 'p', x: 3, y: 1, to: { map: 'b', entrance: 'start' } },
      ],
    }, /Duplicate portal/],
    ['fractional portal size', { portals: [{ id: 'p', x: 2, y: 1, w: 1.5, to: { map: 'b', entrance: 'start' } }] }, /integer/],
  ])('rejects %s', (_label, extra, message) => {
    const raw = { ...base, layout: room, ...extra };
    expect(() => parseMap(raw)).toThrow(MapParseError);
    expect(() => parseMap(raw)).toThrow(message);
  });
});

describe('portal rules', () => {
  const map = parseMap({
    ...base,
    layout: room,
    entrances: { from_b: { x: 2, y: 3 } },
    portals: [
      { id: 'open', x: 4, y: 1, w: 1, h: 2, to: { map: 'b', entrance: 'start' } },
      { id: 'sealed', x: 3, y: 3, to: { map: 'c', entrance: 'x' }, requiresFlag: 'seal_broken', blockedText: '封石紋絲不動。' },
    ],
  });

  it('finds the portal containing a point, and none outside', () => {
    expect(findPortalAt(map, 4.5, 2.5)?.id).toBe('open');
    expect(findPortalAt(map, 4.0, 1.0)?.id).toBe('open'); // min edge is inside
    expect(findPortalAt(map, 5.0, 1.5)).toBeNull(); // max edge is outside
    expect(findPortalAt(map, 2.5, 1.5)).toBeNull();
  });

  it('a portal with no requirement is always open', () => {
    expect(portalBlockedReason(map.portals[0]!, new Set())).toBeNull();
  });

  it('a flagged portal is closed with its message until the flag is set', () => {
    const sealed = map.portals[1]!;
    expect(portalBlockedReason(sealed, new Set())).toBe('封石紋絲不動。');
    expect(portalBlockedReason(sealed, new Set(['other']))).toBe('封石紋絲不動。');
    expect(portalBlockedReason(sealed, new Set(['seal_broken']))).toBeNull();
  });

  it('resolves "start" to the P tile and named entrances to their tile, else null', () => {
    expect(resolveEntrance(map, 'start')).toEqual({ x: 1.5, y: 1.5 });
    expect(resolveEntrance(map, 'from_b')).toEqual({ x: 2.5, y: 3.5 });
    expect(resolveEntrance(map, 'nope')).toBeNull();
  });
});

describe('the real world maps', () => {
  const maps: MapData[] = Object.entries(WORLD_MAP_FILES).map(([id, file]) => {
    const map = parseMap(JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as unknown);
    expect(map.id, `${file} declares id "${map.id}"`).toBe(id);
    return map;
  });

  it('start map exists', () => {
    expect(maps.some((m) => m.id === START_MAP_ID)).toBe(true);
  });

  it('every portal leads to an existing map and entrance', () => {
    expect(checkWorldLinks(maps)).toEqual([]);
  });

  it('checkWorldLinks reports a missing map and a missing entrance', () => {
    const a = parseMap({ ...base, layout: room, portals: [{ id: 'p', x: 2, y: 1, to: { map: 'zzz', entrance: 'start' } }] });
    const b = parseMap({ id: 'b', name: 'B', layout: room, portals: [{ id: 'q', x: 2, y: 1, to: { map: 'a', entrance: 'nope' } }] });
    const problems = checkWorldLinks([a, b]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/"zzz" does not exist/);
    expect(problems[1]).toMatch(/no entrance "nope"/);
  });

  it('no entrance sits inside a portal (arriving would bounce the player straight back)', () => {
    for (const map of maps) {
      const points = [map.spawns.player, ...Object.values(map.entrances)];
      for (const p of points) expect(findPortalAt(map, p.x, p.y), `${map.id} @ ${p.x},${p.y}`).toBeNull();
    }
  });

  it('on each map the player can walk from the start to every entrance, portal and spawn', () => {
    for (const map of maps) {
      const reachable = reachableTiles(map);
      const targets = [
        ...Object.values(map.entrances),
        ...map.spawns.monsters,
        ...map.spawns.elites,
        ...(map.spawns.boss ? [map.spawns.boss] : []),
        ...map.portals.map((p) => ({ x: p.rect.minX + 0.5, y: p.rect.minY + 0.5 })),
      ];
      for (const t of targets) {
        expect(reachable.has(Math.floor(t.y) * map.width + Math.floor(t.x)), `${map.id}: ${t.x},${t.y} unreachable`).toBe(true);
      }
    }
  });

  it('every map can be reached from the start map by following portals (ignoring closed flags)', () => {
    const seen = new Set<string>([START_MAP_ID]);
    const queue: string[] = [START_MAP_ID];
    while (queue.length) {
      const id = queue.shift()!;
      const map = maps.find((m) => m.id === id)!;
      for (const p of map.portals) {
        if (!seen.has(p.to.map)) {
          seen.add(p.to.map);
          queue.push(p.to.map);
        }
      }
    }
    expect([...seen].sort()).toEqual(maps.map((m) => m.id).sort());
  });

  it('every map has a way back: portals form a symmetric graph', () => {
    for (const map of maps) {
      for (const p of map.portals) {
        const target = maps.find((m) => m.id === p.to.map)!;
        expect(target.portals.some((q) => q.to.map === map.id), `${p.to.map} has no portal back to ${map.id}`).toBe(true);
      }
    }
  });
});

/** Tiles reachable from the default spawn, treating walls, void and crates as blocked. */
function reachableTiles(map: MapData): Set<number> {
  const collision = new CollisionSystem(map);
  const crates = new Set(map.props.map((p) => p.tileY * map.width + p.tileX));
  const start = Math.floor(map.spawns.player.y) * map.width + Math.floor(map.spawns.player.x);
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const cx = cur % map.width;
    const cy = Math.floor(cur / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = ny * map.width + nx;
      if (collision.isTileBlocked(nx, ny) || crates.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push(k);
    }
  }
  return seen;
}
