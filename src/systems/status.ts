import type { DamageType } from '../data/damageTypes';
import { FREEZE_RULES, MAX_CONTROL_RESIST, STATUSES, type StatusCategory, type StatusId } from '../data/statuses';
import { DotSet, type DotTick, type Defense } from './damage';
import type { Rng } from './rng';

/**
 * The one manager of status effects (docs/design/status-effects.md), used by the player and by monsters alike: timing, refreshing, stacking,
 * immunity, control resistance, the freeze gauge and cleansing live here, so a skill or an affix only says "put this on". Pure logic.
 *
 * The rules in short:
 * - the same effect never adds up: a new one refreshes the running one (longer time, stronger strength win), except damage effects that say they stack;
 * - nothing lasts longer than its `maxDuration`, and a control effect is shortened by the target's control resistance and cannot be put on again for a
 *   while after it ends, so no one is locked down for ever;
 * - the strength of a debuff never goes past its limit;
 * - damage over time is damage of its own type: it goes through the defense of that type, is raised by "shock" like any damage, never crits.
 */

export interface StatusApplication {
  id: StatusId;
  /** Seconds; the effect's own duration when left out. */
  duration?: number;
  /** Strength; the effect's own when left out (see StatusDef.magnitude). */
  magnitude?: number;
  /** damage effects: damage per second (required for them). */
  dps?: number;
}

export type ApplyResult =
  | { applied: true; refreshed: boolean }
  | { applied: false; reason: 'unimplemented' | 'immune' | 'cooldown' | 'invalid' };

export interface StatusOptions {
  /** 0 to 0.9: shortens control effects by this share (a boss has 50% unless its definition says otherwise). */
  controlResist?: number;
  /** Effects this target can never have (a stone golem does not bleed). */
  immune?: readonly StatusId[];
  /** Multiplies the freeze gauge it takes to freeze this target (a boss needs more). */
  buildupFactor?: number;
}

export interface StatusView {
  id: StatusId;
  name: string;
  color: string;
  category: StatusCategory;
  remaining: number;
  magnitude?: number;
}

interface Running {
  left: number;
  magnitude: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export class StatusSet {
  private readonly running = new Map<StatusId, Running>();
  private readonly dots = new DotSet();
  /** Seconds left in which a control effect that just ended cannot be put on again. */
  private readonly immunity = new Map<StatusId, number>();
  /** Build-up gauges (the freeze gauge), with the threshold each one is measured against. */
  private readonly gauges = new Map<StatusId, { value: number; threshold: number }>();

  constructor(private readonly options: StatusOptions = {}) {}

  // --- applying ------------------------------------------------------------------------------

  /** Puts an effect on, or refreshes it. */
  apply(app: StatusApplication): ApplyResult {
    const def = STATUSES[app.id];
    if (!def.implemented) return { applied: false, reason: 'unimplemented' };
    if (this.options.immune?.includes(app.id)) return { applied: false, reason: 'immune' };
    if ((this.immunity.get(app.id) ?? 0) > 0) return { applied: false, reason: 'cooldown' };

    let duration = app.duration ?? def.duration;
    if (def.controlled) duration *= 1 - clamp(this.options.controlResist ?? 0, 0, MAX_CONTROL_RESIST);
    duration = Math.min(duration, def.maxDuration);
    if (!(duration > 0)) return { applied: false, reason: 'invalid' };

    if (def.category === 'damage') {
      const dps = app.dps ?? 0;
      if (!(dps > 0)) return { applied: false, reason: 'invalid' };
      const refreshed = this.dots.remaining(app.id) > 0;
      this.dots.apply({ id: app.id, type: def.damageType!, dps, duration, maxStacks: def.maxStacks, armorApplies: def.armorApplies });
      return { applied: true, refreshed };
    }

    let magnitude = app.magnitude ?? def.magnitude ?? 0;
    if (def.magnitude !== undefined && def.magnitudeLimit !== undefined) {
      // slow keeps a speed factor (the limit is a floor); the others keep a share (the limit is a ceiling)
      magnitude = def.id === 'slow' ? Math.max(def.magnitudeLimit, magnitude) : Math.min(def.magnitudeLimit, magnitude);
    }
    const existing = this.running.get(app.id);
    if (existing) {
      existing.left = Math.min(def.maxDuration, Math.max(existing.left, duration));
      existing.magnitude = def.id === 'slow' ? Math.min(existing.magnitude, magnitude) : Math.max(existing.magnitude, magnitude);
      return { applied: true, refreshed: true };
    }
    this.running.set(app.id, { left: duration, magnitude });
    return { applied: true, refreshed: false };
  }

  /**
   * Adds to a build-up gauge (the freeze gauge): when it reaches the threshold the effect is put on and the gauge starts again. The gauge drains
   * while the target is not being hit. Returns whether the effect was put on by this call.
   */
  buildup(id: StatusId, amount: number, application: Omit<StatusApplication, 'id'> = {}): boolean {
    const def = STATUSES[id];
    if (!def.implemented || !(amount > 0)) return false;
    if (this.options.immune?.includes(id) || (this.immunity.get(id) ?? 0) > 0 || this.running.has(id)) return false;
    const threshold = FREEZE_RULES.threshold * (this.options.buildupFactor ?? 1);
    const gauge = this.gauges.get(id) ?? { value: 0, threshold };
    gauge.threshold = threshold;
    gauge.value += amount;
    this.gauges.set(id, gauge);
    if (gauge.value < gauge.threshold) return false;
    this.gauges.delete(id);
    return this.apply({ id, ...application }).applied;
  }

  /** How full the gauge of `id` is, 0 to 1. */
  gauge(id: StatusId): number {
    const g = this.gauges.get(id);
    return g ? Math.min(1, g.value / g.threshold) : 0;
  }

  // --- time ----------------------------------------------------------------------------------

  /**
   * Advances every effect by `dt` seconds and returns the damage of the damage-over-time tick that fell in it, or null.
   * `defense` is the target's own defense (without status changes): the armor break and the shock on it are applied here.
   */
  tick(dt: number, defense: Defense = { armor: 0 }, referenceDamage?: number): DotTick | null {
    for (const [id, r] of this.running) {
      r.left -= dt;
      if (r.left <= 0) {
        this.running.delete(id);
        const after = STATUSES[id].immunityAfter;
        if (after) this.immunity.set(id, after);
      }
    }
    for (const [id, left] of this.immunity) {
      if (left - dt <= 0) this.immunity.delete(id);
      else this.immunity.set(id, left - dt);
    }
    for (const [id, g] of this.gauges) {
      g.value -= g.threshold * FREEZE_RULES.drainPerSecond * dt;
      if (g.value <= 0) this.gauges.delete(id);
    }
    return this.dots.tick(dt, this.defend(defense), referenceDamage);
  }

  // --- what the effects do -------------------------------------------------------------------

  get active(): boolean {
    return this.running.size > 0 || this.dots.active;
  }

  has(id: StatusId): boolean {
    return STATUSES[id].category === 'damage' ? this.dots.remaining(id) > 0 : this.running.has(id);
  }

  /** Seconds the effect has left (0 if it is not on). */
  remaining(id: StatusId): number {
    return STATUSES[id].category === 'damage' ? this.dots.remaining(id) : (this.running.get(id)?.left ?? 0);
  }

  /** The strength it runs with (0 if it is not on); for a damage effect the damage per second. */
  magnitude(id: StatusId): number {
    return STATUSES[id].category === 'damage' ? this.dots.rate(id) : (this.running.get(id)?.magnitude ?? 0);
  }

  /** Frozen: cannot act at all. */
  get frozen(): boolean {
    return this.running.has('freeze');
  }

  /** False while something takes away its actions (frozen). */
  get canAct(): boolean {
    return !this.frozen;
  }

  /** What is left of its movement speed: 0 frozen, the slow factor when slowed, 1 otherwise. */
  get moveSpeedMultiplier(): number {
    if (this.frozen) return 0;
    const slow = this.running.get('slow');
    return slow ? slow.magnitude : 1;
  }

  /** What it deals, as a multiplier: weaken takes a share off. */
  get damageDealtMultiplier(): number {
    const weaken = this.running.get('weaken');
    return weaken ? 1 - weaken.magnitude : 1;
  }

  /** What it takes, as a multiplier: shock and a mark each add a share (they multiply: a shocked and marked target takes both). */
  get damageTakenMultiplier(): number {
    const shock = this.running.get('shock');
    const mark = this.running.get('mark');
    return (shock ? 1 + shock.magnitude : 1) * (mark ? 1 + mark.magnitude : 1);
  }

  /** What is left of its armor: armor break takes a share off. */
  get armorMultiplier(): number {
    const broken = this.running.get('armorBreak');
    return broken ? 1 - broken.magnitude : 1;
  }

  /** The defense with the effects on the target applied (armor break, shock). */
  defend(defense: Defense): Defense {
    if (this.running.size === 0) return defense;
    return { ...defense, armor: defense.armor * this.armorMultiplier, takenMultiplier: (defense.takenMultiplier ?? 1) * this.damageTakenMultiplier };
  }

  /** What is on the target right now (damage effects first, then control, then debuffs). */
  list(): StatusView[] {
    const out: StatusView[] = [];
    for (const id of Object.keys(STATUSES) as StatusId[]) {
      if (!this.has(id)) continue;
      const def = STATUSES[id];
      out.push({ id, name: def.name, color: def.color, category: def.category, remaining: this.remaining(id), magnitude: this.magnitude(id) || undefined });
    }
    const order: Record<StatusCategory, number> = { damage: 0, control: 1, debuff: 2 };
    return out.sort((a, b) => order[a.category] - order[b.category]);
  }

  // --- removing ------------------------------------------------------------------------------

  /** Cleansing: removes the effects that can be removed (all of them, or those among `ids`). Returns what was removed. */
  dispel(ids?: readonly StatusId[]): StatusId[] {
    const removed: StatusId[] = [];
    for (const id of Object.keys(STATUSES) as StatusId[]) {
      if (ids && !ids.includes(id)) continue;
      if (!STATUSES[id].dispellable || !this.has(id)) continue;
      if (STATUSES[id].category === 'damage') this.dots.remove(id);
      else this.running.delete(id);
      removed.push(id);
    }
    return removed;
  }

  /** Removes everything (the target died or left the fight). */
  clear(): void {
    this.running.clear();
    this.dots.clear();
    this.immunity.clear();
    this.gauges.clear();
  }
}

// --- triggers -------------------------------------------------------------------------------------

/** "When this hits, put that on": a chance, a condition, or build-up. What skills and gear carry. */
export interface StatusTrigger {
  id: StatusId;
  /** 0 to 1 (1 always; the chance is rolled once per trigger per hit). Ignored for build-up. */
  chance?: number;
  /** Only when the hit was a critical hit (default: any hit). */
  on?: 'hit' | 'crit';
  /** Instead of a chance: points that go into the target's build-up gauge. */
  buildup?: number;
  /** Strength and time to use instead of the effect's own. */
  magnitude?: number;
  duration?: number;
}

export interface HitInfo {
  /** The damage of the hit before any defense; damage effects are worked out from it. */
  raw: number;
  crit: boolean;
  /** The attacker's "increased damage", which raises the damage effect of its type. */
  increased?: Partial<Record<DamageType | 'all', number>>;
  /** The attacker's increased damage over time (a fraction). */
  dotDamage?: number;
  /** The attacker's longer effects (a fraction). */
  durationBonus?: number;
}

/** Damage per second of a damage effect started by a hit: its share of the hit, spread over its (possibly longer) duration, with increases. */
export function damageEffectRate(id: StatusId, hit: HitInfo): number {
  const def = STATUSES[id];
  if (def.category !== 'damage' || !def.dotFraction || !def.damageType) return 0;
  const increase = 1 + (hit.dotDamage ?? 0) + (hit.increased?.[def.damageType] ?? 0) + (hit.increased?.all ?? 0);
  return (hit.raw * def.dotFraction * Math.max(0, increase)) / def.duration;
}

/** Rolls the triggers of one hit against a target and puts on what comes up. Returns the effects that were put on. */
export function applyTriggers(target: StatusSet, triggers: readonly StatusTrigger[], hit: HitInfo, rng: Rng): StatusId[] {
  const applied: StatusId[] = [];
  const longer = 1 + (hit.durationBonus ?? 0);
  for (const t of triggers) {
    if (t.on === 'crit' && !hit.crit) continue;
    const def = STATUSES[t.id];
    const application = {
      duration: (t.duration ?? def.duration) * longer,
      magnitude: t.magnitude,
      dps: damageEffectRate(t.id, hit),
    };
    if (t.buildup !== undefined) {
      if (target.buildup(t.id, t.buildup, application)) applied.push(t.id);
      continue;
    }
    const chance = t.chance ?? 1;
    if (chance <= 0) continue;
    if (chance < 1 && rng() >= chance) continue;
    if (target.apply(application.dps > 0 || def.category !== 'damage' ? { id: t.id, ...application } : { id: t.id }).applied) applied.push(t.id);
  }
  return applied;
}
