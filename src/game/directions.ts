/** Number of facing directions in the character sheets (tools/prepare_characters.py). */
export const DIRECTION_COUNT = 4;

/** Sheet rows, in order: the figure seen from the front (toward the camera), facing right, from behind, facing left. */
export const Facing = { FRONT: 0, RIGHT: 1, BACK: 2, LEFT: 3 } as const;

/**
 * Which of the 4 facings looks along a world-space vector. World +x runs toward the lower right of the screen and +y toward the
 * lower left, so the screen vector is (dx - dy, (dx + dy) / 2). Walking along a world axis is the common case and lands exactly
 * between two facings, so sideways wins ties: +x and -y face right, +y and -x face left; pure screen up / down give back / front.
 */
export function directionIndex(dx: number, dy: number): number {
  const sx = dx - dy;
  const sy = dx + dy; // twice the screen y; down is positive
  if (Math.abs(sx) >= Math.abs(sy) * 0.9) return sx >= 0 ? Facing.RIGHT : Facing.LEFT;
  return sy > 0 ? Facing.FRONT : Facing.BACK;
}
