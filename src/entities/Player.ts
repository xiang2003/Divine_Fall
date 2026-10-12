import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config/gameConfig';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import { SpriteAnimator } from '../game/SpriteAnimator';
import { AttackTimer } from '../systems/AttackTimer';
import { applyArmor, normalizeInto } from '../systems/combatMath';
import type { CollisionSystem } from '../systems/CollisionSystem';
import { ClickMover } from '../systems/movement';
import type { PlayerStats } from '../systems/stats';

/** Seconds the "hurt" pose shows after a hit (only while standing still). */
const HURT_FLASH = 0.2;

export interface PlayerHooks {
  /** A swing began; (dirX, dirY) is the unit aim direction, `duration` the swing length in seconds. */
  swingStarted?(dirX: number, dirY: number, duration: number): void;
  /** The strike moment of the swing. The combat system resolves who got hit. */
  swingHit?(dirX: number, dirY: number): void;
}

export class Player {
  /** Foot position in world units. */
  readonly pos: Vec2;
  readonly radius = PLAYER_CONFIG.radius;
  readonly group = new THREE.Group();
  readonly mover = new ClickMover();
  hooks: PlayerHooks = {};

  hp: number;
  isDead = false;

  private readonly animator: SpriteAnimator;
  private readonly shadow: THREE.Mesh;
  private readonly attack = new AttackTimer();
  private readonly swingDir: Vec2 = { x: 1, y: 1 };
  private hurtTimer = 0;
  private sinceDamaged = Infinity;

  constructor(
    assets: AssetLoader,
    private readonly collision: CollisionSystem,
    spawn: Vec2,
    /** Live stats object; replace its fields (not the reference) when equipment changes. */
    readonly stats: PlayerStats,
  ) {
    this.pos = { x: spawn.x, y: spawn.y };
    this.hp = stats.maxHp;
    this.animator = new SpriteAnimator(assets, SpriteKey.PLAYER, 'idle');
    this.shadow = new THREE.Mesh(assets.sharedGeometry(SpriteKey.SHADOW), assets.material(SpriteKey.SHADOW));
    this.group.add(this.shadow, this.animator.mesh);
    this.syncVisuals();
  }

  get isSwinging(): boolean {
    return this.attack.swinging;
  }

  /** Walk toward a world position (click-to-move). Ignored while dead or mid-swing. */
  moveTo(x: number, y: number): void {
    if (this.isDead || this.attack.swinging) return;
    this.mover.setTarget(x, y);
  }

  /**
   * Starts a melee swing toward a world position. Returns false if dead, already swinging or
   * still on cooldown. The swing stops the player in place.
   */
  startAttack(aimX: number, aimY: number): boolean {
    if (this.isDead || !this.attack.canStart) return false;
    normalizeInto(aimX - this.pos.x, aimY - this.pos.y, this.swingDir, this.swingDir.x, this.swingDir.y);

    const cooldown = 1 / this.stats.attackSpeed;
    const animLength = this.animator.durationOf('attack');
    // The swing never outlasts the cooldown; at high attack speed the animation is sped up to match.
    const duration = Math.min(animLength, cooldown);
    this.attack.start(duration, cooldown, PLAYER_CONFIG.attackHitFraction);
    this.animator.setSpeed(animLength / duration);
    this.animator.play('attack', true);
    this.mover.stop();
    this.faceWorld(this.swingDir.x, this.swingDir.y);
    this.hooks.swingStarted?.(this.swingDir.x, this.swingDir.y, duration);
    return true;
  }

  /** Applies a hit (armor is applied here). Returns the damage actually taken and whether it was fatal. */
  takeDamage(rawDamage: number): { amount: number; died: boolean } {
    if (this.isDead) return { amount: 0, died: false };
    const amount = applyArmor(rawDamage, this.stats.armor);
    this.hp = Math.max(0, this.hp - amount);
    this.sinceDamaged = 0;
    this.hurtTimer = HURT_FLASH;
    if (this.hp > 0) return { amount, died: false };

    this.isDead = true;
    this.attack.cancel();
    this.mover.stop();
    this.animator.setSpeed(1);
    this.animator.play('die', true);
    return { amount, died: true };
  }

  /** Brings the player back at `spawn` with full health. */
  respawn(spawn: Vec2): void {
    this.pos.x = spawn.x;
    this.pos.y = spawn.y;
    this.hp = this.stats.maxHp;
    this.isDead = false;
    this.hurtTimer = 0;
    this.sinceDamaged = Infinity;
    this.attack.reset();
    this.mover.stop();
    this.animator.setSpeed(1);
    this.animator.play('idle', true);
    this.syncVisuals();
  }

  update(dt: number): void {
    if (this.isDead) {
      this.animator.update(dt);
      this.syncVisuals();
      return;
    }

    this.sinceDamaged += dt;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.sinceDamaged > PLAYER_CONFIG.regenDelay && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + PLAYER_CONFIG.regenPerSecond * dt);
    }

    const swing = this.attack.update(dt);
    if (swing.hit) this.hooks.swingHit?.(this.swingDir.x, this.swingDir.y);
    if (swing.finished) this.animator.setSpeed(1);

    let moving = false;
    if (!this.attack.swinging) {
      moving = this.mover.update(this.pos, dt, this.stats.moveSpeed, this.radius, this.collision);
      if (moving) this.faceWorld(this.mover.direction.x, this.mover.direction.y);
      this.animator.play(moving ? 'walk' : this.hurtTimer > 0 ? 'hurt' : 'idle');
    }
    this.animator.update(dt);
    this.syncVisuals();
  }

  private faceWorld(dx: number, dy: number): void {
    const screenX = dx - dy;
    if (Math.abs(screenX) > 1e-3) this.animator.setFlipX(screenX < 0);
  }

  private syncVisuals(): void {
    // Two separate meshes, both positioned at the feet. The shadow is in the ground-decal
    // layer so it never sorts over walls; the body is in the object layer sorted by depth.
    placeAt(this.shadow, Layer.GROUND_DECAL, this.pos.x, this.pos.y);
    placeAt(this.animator.mesh, this.isDead ? Layer.GROUND_DECAL : Layer.OBJECT, this.pos.x, this.pos.y);
    this.shadow.visible = !this.isDead;
  }

  dispose(): void {
    this.animator.dispose();
    this.group.clear();
  }
}
