import { MAX_MOVE_STEP } from '../config/gameConfig';
import type { Vec2 } from '../game/iso';
import type { CollisionSystem } from '../systems/CollisionSystem';

export type ProjectileOutcome = 'hit' | 'wall' | 'expired' | null;

export interface ProjectileTarget {
  readonly pos: Vec2;
  readonly radius: number;
  readonly isDead: boolean;
}

/** A straight-flying hostile projectile. Pure logic; pooled and rendered by ProjectileSystem. */
export class Projectile {
  active = false;
  readonly pos: Vec2 = { x: 0, y: 0 };
  dirX = 0;
  dirY = 0;
  speed = 0;
  radius = 0.15;
  damage = 0;
  /** Seconds before it disappears on its own. */
  life = 0;

  launch(x: number, y: number, dirX: number, dirY: number, speed: number, damage: number, life: number): void {
    this.active = true;
    this.pos.x = x;
    this.pos.y = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = speed;
    this.damage = damage;
    this.life = life;
  }

  /**
   * Flies for `dt` seconds in sub-steps (so fast shots can't skip over thin walls or the target).
   * Returns what ended its flight this tick, or null if it is still flying.
   */
  update(dt: number, collision: CollisionSystem, target: ProjectileTarget): ProjectileOutcome {
    if (!this.active) return null;
    const dist = this.speed * dt;
    const steps = Math.max(1, Math.ceil(dist / MAX_MOVE_STEP));
    const sx = (this.dirX * dist) / steps;
    const sy = (this.dirY * dist) / steps;
    for (let i = 0; i < steps; i++) {
      this.pos.x += sx;
      this.pos.y += sy;
      if (collision.collidesCircle(this.pos.x, this.pos.y, this.radius)) {
        this.active = false;
        return 'wall';
      }
      if (
        !target.isDead &&
        Math.hypot(target.pos.x - this.pos.x, target.pos.y - this.pos.y) < target.radius + this.radius
      ) {
        this.active = false;
        return 'hit';
      }
    }
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return 'expired';
    }
    return null;
  }
}
