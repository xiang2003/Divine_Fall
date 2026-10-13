import type { QuestDef } from '../systems/quests';

/**
 * Chapter 1 quests (docs/design/chapter1-pure-source-island.md, section 5).
 * Only the quests whose maps, monsters and objects exist are defined so far: the later main quests
 * (muddy water, resonance, the stranded ferry) arrive together with the content they refer to.
 */
export const QUESTS: Record<string, QuestDef> = {
  q1_first_hunt: {
    id: 'q1_first_hunt',
    title: '初試鋒芒',
    summary: '岩牙要你先在林道裡證明自己的身手。',
    giver: 'hunter_yanya',
    requires: [],
    objectives: [
      { type: 'kill', label: '擊殺臍帶林道裡的野獸', count: 5, map: 'pure_forest' },
    ],
    rewards: { xp: 40, items: [{ rarity: 'magic', count: 1 }] },
  },
};

export function getQuest(id: string): QuestDef {
  const q = QUESTS[id];
  if (!q) throw new Error(`Unknown quest "${id}"`);
  return q;
}
