/**
 * Character levels 1 to 100, area levels and how monsters grow (docs/design/level-system.md). All numbers here are first drafts that the balance
 * tests and the pacing test watch; change them here and the rest follows.
 */

export const MAX_LEVEL = 100;

/** Stat gain for every level above 1 (the rest of a character's strength comes from gear). */
export const LEVEL_BONUS = {
  maxHp: 12,
  damage: 1,
  armor: 1.5,
} as const;

// --- experience ----------------------------------------------------------------------------------

/**
 * Experience needed to go from `level` to `level + 1` is round(scale * (level + offset)^3 * growth^level).
 * The shape follows the curve of Path of Exile: flat at the start, then exponential, so the last ten levels cost about as much as the first ninety.
 * (Fitted to the points read off that curve: the total at level 60 / 70 / 80 / 90 is about 3.5% / 9% / 21% / 47% of the total at 100.)
 */
export const XP_CURVE = { scale: 40 / (125 * 1.04), offset: 4, growth: 1.04 } as const;

/** A level costs this many experience points. The cost of reaching 100 in total is about 231 million. */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  const l = Math.max(1, level);
  return Math.round(XP_CURVE.scale * Math.pow(l + XP_CURVE.offset, 3) * Math.pow(XP_CURVE.growth, l));
}

/** How many ordinary monsters of the player's own level it should take to gain a level: [level, kills], joined by straight lines. */
export const KILLS_TARGET: readonly (readonly [number, number])[] = [
  [1, 9],
  [10, 13],
  [30, 22],
  [60, 50],
  [90, 150],
  [99, 250],
];

export function killsPerLevel(level: number): number {
  const l = Math.min(Math.max(level, 1), 99);
  for (let i = 0; i + 1 < KILLS_TARGET.length; i++) {
    const [l0, k0] = KILLS_TARGET[i]!;
    const [l1, k1] = KILLS_TARGET[i + 1]!;
    if (l >= l0 && l <= l1) return k0 + ((k1 - k0) * (l - l0)) / (l1 - l0);
  }
  return KILLS_TARGET[KILLS_TARGET.length - 1]![1];
}

/**
 * The experience an ordinary monster of this level gives. It is not guessed: it is the cost of a level divided by the kills a level should take, so
 * changing the curve changes the monsters with it and the pace stays where the targets put it.
 */
export function xpPerKill(level: number): number {
  return Math.max(1, Math.round(xpToNextLevel(Math.min(level, MAX_LEVEL - 1)) / killsPerLevel(level)));
}

/** Elites are worth this many times an ordinary monster of their level. */
export const ELITE_XP_MULT = 3;
/** The `xp` of a monster definition is its weight against this (a ghoul = 10 is "one ordinary monster"). */
export const XP_WEIGHT_REFERENCE = 10;

/**
 * The experience of a kill is cut when the monster is far above or below the player (the rule of Path of Exile): inside a safe range
 * nothing is lost, outside it the share falls quickly. Loot and gold are not cut.
 */
export function xpLevelMultiplier(playerLevel: number, monsterLevel: number): number {
  const safe = 3 + Math.floor(playerLevel / 16);
  const effective = Math.max(Math.abs(playerLevel - monsterLevel) - safe, 0);
  const multiplier = Math.pow((playerLevel + 5) / (playerLevel + 5 + Math.pow(effective, 2.5)), 1.5);
  return Math.max(0.01, multiplier);
}

// --- area levels and monsters --------------------------------------------------------------------

/** An elite is this many levels above the area it stands in, and a boss this many. */
export const ELITE_LEVEL_BONUS = 1;
export const BOSS_LEVEL_BONUS = 3;

export function monsterLevel(areaLevel: number, kind: 'normal' | 'elite' | 'boss'): number {
  return Math.min(MAX_LEVEL, areaLevel + (kind === 'boss' ? BOSS_LEVEL_BONUS : kind === 'elite' ? ELITE_LEVEL_BONUS : 0));
}

/** How a monster grows with its level, compared with the numbers of its definition (those are the numbers of level 1). */
export const MONSTER_GROWTH = { hp: 1.06, damage: 1.045, gold: 1.06 } as const;

const growth = (rate: number, level: number): number => Math.pow(rate, Math.max(0, level - 1));
export const monsterHpMultiplier = (level: number): number => growth(MONSTER_GROWTH.hp, level);
export const monsterDamageMultiplier = (level: number): number => growth(MONSTER_GROWTH.damage, level);
/** Gold dropped by monsters of this level (shop prices follow the same curve in the level plan). */
export const goldMultiplier = (level: number): number => growth(MONSTER_GROWTH.gold, level);
