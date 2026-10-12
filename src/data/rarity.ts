export type Rarity = 'normal' | 'magic' | 'rare' | 'legendary';

/** Weakest to strongest. */
export const RARITIES: readonly Rarity[] = ['normal', 'magic', 'rare', 'legendary'];

/** One source of truth for rarity colour and wording, used by the HUD, ground labels, tooltips and glows. */
export const RARITY_INFO: Record<Rarity, { label: string; color: string }> = {
  normal: { label: '普通', color: '#e8e4da' },
  magic: { label: '魔法', color: '#6f8fff' },
  rare: { label: '稀有', color: '#ffd84a' },
  legendary: { label: '傳奇', color: '#ff8a2a' },
};

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}
