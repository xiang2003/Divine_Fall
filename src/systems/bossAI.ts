import type { BossAttackDef } from '../data/monsters';
import type { Rng } from './rng';

/** Which phase (0-based) a boss at `hpRatio` is in: one phase per threshold crossed. */
export function phaseForHpRatio(hpRatio: number, thresholds: readonly number[]): number {
  let phase = 0;
  for (const t of thresholds) if (hpRatio <= t) phase++;
  return phase;
}

/** What the boss knows about the fight right now. */
export interface BossContext {
  /** Edge-to-edge distance to the player. */
  reach: number;
  /** Centre-to-centre distance to the player. */
  dist: number;
  /** Line of sight to the player. */
  sees: boolean;
  /** The boss's melee reach (edge-to-edge). */
  meleeRange: number;
}

/** Ranged attacks are pointless point-blank; the fan needs at least this much gap. */
const FAN_MIN_REACH = 2;
/** A charge needs room to run: not point-blank, and not from across the room. */
const CHARGE_MIN_REACH = 2.5;
const CHARGE_MAX_REACH = 9;
/** The pillars come up around the player: close enough for them to matter. */
const PILLARS_MAX_DIST = 11;
/** A nova is worth using when the player is within its blast radius plus a little margin. */
const NOVA_MARGIN = 0.8;

export function isAttackAvailable(attack: BossAttackDef, phase: number, ctx: BossContext): boolean {
  if (phase < attack.minPhase) return false;
  switch (attack.kind) {
    case 'cleave':
      return ctx.reach <= ctx.meleeRange;
    case 'nova':
      return ctx.dist <= (attack.radius ?? 3) + NOVA_MARGIN;
    case 'fan':
      return ctx.sees && ctx.reach >= FAN_MIN_REACH;
    case 'charge':
      return ctx.sees && ctx.reach >= CHARGE_MIN_REACH && ctx.reach <= CHARGE_MAX_REACH;
    case 'pillars':
      return ctx.sees && ctx.dist <= PILLARS_MAX_DIST;
  }
}

/** Every attack the boss can use right now. */
export function availableBossAttacks(
  attacks: readonly BossAttackDef[],
  phase: number,
  ctx: BossContext,
): BossAttackDef[] {
  return attacks.filter((a) => isAttackAvailable(a, phase, ctx));
}

/** Picks one available attack by weight, or null if none fits (the boss should then close the distance). */
export function chooseBossAttack(
  attacks: readonly BossAttackDef[],
  phase: number,
  ctx: BossContext,
  rng: Rng,
): BossAttackDef | null {
  const options = availableBossAttacks(attacks, phase, ctx);
  if (options.length === 0) return null;
  let total = 0;
  for (const o of options) total += o.weight;
  let roll = rng() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll < 0) return o;
  }
  return options[options.length - 1]!;
}
