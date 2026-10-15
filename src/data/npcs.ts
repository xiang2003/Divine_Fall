import { SpriteKey } from '../game/assetManifest';
import type { NpcConversation } from '../systems/npcTopics';

export interface NpcDef {
  id: string;
  name: string;
  /** Short role shown under the name. */
  title: string;
  spriteKey: string;
  /** Visual scale of the sprite. */
  scale: number;
  /** Height of the name tag above the feet, in scene pixels (at scale 1): about the figure's height. */
  tagHeight: number;
  /** Upper-body picture shown beside the conversation (a transparent WebP under public/). */
  portrait: string;
  conversation: NpcConversation;
}

export const NPCS: Record<string, NpcDef> = {
  elder_qiyi: {
    id: 'elder_qiyi',
    name: '祈漪',
    title: '村長',
    spriteKey: SpriteKey.NPC_ELDER,
    scale: 1,
    tagHeight: 53,
    portrait: 'assets/art/portraits/elder_qiyi.webp',
    conversation: {
      intro: { graph: 'elder_intro', metFlag: 'met_elder' },
      greetings: [
        '水不會咬人……至少以前不會。',
        '我這把老骨頭，站久了就愛說些沒頭沒尾的話。',
        '貝殼磨得再亮，也亮不過日子。',
      ],
      topics: [
        { kind: 'turnin', label: '交出碎片', graph: 'elder_q3_turnin', if: { quest: 'q3_resonance', state: 'ready' } },
        { kind: 'quest', label: '那塊碎片', graph: 'elder_q3_offer', if: { all: [{ flag: 'has_shard' }, { quest: 'q3_resonance', state: 'available' }] } },
        { kind: 'active', label: '關於遺跡', graph: 'elder_q3_active', if: { quest: 'q3_resonance', state: 'active' } },
        { kind: 'quest', label: '渡船與離島', graph: 'elder_q4_offer', if: { quest: 'q4_stranded_boat', state: 'available' } },
        { kind: 'active', label: '渡船與離島', graph: 'elder_q4_active', if: { quest: 'q4_stranded_boat', state: 'active' } },
        { kind: 'story', label: '往後的事', graph: 'elder_after', if: { quest: 'q4_stranded_boat', state: 'completed' } },
        { kind: 'talk', label: '聊聊村子與井水', graph: 'elder_repeat' },
      ],
    },
  },
  hunter_yanya: {
    id: 'hunter_yanya',
    name: '岩牙',
    title: '獵人',
    spriteKey: SpriteKey.NPC_HUNTER,
    scale: 1,
    tagHeight: 61,
    portrait: 'assets/art/portraits/hunter_yanya.webp',
    conversation: {
      intro: { graph: 'hunter_intro', metFlag: 'met_yanya' },
      greetings: [
        '劍舉高！野獸可不會等你想好。',
        '這道疤？嘿，教訓而已，別問。',
        '我的箭都是自己削的，比村裡的鍋碗都結實。',
      ],
      topics: [
        { kind: 'turnin', label: '回報獵殺', graph: 'hunter_turnin', if: { quest: 'q1_first_hunt', state: 'ready' } },
        { kind: 'active', label: '林道的野獸', graph: 'hunter_active', if: { quest: 'q1_first_hunt', state: 'active' } },
        { kind: 'quest', label: '請教狩獵', graph: 'hunter_offer', if: { quest: 'q1_first_hunt', state: 'available' } },
        { kind: 'talk', label: '閒聊', graph: 'hunter_repeat' },
      ],
    },
  },
  waterer_xi: {
    id: 'waterer_xi',
    name: '汐',
    title: '汲水人',
    spriteKey: SpriteKey.NPC_WATERER,
    scale: 1,
    tagHeight: 48,
    portrait: 'assets/art/portraits/waterer_xi.webp',
    conversation: {
      intro: { graph: 'waterer_intro', metFlag: 'met_xi' },
      greetings: [
        '……今天的鳥，都往同一個方向飛。',
        '水的味道，又變了一點點。',
        '我、我只是在看，沒有別的意思。',
      ],
      topics: [
        { kind: 'turnin', label: '回報水源', graph: 'xi_q2_turnin', if: { quest: 'q2_muddy_water', state: 'ready' } },
        { kind: 'active', label: '水源的調查', graph: 'xi_q2_active', if: { quest: 'q2_muddy_water', state: 'active' } },
        { kind: 'quest', label: '水的異狀', graph: 'xi_q2_offer', if: { quest: 'q2_muddy_water', state: 'available' } },
        { kind: 'story', label: '碎片之後', graph: 'xi_after', if: { quest: 'q2_muddy_water', state: 'completed' } },
        { kind: 'talk', label: '閒聊', graph: 'waterer_repeat' },
      ],
    },
  },
  boatwright_laodu: {
    id: 'boatwright_laodu',
    name: '老舵',
    title: '船匠',
    spriteKey: SpriteKey.NPC_BOATWRIGHT,
    scale: 1,
    tagHeight: 45,
    portrait: 'assets/art/portraits/boatwright_laodu.webp',
    conversation: {
      intro: { graph: 'boatwright_intro', metFlag: 'met_laodu' },
      greetings: [
        '看什麼看！要修船就排隊，要偷懶就滾遠點！',
        '半吊子的活，我看一眼就知道。',
        '龜孫，別把菸灰彈到我的船板上！',
      ],
      topics: [
        { kind: 'quest', label: '擱淺的渡船', graph: 'laodu_coast_q4', if: { all: [{ map: 'pure_coast' }, { quest: 'q4_stranded_boat', state: 'active' }, { notFlag: 'laodu_ferry_checked' }] } },
        { kind: 'story', label: '那艘渡船', graph: 'laodu_coast_after', if: { all: [{ map: 'pure_coast' }, { flag: 'laodu_ferry_checked' }] } },
        { kind: 'talk', label: '閒聊', graph: 'boatwright_repeat' },
      ],
    },
  },
};

/** Chapter 2: the people of Qinglan Town (docs/design/chapter2-canglan-continent.md). */
Object.assign(NPCS, {
  innkeeper_zhoubo: {
    id: 'innkeeper_zhoubo',
    name: '周伯',
    title: '客棧老闆',
    spriteKey: SpriteKey.NPC_ZHOU,
    scale: 1,
    tagHeight: 50,
    portrait: 'assets/art/portraits/innkeeper_zhoubo.webp',
    conversation: {
      intro: { graph: 'zhou_intro', metFlag: 'met_zhou' },
      greetings: ['客官，住店還是吃飯？', '鎮上有什麼事，十有八九我先聽到。', '熱湯剛出鍋，趁熱喝。'],
      topics: [
        { kind: 'story', label: '山道盡頭的傳聞', graph: 'zhou_record_ask', if: { quest: 'q9_ruin_record', state: ['active', 'ready'] } },
        { kind: 'story', label: '關於你的名聲', graph: 'zhou_record_cold', if: { flag: 'record_hidden' } },
        { kind: 'turnin', label: '回報老路', graph: 'zhou_q7_turnin', if: { quest: 'q7_warden_bounty', state: 'ready' } },
        { kind: 'active', label: '古林的老路', graph: 'zhou_q7_active', if: { quest: 'q7_warden_bounty', state: 'active' } },
        { kind: 'quest', label: '客棧的傳聞', graph: 'zhou_q7_offer', if: { quest: 'q7_warden_bounty', state: 'available' } },
        { kind: 'talk', label: '打聽消息', graph: 'zhou_repeat' },
      ],
    },
  },
  herbalist_qinghe: {
    id: 'herbalist_qinghe',
    name: '沈青禾',
    title: '藥鋪學徒',
    spriteKey: SpriteKey.NPC_QINGHE,
    scale: 1,
    tagHeight: 46,
    portrait: 'assets/art/portraits/herbalist_qinghe.webp',
    conversation: {
      intro: { graph: 'qinghe_intro', metFlag: 'met_qinghe' },
      greetings: ['……請不要碰那邊的瓶子。', '今天的露水比往常重。', '認得的東西，就沒那麼可怕。'],
      topics: [{ kind: 'talk', label: '山林與草藥', graph: 'qinghe_repeat' }],
    },
  },
  blacksmith_tieshan: {
    id: 'blacksmith_tieshan',
    name: '鐵山',
    title: '鐵匠',
    spriteKey: SpriteKey.NPC_TIESHAN,
    scale: 1,
    tagHeight: 52,
    portrait: 'assets/art/portraits/blacksmith_tieshan.webp',
    conversation: {
      intro: { graph: 'tieshan_intro', metFlag: 'met_tieshan' },
      greetings: ['……要打什麼？', '好鐵不怕看。', '爐子不等人。'],
      topics: [
        { kind: 'shop', label: '買賣裝備', shop: 'blacksmith' },
        { kind: 'story', label: '聯盟的託付', graph: 'tieshan_record_ask', if: { quest: 'q9_ruin_record', state: ['active', 'ready'] } },
        { kind: 'story', label: '配方的頭一頁', graph: 'tieshan_record_thanks', if: { flag: 'record_guild' } },
        { kind: 'story', label: '你掌心的印', graph: 'tieshan_relic', if: { all: [{ flag: 'has_relic' }, { notFlag: 'tieshan_saw_relic' }] } },
        { kind: 'talk', label: '閒聊', graph: 'tieshan_repeat' },
      ],
    },
  },
  wanderer_guchangfeng: {
    id: 'wanderer_guchangfeng',
    name: '顧長風',
    title: '流浪修士',
    spriteKey: SpriteKey.NPC_GU,
    scale: 1,
    tagHeight: 56,
    portrait: 'assets/art/portraits/wanderer_guchangfeng.webp',
    conversation: {
      intro: { graph: 'gu_intro', metFlag: 'met_gu' },
      greetings: ['……風向變了。', '你走過的地方，靈氣都有反應。', '我只是個閒人。'],
      topics: [
        { kind: 'turnin', label: '殘缺的記錄', graph: 'gu_q9_turnin', if: { quest: 'q9_ruin_record', state: 'ready' } },
        { kind: 'story', label: '地圖上的三個記號', graph: 'gu_three_places', if: { quest: 'q9_ruin_record', state: 'completed' } },
        { kind: 'story', label: '停戰碑原上的三份記錄', graph: 'gu_truce', if: { flag: 'truce_understood' } },
        { kind: 'turnin', label: '回報祭壇', graph: 'gu_q6_turnin', if: { quest: 'q6_altar_trace', state: 'ready' } },
        { kind: 'active', label: '古林的祭壇', graph: 'gu_q6_active', if: { quest: 'q6_altar_trace', state: 'active' } },
        { kind: 'quest', label: '靈氣的痕跡', graph: 'gu_q6_offer', if: { quest: 'q6_altar_trace', state: 'available' } },
        { kind: 'story', label: '關於你的印', graph: 'gu_aura', if: { flag: 'has_relic' } },
        { kind: 'talk', label: '閒聊', graph: 'gu_repeat' },
      ],
    },
  },
  patrol_linruotang: {
    id: 'patrol_linruotang',
    name: '林若棠',
    title: '巡山司接待',
    spriteKey: SpriteKey.NPC_LIN,
    scale: 1,
    tagHeight: 48,
    portrait: 'assets/art/portraits/patrol_linruotang.webp',
    conversation: {
      intro: { graph: 'lin_intro', metFlag: 'met_lin' },
      greetings: ['領懸賞？登記，簽字，去做。', '我沒空聊天。', '山裡的東西越來越兇。'],
      topics: [
        { kind: 'story', label: '關於遺跡的記錄', graph: 'lin_record_ask', if: { quest: 'q9_ruin_record', state: ['active', 'ready'] } },
        { kind: 'story', label: '登記的記錄', graph: 'lin_record_thanks', if: { flag: 'record_patrol' } },
        { kind: 'turnin', label: '回報狼群', graph: 'lin_q5_turnin', if: { quest: 'q5_wolf_bounty', state: 'ready' } },
        { kind: 'turnin', label: '回報巨像', graph: 'lin_q8_turnin', if: { quest: 'q8_colossus_bounty', state: 'ready' } },
        { kind: 'active', label: '古林的狼群', graph: 'lin_q5_active', if: { quest: 'q5_wolf_bounty', state: 'active' } },
        { kind: 'active', label: '山道的巨像', graph: 'lin_q8_active', if: { quest: 'q8_colossus_bounty', state: 'active' } },
        { kind: 'quest', label: '古林的狼群', graph: 'lin_q5_offer', if: { quest: 'q5_wolf_bounty', state: 'available' } },
        { kind: 'quest', label: '山道的巨像', graph: 'lin_q8_offer', if: { quest: 'q8_colossus_bounty', state: 'available' } },
        { kind: 'talk', label: '閒聊', graph: 'lin_repeat' },
      ],
    },
  },
} satisfies Record<string, NpcDef>);

export function getNpc(id: string): NpcDef {
  const def = NPCS[id];
  if (!def) throw new Error(`Unknown NPC "${id}"`);
  return def;
}
