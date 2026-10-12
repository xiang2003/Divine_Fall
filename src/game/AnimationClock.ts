/** Describes one animation inside a spritesheet. Frames are laid out left-to-right on `row`. */
export interface AnimationDef {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export type AnimationSet = Record<string, AnimationDef>;

/**
 * Pure animation timing (no Three.js). Tracks which animation is playing and which
 * frame is current, and reports completion of non-looping animations.
 */
export class AnimationClock {
  private current: string;
  private elapsed = 0;
  private frameIndex = 0;
  private finished = false;

  constructor(
    private readonly animations: AnimationSet,
    initial: string,
    /** Called once when a non-looping animation reaches its last frame's end. */
    private readonly onComplete?: (name: string) => void,
  ) {
    this.def(initial); // validate
    this.current = initial;
  }

  get name(): string {
    return this.current;
  }
  get frame(): number {
    return this.frameIndex;
  }
  get row(): number {
    return this.def(this.current).row;
  }
  get isFinished(): boolean {
    return this.finished;
  }

  /** Switch animation. A no-op if already playing it, unless `restart` is set. */
  play(name: string, restart = false): void {
    this.def(name);
    if (name === this.current && !restart) return;
    this.current = name;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.finished = false;
  }

  /** Advances time. Returns true when the visible frame changed. */
  update(dt: number): boolean {
    if (this.finished) return false;
    const def = this.def(this.current);
    this.elapsed += dt;
    const raw = Math.floor(this.elapsed * def.fps);
    let next: number;
    if (def.loop) {
      next = raw % def.frames;
    } else if (raw >= def.frames) {
      next = def.frames - 1;
      this.finished = true;
    } else {
      next = raw;
    }
    const changed = next !== this.frameIndex;
    this.frameIndex = next;
    if (this.finished) this.onComplete?.(this.current);
    return changed;
  }

  private def(name: string): AnimationDef {
    const d = this.animations[name];
    if (!d) throw new Error(`Unknown animation "${name}"`);
    return d;
  }
}
