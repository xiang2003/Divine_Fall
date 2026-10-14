import { POTIONS, STARTER_BELT, type PotionDef, type PotionId } from '../data/potions';

/** Number of potion slots (keys 1, 2 and 3). */
export const POTION_SLOTS = 3;

export interface BeltSlot {
  id: PotionId;
  count: number;
}

/** The three potion slots. Pure bookkeeping: what a potion does to the player is up to the caller. */
export class PotionBelt {
  private readonly slots: (BeltSlot | null)[] = [];

  constructor() {
    this.restock();
  }

  /** Puts the starting potions back (new game, restart). */
  restock(): void {
    this.slots.length = 0;
    for (let i = 0; i < POTION_SLOTS; i++) {
      const s = STARTER_BELT[i];
      this.slots.push(s ? { ...s } : null);
    }
  }

  /** The potion in a slot, or null when the slot is empty. */
  peek(index: number): { def: PotionDef; count: number } | null {
    const s = this.slots[index];
    return s ? { def: POTIONS[s.id], count: s.count } : null;
  }

  /** Removes one potion from a slot and returns its definition; null when the slot is empty. */
  take(index: number): PotionDef | null {
    const s = this.slots[index];
    if (!s) return null;
    s.count--;
    if (s.count <= 0) this.slots[index] = null;
    return POTIONS[s.id];
  }
}
