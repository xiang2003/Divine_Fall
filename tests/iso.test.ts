import { describe, expect, it } from 'vitest';
import { Layer, placeAt, sceneToWorld, sortKey, worldToSceneX, worldToSceneY } from '../src/game/iso';

describe('isometric projection', () => {
  it('round-trips world -> scene -> world', () => {
    for (const [x, y] of [
      [0, 0],
      [5.5, 3.25],
      [-2, 7],
      [40.1, 29.9],
    ] as const) {
      const out = sceneToWorld(worldToSceneX(x, y), worldToSceneY(x, y), { x: 0, y: 0 });
      expect(out.x).toBeCloseTo(x, 9);
      expect(out.y).toBeCloseTo(y, 9);
    }
  });

  it('moves +x to screen right-down and +y to screen left-down', () => {
    expect(worldToSceneX(1, 0)).toBeGreaterThan(0);
    expect(worldToSceneY(1, 0)).toBeLessThan(0);
    expect(worldToSceneX(0, 1)).toBeLessThan(0);
    expect(worldToSceneY(0, 1)).toBeLessThan(0);
  });
});

describe('draw order', () => {
  it('draws things nearer the viewer (larger x+y) later within a layer', () => {
    expect(sortKey(Layer.OBJECT, 5, 5)).toBeGreaterThan(sortKey(Layer.OBJECT, 4, 4));
    expect(sortKey(Layer.OBJECT, 6, 3)).toBe(sortKey(Layer.OBJECT, 3, 6));
  });

  it('keeps layers strictly separated regardless of position', () => {
    const farthestObject = sortKey(Layer.OBJECT, 1000, 1000);
    expect(sortKey(Layer.FOREGROUND, -1000, -1000)).toBeGreaterThan(farthestObject);
    expect(sortKey(Layer.OBJECT, -1000, -1000)).toBeGreaterThan(sortKey(Layer.GROUND_DECAL, 1000, 1000));
    expect(sortKey(Layer.GROUND_DECAL, -1000, -1000)).toBeGreaterThan(sortKey(Layer.GROUND, 1000, 1000));
  });

  it('puts the player behind a crate when north of it and in front when south of it', () => {
    const crate = { position: { x: 0, y: 0 }, renderOrder: 0 };
    const behind = { position: { x: 0, y: 0 }, renderOrder: 0 };
    const front = { position: { x: 0, y: 0 }, renderOrder: 0 };
    placeAt(crate, Layer.OBJECT, 10.5, 10.5);
    placeAt(behind, Layer.OBJECT, 10.5, 9.8); // smaller x+y
    placeAt(front, Layer.OBJECT, 10.5, 11.2); // larger x+y
    expect(behind.renderOrder).toBeLessThan(crate.renderOrder);
    expect(front.renderOrder).toBeGreaterThan(crate.renderOrder);
  });
});
