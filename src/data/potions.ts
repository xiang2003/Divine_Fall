export type PotionId = 'health' | 'mana';

export interface PotionDef {
  id: PotionId;
  name: string;
  description: string;
  /** Which gauge the potion refills. */
  restores: 'hp' | 'mana';
  /** Points restored per use. */
  amount: number;
  /** Charges the potion holds when full. Each use costs one. */
  maxCharges: number;
}

export const POTIONS: Record<PotionId, PotionDef> = {
  health: { id: 'health', name: '生命藥水', description: '立刻恢復 50 點生命。', restores: 'hp', amount: 50, maxCharges: 3 },
  mana: { id: 'mana', name: '魔力藥水', description: '立刻恢復 40 點魔力。', restores: 'mana', amount: 40, maxCharges: 3 },
};

/** What the belt holds in a new game: a health potion, a mana potion, and an empty third slot. */
export const STARTER_BELT: readonly (PotionId | null)[] = ['health', 'mana', null];

/** Charge every potion gets back from a normal kill (so four kills refill one charge). */
export const RECHARGE_PER_KILL = 0.25;
/** An elite kill counts as this many normal kills, a boss kill as this many. */
export const RECHARGE_ELITE_MULT = 4;
export const RECHARGE_BOSS_MULT = 12;
