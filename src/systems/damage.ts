import { DAMAGE_RULES, DAMAGE_TYPES, type DamageType, type ResistType } from '../data/damageTypes';
import type { Rng } from './rng';

/**
 * The one place damage is worked out (docs/design/damage-types.md). Skills, monsters, traps and the HUD all go through `resolveHit`, so the number
 * that floats up, the life that is taken and the death check are the same number. Pure functions: no rendering, no game state.
 *
 * Order of a direct hit:
 *   1. the base damage (skill + the attacker's attributes), split into types, then converted;
 *   2. x skill multiplier x (1 + the sum of "increased") x every "more" multiplier;
 *   3. a critical hit multiplies everything by the crit multiplier;
 *   4. each type is reduced by its own defense (armor for physical, a resistance for the rest);
 *   5. every type is rounded, and the rounded parts are what is displayed and subtracted.
 */

export type DamageMap = Partial<Record<DamageType, number>>;

/** Part of one type's damage becomes another type's (e.g. half the physical damage turns into fire). */
export interface Conversion {
  from: DamageType;
  to: DamageType;
  /** 0 to 1. */
  ratio: number;
}

/** What the attacker brings. Every field is optional: nothing means nothing extra. */
export interface Offense {
  /** "Increased" damage as fractions (0.2 = +20%): the ones of a type and `all` are added together, then multiply once. */
  increased?: Partial<Record<DamageType | 'all', number>>;
  /** "More" damage: each entry is its own multiplier (1.2 = 20% more); they multiply one after another. */
  more?: readonly number[];
  /** Chance and multiplier of a critical hit; only used when the hit may crit. */
  critChance?: number;
  critMultiplier?: number;
  /** Damage conversion, applied once to the base damage (a converted part is never converted again). */
  conversions?: readonly Conversion[];
  /**
   * Penetration as fractions: for a resistance, how many points of the target's resistance this attack ignores (after the cap);
   * for physical, the share of the target's armor it ignores. Separate from a target's "resistance reduction" (see Defense).
   */
  penetration?: Partial<Record<DamageType, number>>;
}

/** What the target brings. */
export interface Defense {
  armor: number;
  /** Resistances as fractions (0.3 = 30%; negative = takes extra). Already the sum of base and bonuses. */
  resist?: Partial<Record<ResistType, number>>;
  /** Where each resistance stops growing (default 75%); gear or effects that raise it must say so. */
  resistCap?: Partial<Record<ResistType, number>>;
  /** Resistance reduction placed on the target (a curse): taken off before the cap is applied. Not the attacker's penetration. */
  resistReduction?: Partial<Record<ResistType, number>>;
  /** What the target takes in total, after its defenses, as a multiplier ("more damage taken"; shock makes it 1.2). Default 1. */
  takenMultiplier?: number;
}

export const NO_DEFENSE: Defense = { armor: 0 };

export interface HitInput {
  /** Base damage by type: the skill's base plus what the attacker's attributes add. */
  damage: DamageMap;
  /** The skill's own multiplier (default 1). */
  skillMultiplier?: number;
  /** Only hits that say so can crit (default: no). */
  canCrit?: boolean;
  /** The baseline damage of the attacker's level, which armor is measured against (default: level 1). */
  referenceDamage?: number;
}

export interface HitResult {
  /** The final damage of each type, whole numbers. */
  byType: DamageMap;
  /** The sum of `byType`, and what is taken from the target's life. At least 1 if the hit had any damage at all. */
  total: number;
  crit: boolean;
  /** The type that did the most (picks the colour of the number). */
  dominant: DamageType;
  /** The damage before any defense (after skill, increases, more and crit): what damage over time that comes from this hit is worked out from. */
  raw: number;
}

/** The damage a monster of this level is "worth" for armor purposes: 8 at level 1, growing 4.5% per level. */
export function baselineDamage(level = 1): number {
  return DAMAGE_RULES.baselineDamage * Math.pow(DAMAGE_RULES.baselineGrowth, Math.max(0, level - 1));
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const positive = (v: number | undefined): number => (v !== undefined && Number.isFinite(v) && v > 0 ? v : 0);

/** Fraction of a physical hit that armor absorbs. Armor ignored by penetration (a share of it) counts as not there. */
export function armorReduction(armor: number, referenceDamage: number = baselineDamage(1), armorPenetration = 0): number {
  const effective = Math.max(0, armor) * (1 - clamp(armorPenetration, 0, 1));
  if (effective <= 0) return 0;
  return Math.min(DAMAGE_RULES.armorReductionCap, effective / (effective + DAMAGE_RULES.armorFactor * Math.max(1e-9, referenceDamage)));
}

/**
 * A resistance after everything that touches it: base (with bonuses) minus the reduction placed on the target, held between the floor
 * (-100%) and the cap (75% unless raised), and only then lowered by the attacker's penetration (never below the floor).
 */
export function effectiveResist(defense: Defense, type: ResistType, penetration = 0): number {
  const base = defense.resist?.[type] ?? 0;
  const reduction = defense.resistReduction?.[type] ?? 0;
  const cap = defense.resistCap?.[type] ?? DAMAGE_RULES.resistCap;
  const held = clamp(base - reduction, DAMAGE_RULES.resistFloor, cap);
  return Math.max(DAMAGE_RULES.resistFloor, held - Math.max(0, penetration));
}

/** The multiplier a target's defense leaves of a hit of this type (1 = untouched, 0.25 = a quarter gets through). */
export function defenseMultiplier(type: DamageType, defense: Defense, referenceDamage?: number, penetration = 0): number {
  const taken = Math.max(0, defense.takenMultiplier ?? 1);
  if (type === 'physical') return (1 - armorReduction(defense.armor, referenceDamage, penetration)) * taken;
  return (1 - effectiveResist(defense, type, penetration)) * taken;
}

/** Splits damage by the conversions. Each source type converts at most 100% of itself (more is scaled down) and only once. */
export function convertDamage(base: DamageMap, conversions: readonly Conversion[] = []): DamageMap {
  const out: DamageMap = {};
  for (const type of DAMAGE_TYPES) if (positive(base[type]) > 0) out[type] = base[type]!;
  const bySource = new Map<DamageType, Conversion[]>();
  for (const c of conversions) {
    if (!(c.ratio > 0) || c.from === c.to) continue;
    const list = bySource.get(c.from) ?? [];
    list.push(c);
    bySource.set(c.from, list);
  }
  for (const [from, list] of bySource) {
    const amount = positive(base[from]);
    if (amount <= 0) continue;
    const total = list.reduce((sum, c) => sum + c.ratio, 0);
    const scale = total > 1 ? 1 / total : 1;
    for (const c of list) {
      const moved = amount * c.ratio * scale;
      out[from] = Math.max(0, (out[from] ?? 0) - moved);
      out[c.to] = (out[c.to] ?? 0) + moved;
    }
  }
  return out;
}

/** The product of the "more" multipliers. */
export function moreMultiplier(more: readonly number[] = []): number {
  return more.reduce((product, m) => product * Math.max(0, m), 1);
}

/** 1 + the sum of the "increased" fractions that apply to `type` (the type's own and `all`); never below 0. */
export function increasedMultiplier(type: DamageType, increased: Offense['increased'] = {}): number {
  return Math.max(0, 1 + (increased[type] ?? 0) + (increased.all ?? 0));
}

/**
 * Works out one direct hit. `rng` is only used for the crit roll (and only when the hit may crit and has a chance at all).
 * Damage of different types is defended against separately and then added up.
 */
export function resolveHit(input: HitInput, offense: Offense = {}, defense: Defense = NO_DEFENSE, rng?: Rng): HitResult {
  const converted = convertDamage(input.damage, offense.conversions);
  const skill = positive(input.skillMultiplier ?? 1) || 0;
  const more = moreMultiplier(offense.more);

  let crit = false;
  if (input.canCrit && rng) {
    const chance = clamp(offense.critChance ?? 0, 0, 1);
    crit = chance > 0 && rng() < chance;
  }
  const critMultiplier = crit ? Math.max(1, offense.critMultiplier ?? DAMAGE_RULES.baseCritMultiplier) : 1;

  const finalByType: Record<DamageType, number> = { physical: 0, fire: 0, cold: 0, lightning: 0, corruption: 0, divine: 0 };
  const byType: DamageMap = {};
  let raw = 0;
  let dominant: DamageType = 'physical';
  let best = -1;
  for (const type of DAMAGE_TYPES) {
    const base = positive(converted[type]);
    if (base <= 0) continue;
    const amount = base * skill * increasedMultiplier(type, offense.increased) * more * critMultiplier;
    raw += amount;
    const defended = amount * defenseMultiplier(type, defense, input.referenceDamage, offense.penetration?.[type] ?? 0);
    finalByType[type] = defended;
    if (defended > best) {
      best = defended;
      dominant = type;
    }
  }
  let total = 0;
  for (const type of DAMAGE_TYPES) {
    if (finalByType[type] <= 0) continue;
    const rounded = Math.round(finalByType[type]);
    if (rounded > 0) {
      byType[type] = rounded;
      total += rounded;
    }
  }
  if (total === 0 && raw > 0) {
    // every hit that had any damage at all does at least 1
    byType[dominant] = 1;
    total = 1;
  }
  return { byType, total, crit, dominant, raw };
}

// --- damage over time -------------------------------------------------------------------------

/** One kind of damage over time (burning, bleeding, corrosion). */
export interface DotSpec {
  /** Same id = same effect: applying it again refreshes it instead of adding a second copy. */
  id: string;
  type: DamageType;
  dps: number;
  /** Seconds. */
  duration: number;
  /** How many copies of this id can run at once, each with its own rate (default 1: no stacking). */
  maxStacks?: number;
  /** Does armor reduce this physical damage over time? Bleeding is defined as no (default no); resistances always apply. */
  armorApplies?: boolean;
}

/** Seconds between the ticks that deal the damage. */
export const DOT_TICK = 0.5;

interface DotStack {
  spec: DotSpec;
  dps: number;
  left: number;
}

export interface DotTick {
  /** Whole damage of the tick. */
  amount: number;
  byType: DamageMap;
}

/**
 * The damage-over-time effects on one target. Damage over time never crits and does not use the hit that applied it again;
 * each tick goes through the target's defense for its own type.
 */
export class DotSet {
  private readonly stacks: DotStack[] = [];
  private clock = 0;
  /** Damage worked out but not yet paid, by type (less than 1 each between ticks). */
  private readonly carry: Record<DamageType, number> = { physical: 0, fire: 0, cold: 0, lightning: 0, corruption: 0, divine: 0 };

  get active(): boolean {
    return this.stacks.length > 0;
  }

  /** How many copies of `id` are running. */
  count(id: string): number {
    return this.stacks.filter((s) => s.spec.id === id).length;
  }

  /** Starts or refreshes an effect. Without stacking, the stronger rate and the longer time win; with stacking, a full pile replaces its shortest-lived copy. */
  apply(spec: DotSpec): void {
    if (!(spec.dps > 0) || !(spec.duration > 0)) return;
    const max = Math.max(1, Math.floor(spec.maxStacks ?? 1));
    const same = this.stacks.filter((s) => s.spec.id === spec.id);
    if (max === 1) {
      const existing = same[0];
      if (existing) {
        existing.dps = Math.max(existing.dps, spec.dps);
        existing.left = Math.max(existing.left, spec.duration);
      } else {
        this.stacks.push({ spec, dps: spec.dps, left: spec.duration });
      }
      return;
    }
    if (same.length < max) {
      this.stacks.push({ spec, dps: spec.dps, left: spec.duration });
      return;
    }
    const shortest = same.reduce((a, b) => (b.left < a.left ? b : a));
    shortest.dps = spec.dps;
    shortest.left = spec.duration;
  }

  /** Seconds the longest-running copy of `id` has left (0 if none is running). */
  remaining(id: string): number {
    return this.stacks.reduce((best, s) => (s.spec.id === id ? Math.max(best, s.left) : best), 0);
  }

  /** The strongest rate among the copies of `id` (0 if none). */
  rate(id: string): number {
    return this.stacks.reduce((best, s) => (s.spec.id === id ? Math.max(best, s.dps) : best), 0);
  }

  /** Stops every copy of `id` (a cleansing); what was worked out but not yet paid is dropped too. Returns whether anything was removed. */
  remove(id: string): boolean {
    const before = this.stacks.length;
    for (let i = this.stacks.length - 1; i >= 0; i--) if (this.stacks[i]!.spec.id === id) this.stacks.splice(i, 1);
    if (this.stacks.length === 0) {
      this.clock = 0;
      for (const t of DAMAGE_TYPES) this.carry[t] = 0;
    }
    return this.stacks.length !== before;
  }

  clear(): void {
    this.stacks.length = 0;
    this.clock = 0;
    for (const t of DAMAGE_TYPES) this.carry[t] = 0;
  }

  /**
   * Advances `dt` seconds and returns the damage of the tick that fell in it, or null. The part of a tick that is less than a whole point
   * is carried to the next one (and paid out when the effect ends), so the total over time is dps x duration however it is rounded.
   */
  tick(dt: number, defense: Defense = NO_DEFENSE, referenceDamage?: number): DotTick | null {
    if (this.stacks.length === 0) return null;
    const step = Math.min(dt, Math.max(...this.stacks.map((s) => s.left)));
    this.clock += step;
    let ticked = false;
    if (this.clock >= DOT_TICK - 1e-9) {
      this.clock = Math.max(0, this.clock - DOT_TICK);
      ticked = true;
      for (const s of this.stacks) {
        const mult = s.spec.type === 'physical' && !s.spec.armorApplies ? 1 : defenseMultiplier(s.spec.type, defense, referenceDamage);
        this.carry[s.spec.type] += s.dps * DOT_TICK * mult;
      }
    }
    for (const s of this.stacks) s.left -= step;
    for (let i = this.stacks.length - 1; i >= 0; i--) if (this.stacks[i]!.left <= 0) this.stacks.splice(i, 1);
    const ended = this.stacks.length === 0;
    if (!ticked && !ended) return null;
    const byType: DamageMap = {};
    let amount = 0;
    for (const type of DAMAGE_TYPES) {
      const whole = ended ? Math.round(this.carry[type]) : Math.floor(this.carry[type] + 1e-9);
      if (whole > 0) {
        byType[type] = whole;
        amount += whole;
      }
      this.carry[type] = ended ? 0 : this.carry[type] - Math.max(0, whole);
    }
    if (ended) this.clock = 0;
    return amount > 0 ? { amount, byType } : null;
  }
}
