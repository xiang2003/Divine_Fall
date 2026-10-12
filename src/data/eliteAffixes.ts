export type EliteAffixId = 'empowered' | 'frenzied' | 'lightning' | 'vampiric';

export interface EliteAffixDef {
  id: EliteAffixId;
  name: string;
  description: string;
  /** Multipliers applied on top of the base elite bonus. 1 = no change. */
  hpMult: number;
  damageMult: number;
  moveSpeedMult: number;
  /** Divides attack duration and cooldown (>1 attacks faster). */
  attackSpeedMult: number;
  /** Extra lightning damage on every hit, as a fraction of the hit (0 = none). */
  lightningRatio: number;
  /** Fraction of damage dealt that heals the monster (0 = none). */
  lifestealRatio: number;
}

const NEUTRAL = {
  hpMult: 1,
  damageMult: 1,
  moveSpeedMult: 1,
  attackSpeedMult: 1,
  lightningRatio: 0,
  lifestealRatio: 0,
} as const;

export const ELITE_AFFIXES: Record<EliteAffixId, EliteAffixDef> = {
  empowered: { ...NEUTRAL, id: 'empowered', name: '強化', description: '生命值大幅提高', hpMult: 1.6 },
  frenzied: {
    ...NEUTRAL,
    id: 'frenzied',
    name: '狂暴',
    description: '攻擊與移動更快',
    attackSpeedMult: 1.6,
    moveSpeedMult: 1.15,
  },
  lightning: { ...NEUTRAL, id: 'lightning', name: '閃電', description: '攻擊附帶閃電傷害', lightningRatio: 0.5 },
  vampiric: { ...NEUTRAL, id: 'vampiric', name: '吸血', description: '造成傷害時恢復生命', lifestealRatio: 0.5 },
};

export const ELITE_AFFIX_IDS = Object.keys(ELITE_AFFIXES) as EliteAffixId[];

/** What being elite does before any affix: tougher, harder-hitting and bigger. */
export const ELITE_BASE = { hpMult: 2.5, damageMult: 1.3, scale: 1.25 } as const;

/** Chance that an elite gets a second affix (every elite has at least one). */
export const ELITE_SECOND_AFFIX_CHANCE = 0.6;
