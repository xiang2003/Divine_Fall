import {
  FACTION_IDS,
  FACTIONS,
  MERCHANT_PRICE_LIMIT,
  MERCHANT_PRICE_PER_POINT,
  REPUTATION_MAX,
  REPUTATION_MIN,
  reputationRank,
  type FactionId,
} from '../data/reputation';

/** One line of the reputation page. */
export interface ReputationView {
  id: FactionId;
  name: string;
  npc: string;
  effect: string;
  value: number;
  rank: string;
}

/** What each group thinks of the player. Pure data; the game keeps one and the dialogue changes it. */
export class Reputation {
  private readonly values: Record<FactionId, number> = { patrol: 0, guild: 0, merchants: 0, locals: 0 };

  get(faction: FactionId): number {
    return this.values[faction];
  }

  /** Adds (or takes off) points and keeps the result inside the limits. Returns how much it really changed. */
  add(faction: FactionId, amount: number): number {
    const before = this.values[faction];
    this.values[faction] = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, before + Math.round(amount)));
    return this.values[faction] - before;
  }

  /** What the player pays for what the merchants sell, as a multiplier: 3% less for every point of good standing, 3% more for every point of bad, at most 12% either way. */
  get priceMultiplier(): number {
    const change = Math.max(-MERCHANT_PRICE_LIMIT, Math.min(MERCHANT_PRICE_LIMIT, this.values.merchants * MERCHANT_PRICE_PER_POINT));
    return 1 - change;
  }

  views(): ReputationView[] {
    return FACTION_IDS.map((id) => ({ id, name: FACTIONS[id].name, npc: FACTIONS[id].npc, effect: FACTIONS[id].effect, value: this.values[id], rank: reputationRank(this.values[id]) }));
  }

  getState(): Record<FactionId, number> {
    return { ...this.values };
  }

  setState(state: Partial<Record<FactionId, number>>): void {
    for (const id of FACTION_IDS) {
      const v = Number(state[id] ?? 0);
      this.values[id] = Number.isFinite(v) ? Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, Math.round(v))) : 0;
    }
  }
}
