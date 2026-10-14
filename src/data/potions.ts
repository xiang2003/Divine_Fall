export type PotionId = 'health' | 'mana';

export interface PotionDef {
  id: PotionId;
  name: string;
  description: string;
  /** Which gauge the potion refills. */
  restores: 'hp' | 'mana';
  /** Points restored in one go. */
  amount: number;
}

export const POTIONS: Record<PotionId, PotionDef> = {
  health: { id: 'health', name: '生命藥水', description: '立刻恢復 50 點生命。', restores: 'hp', amount: 50 },
  mana: { id: 'mana', name: '魔力藥水', description: '立刻恢復 40 點魔力。', restores: 'mana', amount: 40 },
};

/** What the potion belt holds in a new game and after a restart: one of each, and an empty third slot. */
export const STARTER_BELT: readonly ({ id: PotionId; count: number } | null)[] = [
  { id: 'health', count: 1 },
  { id: 'mana', count: 1 },
  null,
];
