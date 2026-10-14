import { MAX_MOVE_STEP } from '../config/gameConfig';
import type { Vec2 } from '../game/iso';
import type { PoisonDef, SlowDef } from '../data/monsters';
import type { Monster } from './Monster';
import type { CollisionSystem } from '../systems/CollisionSystem';

/** What a shot does to whoever it hits, beyond its damage (a monster's shots take these from its definition). */
export interface ShotEffects {
  poison?: PoisonDef;
  slow?: SlowDef;
  /** Colour of the shot (0xRRGGBB). */
  tint?: number;
}

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
  /** Who fired it (so elite effects like lifesteal apply when it hits). */
  owner: Monster | null = null;
  /** Effects of its own (a trap's arrow); a shot without them uses its owner's. */
  effects: ShotEffects | null = null;

  launch(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    life: number,
    owner: Monster | null = null,
    effects: ShotEffects | null = null,
  ): void {
    this.owner = owner;
    this.effects = effects;
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
