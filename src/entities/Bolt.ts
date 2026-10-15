import { MAX_MOVE_STEP } from '../config/gameConfig';
import type { DamageType } from '../data/damageTypes';
import type { Vec2 } from '../game/iso';
import type { CollisionSystem } from '../systems/CollisionSystem';

export interface BoltTarget {
  readonly pos: Vec2;
  readonly radius: number;
  readonly isDead: boolean;
  /** Hiding (an ambusher under the water): cannot be hit. */
  readonly hidden?: boolean;
}

/**
 * A friendly, piercing projectile fired by a player skill. It flies straight, stops at walls, and hits each
 * enemy at most once as it passes through. Pure logic; pooled and drawn by SkillProjectileSystem.
 */
export class Bolt<T extends BoltTarget = BoltTarget> {
  active = false;
  readonly pos: Vec2 = { x: 0, y: 0 };
  dirX = 0;
  dirY = 0;
  speed = 0;
  radius = 0.25;
  damageMult = 1;
  /** What kind of damage it deals. */
  damageType: DamageType = 'physical';
  life = 0;
  private readonly alreadyHit = new Set<T>();

  launch(x: number, y: number, dirX: number, dirY: number, speed: number, life: number, damageMult: number, damageType: DamageType = 'physical'): void {
    this.active = true;
    this.pos.x = x;
    this.pos.y = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = speed;
    this.life = life;
    this.damageMult = damageMult;
    this.damageType = damageType;
    this.alreadyHit.clear();
  }

  /** Advances the bolt, calling `onHit` once per enemy it newly touches. Returns false once it has ended. */
  update(dt: number, collision: CollisionSystem, targets: Iterable<T>, onHit: (target: T) => void): boolean {
    if (!this.active) return false;
    const dist = this.speed * dt;
    const steps = Math.max(1, Math.ceil(dist / MAX_MOVE_STEP));
    const sx = (this.dirX * dist) / steps;
    const sy = (this.dirY * dist) / steps;
    for (let i = 0; i < steps; i++) {
      this.pos.x += sx;
      this.pos.y += sy;
      if (collision.collidesCircle(this.pos.x, this.pos.y, this.radius)) {
        this.active = false;
        return false;
      }
      for (const t of targets) {
        if (t.isDead || t.hidden || this.alreadyHit.has(t)) continue;
        if (Math.hypot(t.pos.x - this.pos.x, t.pos.y - this.pos.y) < t.radius + this.radius) {
          this.alreadyHit.add(t);
          onHit(t);
        }
      }
    }
    this.life -= dt;
    if (this.life <= 0) this.active = false;
    return this.active;
  }
}
