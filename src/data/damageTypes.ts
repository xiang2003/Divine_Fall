/**
 * The six kinds of damage (docs/design/damage-types.md). The identifiers are fixed values: save files, items and monsters name them.
 * Physical damage is reduced by armor; every other kind has a resistance of its own.
 */
export const DAMAGE_TYPES = ['physical', 'fire', 'cold', 'lightning', 'corruption', 'divine'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** The kinds that are reduced by a resistance (everything except physical). */
export type ResistType = Exclude<DamageType, 'physical'>;
export const RESIST_TYPES: readonly ResistType[] = ['fire', 'cold', 'lightning', 'corruption', 'divine'];

export const DAMAGE_TYPE_INFO: Record<DamageType, { label: string; /** What defends against it. */ defenseLabel: string; /** Colour of its damage numbers. */ color: string }> = {
  physical: { label: '物理', defenseLabel: '護甲', color: '#e8e4da' },
  fire: { label: '火焰', defenseLabel: '火焰抗性', color: '#ff8a3a' },
  cold: { label: '冰霜', defenseLabel: '冰霜抗性', color: '#7fd4ff' },
  lightning: { label: '雷電', defenseLabel: '雷電抗性', color: '#ffe14a' },
  corruption: { label: '腐化', defenseLabel: '腐化抗性', color: '#b87be8' },
  divine: { label: '神聖', defenseLabel: '神聖抗性', color: '#fff2b0' },
};

export function isDamageType(value: string): value is DamageType {
  return (DAMAGE_TYPES as readonly string[]).includes(value);
}

/** The rules' numbers. Initial design values, to be balanced against character level and monster growth. */
export const DAMAGE_RULES = {
  /** A resistance can be pushed to this far by gear, and no farther (unless something raises the cap explicitly). */
  resistCap: 0.75,
  /** A resistance can sink to this far: -100% means double damage. */
  resistFloor: -1,
  /** Armor reduces a physical hit by armor / (armor + armorFactor * the attacker's baseline damage), at most this much. */
  armorReductionCap: 0.75,
  armorFactor: 5,
  /** A critical hit multiplies by this unless gear adds to it (150%). */
  baseCritMultiplier: 1.5,
  /** Baseline damage of an attacker of level 1, and how much it grows per level (the monster damage curve of the level plan). */
  baselineDamage: 8,
  baselineGrowth: 1.045,
} as const;
