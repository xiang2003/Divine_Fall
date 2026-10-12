import { PLAYER_CONFIG } from '../config/gameConfig';

export interface PlayerStats {
  maxHp: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  armor: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
}

/**
 * The single place that produces the player's final stats. Today that is just the base values;
 * equipment (Phase 3) and level-ups (Phase 5) will add their modifiers here so no other system
 * computes its own numbers.
 */
export function computePlayerStats(): PlayerStats {
  return { ...PLAYER_CONFIG.baseStats };
}
