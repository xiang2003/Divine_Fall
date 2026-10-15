import { SpriteKey } from '../game/assetManifest';
import type { DamageType, ResistType } from './damageTypes';
import type { LootTableId } from './lootTables';

export type MonsterBehavior = 'melee' | 'ranged';

export type BossAttackKind = 'cleave' | 'nova' | 'fan' | 'charge' | 'pillars';

/** What a ground strike looks like: a stone pillar, a root spike, or only a blast. */
export type GroundStrikeStyle = 'pillar' | 'root' | 'burst';

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
  /** pillars: how many stone pillars are summoned (`radius` is the size of each one's circle). */
  pillars?: number;
  /** pillars: what comes up out of the floor (default: stone pillars). */
  strike?: GroundStrikeStyle;
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

/** A charge a normal monster makes from a few steps away: it crouches, runs `rush` units along the line to where you stood, and hurts you if it runs into you. */
export interface ChargeDef {
  /** It starts the charge when you are at most this far away (edge to edge), and at least `minRange`. */
  range: number;
  minRange: number;
  /** How far the run carries it, in world units. */
  rush: number;
  /** Length of the whole move (crouch, run, recovery) in seconds. */
  duration: number;
  damageMult: number;
  /** If the run ends against an obstacle instead of in open ground, it is stunned for this long. */
  stunSeconds: number;
}

/** Hiding: it waits invisible and out of reach until the player comes within `triggerRange`, then surfaces (taking `emerge` seconds, during which it cannot act). */
export interface AmbushDef {
  triggerRange: number;
  emerge: number;
}

/** When it dies it may burst: with probability `chance` a warning circle of `radius` appears where it fell and goes off `delay` seconds later. */
export interface DeathBurstDef {
  chance: number;
  radius: number;
  delay: number;
  damageMult: number;
}

/** A combo: after the first blow of a melee attack (or of a pounce, when it lands) `hits - 1` more follow, `gap` seconds apart. The attack must last long enough to hold them all. */
export interface ComboDef {
  hits: number;
  gap: number;
}

/** Berserk: once its health is at or below `hpFraction` of the maximum it moves, attacks and hits harder. */
export interface BerserkDef {
  hpFraction: number;
  speedMult: number;
  /** Multiplier of the time between attacks (< 1 attacks more often). */
  cooldownMult: number;
  damageMult: number;
}

/** Its ranged attack lobs a cloud onto the target's spot instead of a projectile: it shows a warning circle, then lingers and poisons whoever stands in it. */
export interface PoolDef {
  radius: number;
  /** Seconds from the throw to the cloud forming (the warning). */
  delay: number;
  /** Seconds the cloud stays. */
  duration: number;
  /** Poison damage per second while standing in it. */
  dps: number;
}

/** Splitting: the first time its health drops to `hpFraction` of the maximum, `count` copies of the monster `into` appear around it. */
export interface SplitDef {
  hpFraction: number;
  into: string;
  count: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  spriteKey: string;
  behavior: MonsterBehavior;
  maxHp: number;
  /** Damage per hit / projectile, before the player's armor or resistance. */
  damage: number;
  /** The kind of damage its hits and shots deal (default physical). */
  damageType?: DamageType;
  /** Armor against the player's physical damage (default 0): reduces it like the player's armor does (see systems/damage.ts). */
  armor?: number;
  /** Resistances against the other kinds of damage as fractions (0.5 = takes half; -0.5 = takes half again as much). */
  resist?: Partial<Record<ResistType, number>>;
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
  /** Its projectiles steer toward the target, turning at most this many radians per second. */
  homing?: number;
  /** Melee: a string of blows (see ComboDef). */
  combo?: ComboDef;
  /** Goes berserk when badly hurt (see BerserkDef). */
  berserk?: BerserkDef;
  /** Ranged: lobs poison clouds (see PoolDef). */
  pool?: PoolDef;
  /** Melee: when it chases you it comes in from the side (each member of a pack takes a side), and only closes in straight when it is near. */
  flank?: boolean;
  /** Melee: a charge from a distance (see ChargeDef). */
  charge?: ChargeDef;
  /** Starts hidden (see AmbushDef). */
  ambush?: AmbushDef;
  /** May burst when it dies (see DeathBurstDef). */
  deathBurst?: DeathBurstDef;
  /** Splits into phantoms when badly hurt (see SplitDef). */
  split?: SplitDef;
  /** Breaks into stone chunks when it dies instead of falling over. */
  shatters?: boolean;
  /** An illusion: drawn see-through, gives no experience, loot or quest progress, and does not count toward the monsters left on the map. */
  phantom?: boolean;
  /** Seconds after which it vanishes by itself. */
  lifetime?: number;
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
    damageType: 'corruption',
    resist: { corruption: 0.3 },
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
    damageType: 'cold',
    resist: { cold: 0.5, lightning: -0.25 },
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
    damageType: 'divine',
    resist: { divine: 0.3 },
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
    damageType: 'corruption',
    resist: { corruption: 0.5 },
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
  // ---- the primordial core ----------------------------------------------------------------------------
  /** A man-shaped heap of ancient stone: slow, and it throws one heavy punch at a time. It breaks into stones when it dies. */
  stone_attendant: {
    id: 'stone_attendant',
    name: '胎岩侍者',
    spriteKey: SpriteKey.ATTENDANT,
    directional: true,
    attackStyle: 'lunge',
    behavior: 'melee',
    maxHp: 100,
    damage: 15,
    armor: 15,
    moveSpeed: 1.4,
    detectRange: 7,
    attackRange: 0.5,
    attackCooldown: 2.2,
    attackDuration: 1.2,
    radius: 0.42,
    shatters: true,
    xp: 22,
    lootTable: 'normalMonster',
    barHeight: 66,
  },
  /** A floating old mask. Its spirit bolts follow you; when it is badly hurt it throws off two see-through copies of itself. */
  mask_spirit: {
    id: 'mask_spirit',
    name: '殘面靈',
    spriteKey: SpriteKey.MASK,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 34,
    damage: 8,
    damageType: 'corruption',
    resist: { divine: -0.25 },
    moveSpeed: 2.6,
    detectRange: 9,
    attackRange: 7,
    attackCooldown: 2.6,
    attackDuration: 0.7,
    radius: 0.28,
    keepDistance: 3.5,
    projectileSpeed: 4.2,
    homing: 1.7,
    flyer: true,
    split: { hpFraction: 0.4, into: 'mask_phantom', count: 2 },
    projectileTint: 0x8affea,
    xp: 18,
    lootTable: 'normalMonster',
    barHeight: 52,
  },
  /** A copy a mask throws off: one hit takes it, and it fades on its own. */
  mask_phantom: {
    id: 'mask_phantom',
    name: '殘面幻影',
    spriteKey: SpriteKey.MASK,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 1,
    damage: 5,
    damageType: 'corruption',
    moveSpeed: 2.8,
    detectRange: 12,
    attackRange: 7,
    attackCooldown: 2.4,
    attackDuration: 0.7,
    radius: 0.26,
    keepDistance: 3.5,
    projectileSpeed: 4.2,
    homing: 1.7,
    flyer: true,
    phantom: true,
    lifetime: 9,
    projectileTint: 0x8affea,
    xp: 0,
    lootTable: 'normalMonster',
    barHeight: 52,
  },
  /** The boss of the core: a huge faceless statue with a stone blade. Slashes, charges, and calls stone pillars up out of the floor. */
  core_watcher: {
    id: 'core_watcher',
    name: '初胎守望者',
    spriteKey: SpriteKey.WATCHER,
    directional: true,
    attackStyle: 'charge',
    behavior: 'melee',
    maxHp: 900,
    damage: 18,
    damageType: 'divine',
    armor: 15,
    resist: { divine: 0.4, corruption: -0.25 },
    moveSpeed: 2.3,
    detectRange: 12,
    attackRange: 1.3,
    attackCooldown: 2,
    attackDuration: 1.1,
    radius: 0.7,
    xp: 400,
    lootTable: 'boss',
    barHeight: 124,
    isBoss: true,
    phaseThresholds: [0.66, 0.33],
    phaseSpeed: [1, 1.1, 1.25],
    phaseCooldown: [1, 0.85, 0.7],
    bossAttacks: [
      { id: 'slash', kind: 'cleave', minPhase: 0, weight: 3, duration: 1.1, damageMult: 1 },
      { id: 'charge', kind: 'charge', minPhase: 0, weight: 2, duration: 1.5, damageMult: 1.5, rush: 7, hitFraction: 0.95 },
      { id: 'pillars', kind: 'pillars', minPhase: 1, weight: 3, duration: 1.6, damageMult: 1.2, pillars: 4, radius: 1.3, hitFraction: 0.9 },
      { id: 'pillar_storm', kind: 'pillars', minPhase: 2, weight: 3, duration: 1.5, damageMult: 1.2, pillars: 7, radius: 1.3, hitFraction: 0.9 },
    ],
  },
  // ---- the Mist Coast (chapter 2) ---------------------------------------------------------------------
  /** A wolf of the wild woods: fast, in packs, and it comes at you from the side. */
  wild_wolf: {
    id: 'wild_wolf',
    name: '荒林野狼',
    spriteKey: SpriteKey.WOLF,
    directional: true,
    attackStyle: 'pounce',
    behavior: 'melee',
    maxHp: 26,
    damage: 7,
    moveSpeed: 4.2,
    detectRange: 9,
    attackRange: 0.35,
    attackCooldown: 1.3,
    attackDuration: 0.4,
    radius: 0.28,
    pounce: { range: 2.6, speed: 8, duration: 0.7, damageMult: 1.3 },
    flank: true,
    packSize: 3,
    xp: 8,
    lootTable: 'normalMonster',
    barHeight: 44,
  },
  /** A big boar with split horns. It charges, and if it runs into a rock or a tree instead of you it is left dazed. */
  cleft_boar: {
    id: 'cleft_boar',
    name: '裂角野豬',
    spriteKey: SpriteKey.BOAR,
    directional: true,
    attackStyle: 'charge',
    behavior: 'melee',
    maxHp: 70,
    damage: 11,
    armor: 6,
    moveSpeed: 2.6,
    detectRange: 8,
    attackRange: 0.4,
    attackCooldown: 2,
    attackDuration: 0.5,
    radius: 0.4,
    charge: { range: 8, minRange: 2.5, rush: 6, duration: 1.3, damageMult: 1.6, stunSeconds: 1.8 },
    xp: 18,
    lootTable: 'normalMonster',
    barHeight: 46,
  },
  /** A figure of living seawater that lies in wait at the water's edge, rises when you come close, and throws blades of water. */
  drowned_spirit: {
    id: 'drowned_spirit',
    name: '溺靈水妖',
    spriteKey: SpriteKey.SPIRIT,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 30,
    damage: 8,
    damageType: 'cold',
    resist: { cold: 0.5, lightning: -0.3 },
    moveSpeed: 2.6,
    detectRange: 9,
    attackRange: 7,
    attackCooldown: 2.2,
    attackDuration: 0.6,
    radius: 0.28,
    keepDistance: 3,
    projectileSpeed: 7.5,
    projectileTint: 0x7fd8ff,
    ambush: { triggerRange: 3.6, emerge: 0.5 },
    xp: 16,
    lootTable: 'normalMonster',
    barHeight: 56,
  },
  /** The dead of a wreck, held together by anger: slow, with a rusty blade, and sometimes it bursts with resentment when it falls. */
  wreck_revenant: {
    id: 'wreck_revenant',
    name: '沉船怨骸',
    spriteKey: SpriteKey.REVENANT,
    directional: true,
    attackStyle: 'lunge',
    behavior: 'melee',
    maxHp: 85,
    damage: 12,
    resist: { corruption: 0.5 },
    moveSpeed: 1.5,
    detectRange: 6,
    attackRange: 0.45,
    attackCooldown: 2,
    attackDuration: 1,
    radius: 0.36,
    deathBurst: { chance: 0.5, radius: 2.2, delay: 0.9, damageMult: 1.1 },
    xp: 20,
    lootTable: 'normalMonster',
    barHeight: 62,
  },
  // ---- the green-vine forest (chapter 2) -------------------------------------------------------------
  /** A wolf of the old forest: fast, in a pack, comes at you from the side, and howls for the rest of the pack when it is badly hurt. */
  green_fang_wolf: {
    id: 'green_fang_wolf',
    name: '青牙狼',
    spriteKey: SpriteKey.GREEN_FANG,
    directional: true,
    attackStyle: 'pounce',
    behavior: 'melee',
    maxHp: 40,
    damage: 9,
    moveSpeed: 4.3,
    detectRange: 9,
    attackRange: 0.35,
    attackCooldown: 1.3,
    attackDuration: 0.4,
    radius: 0.28,
    pounce: { range: 2.8, speed: 8.5, duration: 0.75, damageMult: 1.3 },
    flank: true,
    packSize: 3,
    split: { hpFraction: 0.35, into: 'green_fang_ally', count: 2 },
    xp: 12,
    lootTable: 'normalMonster',
    barHeight: 46,
  },
  /** A wolf that came when another one howled: the same, only weaker, and it cannot howl itself. */
  green_fang_ally: {
    id: 'green_fang_ally',
    name: '青牙狼',
    spriteKey: SpriteKey.GREEN_FANG,
    directional: true,
    attackStyle: 'pounce',
    behavior: 'melee',
    maxHp: 24,
    damage: 7,
    moveSpeed: 4.3,
    detectRange: 12,
    attackRange: 0.35,
    attackCooldown: 1.3,
    attackDuration: 0.4,
    radius: 0.28,
    pounce: { range: 2.8, speed: 8.5, duration: 0.75, damageMult: 1.3 },
    flank: true,
    xp: 6,
    lootTable: 'normalMonster',
    barHeight: 46,
  },
  /** A big ape in armour of vines and bark. Slow; every blow is two fists slammed into the ground. */
  vine_ape: {
    id: 'vine_ape',
    name: '藤甲猿',
    spriteKey: SpriteKey.VINE_APE,
    directional: true,
    attackStyle: 'slam',
    behavior: 'melee',
    maxHp: 150,
    damage: 14,
    armor: 10,
    moveSpeed: 1.9,
    detectRange: 7,
    attackRange: 1.8,
    attackCooldown: 2.2,
    attackDuration: 1.3,
    radius: 0.5,
    slam: { radius: 2.4, duration: 1.3, hitFraction: 0.7, damageMult: 1.2 },
    xp: 30,
    lootTable: 'normalMonster',
    barHeight: 74,
  },
  /** A tainted flower. It hardly moves, and lobs clouds of poison dust that stay on the ground. */
  rot_flower: {
    id: 'rot_flower',
    name: '腐靈花妖',
    spriteKey: SpriteKey.ROT_FLOWER,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 60,
    damage: 5,
    damageType: 'corruption',
    resist: { corruption: 0.6, divine: -0.25 },
    moveSpeed: 1.1,
    detectRange: 9,
    attackRange: 7,
    attackCooldown: 3.2,
    attackDuration: 0.9,
    radius: 0.4,
    keepDistance: 3.5,
    pool: { radius: 1.7, delay: 0.8, duration: 6, dps: 4 },
    xp: 22,
    lootTable: 'normalMonster',
    barHeight: 60,
  },
  /** The boss of the green-vine forest: a guardian of old trees and stone. Swings its arms, stamps, and calls root spikes out of the ground. */
  old_wood_warden: {
    id: 'old_wood_warden',
    name: '古木巡守者',
    spriteKey: SpriteKey.WARDEN,
    directional: true,
    attackStyle: 'slam',
    behavior: 'melee',
    maxHp: 1100,
    damage: 20,
    armor: 15,
    moveSpeed: 2.2,
    detectRange: 12,
    attackRange: 1.6,
    attackCooldown: 2,
    attackDuration: 1.2,
    radius: 0.75,
    xp: 600,
    lootTable: 'boss',
    barHeight: 130,
    isBoss: true,
    phaseThresholds: [0.66, 0.33],
    phaseSpeed: [1, 1.1, 1.25],
    phaseCooldown: [1, 0.85, 0.7],
    bossAttacks: [
      { id: 'swing', kind: 'cleave', minPhase: 0, weight: 3, duration: 1.2, damageMult: 1 },
      { id: 'stomp', kind: 'nova', minPhase: 0, weight: 2, duration: 1.5, damageMult: 1.3, radius: 3.6, hitFraction: 0.85 },
      { id: 'roots', kind: 'pillars', minPhase: 1, weight: 3, duration: 1.8, damageMult: 1.2, pillars: 5, radius: 1.1, hitFraction: 0.9, strike: 'root' },
      { id: 'root_storm', kind: 'pillars', minPhase: 2, weight: 3, duration: 1.8, damageMult: 1.2, pillars: 9, radius: 1.1, hitFraction: 0.9, strike: 'root' },
    ],
  },
  // ---- the broken-sword pass (chapter 2) --------------------------------------------------------------
  /** A mountain wolf with claws like blades: fast, a short dash, and a string of slashes when it lands. */
  mountain_blade_wolf: {
    id: 'mountain_blade_wolf',
    name: '山地刃狼',
    spriteKey: SpriteKey.BLADE_WOLF,
    directional: true,
    attackStyle: 'pounce',
    behavior: 'melee',
    maxHp: 48,
    damage: 8,
    moveSpeed: 4.8,
    detectRange: 9,
    attackRange: 0.35,
    attackCooldown: 1.6,
    attackDuration: 1.2,
    radius: 0.28,
    pounce: { range: 3.2, speed: 9.5, duration: 1.15, damageMult: 1.1 },
    combo: { hits: 3, gap: 0.15 },
    xp: 16,
    lootTable: 'normalMonster',
    barHeight: 46,
  },
  /** A swordsman with a broken sabre: a short dash, then three quick cuts. */
  exiled_swordsman: {
    id: 'exiled_swordsman',
    name: '流亡刀客',
    spriteKey: SpriteKey.SWORDSMAN,
    directional: true,
    attackStyle: 'charge',
    behavior: 'melee',
    maxHp: 90,
    damage: 11,
    armor: 10,
    moveSpeed: 2.8,
    detectRange: 8,
    attackRange: 0.5,
    attackCooldown: 2,
    attackDuration: 1.3,
    radius: 0.34,
    pounce: { range: 3.4, speed: 9, duration: 1.3, damageMult: 1.0 },
    combo: { hits: 3, gap: 0.22 },
    xp: 24,
    lootTable: 'normalMonster',
    barHeight: 62,
  },
  /** A cultivator gone wrong: dark bolts from a distance, and when it is badly hurt it goes wild. */
  fallen_cultivator: {
    id: 'fallen_cultivator',
    name: '墮靈修士',
    spriteKey: SpriteKey.CULTIST,
    directional: true,
    attackStyle: 'spit',
    behavior: 'ranged',
    maxHp: 70,
    damage: 10,
    damageType: 'corruption',
    resist: { corruption: 0.3, divine: -0.2 },
    moveSpeed: 2.2,
    detectRange: 10,
    attackRange: 7.5,
    attackCooldown: 2.2,
    attackDuration: 0.8,
    radius: 0.3,
    keepDistance: 3.5,
    projectileSpeed: 6.5,
    projectileTint: 0x9a4aff,
    berserk: { hpFraction: 0.35, speedMult: 1.5, cooldownMult: 0.55, damageMult: 1.3 },
    xp: 24,
    lootTable: 'normalMonster',
    barHeight: 62,
  },
  /** The boss of the pass: weapons of an old war and rock, fused into one giant. Great sweeps, and a slam it takes a long breath for. */
  broken_sword_colossus: {
    id: 'broken_sword_colossus',
    name: '斷劍巨像',
    spriteKey: SpriteKey.COLOSSUS,
    directional: true,
    attackStyle: 'slam',
    behavior: 'melee',
    maxHp: 1300,
    damage: 22,
    armor: 40,
    resist: { lightning: -0.3 },
    moveSpeed: 1.9,
    detectRange: 12,
    attackRange: 1.8,
    attackCooldown: 2.2,
    attackDuration: 1.3,
    radius: 0.8,
    xp: 700,
    lootTable: 'boss',
    barHeight: 140,
    isBoss: true,
    phaseThresholds: [0.66, 0.33],
    phaseSpeed: [1, 1.1, 1.25],
    phaseCooldown: [1, 0.85, 0.7],
    bossAttacks: [
      { id: 'slash', kind: 'cleave', minPhase: 0, weight: 3, duration: 1.3, damageMult: 1 },
      { id: 'sweep', kind: 'nova', minPhase: 0, weight: 3, duration: 1.4, damageMult: 1.3, radius: 3.8, hitFraction: 0.6 },
      { id: 'heavy_slam', kind: 'nova', minPhase: 0, weight: 2, duration: 2.6, damageMult: 2, radius: 5.6, hitFraction: 0.92 },
      { id: 'charge', kind: 'charge', minPhase: 1, weight: 2, duration: 1.5, damageMult: 1.5, rush: 6.5, hitFraction: 0.95 },
      { id: 'shards', kind: 'pillars', minPhase: 2, weight: 3, duration: 1.6, damageMult: 1.2, pillars: 7, radius: 1.2, hitFraction: 0.9 },
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
    armor: 25,
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
    damageType: 'cold',
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
    armor: 20,
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
    damageType: 'divine',
    armor: 15,
    resist: { divine: 0.4 },
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
