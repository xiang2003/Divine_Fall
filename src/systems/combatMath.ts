import { armorReduction } from './damage';
import type { Rng } from './rng';

/**
 * Fraction of a physical hit that gets through `armor`: 1 - armor / (armor + 5 x the attacker's baseline damage), at most 75% absorbed
 * (see damage.ts). Negative armor is treated as 0. `referenceDamage` defaults to the baseline of a level-1 attacker.
 */
export function armorMultiplier(armor: number, referenceDamage?: number): number {
  return 1 - armorReduction(armor, referenceDamage);
}

/** Physical damage after armor, rounded, never below 1 so every hit matters. */
export function applyArmor(damage: number, armor: number, referenceDamage?: number): number {
  return Math.max(1, Math.round(damage * armorMultiplier(armor, referenceDamage)));
}

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

/** Rolls one hit: crit with probability `critChance`, multiplying by `critMultiplier`. */
export function rollDamage(base: number, critChance: number, critMultiplier: number, rng: Rng): DamageRoll {
  const crit = rng() < critChance;
  return { amount: Math.max(1, Math.round(base * (crit ? critMultiplier : 1))), crit };
}

/**
 * Is a circular target inside a melee swing? `(dirX, dirY)` must be a unit vector.
 * `range` is measured from the attacker's origin to the target's edge. A target overlapping the
 * attacker is always hit, so hugging an enemy never makes a swing whiff.
 */
export function inAttackArc(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
  range: number,
  halfAngle: number,
): boolean {
  const vx = targetX - originX;
  const vy = targetY - originY;
  const dist = Math.hypot(vx, vy);
  if (dist > range + targetRadius) return false;
  if (dist <= targetRadius + 0.25) return true;
  return (vx * dirX + vy * dirY) / dist >= Math.cos(halfAngle);
}

/** Normalises (x, y) into `out`; falls back to (fallbackX, fallbackY) for a zero vector. */
export function normalizeInto(
  x: number,
  y: number,
  out: { x: number; y: number },
  fallbackX = 0,
  fallbackY = 1,
): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-9) {
    out.x = fallbackX;
    out.y = fallbackY;
  } else {
    out.x = x / len;
    out.y = y / len;
  }
  return out;
}
