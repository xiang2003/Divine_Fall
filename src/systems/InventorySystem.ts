import type { EquipSlot, ItemInstance } from '../data/items';
import { emptyEquipment, type Equipment } from './stats';

export const INVENTORY_SIZE = 30;

export type AddResult = { ok: true; index: number } | { ok: false; reason: 'full' | 'duplicate' };
export type OpResult = { ok: true } | { ok: false; reason: 'full' | 'empty' | 'invalid' };

/**
 * A fixed-size backpack plus five equipment slots. Pure data; it never destroys an item:
 * every operation either moves the item somewhere or fails and leaves things exactly as they were.
 */
export class Inventory {
  readonly slots: (ItemInstance | null)[] = new Array<ItemInstance | null>(INVENTORY_SIZE).fill(null);
  readonly equipment: Equipment = emptyEquipment();

  /** `onChange` fires after every successful mutation. */
  constructor(private readonly onChange?: () => void) {}

  get freeSlots(): number {
    return this.slots.reduce((n, s) => n + (s === null ? 1 : 0), 0);
  }

  /** True if an item with this uid is in the backpack or equipped. */
  has(uid: string): boolean {
    return this.slots.some((s) => s?.uid === uid) || Object.values(this.equipment).some((e) => e?.uid === uid);
  }

  /** Puts an item in the first free slot. Fails (changing nothing) if full, or if that exact item is already owned. */
  add(item: ItemInstance): AddResult {
    if (this.has(item.uid)) return { ok: false, reason: 'duplicate' };
    const index = this.slots.indexOf(null);
    if (index === -1) return { ok: false, reason: 'full' };
    this.slots[index] = item;
    this.onChange?.();
    return { ok: true, index };
  }

  /** Equips the backpack item at `index`; whatever was in that equipment slot takes its place in the backpack. */
  equip(index: number): OpResult {
    const item = this.slots[index];
    if (index < 0 || index >= INVENTORY_SIZE) return { ok: false, reason: 'invalid' };
    if (!item) return { ok: false, reason: 'empty' };
    const previous = this.equipment[item.slot];
    this.equipment[item.slot] = item;
    this.slots[index] = previous; // swap: never needs a free slot
    this.onChange?.();
    return { ok: true };
  }

  /** Moves an equipped item to the backpack. Fails (item stays equipped) if the backpack is full. */
  unequip(slot: EquipSlot): OpResult {
    const item = this.equipment[slot];
    if (!item) return { ok: false, reason: 'empty' };
    const index = this.slots.indexOf(null);
    if (index === -1) return { ok: false, reason: 'full' };
    this.slots[index] = item;
    this.equipment[slot] = null;
    this.onChange?.();
    return { ok: true };
  }

  /** Removes and returns the backpack item at `index` (the caller must put it somewhere, e.g. on the ground). */
  take(index: number): ItemInstance | null {
    const item = this.slots[index] ?? null;
    if (!item) return null;
    this.slots[index] = null;
    this.onChange?.();
    return item;
  }
}
