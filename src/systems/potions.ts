import { POTIONS, STARTER_BELT, type PotionDef, type PotionId } from '../data/potions';

/** Number of potion slots (keys 1, 2 and 3). */
export const POTION_SLOTS = 3;

interface BeltSlot {
  id: PotionId;
  /** Charges held, fractions included (a kill adds a part of a charge). Only whole charges can be used. */
  charges: number;
}

export interface HeldPotion {
  def: PotionDef;
  /** Whole charges that can be used now. */
  charges: number;
  /** Progress toward the next charge (0 to 1; 0 when the potion is full). */
  fraction: number;
}

/**
 * The three potion slots. A potion is not used up: each use costs one charge, kills give charge back, and
 * `refill` (coming back to town) fills everything. Pure bookkeeping: what a potion does is up to the caller.
 */
export class PotionBelt {
  private readonly slots: (BeltSlot | null)[] = [];

  constructor() {
    this.refill();
  }

  /** Puts the starting potions back, all charges full (new game, restart; also the town visit). */
  refill(): void {
    if (this.slots.length === 0) {
      for (let i = 0; i < POTION_SLOTS; i++) {
        const id = STARTER_BELT[i] ?? null;
        this.slots.push(id ? { id, charges: POTIONS[id].maxCharges } : null);
      }
      return;
    }
    for (const s of this.slots) if (s) s.charges = POTIONS[s.id].maxCharges;
  }

  /** The potion in a slot, or null when the slot is empty. */
  peek(index: number): HeldPotion | null {
    const s = this.slots[index];
    if (!s) return null;
    const def = POTIONS[s.id];
    const whole = Math.floor(s.charges + 1e-9);
    return { def, charges: whole, fraction: whole >= def.maxCharges ? 0 : Math.max(0, s.charges - whole) };
  }

  /** Spends one charge and returns the potion's definition; null when the slot is empty or has no whole charge. */
  take(index: number): PotionDef | null {
    const s = this.slots[index];
    if (!s || this.peek(index)!.charges < 1) return null;
    s.charges = Math.max(0, s.charges - 1);
    return POTIONS[s.id];
  }

  /** True when every potion holds all its charges. */
  get isFull(): boolean {
    return this.slots.every((s) => !s || s.charges >= POTIONS[s.id].maxCharges);
  }

  /** Gives every potion `amount` charges back (capped at full). */
  recharge(amount: number): void {
    for (const s of this.slots) if (s) s.charges = Math.min(POTIONS[s.id].maxCharges, s.charges + amount);
  }
}
