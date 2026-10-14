import * as THREE from 'three';
import type { AssetLoader } from './AssetLoader';
import { DIRECTION_COUNT, Facing, directionIndex } from './directions';

export type DirectionalPose = 'idle' | 'walk' | 'attack' | 'hurt' | 'die';

/** Frames in a character sheet's idle (breathing) cycle; each facing is one row of this many columns. */
export const IDLE_FRAMES = 4;
const IDLE_FPS = 3;

/** Natural length of the one-shot poses in "animation seconds"; the player scales it with setSpeed like any animator. */
const ATTACK_LENGTH = 1;
const HURT_LENGTH = 0.3;
const DIE_LENGTH = 0.8;

/** The attack steps forward this far (scene pixels) at its peak, and leans this far (radians). */
const LUNGE_PIXELS = 6;
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
  private shown = { col: -1, row: -1 };
  /** Screen-space offset applied on top of the placed position (the hop, the lunge, the recoil). */
  offsetX = 0;
  offsetY = 0;
  private lungeX = 0;
  private lungeY = 0;

  constructor(
    private readonly loader: AssetLoader,
    private readonly key: string,
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
    if (!['idle', 'walk', 'attack', 'hurt', 'die'].includes(pose)) return;
    if (pose === this.pose && !restart) return;
    this.pose = pose;
    this.time = 0;
  }

  /** Natural length of a pose in animation seconds (walk and idle loop, so they have no end). */
  durationOf(name: string): number {
    if (name === 'attack') return ATTACK_LENGTH;
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
    this.mesh.scale.set(scale, scale, 1);
  }

  /** Tints the figure red while the player has just been hit. */
  setHurtFlash(on: boolean): void {
    if (on === this.hurtFlash) return;
    this.hurtFlash = on;
    this.material.color.setRGB(1, on ? 0.5 : 1, on ? 0.5 : 1);
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
      case 'attack': {
        const lean = Math.sin(this.progress(ATTACK_LENGTH) * Math.PI);
        this.offsetX = this.lungeX * LUNGE_PIXELS * lean;
        this.offsetY = this.lungeY * LUNGE_PIXELS * lean * 0.5;
        // lean toward the side the figure faces (screen right is a clockwise turn, so a negative angle)
        rotation = -this.lungeX * ATTACK_LEAN * lean;
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
    this.material.opacity = alpha;
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
