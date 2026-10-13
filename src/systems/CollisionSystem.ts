import { MAX_MOVE_STEP } from '../config/gameConfig';
import { TileType, tileAt, type MapData, type Rect } from '../data/mapData';
import type { Vec2 } from '../game/iso';

const RESOLVE_ITERATIONS = 4;
const EPSILON = 1e-6;

/**
 * Circle-vs-rectangle collision against the map's wall tiles, void, and prop footprints.
 * Collision data comes only from MapData, never from images.
 * Movement is applied in small sub-steps followed by push-out, which gives wall sliding for free.
 */
export class CollisionSystem {
  private readonly propRects: Rect[];

  /** `extraSolids` are further blocking rectangles (characters that stand still, such as NPCs). */
  constructor(private readonly map: MapData, extraSolids: readonly Rect[] = []) {
    this.propRects = [...map.props.map((p) => p.bounds), ...extraSolids];
  }

  /** True if the tile at (x, y) cannot be walked on. Out of bounds counts as blocked. */
  isTileBlocked(x: number, y: number): boolean {
    return tileAt(this.map, x, y) !== TileType.FLOOR;
  }

  /** True if a circle at (x, y) would overlap anything solid. */
  collidesCircle(x: number, y: number, r: number): boolean {
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r);
    const y1 = Math.floor(y + r);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isTileBlocked(tx, ty) && circleHitsBox(x, y, r, tx, ty, tx + 1, ty + 1)) return true;
      }
    }
    for (const b of this.propRects) {
      if (circleHitsBox(x, y, r, b.minX, b.minY, b.maxX, b.maxY)) return true;
    }
    return false;
  }

  /** True if no wall / void tile lies on the straight segment between two points (props don't block sight). */
  hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist / 0.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.isTileBlocked(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t))) return false;
    }
    return true;
  }

  /**
   * Moves a circle from `pos` by (dx, dy), stopping at / sliding along solids.
   * Writes the result into `pos` and returns it (no allocation).
   */
  moveCircle(pos: Vec2, r: number, dx: number, dy: number): Vec2 {
    const dist = Math.hypot(dx, dy);
    if (dist < EPSILON) return pos;
    const steps = Math.max(1, Math.ceil(dist / MAX_MOVE_STEP));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      pos.x += sx;
      pos.y += sy;
      this.pushOut(pos, r);
    }
    return pos;
  }

  /** Resolves any overlap by pushing the circle out of solids. */
  pushOut(pos: Vec2, r: number): void {
    for (let iter = 0; iter < RESOLVE_ITERATIONS; iter++) {
      let moved = false;
      const x0 = Math.floor(pos.x - r);
      const x1 = Math.floor(pos.x + r);
      const y0 = Math.floor(pos.y - r);
      const y1 = Math.floor(pos.y + r);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (this.isTileBlocked(tx, ty) && separate(pos, r, tx, ty, tx + 1, ty + 1)) moved = true;
        }
      }
      for (const b of this.propRects) {
        if (separate(pos, r, b.minX, b.minY, b.maxX, b.maxY)) moved = true;
      }
      if (!moved) return;
    }
  }
}

function circleHitsBox(cx: number, cy: number, r: number, minX: number, minY: number, maxX: number, maxY: number): boolean {
  const nx = Math.min(maxX, Math.max(minX, cx));
  const ny = Math.min(maxY, Math.max(minY, cy));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/** Pushes the circle out of the box if overlapping. Returns true if it moved. */
function separate(pos: Vec2, r: number, minX: number, minY: number, maxX: number, maxY: number): boolean {
  const nx = Math.min(maxX, Math.max(minX, pos.x));
  const ny = Math.min(maxY, Math.max(minY, pos.y));
  const dx = pos.x - nx;
  const dy = pos.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;

  if (d2 > EPSILON) {
    const d = Math.sqrt(d2);
    const push = r - d;
    pos.x += (dx / d) * push;
    pos.y += (dy / d) * push;
    return true;
  }
  // Centre is inside the box: leave through the nearest face.
  const left = pos.x - minX;
  const right = maxX - pos.x;
  const top = pos.y - minY;
  const bottom = maxY - pos.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) pos.x = minX - r;
  else if (m === right) pos.x = maxX + r;
  else if (m === top) pos.y = minY - r;
  else pos.y = maxY + r;
  return true;
}
