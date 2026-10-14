import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { MINIMAP_SCALE, minimapProject, minimapTileColor } from '../src/ui/minimapDraw';

describe('minimap', () => {
  it('projects world units like the game view: +x goes right and down, +y goes left and down', () => {
    expect(minimapProject(0, 0)).toEqual({ x: 0, y: 0 });
    const east = minimapProject(1, 0);
    expect(east.x).toBe(MINIMAP_SCALE);
    expect(east.y).toBe(MINIMAP_SCALE / 2);
    const south = minimapProject(0, 1);
    expect(south.x).toBe(-MINIMAP_SCALE);
    expect(south.y).toBe(MINIMAP_SCALE / 2);
  });

  it('colours each kind of tile, and leaves empty space empty', () => {
    const map = parseMap({
      id: 'x',
      name: 'X',
      theme: 'grass',
      layout: ['######', '#P,.W#', '#.T..#', '######'],
    });
    const floor = minimapTileColor(map, 3, 1);
    const path = minimapTileColor(map, 2, 1);
    expect(floor).toBeTruthy();
    expect(path).toBeTruthy();
    expect(path).not.toBe(floor); // dirt paths stand out
    expect(minimapTileColor(map, 4, 1)).not.toBe(floor); // water
    expect(minimapTileColor(map, 0, 0)).not.toBe(floor); // wall
    expect(minimapTileColor(map, 2, 2)).not.toBe(floor); // tree
    expect(minimapTileColor(map, 99, 99)).toBeNull();
  });
});
