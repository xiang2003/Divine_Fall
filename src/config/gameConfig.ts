/** Central tunables. Keep gameplay numbers here (or in src/data) rather than scattered in logic. */

export type InputAction =
  | 'skillQ'
  | 'skillW'
  | 'skillE'
  | 'skillR'
  | 'skillT'
  | 'dodge'
  | 'inventory'
  | 'pickup'
  | 'pause'
  | 'debug';

/** Skill actions in hotbar order. */
export const SKILL_ACTIONS = ['skillQ', 'skillW', 'skillE', 'skillR', 'skillT'] as const satisfies readonly InputAction[];

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
  dodge: ['Space'],
  inventory: ['KeyI', 'KeyB'],
  pickup: ['KeyF'],
  pause: ['Escape'],
  debug: ['F3'],
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
  /** Level-1 stats before equipment and progression modifiers (see systems/stats.ts). */
  baseStats: {
    maxHp: 100,
    /** Damage per hit before crits and armor. */
    damage: 12,
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

/** Largest simulation step, so a tab switch or hitch can't teleport anyone through a wall. */
export const MAX_FRAME_DT = 0.05;

/** Maximum distance moved per collision sub-step (must stay well under the collision radius). */
export const MAX_MOVE_STEP = 0.15;
