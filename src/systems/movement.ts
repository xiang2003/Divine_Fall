import { PLAYER_CONFIG } from '../config/gameConfig';
import type { Vec2 } from '../game/iso';
import type { CollisionSystem } from './CollisionSystem';

/** Seconds of (almost) no progress before a blocked click-to-move gives up. */
const STUCK_TIMEOUT = 0.12;
/** Progress below this fraction of the intended step counts as "no progress". */
const STUCK_PROGRESS_RATIO = 0.3;

/**
 * Click-to-move controller: walks a circle toward a world-space target at constant speed,
 * stopping on arrival or when a wall blocks the way. Pure logic (no rendering), so it is unit-tested.
 */
export class ClickMover {
  /** Unit vector of the most recent movement; unchanged while idle. */
  readonly direction: Vec2 = { x: 0, y: 1 };
  private target: Vec2 | null = null;
  private stuckTime = 0;

  get hasTarget(): boolean {
    return this.target !== null;
  }

  /** Where the mover is heading, or null when idle. Do not mutate. */
  get currentTarget(): Readonly<Vec2> | null {
    return this.target;
  }

  setTarget(x: number, y: number): void {
    this.target ??= { x, y };
    this.target.x = x;
    this.target.y = y;
    this.stuckTime = 0;
  }

  stop(): void {
    this.target = null;
    this.stuckTime = 0;
  }

  /** Advances `pos` toward the target. Returns true if the entity moved this tick. */
  update(pos: Vec2, dt: number, speed: number, radius: number, collision: CollisionSystem): boolean {
    const target = this.target;
    if (!target) return false;
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= PLAYER_CONFIG.arriveDistance) {
      this.stop();
      return false;
    }
    const step = Math.min(speed * dt, dist);
    if (step <= 0) return false;
    this.direction.x = dx / dist;
    this.direction.y = dy / dist;

    const bx = pos.x;
    const by = pos.y;
    collision.moveCircle(pos, radius, this.direction.x * step, this.direction.y * step);
    const moved = Math.hypot(pos.x - bx, pos.y - by);

    if (moved < step * STUCK_PROGRESS_RATIO) {
      this.stuckTime += dt;
      if (this.stuckTime >= STUCK_TIMEOUT) {
        this.stop();
        return false;
      }
    } else {
      this.stuckTime = 0;
    }
    return moved > 0;
  }
}
