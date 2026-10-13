import * as THREE from 'three';
import type { AssetLoader } from './AssetLoader';
import { DIRECTION_COUNT, directionIndex } from './directions';

export type DirectionalPose = 'idle' | 'walk' | 'attack' | 'hurt' | 'die';

/** Frames in the run cycle of the character sheets. */
export const RUN_FRAMES = 10;
const RUN_FPS = 12;
/** Natural length of the attack and death poses in "animation seconds"; the player scales it with setSpeed like any animator. */
const ATTACK_LENGTH = 1;
const DIE_LENGTH = 0.8;
/** The run frame held during an attack (a wide stride, leaning into the swing). */
const ATTACK_FRAME = 4;

/** Anchor of the figure's feet is at the bottom of the frame; these offsets are in scene pixels. */
const LUNGE_PIXELS = 7;

/**
 * Draws a character that has 8 facing directions (instead of one picture mirrored): an idle sheet (one frame per direction)
 * and, optionally, a run sheet (one row per direction). It offers the same calls as SpriteAnimator (`play`, `durationOf`,
 * `setSpeed`, `update`, `mesh`) so the player can swap one for the other, plus `setFacingWorld`.
 *
 * The art has no attack, hurt or death frames, so those are acted out: the attack lunges forward in a wide run stride,
 * a hit flashes the figure red, and death topples it sideways and fades it.
 */
export class DirectionalAnimator {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly idleMaterial: THREE.MeshBasicMaterial;
  private readonly runMaterial: THREE.MeshBasicMaterial | null;
  private pose: DirectionalPose = 'idle';
  private time = 0;
  private speed = 1;
  private direction = 3;
  private hurtFlash = false;
  private shown = { key: '', col: -1, row: -1 };
  /** Screen-space offset applied on top of the placed position (the lunge). */
  offsetX = 0;
  offsetY = 0;
  private lungeX = 0;
  private lungeY = 0;

  constructor(
    private readonly loader: AssetLoader,
    private readonly idleKey: string,
    private readonly runKey: string | null = null,
  ) {
    this.geometry = loader.createGeometry(idleKey, 0, 0);
    this.idleMaterial = loader.material(idleKey).clone();
    this.runMaterial = runKey ? loader.material(runKey).clone() : null;
    this.mesh = new THREE.Mesh(this.geometry, this.idleMaterial);
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
    if (pose === this.pose && !restart) return;
    this.pose = pose;
    this.time = 0;
  }

  /** Natural length of a pose in animation seconds (a run loop and idle are open ended). */
  durationOf(name: string): number {
    if (name === 'attack') return ATTACK_LENGTH;
    if (name === 'die') return DIE_LENGTH;
    return 1;
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  /** Mirroring is not used: every direction has its own picture. Kept so callers need not care. */
  setFlipX(_flip: boolean): void {}

  setScale(scale: number): void {
    this.mesh.scale.set(scale, scale, 1);
  }

  /** Tints the figure red while the player has just been hit. */
  setHurtFlash(on: boolean): void {
    if (on === this.hurtFlash) return;
    this.hurtFlash = on;
    for (const m of [this.idleMaterial, this.runMaterial]) m?.color.setRGB(1, on ? 0.5 : 1, on ? 0.5 : 1);
  }

  update(dt: number): void {
    this.time += dt * this.speed;
    this.apply();
  }

  /** Progress 0..1 of a one-shot pose. */
  private progress(length: number): number {
    return Math.min(1, this.time / length);
  }

  private apply(): void {
    let key = this.idleKey;
    let col = this.direction;
    let row = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.mesh.rotation.z = 0;
    let alpha = 1;

    switch (this.pose) {
      case 'walk':
        if (this.runKey) {
          key = this.runKey;
          col = Math.floor(this.time * RUN_FPS) % RUN_FRAMES;
          row = this.direction;
        }
        break;
      case 'attack': {
        if (this.runKey) {
          key = this.runKey;
          col = ATTACK_FRAME;
          row = this.direction;
        }
        const p = this.progress(ATTACK_LENGTH);
        const lunge = Math.sin(p * Math.PI);
        this.offsetX = this.lungeX * LUNGE_PIXELS * lunge;
        this.offsetY = this.lungeY * LUNGE_PIXELS * lunge * 0.5;
        break;
      }
      case 'hurt':
        this.offsetX = -this.lungeX * 2;
        this.offsetY = -this.lungeY;
        break;
      case 'die': {
        const p = this.progress(DIE_LENGTH);
        const eased = 1 - Math.pow(1 - p, 2);
        // topple toward the side the figure faces, then lie there
        this.mesh.rotation.z = (this.lungeX >= 0 ? -1 : 1) * eased * (Math.PI / 2);
        this.offsetY = -eased * 5;
        alpha = 1 - 0.2 * eased;
        break;
      }
      default:
        break;
    }

    const material = key === this.runKey && this.runMaterial ? this.runMaterial : this.idleMaterial;
    if (this.mesh.material !== material) this.mesh.material = material;
    material.opacity = alpha;
    if (this.shown.key !== key || this.shown.col !== col || this.shown.row !== row) {
      this.shown = { key, col, row };
      this.loader.setFrameUv(this.geometry, key, col, row);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.idleMaterial.dispose();
    this.runMaterial?.dispose();
  }
}

export { DIRECTION_COUNT };
