import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { parseMap } from '../src/data/mapData';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { ClickMover } from '../src/systems/movement';

// 8x5 room, floor x 1..6 / y 1..3, with a wall nub at (4,2).
const MAP = parseMap({
  id: 't',
  name: 't',
  layout: ['########', '#P.....#', '#...#..#', '#......#', '########'],
});
const collision = new CollisionSystem(MAP);
const SPEED = PLAYER_CONFIG.baseStats.moveSpeed;
const R = PLAYER_CONFIG.radius;

function run(mover: ClickMover, pos: { x: number; y: number }, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) mover.update(pos, dt, SPEED, R, collision);
}

describe('ClickMover', () => {
  it('is idle without a target', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    expect(mover.update(pos, 0.016, SPEED, R, collision)).toBe(false);
    expect(pos).toEqual({ x: 1.5, y: 1.5 });
  });

  it('walks at constant speed toward the target', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    mover.setTarget(6, 1.5);
    run(mover, pos, 0.5);
    expect(pos.x).toBeCloseTo(1.5 + SPEED * 0.5, 1);
    expect(pos.y).toBeCloseTo(1.5, 5);
    expect(mover.hasTarget).toBe(true);
  });

  it('arrives, snaps no further than the target and clears the target', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    mover.setTarget(3, 3);
    run(mover, pos, 3);
    expect(Math.hypot(pos.x - 3, pos.y - 3)).toBeLessThanOrEqual(PLAYER_CONFIG.arriveDistance + 1e-6);
    expect(mover.hasTarget).toBe(false);
  });

  it('does not overshoot with a large dt', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    mover.setTarget(2, 1.5);
    mover.update(pos, 1, SPEED, R, collision); // a full second at 4.5 u/s would overshoot by a lot
    expect(pos.x).toBeCloseTo(2, 5);
  });

  it('gives up when blocked head-on by a wall instead of grinding forever', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    mover.setTarget(-5, 1.5); // through the west wall
    run(mover, pos, 1);
    expect(mover.hasTarget).toBe(false);
    expect(pos.x).toBeGreaterThanOrEqual(1 + R - 1e-6);
  });

  it('stops against a wall when the click is inside a wall', () => {
    const mover = new ClickMover();
    const pos = { x: 2.5, y: 2.5 };
    mover.setTarget(4.5, 2.5); // the wall nub at tile (4,2)
    run(mover, pos, 2);
    expect(mover.hasTarget).toBe(false);
    expect(pos.x).toBeCloseTo(4 - R, 3);
  });

  it('can be retargeted mid-walk and stopped on demand', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    mover.setTarget(6, 1.5);
    run(mover, pos, 0.2);
    mover.setTarget(pos.x, 3); // turn straight "down"
    run(mover, pos, 0.2);
    expect(pos.y).toBeGreaterThan(1.5);
    mover.stop();
    const before = { ...pos };
    run(mover, pos, 0.5);
    expect(pos).toEqual(before);
  });

  it('remembers the last travel direction while idle', () => {
    const mover = new ClickMover();
    const pos = { x: 1.5, y: 1.5 };
    mover.setTarget(3, 1.5);
    run(mover, pos, 1);
    expect(mover.direction.x).toBeCloseTo(1, 5);
    expect(mover.direction.y).toBeCloseTo(0, 5);
  });
});
