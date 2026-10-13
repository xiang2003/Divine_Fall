import { LEVEL_BONUS, MAX_LEVEL, xpToNextLevel } from '../data/progression';

export interface ProgressionState {
  level: number;
  /** Experience gathered toward the next level (not a lifetime total). */
  xp: number;
}

/** Flat stat bonuses a character of this level gets on top of the level-1 base. */
export function levelBonus(level: number): { maxHp: number; damage: number; armor: number } {
  const steps = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  return {
    maxHp: LEVEL_BONUS.maxHp * steps,
    damage: LEVEL_BONUS.damage * steps,
    armor: LEVEL_BONUS.armor * steps,
  };
}

/** Level and experience bookkeeping. Pure logic, no rendering. */
export class Progression {
  level = 1;
  xp = 0;

  get atMaxLevel(): boolean {
    return this.level >= MAX_LEVEL;
  }

  /** Experience needed for the next level (0 at the cap). */
  get xpToNext(): number {
    return xpToNextLevel(this.level);
  }

  /**
   * Adds experience, carrying any overflow into the following levels.
   * Returns how many levels were gained. Experience is discarded at the level cap.
   */
  addXp(amount: number): number {
    if (!(amount > 0) || this.atMaxLevel) return 0;
    this.xp += Math.floor(amount);
    let gained = 0;
    while (!this.atMaxLevel && this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      gained++;
    }
    if (this.atMaxLevel) this.xp = 0;
    return gained;
  }

  /** Restores a saved state, clamping anything out of range. */
  setState(state: ProgressionState): void {
    const level = Math.floor(state.level);
    this.level = Number.isFinite(level) ? Math.max(1, Math.min(MAX_LEVEL, level)) : 1;
    const xp = Math.floor(state.xp);
    this.xp = this.atMaxLevel || !Number.isFinite(xp) ? 0 : Math.max(0, Math.min(this.xpToNext - 1, xp));
  }

  getState(): ProgressionState {
    return { level: this.level, xp: this.xp };
  }
}
