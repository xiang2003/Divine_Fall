/**
 * Swing timing shared by anything that attacks with a windup: one swing lasts `duration`
 * seconds, damage lands exactly once at `hitFraction` of the way through, and the next swing
 * cannot start until `cooldown` seconds after this one started.
 *
 * Keeping animation, hit moment and cooldown in one object is what guarantees they never drift apart.
 */
export class AttackTimer {
  private cooldownLeft = 0;
  private elapsed = 0;
  private active = false;
  private hitDone = false;
  private swingDuration = 0;
  private hitAt = 0;

  get swinging(): boolean {
    return this.active;
  }
  get canStart(): boolean {
    return !this.active && this.cooldownLeft <= 0;
  }
  /** 0..1 progress through the current swing (0 when idle). */
  get progress(): number {
    return this.active ? Math.min(1, this.elapsed / this.swingDuration) : 0;
  }

  /** Begins a swing. Returns false (and does nothing) if one is running or still cooling down. */
  start(duration: number, cooldown: number, hitFraction: number): boolean {
    if (!this.canStart) return false;
    this.active = true;
    this.hitDone = false;
    this.elapsed = 0;
    this.swingDuration = duration;
    this.hitAt = duration * hitFraction;
    this.cooldownLeft = Math.max(cooldown, duration);
    return true;
  }

  /** Cancels the current swing (e.g. on death or stagger). The cooldown keeps running. */
  cancel(): void {
    this.active = false;
  }

  /** Clears everything, including the cooldown (used on respawn). */
  reset(): void {
    this.active = false;
    this.cooldownLeft = 0;
    this.elapsed = 0;
  }

  /** Advances time. Returns `hit: true` on the single tick the strike moment is crossed, and `finished` when the swing ends. */
  update(dt: number): { hit: boolean; finished: boolean } {
    if (this.cooldownLeft > 0) this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    if (!this.active) return { hit: false, finished: false };
    this.elapsed += dt;
    let hit = false;
    if (!this.hitDone && this.elapsed >= this.hitAt) {
      this.hitDone = true;
      hit = true;
    }
    const finished = this.elapsed >= this.swingDuration;
    if (finished) this.active = false;
    return { hit, finished };
  }
}
