/** Unique effects carried by legendary items. Numbers live here so tuning never touches logic. */
export type LegendaryEffectId = 'chainLightning' | 'lifeOnKill' | 'dodgeHaste' | 'killFrenzy';

export const LEGENDARY_EFFECTS = {
  chainLightning: {
    /** Chance per swing that hits something. */
    chance: 0.25,
    /** Extra enemies the lightning jumps to. */
    maxTargets: 3,
    /** Jump distance in world units. */
    range: 4,
    /** Fraction of the player's attack damage dealt by each arc. */
    damageRatio: 0.6,
  },
  lifeOnKill: {
    /** Fraction of max HP restored per kill. */
    healRatio: 0.06,
    minHeal: 3,
  },
  dodgeHaste: {
    duration: 2,
    /** +40% move speed. */
    speedBonus: 0.4,
  },
  killFrenzy: {
    duration: 3,
    /** +30% attack speed. */
    attackSpeedBonus: 0.3,
  },
} as const;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Tooltip text, generated from the numbers above so it can never disagree with the behaviour. */
export const LEGENDARY_EFFECT_TEXT: Record<LegendaryEffectId, string> = {
  chainLightning: `攻擊命中時有 ${pct(LEGENDARY_EFFECTS.chainLightning.chance)} 機率釋放連鎖閃電，對附近最多 ${LEGENDARY_EFFECTS.chainLightning.maxTargets} 名敵人各造成 ${pct(LEGENDARY_EFFECTS.chainLightning.damageRatio)} 攻擊傷害`,
  lifeOnKill: `擊殺敵人時恢復 ${pct(LEGENDARY_EFFECTS.lifeOnKill.healRatio)} 最大生命（至少 ${LEGENDARY_EFFECTS.lifeOnKill.minHeal} 點）`,
  dodgeHaste: `閃避後 ${LEGENDARY_EFFECTS.dodgeHaste.duration} 秒內移動速度 +${pct(LEGENDARY_EFFECTS.dodgeHaste.speedBonus)}`,
  killFrenzy: `擊殺敵人後 ${LEGENDARY_EFFECTS.killFrenzy.duration} 秒內攻擊速度 +${pct(LEGENDARY_EFFECTS.killFrenzy.attackSpeedBonus)}`,
};
