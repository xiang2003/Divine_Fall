import type { EquipSlot } from '../data/items';
import { drawItemIcon } from '../game/ItemArt';

const cache = new Map<EquipSlot, string>();

/** Data URL of the placeholder icon for a slot (drawn once, then cached). */
export function itemIconUrl(slot: EquipSlot): string {
  let url = cache.get(slot);
  if (!url) {
    url = drawItemIcon(slot).toDataURL('image/png');
    cache.set(slot, url);
  }
  return url;
}
