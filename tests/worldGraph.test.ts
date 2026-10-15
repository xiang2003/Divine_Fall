import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMap, type MapData } from '../src/data/mapData';
import { WORLD_MAP_FILES, WORLD_MAP_LAYOUT } from '../src/data/worldMaps';
import { buildWorldGraph } from '../src/systems/worldGraph';

const load = (file: string): MapData => parseMap(JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as unknown);
const maps = Object.values(WORLD_MAP_FILES).map(load);
const edgeOf = (g: ReturnType<typeof buildWorldGraph>, a: string, b: string) => g.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));

describe('world graph', () => {
  it('every map has a place on the world map, and the places are distinct and inside the panel', () => {
    expect(Object.keys(WORLD_MAP_LAYOUT).sort()).toEqual(Object.keys(WORLD_MAP_FILES).sort());
    const seen = new Set<string>();
    for (const p of Object.values(WORLD_MAP_LAYOUT)) {
      expect(p.x).toBeGreaterThan(5);
      expect(p.x).toBeLessThan(95);
      expect(p.y).toBeGreaterThan(5);
      expect(p.y).toBeLessThan(95);
      const key = `${p.x},${p.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('draws one line per pair of connected maps, however many portals join them', () => {
    const g = buildWorldGraph(maps, WORLD_MAP_LAYOUT, new Set(), new Set(), 'pure_village');
    expect(g.nodes).toHaveLength(maps.length);
    const pairs = g.edges.map((e) => [e.a, e.b].sort().join('|')).sort();
    expect(pairs).toEqual(
      [
        'pure_forest|pure_village',
        'pure_forest|pure_spring_cave',
        'pure_forest|pure_ruins',
        'pure_ruins|pure_core',
        'pure_coast|pure_village',
      ].map((p) => p.split('|').sort().join('|')).sort(),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('every map is on the graph and reachable from the start (even over closed roads)', () => {
    const g = buildWorldGraph(maps, WORLD_MAP_LAYOUT, new Set(), new Set(), 'pure_village');
    const seen = new Set(['pure_village']);
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of g.edges) {
        if (seen.has(e.a) !== seen.has(e.b)) {
          seen.add(e.a);
          seen.add(e.b);
          changed = true;
        }
      }
    }
    expect(seen.size).toBe(maps.length);
  });

  it('closed roads are marked locked with their message until their flag is set', () => {
    const closed = buildWorldGraph(maps, WORLD_MAP_LAYOUT, new Set(), new Set(), 'pure_village');
    expect(edgeOf(closed, 'pure_village', 'pure_coast')).toMatchObject({ locked: true, hint: '海岸那邊，現在還不是去的時候。' });
    expect(edgeOf(closed, 'pure_forest', 'pure_ruins')).toMatchObject({ locked: true, hint: '封石紋絲不動。' });
    expect(edgeOf(closed, 'pure_village', 'pure_forest')?.locked).toBe(false);
    expect(edgeOf(closed, 'pure_forest', 'pure_spring_cave')?.locked).toBe(false);

    expect(edgeOf(closed, 'pure_ruins', 'pure_core')).toMatchObject({ locked: true, hint: '出口的石門紋絲不動。守衛還在這座遺跡裡。' });
    const open = buildWorldGraph(maps, WORLD_MAP_LAYOUT, new Set(['coast_open', 'ruins_open', 'pure_ruins_boss_defeated']), new Set(), 'pure_village');
    expect(open.edges.every((e) => !e.locked)).toBe(true);
    const half = buildWorldGraph(maps, WORLD_MAP_LAYOUT, new Set(['ruins_open']), new Set(), 'pure_village');
    expect(edgeOf(half, 'pure_forest', 'pure_ruins')?.locked).toBe(false);
    expect(edgeOf(half, 'pure_village', 'pure_coast')?.locked).toBe(true);
  });

  it('marks the current map and the visited maps', () => {
    const g = buildWorldGraph(maps, WORLD_MAP_LAYOUT, new Set(), new Set(['pure_village', 'pure_forest']), 'pure_forest');
    const node = (id: string) => g.nodes.find((n) => n.id === id)!;
    expect(node('pure_forest')).toMatchObject({ current: true, visited: true });
    expect(node('pure_village')).toMatchObject({ current: false, visited: true });
    expect(node('pure_coast')).toMatchObject({ current: false, visited: false });
    expect(g.nodes.filter((n) => n.current)).toHaveLength(1);
    expect(node('pure_village').name).toBe('胎息村');
    expect(node('pure_village').kind).toBe(WORLD_MAP_LAYOUT.pure_village.kind);
  });

  it('a map missing from the layout still gets a node in the middle instead of crashing', () => {
    const g = buildWorldGraph(maps, {}, new Set(), new Set(), 'pure_village');
    expect(g.nodes.every((n) => n.x === 50 && n.y === 50)).toBe(true);
  });
});
