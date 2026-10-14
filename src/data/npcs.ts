import { SpriteKey } from '../game/assetManifest';
import type { NpcConversation } from '../systems/npcTopics';

export interface NpcDef {
  id: string;
  name: string;
  /** Short role shown under the name. */
  title: string;
  spriteKey: string;
  /** Visual scale of the sprite (keep it 1: pixel art does not survive fractional scaling). */
  scale: number;
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

export function getNpc(id: string): NpcDef {
  const def = NPCS[id];
  if (!def) throw new Error(`Unknown NPC "${id}"`);
  return def;
}
