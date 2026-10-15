export type PotionId = 'health' | 'mana';

export interface PotionDef {
  id: PotionId;
  name: string;
  description: string;
  /** Which gauge the potion refills. */
  restores: 'hp' | 'mana';
  /** The share of the maximum (of life or of mana) restored per use, so a potion stays worth drinking at every level. */
  fraction: number;
  /** Charges the potion holds when full. Each use costs one. */
  maxCharges: number;
}

export const POTIONS: Record<PotionId, PotionDef> = {
  health: { id: 'health', name: '生命藥水', description: '立刻恢復 50% 的最大生命。', restores: 'hp', fraction: 0.5, maxCharges: 3 },
  mana: { id: 'mana', name: '魔力藥水', description: '立刻恢復 60% 的最大魔力。', restores: 'mana', fraction: 0.6, maxCharges: 3 },
};

/** What the belt holds in a new game: a health potion, a mana potion, and an empty third slot. */
export const STARTER_BELT: readonly (PotionId | null)[] = ['health', 'mana', null];

/** Charge every potion gets back from a normal kill (so four kills refill one charge). */
export const RECHARGE_PER_KILL = 0.25;
/** An elite kill counts as this many normal kills, a boss kill as this many. */
export const RECHARGE_ELITE_MULT = 4;
export const RECHARGE_BOSS_MULT = 12;
