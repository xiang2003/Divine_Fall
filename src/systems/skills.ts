import { NO_UPGRADE, type SkillDef, type SkillUpgrade } from '../data/skills';

export interface SkillStats {
  damageMult: number;
  cooldown: number;
  count: number;
}

/** Longest cooldown reduction upgrades can reach, so a skill can never be spammed every frame. */
export const MAX_COOLDOWN_REDUCTION = 0.6;

/** A skill's effective numbers after applying the character's upgrades for it. */
export function getSkillStats(def: SkillDef, upgrade: SkillUpgrade = NO_UPGRADE): SkillStats {
  return {
    damageMult: def.damageMult * (1 + upgrade.damagePct / 100),
    cooldown: def.cooldown * (1 - Math.min(MAX_COOLDOWN_REDUCTION, upgrade.cooldownReductionPct / 100)),
    count: (def.count ?? 1) + Math.max(0, Math.floor(upgrade.extraProjectiles)),
  };
}

/** Tracks the remaining cooldown of every skill. A skill cannot be cast again until it reaches zero. */
export class SkillCooldowns {
  private readonly remaining = new Map<string, number>();
  private readonly total = new Map<string, number>();

  ready(id: string): boolean {
    return (this.remaining.get(id) ?? 0) <= 0;
  }

  /** Seconds left (0 when ready). */
  remainingOf(id: string): number {
    return Math.max(0, this.remaining.get(id) ?? 0);
  }

  /** The cooldown length the skill was last started with (for drawing the sweep). */
  totalOf(id: string): number {
    return this.total.get(id) ?? 0;
  }

  /** Starts a cooldown. Returns false (changing nothing) if the skill is still cooling down. */
  start(id: string, seconds: number): boolean {
    if (!this.ready(id)) return false;
    this.remaining.set(id, seconds);
    this.total.set(id, seconds);
    return true;
  }

  /** True while any skill is cooling down. */
  get anyActive(): boolean {
    for (const v of this.remaining.values()) if (v > 0) return true;
    return false;
  }

  update(dt: number): void {
    for (const [id, v] of this.remaining) if (v > 0) this.remaining.set(id, Math.max(0, v - dt));
  }

  reset(): void {
    this.remaining.clear();
    this.total.clear();
  }
}
