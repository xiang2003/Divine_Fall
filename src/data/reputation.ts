/**
 * Reputation on the neutral continent (docs/design/chapter2-part2-forgers-trial.md, "聲望"): how each group thinks of the way the player acts.
 * It is a handful of small whole numbers, not a faction war: each one only opens or closes a few specific things.
 */
export type FactionId = 'patrol' | 'guild' | 'merchants' | 'locals';

export const FACTION_IDS: readonly FactionId[] = ['patrol', 'guild', 'merchants', 'locals'];

export const FACTIONS: Record<FactionId, { name: string; /** Who speaks for them. */ npc: string; /** What it changes, for the quest log. */ effect: string }> = {
  patrol: { name: '巡山司信任', npc: '林若棠', effect: '信任時多開一組懸賞與調查任務' },
  guild: { name: '工匠聯盟信任', npc: '鐵山', effect: '信任時開放特殊製作配方' },
  merchants: { name: '商會關係', npc: '周伯', effect: '影響商店的價格與情報' },
  locals: { name: '地方居民評價', npc: '沈青禾', effect: '信任時有些支線的人願意幫忙' },
};

/** Where a reputation can go. */
export const REPUTATION_MIN = -2;
export const REPUTATION_MAX = 4;

/** What a point of reputation with the merchants does to the price of what the player buys (3% each, at most 12%). */
export const MERCHANT_PRICE_PER_POINT = 0.03;
export const MERCHANT_PRICE_LIMIT = 0.12;

const RANKS: Record<number, string> = { [-2]: '敵視', [-1]: '冷淡', 0: '普通', 1: '友善', 2: '信任', 3: '敬重', 4: '傳頌' };

/** The word for a value of reputation. */
export function reputationRank(value: number): string {
  return RANKS[Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, Math.round(value)))]!;
}
