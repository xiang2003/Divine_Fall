import { SpriteKey } from '../game/assetManifest';
import type { LootTableId } from './lootTables';

export type MonsterBehavior = 'melee' | 'ranged';

export type BossAttackKind = 'cleave' | 'nova' | 'fan' | 'charge';

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
  /** charge: how far the rush carries the boss, in world units. */
  rush?: number;
}

/** How a monster with directional art acts out its attack (see DirectionalAnimator). */
export type AttackStyle = 'lunge' | 'pounce' | 'spit' | 'charge' | 'slam';

/** A leaping attack: from `range` away (edge to edge) the monster crouches, springs at where the target stood, and bites where it lands. */
export interface PounceDef {
  /** Starts the leap when the target is at most this far away (edge to edge), but farther than the normal bite reach. */
  range: number;
  /** Speed of the leap in world units per second. */
  speed: number;
  /** Length of the whole move (crouch + leap + landing) in seconds. */
  duration: number;
  /** Multiplier of the monster's damage for the bite at the end of the leap. */
  damageMult: number;
}

/** Venom: each hit of this monster also poisons the target for `duration` seconds, `dps` damage per second (armor does not reduce it). */
export interface PoisonDef {
  dps: number;
  duration: number;
}

/** Slowing: each hit of this monster also slows the target to `factor` of its speed for `duration` seconds (a refreshed, not stacked, effect). */
export interface SlowDef {
  factor: number;
  duration: number;
}

/** Hopping: it only moves while airborne. A hop lasts `period` seconds, of which the last `air` fraction is the flight. */
export interface HopDef {
  period: number;
  air: number;
}

/** A ground slam centred on the monster (its normal attack): a warning of `radius` shows, then everything inside is hit. */
export interface SlamDef {
  radius: number;
  /** Length of the whole slam in seconds. */
  duration: number;
  /** Fraction of the slam at which the blow lands. */
  hitFraction: number;
  damageMult: number;
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
  /** True when spriteKey is a 4-facing sheet (front, right, back, left) drawn by DirectionalAnimator instead of a one-facing sheet. */
  directional?: boolean;
  /** How the attack is acted out (directional art only). */
  attackStyle?: AttackStyle;
  /** Melee only: leaps at the target from a distance. */
  pounce?: PounceDef;
  /** Its hits poison. */
  poison?: PoisonDef;
  /** Its hits slow. */
  slow?: SlowDef;
  /** Moves by hopping (see HopDef). */
  hop?: HopDef;
  /** Flies: drawn hovering above its shadow, fluttering. */
  flyer?: boolean;
  /** Ranged: circles the target sideways while it keeps its distance. */
  strafe?: boolean;
  /** Melee: the normal attack is a slam around itself instead of a swing. */
  slam?: SlamDef;
  /** Appears in a group: this many of them stand around each spawn point of the map. */
  packSize?: number;
  /** A glowing core drawn over the sprite (additive), pulsing: colour, height above the feet in art pixels, size and beats per second. */
  glow?: { color: number; height: number; size: number; hz: number };
  /** Tint of this monster's projectiles (0xRRGGBB). Poisonous monsters default to venom green. */
  projectileTint?: number;

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
  // ---- chapter 1: Pure Source Island (see docs/design/chapter1-pure-source-island.md) ------------
  /** Ordinary wildlife of the forest road: dangerous, not corrupted. A wolf bites, and leaps at you from a few steps away. */
  forest_wolf: {
    id: 'forest_wolf',
    name: '野狼',
    spriteKey: SpriteKey.WOLF,
    directional: true,
    attackStyle: 'pounce',
    behavior: 'melee',
    maxHp: 30,
    damage: 7,
    moveSpeed: 3.4,
    detectRange: 8,
    attackRange: 0.35,
    attackCooldown: 1.5,
    attackDuration: 0.45,
    radius: 0.3,
    pounce: { range: 2.6, speed: 7.5, duration: 0.8, damageMult: 1.4 },
    xp: 10,
    lootTable: 'normalMonster',
    barHeight: 44,
  },
  /** A forest viper: slow, keeps its distance and spits venom that poisons. */
  forest_viper: {
    id: 'forest_viper',
    name: '毒蛇',
    spriteKey: SpriteKey.VIPER,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 18,
    damage: 4,
    moveSpeed: 1.8,
    detectRange: 8,
    attackRange: 5.5,
    attackCooldown: 2.4,
    attackDuration: 0.8,
    radius: 0.28,
    keepDistance: 2.5,
    projectileSpeed: 5.5,
    poison: { dps: 3, duration: 4 },
    xp: 9,
    lootTable: 'normalMonster',
    barHeight: 36,
  },
  // ---- the spring cave ------------------------------------------------------------------------------
  /** A translucent blob with a glowing core. It hops after you and lobs gel that slows whatever it hits. */
  spring_gel: {
    id: 'spring_gel',
    name: '源泉凝膠',
    spriteKey: SpriteKey.GEL,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 26,
    damage: 5,
    moveSpeed: 1.7,
    detectRange: 8,
    attackRange: 5.5,
    attackCooldown: 2.6,
    attackDuration: 0.8,
    radius: 0.3,
    keepDistance: 2.5,
    projectileSpeed: 4.5,
    hop: { period: 0.9, air: 0.45 },
    slow: { factor: 0.55, duration: 2.5 },
    projectileTint: 0x7fffd8,
    glow: { color: 0x6ffff0, height: 11, size: 0.3, hz: 0.8 },
    xp: 10,
    lootTable: 'normalMonster',
    barHeight: 32,
  },
  /** A bat with purple crystals on its wings: fast, comes in a flock, circles you and shoots crystal shards. */
  crystal_bat: {
    id: 'crystal_bat',
    name: '晶翼蝠',
    spriteKey: SpriteKey.BAT,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 12,
    damage: 4,
    moveSpeed: 4.4,
    detectRange: 9,
    attackRange: 6,
    attackCooldown: 1.8,
    attackDuration: 0.5,
    radius: 0.22,
    keepDistance: 2.8,
    projectileSpeed: 7.5,
    flyer: true,
    strafe: true,
    packSize: 3,
    projectileTint: 0xc58cff,
    xp: 5,
    lootTable: 'normalMonster',
    barHeight: 30,
  },
  /** The boss of the spring cave: a deer-headed figure, eaten by the spring's corruption. Charges, and blasts the ground around itself. */
  corroded_deer: {
    id: 'corroded_deer',
    name: '蝕靈鹿',
    spriteKey: SpriteKey.DEER,
    directional: true,
    attackStyle: 'charge',
    behavior: 'melee',
    maxHp: 560,
    damage: 14,
    moveSpeed: 2.7,
    detectRange: 11,
    attackRange: 0.8,
    attackCooldown: 1.8,
    attackDuration: 0.9,
    radius: 0.5,
    xp: 220,
    lootTable: 'boss',
    barHeight: 96,
    isBoss: true,
    phaseThresholds: [0.66, 0.33],
    phaseSpeed: [1, 1.15, 1.3],
    phaseCooldown: [1, 0.8, 0.65],
    bossAttacks: [
      { id: 'gore', kind: 'cleave', minPhase: 0, weight: 3, duration: 0.9, damageMult: 1 },
      { id: 'charge', kind: 'charge', minPhase: 0, weight: 3, duration: 1.4, damageMult: 1.5, rush: 6.5, hitFraction: 0.95 },
      { id: 'stomp', kind: 'nova', minPhase: 0, weight: 2, duration: 1.5, damageMult: 1.3, radius: 4.2, hitFraction: 0.85 },
      { id: 'quake', kind: 'nova', minPhase: 2, weight: 2, duration: 1.6, damageMult: 1.5, radius: 5.2, hitFraction: 0.85 },
    ],
  },
  // ---- the ruins --------------------------------------------------------------------------------------
  /** A golem of ruin stone, furred with moss, a red core in its chest. Slow, and every blow is a slam that hits everything around it. */
  rock_golem: {
    id: 'rock_golem',
    name: '胎岩魔像',
    spriteKey: SpriteKey.GOLEM,
    directional: true,
    attackStyle: 'slam',
    behavior: 'melee',
    maxHp: 140,
    damage: 12,
    moveSpeed: 1.3,
    detectRange: 6,
    attackRange: 1.7,
    attackCooldown: 2.6,
    attackDuration: 1.4,
    radius: 0.5,
    slam: { radius: 2.4, duration: 1.4, hitFraction: 0.75, damageMult: 1.2 },
    glow: { color: 0xff3a2a, height: 44, size: 0.4, hz: 0.6 },
    xp: 24,
    lootTable: 'normalMonster',
    barHeight: 76,
  },
  /** Tier 1 of the abyss: a corrupted island creature. */
  warped: {
    id: 'warped',
    name: '畸變體',
    spriteKey: SpriteKey.WARPED,
    behavior: 'melee',
    maxHp: 48,
    damage: 8,
    moveSpeed: 2.5,
    detectRange: 7,
    attackRange: 0.35,
    attackCooldown: 1.2,
    attackDuration: 0.5,
    radius: 0.3,
    xp: 12,
    lootTable: 'normalMonster',
    barHeight: 56,
  },
  /** A shape in the fouled spring that throws cold light. */
  water_shade: {
    id: 'water_shade',
    name: '水影',
    spriteKey: SpriteKey.WATER_SHADE,
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
  /** Tier 2 of the abyss: something that imitates an ancient ruin warden. */
  echo_guard: {
    id: 'echo_guard',
    name: '仿神守衛',
    spriteKey: SpriteKey.ECHO,
    behavior: 'melee',
    maxHp: 70,
    damage: 11,
    moveSpeed: 2.2,
    detectRange: 7,
    attackRange: 0.4,
    attackCooldown: 1.4,
    attackDuration: 0.6,
    radius: 0.34,
    xp: 22,
    lootTable: 'normalMonster',
    barHeight: 62,
  },
  /** The chapter 1 boss: the imitation of the ruin's guardian statue. Same three-phase fight as the archon. */
  ruins_guardian: {
    id: 'ruins_guardian',
    name: '遺跡守衛・仿影',
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
