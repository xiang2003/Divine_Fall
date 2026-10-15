import { DODGE_CONFIG } from '../config/gameConfig';

/**
 * Dash timing for the dodge: a short burst of movement during which the player cannot be hurt,
 * followed by a cooldown. Pure logic.
 */
export class DodgeController {
  private dashLeft = 0;
  private invulnLeft = 0;
  private cooldownLeft = 0;

  get dashing(): boolean {
    return this.dashLeft > 0;
  }
  get invulnerable(): boolean {
    return this.invulnLeft > 0;
  }
  get ready(): boolean {
    return this.cooldownLeft <= 0 && this.dashLeft <= 0;
  }
  get cooldownRemaining(): number {
    return this.cooldownLeft;
  }
  /** Dash speed in world units per second. */
  get speed(): number {
    return DODGE_CONFIG.distance / DODGE_CONFIG.duration;
  }

  /** Begins a dodge. Returns false if still dashing or cooling down. */
  start(): boolean {
    if (!this.ready) return false;
    this.dashLeft = DODGE_CONFIG.duration;
    this.invulnLeft = DODGE_CONFIG.invulnDuration;
    this.cooldownLeft = DODGE_CONFIG.cooldown;
    return true;
  }

  reset(): void {
    this.dashLeft = 0;
    this.invulnLeft = 0;
    this.cooldownLeft = 0;
  }

  /** Returns the seconds of dash movement to apply this tick (<= dt). */
  update(dt: number): number {
    const dash = Math.min(dt, this.dashLeft);
    this.dashLeft = Math.max(0, this.dashLeft - dt);
    this.invulnLeft = Math.max(0, this.invulnLeft - dt);
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    return dash;
  }
}

/** Timed multipliers granted by legendary effects. Re-triggering refreshes (does not stack) the timer. */
export class Buffs {
  private moveLeft = 0;
  private moveBonus = 0;
  private attackLeft = 0;
  private attackBonus = 0;

  hasteMove(duration: number, bonus: number): void {
    this.moveLeft = duration;
    this.moveBonus = bonus;
  }
  hasteAttack(duration: number, bonus: number): void {
    this.attackLeft = duration;
    this.attackBonus = bonus;
  }

  get moveActive(): boolean {
    return this.moveLeft > 0;
  }
  get attackActive(): boolean {
    return this.attackLeft > 0;
  }

  /** Multiplier applied to move speed (1 = no buff). */
  get moveMultiplier(): number {
    return this.moveLeft > 0 ? 1 + this.moveBonus : 1;
  }
  /** Multiplier applied to attack speed (1 = no buff). */
  get attackSpeedMultiplier(): number {
    return this.attackLeft > 0 ? 1 + this.attackBonus : 1;
  }

  clear(): void {
    this.moveLeft = 0;
    this.attackLeft = 0;
  }

  update(dt: number): void {
    this.moveLeft = Math.max(0, this.moveLeft - dt);
    this.attackLeft = Math.max(0, this.attackLeft - dt);
  }
}
