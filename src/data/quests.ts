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
  q2_muddy_water: {
    id: 'q2_muddy_water',
    title: '渾濁的水源',
    summary: '汐發現島民賴以為生的源泉變得混濁，請你去洞裡查個究竟。',
    giver: 'waterer_xi',
    requires: ['q1_first_hunt'],
    objectives: [
      { type: 'reach', label: '前往源泉洞', map: 'pure_spring_cave' },
      { type: 'kill', label: '擊敗洞中的菁英畸變體', count: 1, map: 'pure_spring_cave', elite: true },
      { type: 'interact', label: '調查洞底的碎片', target: 'spring_shard' },
    ],
    rewards: { xp: 90, items: [{ rarity: 'rare', count: 1 }] },
  },
  q3_resonance: {
    id: 'q3_resonance',
    title: '共鳴',
    summary: '祈漪說，碎片該去的地方是初胎遺跡；入口的封石只對「某種血」有反應。',
    giver: 'elder_qiyi',
    requires: ['q2_muddy_water'],
    startFlags: ['ruins_open'],
    objectives: [
      { type: 'reach', label: '前往初胎遺跡', map: 'pure_ruins' },
      { type: 'kill', label: '擊敗遺跡守衛的仿影', count: 1, map: 'pure_ruins', boss: true },
      { type: 'interact', label: '取得初胎之印', target: 'ruins_relic' },
    ],
    rewards: { xp: 180, items: [{ rarity: 'rare', count: 1 }] },
  },
  q4_stranded_boat: {
    id: 'q4_stranded_boat',
    title: '擱淺的渡船',
    summary: '遺跡醒來的那一夜，海岸擱淺了一艘不是島上造的船。',
    giver: 'elder_qiyi',
    requires: ['q3_resonance'],
    startFlags: ['coast_open'],
    objectives: [
      { type: 'reach', label: '前往斷潮海岸', map: 'pure_coast' },
      { type: 'talk', label: '與老舵交談', npc: 'boatwright_laodu' },
      { type: 'interact', label: '登上渡船', target: 'ferry_board' },
    ],
    rewards: { xp: 150, items: [] },
  },
};

export function getQuest(id: string): QuestDef {
  const q = QUESTS[id];
  if (!q) throw new Error(`Unknown quest "${id}"`);
  return q;
}
