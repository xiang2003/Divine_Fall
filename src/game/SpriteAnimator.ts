import * as THREE from 'three';
import { AnimationClock } from './AnimationClock';
import type { AssetLoader } from './AssetLoader';

/**
 * Plays spritesheet animations on a quad. Knows nothing about players or monsters:
 * animations come from the sprite's manifest entry (frame size, rows, fps, loop).
 * Each animator owns a tiny geometry so it can rewrite UVs per frame while sharing
 * the texture and material.
 */
export class SpriteAnimator {
  readonly mesh: THREE.Mesh;
  private readonly clock: AnimationClock;
  private readonly geometry: THREE.BufferGeometry;
  private shownCol = 0;
  private shownRow = 0;
  private speed = 1;
  private baseScale = 1;
  private flipped = false;

  constructor(
    private readonly loader: AssetLoader,
    private readonly key: string,
    initialAnimation: string,
    onComplete?: (animation: string) => void,
  ) {
    const def = loader.def(key);
    if (!def.animations) throw new Error(`Sprite "${key}" has no animations`);
    this.clock = new AnimationClock(def.animations, initialAnimation, onComplete);
    this.geometry = loader.createGeometry(key, 0, this.clock.row);
    this.shownRow = this.clock.row;
    this.mesh = new THREE.Mesh(this.geometry, loader.material(key));
  }

  get animation(): string {
    return this.clock.name;
  }

  play(name: string, restart = false): void {
    this.clock.play(name, restart);
    this.applyFrame();
  }

  /** Natural length in seconds of one run of an animation (frames / fps). */
  durationOf(name: string): number {
    const d = this.loader.def(this.key).animations?.[name];
    if (!d) throw new Error(`Unknown animation "${name}" on "${this.key}"`);
    return d.frames / d.fps;
  }

  /** Playback speed multiplier (1 = as authored). Used to fit an animation to a gameplay duration. */
  setSpeed(multiplier: number): void {
    this.speed = multiplier;
  }

  get isFinished(): boolean {
    return this.clock.isFinished;
  }

  setFlipX(flip: boolean): void {
    this.flipped = flip;
    this.mesh.scale.x = flip ? -this.baseScale : this.baseScale;
  }

  /** Uniform size multiplier (elites and bosses are drawn larger). Keeps the current mirroring. */
  setScale(scale: number): void {
    this.baseScale = scale;
    this.mesh.scale.set(this.flipped ? -scale : scale, scale, 1);
  }

  update(dt: number): void {
    this.clock.update(dt * this.speed);
    this.applyFrame();
  }

  dispose(): void {
    this.geometry.dispose();
  }

  private applyFrame(): void {
    const col = this.clock.frame;
    const row = this.clock.row;
    if (col === this.shownCol && row === this.shownRow) return;
    this.shownCol = col;
    this.shownRow = row;
    this.loader.setFrameUv(this.geometry, this.key, col, row);
  }
}
