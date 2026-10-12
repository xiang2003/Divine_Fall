import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { Projectile } from '../src/entities/Projectile';
import { CollisionSystem } from '../src/systems/CollisionSystem';

const MAP = parseMap({
  id: 'p',
  name: 'p',
  layout: [
    '################',
    '#P.............#',
    '#..............#',
    '#......#.......#',
    '#......#.......#',
    '#..............#',
    '################',
  ],
});
const collision = new CollisionSystem(MAP);
const DT = 1 / 60;

function fly(p: Projectile, target: { pos: { x: number; y: number }; radius: number; isDead: boolean }, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const r = p.update(DT, collision, target);
    if (r) return r;
  }
  return null;
}

const FAR = { pos: { x: 100, y: 100 }, radius: 0.28, isDead: false };

describe('Projectile', () => {
  it('hits the target it flies into and stops', () => {
    const p = new Projectile();
    p.launch(2, 1.5, 1, 0, 6, 7, 3);
    const target = { pos: { x: 6, y: 1.5 }, radius: 0.28, isDead: false };
    expect(fly(p, target, 2)).toBe('hit');
    expect(p.active).toBe(false);
  });

  it('is stopped by walls', () => {
    const p = new Projectile();
    p.launch(2, 1.5, 1, 0, 6, 7, 5);
    expect(fly(p, FAR, 5)).toBe('wall'); // hits the east wall at x = 15
    expect(p.pos.x).toBeLessThan(15);
  });

  it('is stopped by a one-tile wall even at very high speed (no tunnelling)', () => {
    const p = new Projectile();
    p.launch(2.5, 3.5, 1, 0, 200, 7, 5); // 3.3 tiles per frame at 60 fps, straight at the pillar at x = 7
    expect(fly(p, FAR, 1)).toBe('wall');
    expect(p.pos.x).toBeLessThan(7);
  });

  it('expires after its lifetime in open space', () => {
    const p = new Projectile();
    p.launch(2, 1.5, 1, 0, 1, 7, 0.5);
    expect(fly(p, FAR, 2)).toBe('expired');
  });

  it('passes through a dead target', () => {
    const p = new Projectile();
    p.launch(2, 1.5, 1, 0, 6, 7, 3);
    const dead = { pos: { x: 6, y: 1.5 }, radius: 0.28, isDead: true };
    expect(fly(p, dead, 1)).not.toBe('hit');
  });

  it('does nothing when inactive', () => {
    const p = new Projectile();
    expect(p.update(DT, collision, FAR)).toBeNull();
  });
});

describe('CollisionSystem.hasLineOfSight', () => {
  it('is clear in the open and blocked by a wall tile in between', () => {
    expect(collision.hasLineOfSight(2.5, 1.5, 12.5, 1.5)).toBe(true);
    expect(collision.hasLineOfSight(2.5, 3.5, 12.5, 3.5)).toBe(false); // pillar at x = 7
  });

  it('works for coincident points', () => {
    expect(collision.hasLineOfSight(2.5, 1.5, 2.5, 1.5)).toBe(true);
  });
});
