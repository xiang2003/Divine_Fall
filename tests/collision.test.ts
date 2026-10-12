import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { CollisionSystem } from '../src/systems/CollisionSystem';

// A 7x5 room: walls around, floor inside, one crate at (3,2), player at (1,1).
const ROOM = parseMap({
  id: 't',
  name: 't',
  layout: ['#######', '#P....#', '#..c..#', '#.....#', '#######'],
});
const R = 0.28;

describe('CollisionSystem', () => {
  const col = new CollisionSystem(ROOM);

  it('treats walls, void and out-of-bounds as blocked and floor as free', () => {
    expect(col.isTileBlocked(0, 0)).toBe(true);
    expect(col.isTileBlocked(2, 1)).toBe(false);
    expect(col.isTileBlocked(-1, 2)).toBe(true);
    expect(col.isTileBlocked(99, 99)).toBe(true);
  });

  it('stops a circle at a wall instead of passing through', () => {
    const pos = { x: 1.5, y: 1.5 };
    col.moveCircle(pos, R, -5, 0); // push hard into the left wall (x = 1 face)
    expect(pos.x).toBeCloseTo(1 + R, 5);
    expect(pos.y).toBeCloseTo(1.5, 5);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const pos = { x: 1.5, y: 1.5 };
    col.moveCircle(pos, R, -1, 1); // into the left wall while going +y
    expect(pos.x).toBeCloseTo(1 + R, 5);
    expect(pos.y).toBeGreaterThan(2);
  });

  it('cannot tunnel through a wall with a huge step', () => {
    const pos = { x: 5.5, y: 1.5 };
    col.moveCircle(pos, R, 50, 0);
    expect(pos.x).toBeLessThanOrEqual(6 - R + 1e-6);
    expect(col.collidesCircle(pos.x, pos.y, R - 1e-3)).toBe(false);
  });

  it('blocks on crate footprints', () => {
    const pos = { x: 1.5, y: 2.5 };
    col.moveCircle(pos, R, 3, 0); // walk right along y=2.5 into the crate at tile (3,2)
    const crate = ROOM.props[0]!.bounds;
    expect(pos.x).toBeCloseTo(crate.minX - R, 5);
  });

  it('lets the circle walk around a crate', () => {
    const pos = { x: 1.5, y: 2.5 };
    col.moveCircle(pos, R, 0, 0.7); // down to y=3.2, clear of the crate
    col.moveCircle(pos, R, 4, 0);
    expect(pos.x).toBeGreaterThan(5);
  });

  it('pushes out an entity that starts overlapping a solid', () => {
    const pos = { x: 0.9, y: 1.5 }; // overlapping the wall
    col.pushOut(pos, R);
    expect(col.collidesCircle(pos.x, pos.y, R - 1e-3)).toBe(false);
  });

  it('is a no-op for zero movement', () => {
    const pos = { x: 2.5, y: 2.5 };
    col.moveCircle(pos, R, 0, 0);
    expect(pos).toEqual({ x: 2.5, y: 2.5 });
  });
});
