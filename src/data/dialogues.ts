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

  // ---- 獵人 岩牙（任務 1：初試鋒芒）----------------------------------------------------------
  hunter_intro: {
    id: 'hunter_intro',
    start: 'a',
    nodes: {
      a: { text: '喂，小子（丫頭也行）！別杵在那兒，劍舉高！野獸可不會等你想好。', next: 'b' },
      b: { text: '我是岩牙。村長說你要學打獵。哼，學打獵先學活著回來。', set: ['met_yanya'], choices: [
        { text: '請多指教。', to: 'ok' },
        { text: '林子裡到底怎麼了？', to: 'woods' },
      ] },
      ok: { text: '少客套。左鍵走路、右鍵揮劍，Q、W、E 是你的招式。記不住就多練。', next: 'offer' },
      woods: { text: '怎麼了？……沒什麼，只是餓了而已。獸餓了脾氣就差，懂嗎？', next: 'ok' },
      offer: { text: '光練不夠，得見血。往東出村口就是臍帶林道，去宰五隻野獸回來，讓我看看你的手腳。', choices: [
        { text: '好，我去。', to: 'accept' },
        { text: '我還沒準備好。', to: 'later' },
      ] },
      accept: { text: '這才像話。路上別逞強，血快見底就退。回來找我。', startQuest: 'q1_first_hunt', end: true },
      later: { text: '哼，準備好了再來。別讓我等太久。', end: true },
    },
  },
  hunter_offer: {
    id: 'hunter_offer',
    start: 'a',
    nodes: {
      a: { text: '想通了？林道裡有五隻野獸等著你。', choices: [
        { text: '我準備好了。', to: 'accept' },
        { text: '再等等。', to: 'later' },
      ] },
      accept: { text: '好。去吧，回來找我。', startQuest: 'q1_first_hunt', end: true },
      later: { text: '快點，天黑了林子可不好走。', end: true },
    },
  },
  hunter_active: {
    id: 'hunter_active',
    start: 'a',
    nodes: {
      a: { text: '還沒宰夠五隻？東邊出村口就是林道，別在這兒偷懶。', end: true },
    },
  },
  hunter_turnin: {
    id: 'hunter_turnin',
    start: 'a',
    nodes: {
      a: { text: '五隻？……不賴。比我年輕時差一點，就一點。', next: 'b' },
      b: { text: '拿著，這是給你的。有它，下次可以走遠一點——但別走太遠，聽見沒？', completeQuest: 'q1_first_hunt', next: 'c' },
      c: { text: '那些獸的眼神……算了，當我沒說。', end: true },
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

  // ==== 任務 2：渾濁的水源（汐）============================================================================
  xi_q2_offer: {
    id: 'xi_q2_offer',
    start: 'a',
    nodes: {
      a: { text: '水……又變了。今天，連井底都有那股味道。', next: 'b' },
      b: { text: '源泉洞在林道北邊的林間空地。我、我不敢一個人進去。你……願意幫我看看嗎？', choices: [
        { text: '好，我去看看。', to: 'accept' },
        { text: '讓我準備一下。', to: 'later' },
      ] },
      accept: { text: '謝謝……！洞裡的東西，不太對勁。請小心。', startQuest: 'q2_muddy_water', end: true },
      later: { text: '嗯……我等你。', end: true },
    },
  },
  xi_q2_active: {
    id: 'xi_q2_active',
    start: 'a',
    nodes: {
      a: { text: '洞口在林道北邊的林間空地，往北走就看得見。那裡的鳥……全都不叫了。', end: true },
    },
  },
  xi_q2_turnin: {
    id: 'xi_q2_turnin',
    start: 'a',
    nodes: {
      a: { text: '你回來了……！（她盯著你胸前透出的微光）那、那是什麼？', next: 'b' },
      b: { text: '洞裡的水……是不是活的？我一直覺得，它在看著我們。', next: 'c' },
      c: { text: '那天你把碎片握在手裡的時候，你的手指，也亮了一下。你……沒發現嗎？', completeQuest: 'q2_muddy_water', next: 'd' },
      d: { text: '把它給村長看吧。村長……一定知道些什麼。', end: true },
    },
  },
  xi_after: {
    id: 'xi_after',
    start: 'a',
    nodes: {
      a: { text: '水還是濁的，但我覺得……它在等什麼。', choices: [
        { text: '妳的眼睛真的很敏銳。', to: 'thanks' },
        { text: '我會查清楚的。', to: 'bye' },
      ] },
      thanks: { text: '我、我只是……看得比較久而已。', next: 'bye' },
      bye: { text: '嗯。路上小心。', end: true },
    },
  },

  // ==== 任務 3：共鳴（祈漪）===============================================================================
  elder_q3_offer: {
    id: 'elder_q3_offer',
    start: 'a',
    nodes: {
      a: { text: '汐跟我說了。你在洞底……撿到了東西？拿來，讓我看看。', next: 'b' },
      b: { text: '（祈漪接過碎片，指尖微微發抖。碎片在祈漪手裡暗了下去，回到你手上時，又亮了。）', next: 'c' },
      c: { text: '它該去的地方是遺跡。入口的封石只對某種血有反應……我本來希望，這一天能晚一點來。', choices: [
        { text: '「某種血」是什麼意思？', to: 'blood' },
        { text: '我去。', to: 'accept' },
      ] },
      blood: { text: '我現在不能說。等你帶著答案回來，我再把剩下的話說完。', next: 'accept' },
      accept: { text: '封石會認得你。去吧——裡面的東西，會模仿你以為熟悉的樣子。別被騙了。', startQuest: 'q3_resonance', end: true },
    },
  },
  elder_q3_active: {
    id: 'elder_q3_active',
    start: 'a',
    nodes: {
      a: { text: '封石已經鬆開了。遺跡在林道最東邊。', end: true },
    },
  },
  elder_q3_turnin: {
    id: 'elder_q3_turnin',
    start: 'a',
    nodes: {
      a: { text: '（你手心的印記，與祈漪頸間的貝殼同時發出了很輕的聲響。祈漪久久沒有說話。）', next: 'b' },
      b: { text: '我曾經希望你一輩子都不需要走進那裡。', completeQuest: 'q3_resonance', next: 'c' },
      c: { text: '既然它醒了，我不該再替你藏下去了……但今天還不行。', next: 'd' },
      d: { text: '去海岸看看吧。有些事，要先讓你自己看見。', end: true },
    },
  },
  elder_q4_offer: {
    id: 'elder_q4_offer',
    start: 'a',
    nodes: {
      a: { text: '昨夜，海岸擱淺了一艘船。不是我們島上的船。', next: 'b' },
      b: { text: '老舵說，它是遺跡醒來的那一夜靠岸的。你帶著初胎之印……去看看吧。', choices: [
        { text: '我去海岸。', to: 'accept' },
        { text: '讓我再想一想。', to: 'later' },
      ] },
      accept: { text: '去吧。南邊的路，我讓人替你讓開了。', startQuest: 'q4_stranded_boat', end: true },
      later: { text: '船不會自己走……至少，我希望它不會。', end: true },
    },
  },
  elder_q4_active: {
    id: 'elder_q4_active',
    start: 'a',
    nodes: {
      a: { text: '海岸在村子南邊，老舵已經過去了。', end: true },
    },
  },
  elder_after: {
    id: 'elder_after',
    start: 'a',
    nodes: {
      a: { text: '你長大了。比我預想的，快得多。', end: true },
    },
  },

  // ==== 任務 4：擱淺的渡船（老舵、渡船）================================================================
  laodu_coast_q4: {
    id: 'laodu_coast_q4',
    start: 'a',
    nodes: {
      a: { text: '站住！……是你啊。別碰那船的板子，我還沒檢查完！', next: 'b' },
      b: { text: '這船不是我們造的。金屬跟骨頭是長在一起的——這接縫，比我做過的任何東西都漂亮。我、不、服。', next: 'c' },
      c: { text: '它是昨晚遺跡醒來的時候靠岸的。船頭那盞燈，只在你靠近的時候才亮。', choices: [
        { text: '它在等我？', to: 'wait' },
        { text: '你覺得它安全嗎？', to: 'safe' },
      ] },
      wait: { text: '別問我，木頭腦袋。我只是個修船的。', next: 'd' },
      safe: { text: '安全？我連它是什麼木頭——是不是木頭——都不知道。', next: 'd' },
      d: { text: '想上去就上去，不想就滾。……不過，別讓人家把我修的船板給整壞了。', set: ['laodu_ferry_checked'], end: true },
    },
  },
  laodu_coast_after: {
    id: 'laodu_coast_after',
    start: 'a',
    nodes: {
      a: { text: '船在那兒。想好了就上去，別在我面前磨蹭。', end: true },
    },
  },
  ferry_look: {
    id: 'ferry_look',
    start: 'a',
    nodes: {
      a: { text: '一艘擱淺的船。金屬板與蒼白的骨肋拼成船身，接縫找不到一絲痕跡。船頭的燈是暗的。', end: true },
    },
  },
  ferry_need_laodu: {
    id: 'ferry_need_laodu',
    start: 'a',
    nodes: {
      a: { text: '船身冰涼。不遠處，老舵正瞪著你。——先去問問老舵怎麼看吧。', end: true },
    },
  },
  ferry_board: {
    id: 'ferry_board',
    start: 'a',
    nodes: {
      a: { text: '船身冰涼，金屬與骨肋的接縫漂亮得不像人手做的。你靠近的時候，船頭那盞冷藍色的燈亮了。', choices: [
        { text: '登上渡船。', to: 'go' },
        { text: '再等一下。', to: 'wait' },
      ] },
      go: { text: '你踏上甲板。船沒有帆，也沒有槳，卻開始緩緩滑向海面。岸上，有人在喊你的名字。', interact: 'ferry_board', completeQuest: 'q4_stranded_boat', next: 'end' },
      end: { text: '——海的另一邊，有一片你從未見過的陸地。', endChapter: true, end: true },
      wait: { text: '你退後一步。燈，暗了下去。', end: true },
    },
  },

  // ==== 互動物件 ===========================================================================================
  shard_find: {
    id: 'shard_find',
    start: 'a',
    nodes: {
      a: { text: '水池南岸的碎石間，嵌著一塊會發光的碎片，像一顆還沒睡著的心。', next: 'b' },
      b: { text: '你伸手去碰——手上的血管像被點亮似的，一條金色的細線順著手臂亮了起來。', set: ['has_shard'], next: 'c' },
      c: { text: '碎片溫熱，不燙。你把它收進懷裡。洞裡的水，安靜了一瞬。', end: true },
    },
  },
  core_look: {
    id: 'core_look',
    start: 'a',
    nodes: {
      a: { text: '胎盤般的光球懸在石環之上，緩緩轉動。這裡的空氣裡全是靈氣，濃得幾乎能嚐出味道。', next: 'b' },
      b: { text: '你的手還沒伸出去，掌心的印就先亮了。光球轉向你，像是在辨認一張很久以前見過的臉。', next: 'c' },
      c: { text: '它沒有說話。但整座遺跡，在這一刻安靜了下來。', end: true },
    },
  },
  relic_take: {
    id: 'relic_take',
    start: 'a',
    nodes: {
      a: { text: '石像崩解之後，基座上浮著一枚圓印——像一塊胎盤，又像一隻閉著的眼睛。', next: 'b' },
      b: { text: '你懷裡的碎片同時發亮。兩道光合在一起，沉進了你的掌心。', set: ['has_relic'], next: 'c' },
      c: { text: '牆上的壁畫在微光裡浮現：四片大陸的輪廓，環繞著中央的裂口。——卻沒有畫出這座島。', end: true },
    },
  },
};

export function getDialogue(id: string): DialogueGraph {
  const graph = DIALOGUES[id];
  if (!graph) throw new Error(`Unknown dialogue "${id}"`);
  return graph;
}
