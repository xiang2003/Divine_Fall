import type { SummonDef } from '../data/monsters';

/**
 * How many of the `wanted` helpers may really appear: a monster that calls help (`summons`) never has more than `max` of its own alive at once.
 * Helpers of any other kind (what a hurt monster throws off when it splits) are not limited.
 */
export function helpersAllowed(summons: SummonDef | undefined, defId: string, wanted: number, alive: number): number {
  if (!summons || summons.into !== defId) return wanted;
  return Math.max(0, Math.min(wanted, summons.max - alive));
}
