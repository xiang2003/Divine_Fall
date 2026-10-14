import * as THREE from 'three';
import type { AssetLoader } from './AssetLoader';
import type { AttackStyle } from '../data/monsters';
import { DIRECTION_COUNT, Facing, directionIndex } from './directions';

export type DirectionalPose = 'idle' | 'walk' | 'attack' | 'hurt' | 'die' | 'roll';

/**
 * A character sheet has one row per facing: first the idle (breathing) frames, then the frames of the dodge roll
 * (tools/prepare_sprites.py draws both).
 */
export const IDLE_FRAMES = 4;
export const ROLL_FRAMES = 8;
const IDLE_FPS = 3;

/** Natural length of the one-shot poses in "animation seconds"; the player scales it with setSpeed like any animator. */
const ATTACK_LENGTH = 1;
const ROLL_LENGTH = 1;
const HURT_LENGTH = 0.3;
const DIE_LENGTH = 0.8;

/** The attack steps forward this far (scene pixels) at its peak, and leans this far (radians). */
/** The roll hops up this far (scene pixels) in the middle of the tumble. */
const ROLL_HOP = 4;
const LUNGE_PIXELS = 6;
/** The pounce: the crouch ends and the spring starts here (fractions of the attack), and the hop's height in scene pixels. */
const POUNCE_CROUCH = 0.35;
const POUNCE_LAND = 0.7;
const POUNCE_HOP = 9;
/** The spit: the head rears back until here, strikes forward by the end of the next stretch, then settles. */
const SPIT_REAR = 0.45;
const SPIT_STRIKE = 0.6;
const ATTACK_LEAN = 0.16;
/** Walking: steps per second, how high the body hops (scene pixels) and how far it sways (radians). */
const WALK_HZ = 2.2;
const WALK_HOP = 2.4;
const WALK_SWAY = 0.045;

/**
 * Draws a character that has 4 facings (front, right, back, left): one sheet with a row per facing. Every facing has its own
 * picture, so nothing is mirrored at run time. The art only has a breathing idle cycle; the other poses are acted out by moving
 * the picture: walking hops and sways, an attack lunges and leans into the swing, a hit flashes the figure red and pushes it back,
 * and death topples it sideways and fades it. It offers the same calls as SpriteAnimator (`play`, `durationOf`, `setSpeed`,
 * `update`, `mesh`) so the player can swap one for the other, plus `setFacingWorld`.
 */
export class DirectionalAnimator {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private pose: DirectionalPose = 'idle';
  private time = 0;
  private speed = 1;
  private direction: number = Facing.FRONT;
  private hurtFlash = false;
  private poisoned = false;
  private baseScale = 1;
  private fade = 1;
  private shown = { col: -1, row: -1 };
  /** Screen-space offset applied on top of the placed position (the hop, the lunge, the recoil). */
  offsetX = 0;
  offsetY = 0;
  private lungeX = 0;
  private lungeY = 0;

  constructor(
    private readonly loader: AssetLoader,
    private readonly key: string,
    /** How the attack pose is acted out (the hero and the NPCs lunge). */
    private readonly attackStyle: AttackStyle = 'lunge',
  ) {
    this.geometry = loader.createGeometry(key, 0, 0);
    this.material = loader.material(key).clone();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.apply();
  }

  /** Turns to look along a world-space vector. */
  setFacingWorld(dx: number, dy: number): void {
    if (Math.abs(dx) + Math.abs(dy) < 1e-4) return;
    this.direction = directionIndex(dx, dy);
    // the screen-space direction of the lunge: toward where the figure looks
    const sx = dx - dy;
    const sy = (dx + dy) / 2;
    const len = Math.hypot(sx, sy) || 1;
    this.lungeX = sx / len;
    this.lungeY = -sy / len; // scene y points up
  }

  play(name: string, restart = false): void {
    const pose = name as DirectionalPose;
    if (!['idle', 'walk', 'attack', 'hurt', 'die', 'roll'].includes(pose)) return;
    if (pose === this.pose && !restart) return;
    this.pose = pose;
    this.time = 0;
  }

  /** Natural length of a pose in animation seconds (walk and idle loop, so they have no end). */
  durationOf(name: string): number {
    if (name === 'attack') return ATTACK_LENGTH;
    if (name === 'roll') return ROLL_LENGTH;
    if (name === 'hurt') return HURT_LENGTH;
    if (name === 'die') return DIE_LENGTH;
    return 1;
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  /** Mirroring is not used: every facing has its own picture. Kept so callers need not care. */
  setFlipX(_flip: boolean): void {}

  setScale(scale: number): void {
    this.baseScale = scale;
    this.mesh.scale.set(scale, scale, 1);
  }

  /** Tints the figure red while it has just been hit. */
  setHurtFlash(on: boolean): void {
    if (on === this.hurtFlash) return;
    this.hurtFlash = on;
    this.applyTint();
  }

  /** Tints the figure green while it is poisoned (a hit flash takes precedence). */
  setPoisoned(on: boolean): void {
    if (on === this.poisoned) return;
    this.poisoned = on;
    this.applyTint();
  }

  /** Multiplies the figure's opacity (a corpse fading away); 1 is fully visible. */
  setFade(fade: number): void {
    this.fade = fade;
  }

  private applyTint(): void {
    if (this.hurtFlash) this.material.color.setRGB(1, 0.5, 0.5);
    else if (this.poisoned) this.material.color.setRGB(0.62, 1, 0.62);
    else this.material.color.setRGB(1, 1, 1);
  }

  update(dt: number): void {
    this.time += dt * this.speed;
    this.apply();
  }

  private progress(length: number): number {
    return Math.min(1, this.time / length);
  }

  private apply(): void {
    let col = 0;
    let rotation = 0;
    let alpha = 1;
    let squash = 1; // vertical scale (a crouch), with the width growing a little as it shrinks
    this.offsetX = 0;
    this.offsetY = 0;

    switch (this.pose) {
      case 'idle':
        col = Math.floor(this.time * IDLE_FPS) % IDLE_FRAMES;
        break;
      case 'walk': {
        const phase = this.time * WALK_HZ * Math.PI * 2;
        this.offsetY = Math.abs(Math.sin(phase)) * WALK_HOP;
        rotation = Math.sin(phase) * WALK_SWAY;
        break;
      }
      case 'roll': {
        // the tumble: one baked frame per step, with a small hop through the middle of it
        const p = this.progress(ROLL_LENGTH);
        col = IDLE_FRAMES + Math.min(ROLL_FRAMES - 1, Math.floor(p * ROLL_FRAMES));
        this.offsetY = Math.sin(p * Math.PI) * ROLL_HOP;
        break;
      }
      case 'attack': {
        const p = this.progress(ATTACK_LENGTH);
        if (this.attackStyle === 'pounce') {
          if (p < POUNCE_CROUCH) {
            // crouch: sink and draw back a little
            const c = p / POUNCE_CROUCH;
            squash = 1 - 0.14 * c;
            this.offsetX = -this.lungeX * 2.5 * c;
            this.offsetY = -this.lungeY * 1.2 * c;
          } else if (p < POUNCE_LAND) {
            // in the air: an arc, stretched forward and leaning into the leap (the monster itself moves on the ground)
            const a = (p - POUNCE_CROUCH) / (POUNCE_LAND - POUNCE_CROUCH);
            this.offsetY = Math.sin(a * Math.PI) * POUNCE_HOP;
            rotation = -this.lungeX * 0.22 * Math.sin(a * Math.PI);
            squash = 0.96;
          } else {
            const r = (p - POUNCE_LAND) / (1 - POUNCE_LAND);
            squash = 0.9 + 0.1 * r; // lands and rises
          }
        } else if (this.attackStyle === 'spit') {
          if (p < SPIT_REAR) {
            // rear back: lean away and rise
            const r = p / SPIT_REAR;
            this.offsetX = -this.lungeX * 3 * r;
            this.offsetY = 2.5 * r;
            rotation = this.lungeX * 0.14 * r;
            squash = 1 + 0.06 * r;
          } else if (p < SPIT_STRIKE) {
            // strike: snap forward
            const s = (p - SPIT_REAR) / (SPIT_STRIKE - SPIT_REAR);
            this.offsetX = this.lungeX * (-3 + 8 * s);
            this.offsetY = 2.5 * (1 - s);
            rotation = -this.lungeX * 0.2 * s;
            squash = 1.06 - 0.12 * s;
          } else {
            const r = (p - SPIT_STRIKE) / (1 - SPIT_STRIKE);
            this.offsetX = this.lungeX * 5 * (1 - r);
            rotation = -this.lungeX * 0.2 * (1 - r);
            squash = 0.94 + 0.06 * r;
          }
        } else {
          const lean = Math.sin(p * Math.PI);
          this.offsetX = this.lungeX * LUNGE_PIXELS * lean;
          this.offsetY = this.lungeY * LUNGE_PIXELS * lean * 0.5;
          // lean toward the side the figure faces (screen right is a clockwise turn, so a negative angle)
          rotation = -this.lungeX * ATTACK_LEAN * lean;
        }
        break;
      }
      case 'hurt': {
        const recoil = 1 - this.progress(HURT_LENGTH);
        this.offsetX = -this.lungeX * 3 * recoil;
        this.offsetY = -this.lungeY * 1.5 * recoil;
        rotation = this.lungeX * 0.07 * recoil;
        break;
      }
      case 'die': {
        const eased = 1 - Math.pow(1 - this.progress(DIE_LENGTH), 2);
        // topple toward the side the figure faces, sink a little, fade a little
        rotation = (this.lungeX >= 0 ? -1 : 1) * eased * (Math.PI / 2);
        this.offsetY = -eased * 3;
        alpha = 1 - 0.2 * eased;
        break;
      }
    }

    this.mesh.rotation.z = rotation;
    this.mesh.scale.set(this.baseScale * (1 + (1 - squash) * 0.5), this.baseScale * squash, 1);
    this.material.opacity = alpha * this.fade;
    const row = this.direction;
    if (this.shown.col !== col || this.shown.row !== row) {
      this.shown = { col, row };
      this.loader.setFrameUv(this.geometry, this.key, col, row);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export { DIRECTION_COUNT };
