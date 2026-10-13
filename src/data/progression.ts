/** Character progression tunables. All numbers here are untuned placeholders. */

export const MAX_LEVEL = 20;

/** Experience needed to go from `level` to `level + 1` is round(XP_BASE * level ^ XP_EXPONENT). */
export const XP_BASE = 30;
export const XP_EXPONENT = 1.5;

/** Stat gain for every level above 1. */
export const LEVEL_BONUS = {
  maxHp: 10,
  damage: 1,
  armor: 1,
} as const;

/** Elites are worth this many times their base monster's experience. */
export const ELITE_XP_MULT = 3;

/** Experience needed to reach the next level, or 0 at the level cap. */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(XP_BASE * Math.pow(Math.max(1, level), XP_EXPONENT));
}
