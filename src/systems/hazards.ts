import type { PoisonDef } from '../data/monsters';
import type { Vec2 } from '../game/iso';

/** Floor spikes: hidden, then a warning (the tips poke up), then up and dangerous, then they sink again. Seconds. */
export const SPIKE_TIMES = { hidden: 2.2, warn: 0.7, up: 0.6 } as const;
export const SPIKE_CYCLE = SPIKE_TIMES.hidden + SPIKE_TIMES.warn + SPIKE_TIMES.up;
/** Damage of one stab (before armor). */
export const SPIKE_DAMAGE = 14;
/** How far past the edge of the tile the player's centre may be and still be stabbed (world units). */
const SPIKE_MARGIN = 0.1;

export type SpikeState = 'hidden' | 'warn' | 'up';

/** The state of spikes `clock` seconds into their (looping) cycle. */
export function spikeStateAt(clock: number): SpikeState {
  const t = ((clock % SPIKE_CYCLE) + SPIKE_CYCLE) % SPIKE_CYCLE;
  if (t < SPIKE_TIMES.hidden) return 'hidden';
  if (t < SPIKE_TIMES.hidden + SPIKE_TIMES.warn) return 'warn';
  return 'up';
}

/** One set of floor spikes. Hurts once per time they are up, to whoever is standing on them or walks onto them while they are up. */
export class SpikeTrap {
  private clock: number;
  private stabbed = false;
  private wasUp = false;

  constructor(
    readonly pos: Vec2,
    phase = 0,
  ) {
    this.clock = phase;
  }

  get state(): SpikeState {
    return spikeStateAt(this.clock);
  }

  /** True when a body with its centre at `at` is on the tile. */
  covers(at: Vec2): boolean {
    return Math.abs(at.x - this.pos.x) <= 0.5 + SPIKE_MARGIN && Math.abs(at.y - this.pos.y) <= 0.5 + SPIKE_MARGIN;
  }

  /** Advances the timer. Returns true when the spikes stab `target` during this tick (at most once per rise). */
  update(dt: number, target: { pos: Vec2; isDead: boolean }): boolean {
    this.clock += dt;
    const up = this.state === 'up';
    if (up && !this.wasUp) this.stabbed = false; // a new rise: they may stab again
    this.wasUp = up;
    if (!up || this.stabbed || target.isDead || !this.covers(target.pos)) return false;
    this.stabbed = true;
    return true;
  }
}

/** The poisoned arrow of a wall trap. */
export const ARROW_DAMAGE = 7;
export const ARROW_SPEED = 9;
export const ARROW_POISON: PoisonDef = { dps: 3, duration: 4 };
/** An arrow trap sees the corridor in front of its slit: this far, and this wide (half-width, world units). */
export const ARROW_RANGE = 9;
export const ARROW_HALF_WIDTH = 0.6;
/** From the moment it notices the player to the shot (the slit glows meanwhile), and the pause after a shot. Seconds. */
export const ARROW_AIM_TIME = 0.45;
export const ARROW_COOLDOWN = 2.6;

/** True when `target` stands in the lane in front of a slit at `slit` that looks along the unit vector `dir`. */
export function inArrowLane(slit: Vec2, dir: Vec2, target: Vec2): boolean {
  const rx = target.x - slit.x;
  const ry = target.y - slit.y;
  const ahead = rx * dir.x + ry * dir.y;
  const aside = Math.abs(rx * -dir.y + ry * dir.x);
  return ahead > 0.5 && ahead <= ARROW_RANGE && aside <= ARROW_HALF_WIDTH;
}

export type ArrowState = 'idle' | 'aim' | 'rest';

/** A slit in a wall that shoots along the corridor: notices the player in its lane, glows for a moment, shoots, rests. */
export class ArrowTrap {
  private phase: ArrowState = 'idle';
  private timer = 0;

  constructor(
    readonly pos: Vec2,
    readonly dir: Vec2,
  ) {}

  get state(): ArrowState {
    return this.phase;
  }

  /**
   * Advances the trap. `clear` says whether nothing stands between the slit and the player (the arrow would reach them).
   * Returns true on the tick the arrow is shot.
   */
  update(dt: number, target: { pos: Vec2; isDead: boolean }, clear: boolean): boolean {
    switch (this.phase) {
      case 'idle':
        if (!target.isDead && clear && inArrowLane(this.pos, this.dir, target.pos)) {
          this.phase = 'aim';
          this.timer = ARROW_AIM_TIME;
        }
        return false;
      case 'aim':
        this.timer -= dt;
        if (this.timer > 0) return false;
        this.phase = 'rest';
        this.timer = ARROW_COOLDOWN;
        return true; // it shoots even if the player has just left the lane: that is the point of the warning
      case 'rest':
        this.timer -= dt;
        if (this.timer <= 0) this.phase = 'idle';
        return false;
    }
  }
}
