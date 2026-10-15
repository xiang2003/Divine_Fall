import type { InputAction } from '../config/gameConfig';
import type { DamageType } from './damageTypes';

export type SkillKind = 'spin' | 'bolt' | 'slam';

export interface SkillDef {
  id: string;
  /** The keybinding that casts it (see KEYBINDINGS). */
  action: InputAction;
  /** Key label for the skill bar. */
  keyLabel: string;
  name: string;
  description: string;
  kind: SkillKind;
  /** Seconds before it can be cast again (starts at cast). */
  cooldown: number;
  /** Seconds the player is locked into the cast animation. */
  castTime: number;
  /** Fraction of the cast at which the effect lands. */
  hitFraction: number;
  /** Multiplier of the player's attack damage. */
  damageMult: number;
  /** The kind of damage it deals (default physical). */
  damageType?: DamageType;
  /** spin / slam: radius of the area in world units. */
  radius?: number;
  /** slam: farthest distance from the player the target point may be; bolt: how far a bolt flies. */
  range?: number;
  /** bolt: flight speed in world units per second. */
  speed?: number;
  /** bolt: number of bolts per cast (before upgrades). */
  count?: number;
  /** bolt: angle in radians between neighbouring bolts when firing several. */
  spread?: number;
  /** slam: seconds enemies are staggered. Bosses ignore it. */
  stunSeconds?: number;
}

/** The first three skills. R and T are bound but unlocked later (Phase 5). */
export const SKILLS: readonly SkillDef[] = [
  {
    id: 'spin',
    action: 'skillQ',
    keyLabel: 'Q',
    name: '旋風斬',
    description: '以自身為中心橫掃一圈，對範圍內所有敵人造成大量傷害。',
    kind: 'spin',
    cooldown: 6,
    castTime: 0.45,
    hitFraction: 0.5,
    damageMult: 1.6,
    radius: 2.4,
  },
  {
    id: 'bolt',
    action: 'skillW',
    keyLabel: 'W',
    name: '神罰之矢',
    description: '朝游標方向射出會穿透敵人的光矢。',
    kind: 'bolt',
    cooldown: 4,
    castTime: 0.35,
    hitFraction: 0.5,
    damageMult: 1.3,
    damageType: 'divine',
    speed: 12,
    range: 10,
    count: 1,
    spread: 0.22,
  },
  {
    id: 'slam',
    action: 'skillE',
    keyLabel: 'E',
    name: '墜神震擊',
    description: '重擊游標指定的位置，對範圍內敵人造成傷害並使其暈眩。',
    kind: 'slam',
    cooldown: 9,
    castTime: 0.6,
    hitFraction: 0.6,
    damageMult: 2.2,
    radius: 2.2,
    range: 7,
    stunSeconds: 1.5,
  },
];

export function getSkill(id: string): SkillDef {
  const s = SKILLS.find((k) => k.id === id);
  if (!s) throw new Error(`Unknown skill "${id}"`);
  return s;
}

/** Per-skill enhancements a character has earned (granted by level-ups from Phase 5). All zero by default. */
export interface SkillUpgrade {
  /** +% skill damage. */
  damagePct: number;
  /** -% cooldown (capped at 60%). */
  cooldownReductionPct: number;
  /** Extra bolts per cast (bolt skill only). */
  extraProjectiles: number;
}

export const NO_UPGRADE: SkillUpgrade = { damagePct: 0, cooldownReductionPct: 0, extraProjectiles: 0 };
