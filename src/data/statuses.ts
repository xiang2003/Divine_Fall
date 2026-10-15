import type { DamageType } from './damageTypes';

/**
 * Status effects (docs/design/status-effects.md). The identifiers are fixed values. Three kinds:
 * - damage: hurts over time (burning, bleeding, corruption, poison); the damage goes through the defense of its own type;
 * - control: takes away what the target can do (slow, freeze, immobilize, silence, knockback, blind);
 * - debuff: weakens the target (shock, armor break, vulnerability, weaken).
 */
export type StatusId =
  | 'burning'
  | 'bleeding'
  | 'corruption'
  | 'poison'
  | 'electrocution'
  | 'slow'
  | 'freeze'
  | 'shock'
  | 'mark'
  | 'armorBreak'
  | 'vulnerability'
  | 'weaken'
  | 'blind'
  | 'knockback'
  | 'immobilize'
  | 'silence'
  | 'purify';

export type StatusCategory = 'damage' | 'control' | 'debuff';

export interface StatusDef {
  id: StatusId;
  name: string;
  category: StatusCategory;
  /** False for the ones that are only designed so far: nothing applies them yet and the manager refuses them. */
  implemented: boolean;
  /** Colour of its name and of the tint of the figure it is on. */
  color: string;
  /** Seconds it lasts when nothing says otherwise. */
  duration: number;
  /** It can never last longer than this, however often it is refreshed or lengthened (so nothing is locked down for ever). */
  maxDuration: number;
  /** How many copies can run at once (1 = a new one only refreshes the running one). */
  maxStacks: number;
  /** Cleansing can remove it. */
  dispellable: boolean;
  /** damage: the kind of damage it deals. */
  damageType?: DamageType;
  /** damage: the share of the hit that applied it that is paid out over its whole duration (before increases). */
  dotFraction?: number;
  /** damage: does armor reduce it? (resistances always apply). Bleeding is defined as no. */
  armorApplies?: boolean;
  /**
   * The strength when nothing says otherwise: slow = the speed factor that is left (0.6 = 40% slower); shock = extra damage taken; armor break =
   * the share of armor taken away; weaken = the share of damage taken off what the target deals; vulnerability = resistance points taken away.
   */
  magnitude?: number;
  /** The strength never goes past this (for slow: never below), so a stack of effects cannot make a target helpless or invulnerable. */
  magnitudeLimit?: number;
  /** control: seconds after it ends in which it cannot be put on again (no chain-locking). */
  immunityAfter?: number;
  /** control: resistance of the target (`controlResist`) shortens it. */
  controlled?: boolean;
}

export const STATUSES: Record<StatusId, StatusDef> = {
  burning: { id: 'burning', name: '燃燒', category: 'damage', implemented: true, color: '#ff8a3a', duration: 4, maxDuration: 8, maxStacks: 1, dispellable: true, damageType: 'fire', dotFraction: 0.6 },
  bleeding: { id: 'bleeding', name: '流血', category: 'damage', implemented: true, color: '#e04848', duration: 4, maxDuration: 8, maxStacks: 1, dispellable: true, damageType: 'physical', dotFraction: 0.5, armorApplies: false },
  corruption: { id: 'corruption', name: '腐化侵蝕', category: 'damage', implemented: true, color: '#b87be8', duration: 5, maxDuration: 10, maxStacks: 1, dispellable: true, damageType: 'corruption', dotFraction: 0.7 },
  poison: { id: 'poison', name: '中毒', category: 'damage', implemented: true, color: '#7be07b', duration: 4, maxDuration: 12, maxStacks: 1, dispellable: true, damageType: 'corruption', dotFraction: 1 },
  electrocution: { id: 'electrocution', name: '感電爆發', category: 'damage', implemented: false, color: '#ffe14a', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: false, damageType: 'lightning' },
  slow: { id: 'slow', name: '緩速', category: 'control', implemented: true, color: '#7fd4ff', duration: 3, maxDuration: 6, maxStacks: 1, dispellable: true, magnitude: 0.6, magnitudeLimit: 0.3, controlled: true },
  freeze: { id: 'freeze', name: '凍結', category: 'control', implemented: true, color: '#bfeaff', duration: 1.5, maxDuration: 3, maxStacks: 1, dispellable: false, immunityAfter: 3, controlled: true },
  shock: { id: 'shock', name: '感電', category: 'debuff', implemented: true, color: '#ffe14a', duration: 4, maxDuration: 8, maxStacks: 1, dispellable: true, magnitude: 0.2, magnitudeLimit: 0.5 },
  mark: { id: 'mark', name: '標記', category: 'debuff', implemented: true, color: '#ff9a7a', duration: 5, maxDuration: 8, maxStacks: 1, dispellable: true, magnitude: 0.15, magnitudeLimit: 0.3 },
  armorBreak: { id: 'armorBreak', name: '破甲', category: 'debuff', implemented: true, color: '#c8b08a', duration: 5, maxDuration: 10, maxStacks: 1, dispellable: true, magnitude: 0.3, magnitudeLimit: 0.7 },
  vulnerability: { id: 'vulnerability', name: '脆弱', category: 'debuff', implemented: false, color: '#c070c0', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: true },
  weaken: { id: 'weaken', name: '虛弱', category: 'debuff', implemented: true, color: '#a08ad8', duration: 5, maxDuration: 10, maxStacks: 1, dispellable: true, magnitude: 0.25, magnitudeLimit: 0.5 },
  blind: { id: 'blind', name: '致盲', category: 'control', implemented: false, color: '#888888', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: true, controlled: true },
  knockback: { id: 'knockback', name: '擊退', category: 'control', implemented: false, color: '#dddddd', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: false, controlled: true },
  immobilize: { id: 'immobilize', name: '禁錮', category: 'control', implemented: false, color: '#9ad0ff', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: true, controlled: true },
  silence: { id: 'silence', name: '沉默', category: 'control', implemented: false, color: '#aaaaaa', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: true, controlled: true },
  purify: { id: 'purify', name: '淨化', category: 'debuff', implemented: false, color: '#fff2b0', duration: 0, maxDuration: 0, maxStacks: 1, dispellable: false },
};

export const STATUS_IDS = Object.keys(STATUSES) as StatusId[];

/** What the first phase can do. */
export const IMPLEMENTED_STATUS_IDS = STATUS_IDS.filter((id) => STATUSES[id].implemented);

/** A freeze gauge: how much "frozen" a target must collect before it freezes, and how fast the gauge drains when it is not hit. */
export const FREEZE_RULES = {
  /** Points of freeze build-up that freeze a normal monster. A boss needs `bossFactor` times as many. */
  threshold: 100,
  bossFactor: 3,
  /** Share of the threshold the gauge loses each second. */
  drainPerSecond: 0.2,
} as const;

/** Control resistance a boss has when its definition does not say: its controls last half as long. */
export const BOSS_CONTROL_RESIST = 0.5;
/** Control resistance never goes past this: a control always lasts at least a tenth of its time. */
export const MAX_CONTROL_RESIST = 0.9;
