import { TILE_H, TILE_W } from '../config/gameConfig';

/**
 * Isometric helpers. World space is a flat grid where 1 unit = 1 tile; +x runs
 * to screen right-down and +y to screen left-down (so larger x+y is nearer the viewer).
 * Scene space is the Three.js plane the orthographic camera looks at (1 unit = 1 art pixel, +y up).
 */

export interface Vec2 {
  x: number;
  y: number;
}

export function worldToSceneX(wx: number, wy: number): number {
  return (wx - wy) * (TILE_W / 2);
}

export function worldToSceneY(wx: number, wy: number): number {
  return -(wx + wy) * (TILE_H / 2);
}

export function sceneToWorld(sx: number, sy: number, out: Vec2): Vec2 {
  const a = sx / (TILE_W / 2); // wx - wy
  const b = -sy / (TILE_H / 2); // wx + wy
  out.x = (a + b) / 2;
  out.y = (b - a) / 2;
  return out;
}

/** Draw layers, back to front. Within OBJECT, depth is decided by the foot position. */
export const Layer = {
  GROUND: 0,
  GROUND_DECAL: 1,
  OBJECT: 2,
  FOREGROUND: 3,
} as const;
export type Layer = (typeof Layer)[keyof typeof Layer];

const LAYER_STRIDE = 1_000_000;
const DEPTH_SCALE = 100;
const MAX_DEPTH_KEY = LAYER_STRIDE - 1;

/**
 * Single rule for draw order: renderOrder = layer * 1e6 + (wx + wy) * 100 (+ a fixed offset
 * so negative positions stay positive). `wx`/`wy` must be the sprite's foot (ground contact)
 * position in world units. Materials are drawn with depthTest off, so this value alone decides ordering.
 */
export function sortKey(layer: Layer, wx: number, wy: number): number {
  const depth = Math.round((wx + wy) * DEPTH_SCALE) + LAYER_STRIDE / 2;
  const clamped = Math.min(MAX_DEPTH_KEY, Math.max(0, depth));
  return layer * LAYER_STRIDE + clamped;
}

/** Anything with a Three.js-style position and renderOrder. */
export interface Placeable {
  position: { x: number; y: number };
  renderOrder: number;
}

/** Puts an object's pivot at the given world position and assigns its draw order. */
export function placeAt(obj: Placeable, layer: Layer, wx: number, wy: number): void {
  obj.position.x = worldToSceneX(wx, wy);
  obj.position.y = worldToSceneY(wx, wy);
  obj.renderOrder = sortKey(layer, wx, wy);
}
