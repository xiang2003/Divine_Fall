import { SpriteKey } from '../game/assetManifest';
import type { LootTableId } from './lootTables';

export type MonsterBehavior = 'melee' | 'ranged';

export type BossAttackKind = 'cleave' | 'nova' | 'fan';

/** One move in a boss's repertoire. Which are available depends on the current phase and distance to the player. */
export interface BossAttackDef {
  id: string;
  kind: BossAttackKind;
  /** First phase (0-based) in which the boss may use it. */
  minPhase: number;
  /** Relative chance among the attacks currently available. */
  weight: number;
  /** Length of the whole attack (windup + strike + recovery) in seconds. */
  duration: number;
  /** Multiplier of the boss's damage per hit. */
  damageMult: number;
  /** nova: radius of the ground blast in world units. */
  radius?: number;
  /** fan: number of projectiles. */
  count?: number;
  /** fan: angle in radians between neighbouring projectiles. */
  spread?: number;
  /** Fraction of the attack at which it lands (a nova uses a late strike so its ground warning is readable). */
  hitFraction?: number;
}

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
  /** Ranged / boss fan: projectile speed in world units per second. */
  projectileSpeed?: number;
  /** Experience granted on death (consumed by the progression system in Phase 5). */
  xp: number;
  /** Which loot table this monster rolls on death. */
  lootTable: LootTableId;
  /** Height of the health bar above the feet, in art pixels. */
  barHeight: number;

  // --- boss only ---------------------------------------------------------------------------
  isBoss?: boolean;
  /** HP fractions at which the boss enters its next phase, e.g. [0.66, 0.33] gives three phases. */
  phaseThresholds?: readonly number[];
  /** Per-phase multipliers (index = phase). Missing entries mean 1. */
  phaseSpeed?: readonly number[];
  /** Per-phase multiplier of the time between attacks (< 1 attacks more often). */
  phaseCooldown?: readonly number[];
  bossAttacks?: readonly BossAttackDef[];
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
    lootTable: 'normalMonster',
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
    lootTable: 'normalMonster',
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
    lootTable: 'normalMonster',
    barHeight: 34,
  },
  /** The dungeon boss. Three phases; phase 2 adds a projectile fan, phase 3 a wider fan and faster pace. */
  archon: {
    id: 'archon',
    name: '墮神執政官',
    spriteKey: SpriteKey.BOSS,
    behavior: 'melee',
    maxHp: 520,
    damage: 14,
    moveSpeed: 2.5,
    detectRange: 11,
    attackRange: 0.7,
    attackCooldown: 1.6,
    attackDuration: 0.9,
    radius: 0.55,
    projectileSpeed: 5.5,
    xp: 200,
    lootTable: 'boss',
    barHeight: 100,
    isBoss: true,
    phaseThresholds: [0.66, 0.33],
    phaseSpeed: [1, 1.15, 1.3],
    phaseCooldown: [1, 0.8, 0.6],
    bossAttacks: [
      { id: 'cleave', kind: 'cleave', minPhase: 0, weight: 3, duration: 0.9, damageMult: 1 },
      { id: 'nova', kind: 'nova', minPhase: 0, weight: 2, duration: 1.4, damageMult: 1.4, radius: 3.4, hitFraction: 0.85 },
      { id: 'fan', kind: 'fan', minPhase: 1, weight: 3, duration: 1.0, damageMult: 0.7, count: 5, spread: 0.35 },
      { id: 'barrage', kind: 'fan', minPhase: 2, weight: 2, duration: 1.2, damageMult: 0.6, count: 9, spread: 0.3 },
    ],
  },
} as const satisfies Record<string, MonsterDef>;

export type MonsterId = keyof typeof MONSTERS;

const SPAWN_CYCLE: readonly MonsterId[] = ['ghoul', 'shade', 'hound'];

/** Which normal monster stands on the n-th "m" spawn point of the map (deterministic). */
export function monsterForSpawnIndex(index: number): MonsterDef {
  return MONSTERS[SPAWN_CYCLE[index % SPAWN_CYCLE.length]!];
}

/** Which monster type each "e" (elite) spawn point uses; affixes are rolled separately. */
const ELITE_CYCLE: readonly MonsterId[] = ['ghoul', 'shade'];

export function monsterForEliteIndex(index: number): MonsterDef {
  return MONSTERS[ELITE_CYCLE[index % ELITE_CYCLE.length]!];
}
