import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../src/data/monsters';
import { planSpawns } from '../src/systems/spawnPlan';
import { mulberry32 } from '../src/systems/rng';
import { MapParseError, TileType, parseMap, tileAt, type MapData } from '../src/data/mapData';
import { START_MAP_ID, WORLD_MAP_FILES, checkWorldLinks } from '../src/data/worldMaps';
import { BUILDING_VARIANTS, buildingCanvasSize, isBuildingVariant } from '../src/game/BuildingArt';
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

describe('map themes and tree tiles', () => {
  it('"T" is a tile that blocks movement and sight like a wall, and themes default to stone', () => {
    const map = parseMap({ id: 'a', name: 'A', theme: 'grass', layout: ['#####', '#PT.#', '#...#', '#####'] });
    expect(map.theme).toBe('grass');
    expect(tileAt(map, 2, 1)).toBe(TileType.TREE);
    const collision = new CollisionSystem(map);
    expect(collision.isTileBlocked(2, 1)).toBe(true);
    expect(collision.hasLineOfSight(1.5, 1.5, 3.5, 1.5)).toBe(false);
    expect(parseMap({ id: 'a', name: 'A', layout: ['P'] }).theme).toBe('stone');
  });

  it('rejects an unknown theme', () => {
    expect(() => parseMap({ id: 'a', name: 'A', theme: 'lava', layout: ['P'] })).toThrow(/theme/);
  });

  it('the outdoor maps use the grass theme and are sealed by trees or walls (no floor touches void or the map edge)', () => {
    for (const id of ['pure_village', 'pure_forest'] as const) {
      const map = parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES[id]}`, import.meta.url), 'utf8')) as unknown);
      expect(map.theme).toBe('grass');
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (tileAt(map, x, y) !== TileType.FLOOR) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            expect(tileAt(map, x + dx, y + dy), `${id} leaks at ${x},${y}`).not.toBe(TileType.VOID);
          }
        }
      }
    }
  });

  it('the forest has enough monsters for the first quest, spread away from the arrival point', () => {
    const map = parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES.pure_forest}`, import.meta.url), 'utf8')) as unknown);
    expect(map.spawns.monsters.length).toBeGreaterThanOrEqual(8);
    for (const m of map.spawns.monsters) {
      expect(Math.hypot(m.x - map.entrances.from_village!.x, m.y - map.entrances.from_village!.y)).toBeGreaterThan(8);
    }
  });
});

describe('buildings', () => {
  const layout = ['########', '#P.....#', '#.###..#', '#.###..#', '#......#', '########'];
  const base = { id: 'a', name: 'A', layout };

  it('parses a building over solid tiles', () => {
    const map = parseMap({ ...base, buildings: [{ style: 'home', x: 2, y: 2, w: 3, h: 2 }] });
    expect(map.buildings).toEqual([{ style: 'home', x: 2, y: 2, w: 3, h: 2 }]);
    expect(parseMap(base).buildings).toEqual([]);
  });

  it('rejects a building over floor, a building over the edge, bad numbers and overlapping buildings', () => {
    expect(() => parseMap({ ...base, buildings: [{ style: 'home', x: 1, y: 1, w: 3, h: 2 }] })).toThrow(/not a solid/);
    expect(() => parseMap({ ...base, buildings: [{ style: 'home', x: 6, y: 2, w: 3, h: 2 }] })).toThrow(/not a solid/);
    expect(() => parseMap({ ...base, buildings: [{ style: 'home', x: 2, y: 2, w: 1.5, h: 2 }] })).toThrow(/integer/);
    expect(() => parseMap({ ...base, buildings: [{ x: 2, y: 2, w: 1, h: 1 }] })).toThrow(/style/);
    expect(() =>
      parseMap({ ...base, buildings: [{ style: 'a', x: 2, y: 2, w: 2, h: 2 }, { style: 'b', x: 3, y: 3, w: 1, h: 1 }] }),
    ).toThrow(/overlap/);
  });

  it('every building on the real maps has a drawn sprite of exactly that style and size, and nothing walkable stands on it', () => {
    for (const file of Object.values(WORLD_MAP_FILES)) {
      const map = parseMap(JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as unknown);
      const collision = new CollisionSystem(map);
      for (const b of map.buildings) {
        expect(isBuildingVariant(b.style, b.w, b.h), `${map.id}: ${b.style} ${b.w}x${b.h} has no sprite`).toBe(true);
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) expect(collision.isTileBlocked(x, y)).toBe(true);
        const inside = (p: { x: number; y: number }) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
        for (const p of [map.spawns.player, ...Object.values(map.entrances), ...map.spawns.monsters, ...map.npcs.map((n) => n.pos)]) {
          expect(inside(p), `${map.id}: something stands inside ${b.style}`).toBe(false);
        }
      }
    }
  });

  it('every building sprite fits its canvas with the pivot inside it', () => {
    for (const v of BUILDING_VARIANTS) {
      const size = buildingCanvasSize(v.w, v.h);
      expect(size.centerX).toBeGreaterThan(0);
      expect(size.centerX).toBeLessThan(size.width);
      expect(size.centerY).toBeGreaterThan(0);
      expect(size.centerY).toBeLessThan(size.height);
      // The whole footprint diamond is inside the canvas.
      expect(size.centerX - (v.w + v.h) * 16).toBeGreaterThanOrEqual(0);
      expect(size.centerX + (v.w + v.h) * 16).toBeLessThanOrEqual(size.width);
      expect(size.centerY + (v.w + v.h) * 8).toBeLessThanOrEqual(size.height);
    }
  });
});

describe('beach and cave maps', () => {
  const load = (id: keyof typeof WORLD_MAP_FILES) =>
    parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES[id]}`, import.meta.url), 'utf8')) as unknown);

  it('water blocks walking but not sight', () => {
    const map = parseMap({ id: 'a', name: 'A', theme: 'sand', layout: ['#####', '#PWW#', '#...#', '#####'] });
    expect(tileAt(map, 2, 1)).toBe(TileType.WATER);
    const collision = new CollisionSystem(map);
    expect(collision.isTileBlocked(2, 1)).toBe(true);
    expect(collision.hasLineOfSight(1.5, 1.5, 3.5, 1.5)).toBe(true);
  });

  it('the coast is a sand map with sea and the stranded ferry; the cave is a cave map with a pool, an elite and enough monsters', () => {
    const coast = load('pure_coast');
    expect(coast.theme).toBe('sand');
    expect(coast.buildings.map((b) => b.style)).toEqual(['ferry']);
    expect(coast.spawns.monsters).toHaveLength(0); // a safe place
    let water = 0;
    for (let y = 0; y < coast.height; y++) for (let x = 0; x < coast.width; x++) if (tileAt(coast, x, y) === TileType.WATER) water++;
    expect(water).toBeGreaterThan(100);

    const cave = load('pure_spring_cave');
    expect(cave.theme).toBe('cave');
    expect(cave.spawns.elites).toHaveLength(1);
    expect(cave.spawns.monsters.length).toBeGreaterThanOrEqual(8);
    let pool = 0;
    for (let y = 0; y < cave.height; y++) for (let x = 0; x < cave.width; x++) if (tileAt(cave, x, y) === TileType.WATER) pool++;
    expect(pool).toBeGreaterThan(20);
  });

  it('the beach and the cave are sealed: no floor touches void or the map edge', () => {
    for (const id of ['pure_coast', 'pure_spring_cave'] as const) {
      const map = load(id);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (tileAt(map, x, y) !== TileType.FLOOR) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            expect(tileAt(map, x + dx, y + dy), `${id} leaks at ${x},${y}`).not.toBe(TileType.VOID);
          }
        }
      }
    }
  });

  it('the road to the coast is closed until the "coast_open" flag, and the cave is open from the forest', () => {
    const village = load('pure_village');
    expect(village.portals.find((p) => p.to.map === 'pure_coast')?.requiresFlag).toBe('coast_open');
    const forest = load('pure_forest');
    expect(forest.portals.find((p) => p.to.map === 'pure_spring_cave')?.requiresFlag).toBeUndefined();
  });
});

describe('map populations', () => {
  it('parses a population and rejects malformed ones', () => {
    const layout = ['####', '#Pm#', '####'];
    const map = parseMap({ id: 'a', name: 'A', layout, population: { monsters: ['warped'], elites: ['echo_guard'], boss: 'ruins_guardian' } });
    expect(map.population).toEqual({ monsters: ['warped'], elites: ['echo_guard'], boss: 'ruins_guardian' });
    expect(parseMap({ id: 'a', name: 'A', layout }).population).toBeNull();
    expect(() => parseMap({ id: 'a', name: 'A', layout, population: { monsters: 'warped' } })).toThrow(/list of monster ids/);
    expect(() => parseMap({ id: 'a', name: 'A', layout, population: { boss: 5 } })).toThrow(/monster id/);
  });

  it('every monster a real map names exists, and the chapter maps use the island monsters', () => {
    const used = new Map<string, Set<string>>();
    for (const [id, file] of Object.entries(WORLD_MAP_FILES)) {
      const map = parseMap(JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as unknown);
      const ids = [...(map.population?.monsters ?? []), ...(map.population?.elites ?? []), ...(map.population?.boss ? [map.population.boss] : [])];
      for (const m of ids) expect(Object.keys(MONSTERS), `${id}: ${m}`).toContain(m);
      used.set(id, new Set(ids));
    }
    expect(used.get('pure_forest')).toContain('forest_wolf');
    expect(used.get('pure_forest')).toContain('forest_viper');
    expect(used.get('pure_spring_cave')).toContain('water_shade');
    expect(used.get('pure_ruins')).toContain('ruins_guardian');
  });

  it('planSpawns follows the population in order, falls back to the default mix, and rejects unknown ids', () => {
    const spawns = { player: { x: 1, y: 1 }, monsters: [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }], elites: [{ x: 5, y: 5 }], boss: { x: 6, y: 6 }, exit: null };
    const plan = planSpawns(spawns, mulberry32(1), { monsters: ['forest_wolf', 'warped'], elites: ['echo_guard'], boss: 'ruins_guardian' });
    expect(plan.map((p) => p.def.id)).toEqual(['forest_wolf', 'warped', 'forest_wolf', 'echo_guard', 'ruins_guardian']);
    expect(plan[3]!.affixes.length).toBeGreaterThan(0);
    expect(planSpawns(spawns, mulberry32(1)).map((p) => p.def.id)).toEqual(['ghoul', 'shade', 'hound', 'ghoul', 'archon']);
    expect(() => planSpawns(spawns, mulberry32(1), { monsters: ['nope'], elites: [], boss: null })).toThrow(/Unknown monster/);
  });

  it('the island monsters are weaker than the boss and fit their roles', () => {
    expect(MONSTERS.forest_wolf.maxHp).toBeLessThan(MONSTERS.warped.maxHp);
    expect(MONSTERS.warped.maxHp).toBeLessThan(MONSTERS.echo_guard.maxHp);
    expect(MONSTERS.water_shade.behavior).toBe('ranged');
    expect(MONSTERS.ruins_guardian.isBoss).toBe(true);
    expect(MONSTERS.ruins_guardian.bossAttacks?.length).toBeGreaterThan(0);
  });
});
