/** Number of facing directions in the character sheets (tools/prepare_characters.py). */
export const DIRECTION_COUNT = 8;

/**
 * Which of the 8 directions of a character sheet looks along a world-space vector.
 * Sheet order, seen from the isometric camera: 0 back-right, 1 right, 2 front-right, 3 front (toward the camera),
 * 4 front-left, 5 left, 6 back-left, 7 back (away from the camera).
 * World +x runs toward the lower right of the screen and +y toward the lower left.
 */
export function directionIndex(dx: number, dy: number): number {
  const screenX = dx - dy;
  const screenY = (dx + dy) / 2; // down is positive
  const degrees = (Math.atan2(screenY, screenX) * 180) / Math.PI;
  const step = Math.round(degrees / 45); // -4 .. 4, 0 = screen right, 2 = screen down
  return (((step + 1) % DIRECTION_COUNT) + DIRECTION_COUNT) % DIRECTION_COUNT;
}
