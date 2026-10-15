import type { QuestDef } from '../systems/quests';
import { xpPerKill } from './progression';

/** A quest pays in experience worth `kills` ordinary monsters of the level the quest is meant for (so the pay follows the experience curve). */
const worth = (level: number, kills: number): number => xpPerKill(level) * kills;

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
    rewards: { xp: worth(2, 2), items: [{ rarity: 'magic', count: 1 }] },
  },
  q2_muddy_water: {
    id: 'q2_muddy_water',
    title: '渾濁的水源',
    summary: '汐發現島民賴以為生的源泉變得混濁，請你去洞裡查個究竟。',
    giver: 'waterer_xi',
    requires: ['q1_first_hunt'],
    objectives: [
      { type: 'reach', label: '前往源泉洞', map: 'pure_spring_cave' },
      { type: 'kill', label: '擊敗洞中的蝕靈鹿', count: 1, map: 'pure_spring_cave', boss: true },
      { type: 'interact', label: '調查洞底的碎片', target: 'spring_shard' },
    ],
    rewards: { xp: worth(3, 3), items: [{ rarity: 'rare', count: 1 }] },
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
    rewards: { xp: worth(7, 4), items: [{ rarity: 'rare', count: 1 }] },
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
    rewards: { xp: worth(8, 3), items: [] },
  },
};

/**
 * Chapter 2 quests: bounties and requests in Qinglan Town (docs/design/chapter2-canglan-continent.md). They are first drafts:
 * the design only says what each person does, not what they ask for.
 */
Object.assign(QUESTS, {
  q5_wolf_bounty: {
    id: 'q5_wolf_bounty',
    title: '古林的狼群',
    summary: '林若棠在巡山司貼出懸賞：青藤古林裡的青牙狼成群出沒，傷了不少獵人。',
    giver: 'patrol_linruotang',
    requires: [],
    objectives: [{ type: 'kill', label: '擊殺青藤古林的青牙狼', count: 5, monster: 'green_fang_wolf', map: 'canglan_forest' }],
    rewards: { xp: worth(16, 6), items: [{ rarity: 'magic', count: 2 }] },
  },
  q6_altar_trace: {
    id: 'q6_altar_trace',
    title: '靈氣的痕跡',
    summary: '顧長風說古林深處有一座被靈氣侵蝕的祭壇，要你去看一眼，回來告訴他看到了什麼。',
    giver: 'wanderer_guchangfeng',
    requires: [],
    objectives: [{ type: 'interact', label: '調查青藤古林的祭壇', target: 'forest_altar' }],
    rewards: { xp: worth(16, 4), items: [{ rarity: 'rare', count: 1 }] },
  },
  q7_warden_bounty: {
    id: 'q7_warden_bounty',
    title: '客棧的傳聞',
    summary: '周伯說，進過古林深處的人回來都說，那裡有一尊會動的古樹守衛，把通往鎮上的老路封死了。',
    giver: 'innkeeper_zhoubo',
    requires: [],
    objectives: [{ type: 'kill', label: '擊敗古木巡守者', count: 1, map: 'canglan_forest', boss: true }],
    rewards: { xp: worth(19, 8), items: [{ rarity: 'rare', count: 1 }] },
  },
  q8_colossus_bounty: {
    id: 'q8_colossus_bounty',
    title: '山道的巨像',
    summary: '山道上有一尊用舊兵器湊成的巨像，擋住了去內陸的路。林若棠要你清掉它。',
    giver: 'patrol_linruotang',
    requires: ['q5_wolf_bounty'],
    objectives: [{ type: 'kill', label: '擊敗斷劍巨像', count: 1, map: 'broken_sword_pass', boss: true }],
    rewards: { xp: worth(23, 10), items: [{ rarity: 'rare', count: 2 }] },
  },
} satisfies Record<string, QuestDef>);

/**
 * The second part of the continent story (docs/design/chapter2-part2-forgers-trial.md). The player finds the record at the end of the pass, so the quest
 * is not offered by anyone: the dialogue at the pass starts it, and the wanderer takes it in.
 */
Object.assign(QUESTS, {
  q9_ruin_record: {
    id: 'q9_ruin_record',
    title: '殘缺的記錄',
    summary: '山道盡頭的石壁給了你一份殘缺的記錄，和一張只標著三個記號的地圖。鎮上已經有人在打聽它了。',
    giver: null,
    turnIn: 'wanderer_guchangfeng',
    requires: [],
    objectives: [{ type: 'talk', label: '把記錄帶給顧長風', npc: 'wanderer_guchangfeng' }],
    rewards: { xp: worth(24, 4), items: [{ rarity: 'rare', count: 1 }], flags: ['part2_open'] },
  },
} satisfies Record<string, QuestDef>);

export function getQuest(id: string): QuestDef {
  const q = QUESTS[id];
  if (!q) throw new Error(`Unknown quest "${id}"`);
  return q;
}
