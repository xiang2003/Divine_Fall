import * as THREE from 'three';
import type { AssetLoader } from './AssetLoader';
import { DIRECTION_COUNT, Facing, directionIndex } from './directions';

export type DirectionalPose = 'idle' | 'walk' | 'attack' | 'hurt' | 'die';

/**
 * Columns of a character sheet (24 columns x 4 rows of 32 px frames, one row per facing; see tools/prepare_characters.py)
 * that make up each pose, and how fast they play.
 */
export const POSE_FRAMES: Record<DirectionalPose, { frames: readonly number[]; fps: number }> = {
  idle: { frames: [0, 1], fps: 2.5 },
  walk: { frames: [2, 0, 3, 1], fps: 8 },
  attack: { frames: [4, 5, 6, 7], fps: 0 }, // one-shot: spread over the pose length
  hurt: { frames: [19, 20, 20], fps: 0 },
  die: { frames: [21, 22, 23], fps: 0 },
};

/** Natural length of the one-shot poses in "animation seconds"; the player scales it with setSpeed like any animator. */
const ATTACK_LENGTH = 1;
const HURT_LENGTH = 0.3;
const DIE_LENGTH = 0.8;

/** The attack steps forward this far (scene pixels) at its peak. */
const LUNGE_PIXELS = 4;

/**
 * Draws a character that has 4 facings (front, right, back, left): one sheet with a row per facing. It offers the same calls as
 * SpriteAnimator (`play`, `durationOf`, `setSpeed`, `update`, `mesh`) so the player can swap one for the other, plus
 * `setFacingWorld`. Every facing has its own picture, so nothing is mirrored.
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
  /** Screen-space offset applied on top of the placed position (the lunge). */
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
    if (!(pose in POSE_FRAMES)) return;
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

  /** The column to show: looping poses cycle at their fps, one-shot poses spread their frames over the pose length. */
  private column(): number {
    const { frames, fps } = POSE_FRAMES[this.pose];
    if (fps > 0) return frames[Math.floor(this.time * fps) % frames.length]!;
    const length = this.durationOf(this.pose);
    const progress = Math.min(0.999, this.time / length);
    return frames[Math.floor(progress * frames.length)]!;
  }

  private apply(): void {
    const col = this.column();
    const row = this.direction;
    this.offsetX = 0;
    this.offsetY = 0;
    if (this.pose === 'attack') {
      const lunge = Math.sin(Math.min(1, this.time / ATTACK_LENGTH) * Math.PI);
      this.offsetX = this.lungeX * LUNGE_PIXELS * lunge;
      this.offsetY = this.lungeY * LUNGE_PIXELS * lunge * 0.5;
    }
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
