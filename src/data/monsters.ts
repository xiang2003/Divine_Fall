import { SpriteKey } from '../game/assetManifest';

export type MonsterBehavior = 'melee' | 'ranged';

export interface MonsterDef {
  id: string;
  name: string;
  spriteKey: string;
  behavior: MonsterBehavior;
  maxHp: number;
  /** Damage per hit / projectile, before the player's armor. */
  damage: number;
  /** World units per second. */
  moveSpeed: number;
  /** Starts chasing when the player is this close (centre distance) and in line of sight. */
  detectRange: number;
  /** Attack reach measured edge-to-edge (distance between circle edges). */
  attackRange: number;
  /** Seconds between the start of one attack and the start of the next (>= attackDuration). */
  attackCooldown: number;
  /** Length of the attack: windup + strike + recovery. Damage lands at the strike frame (55%). */
  attackDuration: number;
  /** Collision circle radius in world units. */
  radius: number;
  /** Ranged only: backs away when the player is closer than this (edge-to-edge). */
  keepDistance?: number;
  /** Ranged only: projectile speed in world units per second. */
  projectileSpeed?: number;
  /** Experience granted on death (consumed by the progression system in Phase 5). */
  xp: number;
  /** Height of the health bar above the feet, in art pixels. */
  barHeight: number;
}

export const MONSTERS = {
  ghoul: {
    id: 'ghoul',
    name: '蝕骨屍鬼',
    spriteKey: SpriteKey.GHOUL,
    behavior: 'melee',
    maxHp: 45,
    damage: 8,
    moveSpeed: 2.4,
    detectRange: 7,
    attackRange: 0.35,
    attackCooldown: 1.2,
    attackDuration: 0.5,
    radius: 0.3,
    xp: 10,
    barHeight: 56,
  },
  shade: {
    id: 'shade',
    name: '墮神祭影',
    spriteKey: SpriteKey.SHADE,
    behavior: 'ranged',
    maxHp: 28,
    damage: 7,
    moveSpeed: 2.0,
    detectRange: 9,
    attackRange: 6,
    attackCooldown: 2.2,
    attackDuration: 0.7,
    radius: 0.28,
    keepDistance: 3,
    projectileSpeed: 6,
    xp: 14,
    barHeight: 56,
  },
  hound: {
    id: 'hound',
    name: '碎神獵犬',
    spriteKey: SpriteKey.HOUND,
    behavior: 'melee',
    maxHp: 22,
    damage: 6,
    moveSpeed: 4.6,
    detectRange: 8,
    attackRange: 0.3,
    attackCooldown: 0.9,
    attackDuration: 0.35,
    radius: 0.26,
    xp: 8,
    barHeight: 34,
  },
} as const satisfies Record<string, MonsterDef>;

export type MonsterId = keyof typeof MONSTERS;

const SPAWN_CYCLE: readonly MonsterId[] = ['ghoul', 'shade', 'hound'];

/** Which normal monster stands on the n-th "m" spawn point of the map (deterministic). */
export function monsterForSpawnIndex(index: number): MonsterDef {
  return MONSTERS[SPAWN_CYCLE[index % SPAWN_CYCLE.length]!];
}
