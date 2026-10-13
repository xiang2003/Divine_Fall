import type { DialogueGraph } from '../systems/dialogue';

/**
 * Chapter 1 conversations (see docs/design/chapter1-pure-source-island.md, section 4).
 * Personalities come from the design document; the lines here are first drafts. No quest is wired yet:
 * these are introductions that set "met_*" flags, which the quest system will build on.
 * The lore rule applies: hint, never explain (the elder knows more than she says; the island is not explained).
 */
export const DIALOGUES: Record<string, DialogueGraph> = {
  // ---- 村長 祈漪 ----------------------------------------------------------------------------
  elder_intro: {
    id: 'elder_intro',
    start: 'a',
    nodes: {
      a: { text: '又來看井水嗎？別怕，水不會咬人……至少以前不會。', next: 'b' },
      b: { text: '來，坐近一點。我這把老骨頭，站久了就愛說些沒頭沒尾的話。', set: ['met_elder'], choices: [
        { text: '最近井水好像怪怪的。', to: 'water' },
        { text: '您看起來有心事。', to: 'worry' },
        { text: '我該做些什麼？', to: 'task' },
      ] },
      water: { text: '水啊……它總是比人先知道。去問問汐吧，那孩子的眼睛比我這雙老眼好使。', next: 'task' },
      worry: { text: '呵，老人家的心事，就像灶裡的灰，掃一掃，隔天又有了。別擔心我。', next: 'task' },
      task: { text: '岩牙在訓練場等你。林子裡的野獸近來不太安分，先學會保護自己，再談別的事。', next: 'bye' },
      bye: { text: '去吧。慢慢來，不急。', end: true },
    },
  },
  elder_repeat: {
    id: 'elder_repeat',
    start: 'a',
    nodes: {
      a: { text: '嗯？有事就說，沒事就陪我坐一會兒。', choices: [
        { text: '我想再聽聽井水的事。', to: 'water' },
        { text: '您認識汐嗎？', to: 'xi', if: { flag: 'met_xi' } },
        { text: '沒事，我只是來看看您。', to: 'bye' },
      ] },
      water: { text: '水會說話的，只是我們不一定願意聽。', next: 'bye' },
      xi: { text: '那孩子啊……話少，看得卻多。多給她一點時間，她會告訴你的。', next: 'bye' },
      bye: { text: '去忙吧。', end: true },
    },
  },

  // ---- 獵人 岩牙 ----------------------------------------------------------------------------
  hunter_intro: {
    id: 'hunter_intro',
    start: 'a',
    nodes: {
      a: { text: '喂，小子（丫頭也行）！別杵在那兒，劍舉高！野獸可不會等你想好。', next: 'b' },
      b: { text: '我是岩牙。村長說你要學打獵。哼，學打獵先學活著回來。', set: ['met_yanya'], choices: [
        { text: '請多指教。', to: 'ok' },
        { text: '林子裡到底怎麼了？', to: 'woods' },
      ] },
      ok: { text: '少客套。左鍵走路、右鍵揮劍，Q、W、E 是你的招式。記不住就多練。', end: true },
      woods: { text: '怎麼了？……沒什麼，只是餓了而已。獸餓了脾氣就差，懂嗎？', next: 'ok' },
    },
  },
  hunter_repeat: {
    id: 'hunter_repeat',
    start: 'a',
    nodes: {
      a: { text: '還站在這兒？練夠了就去林子裡走一圈。別走太遠，聽見沒？', choices: [
        { text: '您的手臂上那些傷……', to: 'scar' },
        { text: '我會小心的。', to: 'bye' },
      ] },
      scar: { text: '舊傷。一頭沒人記得的熊留的。倒是最近那些獸的眼神……算了，當我沒說。', next: 'bye' },
      bye: { text: '去吧。別讓我來替你收屍。', end: true },
    },
  },

  // ---- 汲水人 汐 ----------------------------------------------------------------------------
  waterer_intro: {
    id: 'waterer_intro',
    start: 'a',
    nodes: {
      a: { text: '……啊。', next: 'b' },
      b: { text: '那、那個……水，不對勁。我不是亂說的，你聞聞看？', set: ['met_xi'], choices: [
        { text: '我聞到了一點鐵的味道。', to: 'iron' },
        { text: '妳是什麼時候發現的？', to: 'when' },
      ] },
      iron: { text: '對！像鐵，又像剛下過雨的泥土。你也覺得，對不對？', next: 'bye' },
      when: { text: '前、前幾天。我沒有馬上說……怕被當成大驚小怪。', next: 'bye' },
      bye: { text: '（她低下頭，把水桶往身後藏了藏）……如果你要去查，請小心。', end: true },
    },
  },
  waterer_repeat: {
    id: 'waterer_repeat',
    start: 'a',
    nodes: {
      a: { text: '今天的鳥，都往同一個方向飛。', choices: [
        { text: '哪個方向？', to: 'dir' },
        { text: '水還是一樣嗎？', to: 'water' },
        { text: '我先走了。', to: 'bye' },
      ] },
      dir: { text: '東邊。往林子深處去。（她小聲補了一句）牠們以前不這樣的。', next: 'bye' },
      water: { text: '更濁了一點點。只有一點點……但我記得每一天的顏色。', next: 'bye' },
      bye: { text: '嗯……再見。', end: true },
    },
  },

  // ---- 船匠 老舵 ----------------------------------------------------------------------------
  boatwright_intro: {
    id: 'boatwright_intro',
    start: 'a',
    nodes: {
      a: { text: '看什麼看！要修船就排隊，要偷懶就滾遠點！', next: 'b' },
      b: { text: '……哼，新面孔？我是老舵，這島上最會做船的人。這句話不准反駁。', set: ['met_laodu'], choices: [
        { text: '您的雪茄快燒到鬍子了。', to: 'cigar' },
        { text: '這島上有很多船嗎？', to: 'boats' },
      ] },
      cigar: { text: '龜孫，這叫手感！我抽了四十年，還沒燒著過……啊，等等，好像有點焦味？', end: true },
      boats: { text: '多不多不是重點，每一艘都是我親手做的，一根釘子都不偷懶。海那邊的活兒，我可沒興趣。', end: true },
    },
  },
  boatwright_repeat: {
    id: 'boatwright_repeat',
    start: 'a',
    nodes: {
      a: { text: '又是你？有話快說，我這兒的木頭可不等人。', choices: [
        { text: '最近海邊有什麼動靜嗎？', to: 'sea' },
        { text: '沒事，路過。', to: 'bye' },
      ] },
      sea: { text: '海？海還是那個海，潮水漲了又退。你別學那些整天看著水平線發呆的木頭腦袋。', next: 'bye' },
      bye: { text: '滾吧滾吧，別擋著我的光。', end: true },
    },
  },
};

export function getDialogue(id: string): DialogueGraph {
  const graph = DIALOGUES[id];
  if (!graph) throw new Error(`Unknown dialogue "${id}"`);
  return graph;
}
