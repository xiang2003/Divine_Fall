/** Central tunables. Keep gameplay numbers here (or in src/data) rather than scattered in logic. */

export type InputAction =
  | 'skillQ'
  | 'skillW'
  | 'skillE'
  | 'skillR'
  | 'skillT'
  | 'potion1'
  | 'potion2'
  | 'potion3'
  | 'dodge'
  | 'inventory'
  | 'quests'
  | 'map'
  | 'pickup'
  | 'pause'
  | 'debug'
  | 'debugLoot'
  | 'debugEquip'
  | 'debugReset'
  | 'debugTeleport'
  | 'debugLevel'
  | 'debugFlag';

/** Skill actions in hotbar order. */
export const SKILL_ACTIONS = ['skillQ', 'skillW', 'skillE', 'skillR', 'skillT'] as const satisfies readonly InputAction[];

/** Potion slot actions in belt order. */
export const POTION_ACTIONS = ['potion1', 'potion2', 'potion3'] as const satisfies readonly InputAction[];

/** Bound but not yet unlocked skill slots (their skills arrive with progression in Phase 5). */
export const LOCKED_SKILL_ACTIONS = ['skillR', 'skillT'] as const satisfies readonly InputAction[];

/** A skill key pressed during another action is remembered this long (seconds) and cast as soon as possible. */
export const SKILL_INPUT_BUFFER = 0.5;

/**
 * Keyboard bindings, as `KeyboardEvent.code` values (layout independent).
 * Movement is mouse-only (see MOUSE_BINDINGS), so W is free to be a skill key.
 * Skills, dodge, inventory and pickup are reserved here; their effects arrive in later phases.
 */
export const KEYBINDINGS: Record<InputAction, readonly string[]> = {
  skillQ: ['KeyQ'],
  skillW: ['KeyW'],
  skillE: ['KeyE'],
  skillR: ['KeyR'],
  skillT: ['KeyT'],
  potion1: ['Digit1'],
  potion2: ['Digit2'],
  potion3: ['Digit3'],
  dodge: ['Space'],
  inventory: ['KeyI', 'KeyB'],
  quests: ['KeyJ'],
  map: ['KeyM'],
  pickup: ['KeyF'],
  pause: ['Escape'],
  debug: ['F3'],
  debugLoot: ['F4'],
  debugEquip: ['F6'],
  debugReset: ['F7'],
  debugTeleport: ['F8'],
  debugLevel: ['F9'],
  debugFlag: ['F10'],
};

export type MouseAction = 'move' | 'attack';

/** Mouse buttons (MouseEvent.button: 0 = left, 1 = middle, 2 = right). */
export const MOUSE_BINDINGS: Record<MouseAction, number> = {
  move: 0,
  attack: 2,
};

/** Isometric tile footprint in screen pixels (2:1 diamond). One world unit = one tile. */
export const TILE_W = 64;
export const TILE_H = 32;

export const CAMERA_CONFIG = {
  /** Screen pixels per art pixel. An integer keeps nearest-filtered pixel art crisp. */
  zoom: 2,
  /** Higher = camera catches up faster. 0 disables smoothing. */
  followSharpness: 10,
} as const;

export const PLAYER_CONFIG = {
  /** Collision circle radius in world units. */
  radius: 0.28,
  /** Click-to-move stops once the player is this close (world units) to the target. */
  arriveDistance: 0.08,
  /** Half-angle (radians) of the melee swing cone: 65 degrees each side of the aim direction. */
  attackArcHalfAngle: (65 * Math.PI) / 180,
  /** Fraction of the swing animation at which damage is applied (the strike frame). */
  attackHitFraction: 0.5,
  /** Seconds without taking damage before out-of-combat regeneration starts. */
  regenDelay: 5,
  /** Out-of-combat HP regenerated per second (placeholder until potions / life-leech exist). */
  regenPerSecond: 3,
  /** Mana pool. Nothing spends mana yet; the gauge and the mana potion exist so skills can cost it later. */
  baseMana: 60,
  /** Level-1 stats before equipment and progression modifiers (see systems/stats.ts). */
  baseStats: {
    maxHp: 100,
    /** Damage per hit before crits and armor. Unarmed value; the starter sword adds +4 (see Game.buildWorld). */
    damage: 8,
    /** Swings per second. */
    attackSpeed: 1.6,
    /** Melee reach measured from the player's centre to the edge of the target (world units). */
    attackRange: 1.5,
    armor: 5,
    critChance: 0.05,
    /** Damage multiplier on a critical hit. */
    critDamage: 1.5,
    /** World units (tiles) per second. */
    moveSpeed: 4.5,
  },
} as const;

/** Dodge (Space): a short invulnerable dash toward the cursor. */
export const DODGE_CONFIG = {
  /** Distance covered by the dash, in world units. */
  distance: 3.2,
  /** Seconds the dash lasts. */
  duration: 0.2,
  /** Seconds before the next dodge. */
  cooldown: 1.0,
  /** Seconds of damage immunity from the start of the dash (slightly longer than the dash itself). */
  invulnDuration: 0.35,
} as const;

export const LOOT_CONFIG = {
  /** The player picks an item up automatically once this close to the one they targeted (world units). */
  pickupRange: 1.2,
  /** F picks up the nearest item within this distance. */
  keyPickupRange: 1.6,
  /** Items scatter this far from where the monster died. */
  scatterRadius: 0.7,
  /** Ground items beyond this count push out the oldest *normal* item (never rarer ones). */
  maxGroundDrops: 60,
} as const;

/** Largest simulation step, so a tab switch or hitch can't teleport anyone through a wall. */
export const MAX_FRAME_DT = 0.05;

/** Maximum distance moved per collision sub-step (must stay well under the collision radius). */
export const MAX_MOVE_STEP = 0.15;
