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

  // ==== 第二章：青嵐鎮 =======================================================================================
  // ---- 周伯（客棧老闆）----
  zhou_intro: {
    id: 'zhou_intro',
    start: 'a',
    nodes: {
      a: { text: '喲，生面孔！風塵僕僕的，剛從海邊上來吧？進來坐，進來坐，先喝碗熱湯。', next: 'b' },
      b: { text: '我是周伯，這間青嵐客棧的掌櫃。鎮上有什麼風吹草動，十有八九我先聽到。', set: ['met_zhou'], choices: [
        { text: '這一帶安全嗎？', to: 'danger' },
        { text: '最近有什麼怪事？', to: 'strange' },
      ] },
      danger: { text: '安全？嘿，往西是青藤古林，狼多，猿也不少；往東是斷劍山道，刀客、墮了道的修士都有。鎮上倒是太平，有巡山司盯著。', next: 'strange' },
      strange: { text: '怪事嘛……近來靈氣不太對勁。林子裡的畜生眼睛發綠，山道上的人說話顛三倒四。我活了五十年，沒見過。', next: 'ask' },
      ask: { text: '你要是有膽量，我這兒正好有個差事。你去問問看？', end: true },
    },
  },
  zhou_repeat: {
    id: 'zhou_repeat',
    start: 'a',
    nodes: {
      a: { text: '客官有什麼吩咐？住店、吃飯，還是打聽事？', choices: [
        { text: '說說這個鎮子。', to: 'town' },
        { text: '那位在城外的流浪修士是誰？', to: 'gu', if: { flag: 'met_gu' } },
        { text: '沒事，隨便看看。', to: 'bye' },
      ] },
      town: { text: '青嵐鎮靠山吃山。獵人、藥農、跑商的都往這兒歇腳。鐵山的鋪子，沈姑娘的藥鋪，巡山司的懸賞，樣樣齊全。', next: 'bye' },
      gu: { text: '顧先生？他住店從來不多話，只愛在城外一站就是半天，說是看風。我也看不出什麼名堂。', next: 'bye' },
      bye: { text: '好嘞，有事再叫我。', end: true },
    },
  },
  zhou_q7_offer: {
    id: 'zhou_q7_offer',
    start: 'a',
    nodes: {
      a: { text: '你來得巧。古林深處原本有條通到鎮上的老路，現在被一尊古樹和石頭拼成的守衛擋死了。進去的人，十個有九個沒走到它面前。', next: 'b' },
      b: { text: '客棧的生意靠商旅，路斷了，我這兒冷清得很。你幫我把它清掉，我拿得出的酬謝不會少。', choices: [
        { text: '我去會會它。', to: 'accept' },
        { text: '讓我再準備一下。', to: 'later' },
      ] },
      accept: { text: '好！活著回來，我請你吃頓好的。', startQuest: 'q7_warden_bounty', end: true },
      later: { text: '不急，路又不會自己好。但也別拖太久。', end: true },
    },
  },
  zhou_q7_active: {
    id: 'zhou_q7_active',
    start: 'a',
    nodes: { a: { text: '往西走青藤古林，一路穿到最深處。那尊守衛站在路口，你不會錯過它。', end: true } },
  },
  zhou_q7_turnin: {
    id: 'zhou_q7_turnin',
    start: 'a',
    nodes: {
      a: { text: '你、你真的把它打倒了？剛才有人從林子那邊跑來說，老路通啦！', next: 'b' },
      b: { text: '拿著，這是我的一點心意。往後在鎮上住店，我給你留最好的房。', completeQuest: 'q7_warden_bounty', next: 'c' },
      c: { text: '對了，那東西倒下的時候，林子裡的靈氣是不是……動了一下？算了，我隨口說說。', end: true },
    },
  },

  // ---- 沈青禾（藥鋪學徒）----
  qinghe_intro: {
    id: 'qinghe_intro',
    start: 'a',
    nodes: {
      a: { text: '……客人，請不要碰那邊的瓶子。那是剛配好的，味道很重。', next: 'b' },
      b: { text: '我是沈青禾，在這間藥鋪幫師父看店。山裡的草藥，我多半認得。', set: ['met_qinghe'], choices: [
        { text: '你看起來很熟悉這片山林。', to: 'woods' },
        { text: '我身上的傷，有什麼藥能用？', to: 'wound' },
      ] },
      woods: { text: '採藥的人，總要記得每一條路。不過這一年，有些路上的草長歪了。靈氣太亂，連最普通的藥草都變了樣。', next: 'bye' },
      wound: { text: '外傷的話，三七和止血草最有效。不過鋪子這幾天缺貨，等山道通了，才有新貨進來。', next: 'bye' },
      bye: { text: '需要什麼，慢慢看吧。', end: true },
    },
  },
  qinghe_repeat: {
    id: 'qinghe_repeat',
    start: 'a',
    nodes: {
      a: { text: '有事嗎？', choices: [
        { text: '古林裡的花妖，是怎麼回事？', to: 'flower' },
        { text: '你一個人守店不怕嗎？', to: 'brave' },
        { text: '沒事。', to: 'bye' },
      ] },
      flower: { text: '那不是普通的花。它們被靈氣泡得太久，開始自己找食物。它們噴的粉，吸一口就會頭暈、發燒，千萬別站在白霧裡。', next: 'bye' },
      brave: { text: '怕過。後來想，與其怕，不如多認幾種草。認得的東西，就沒那麼可怕了。', next: 'bye' },
      bye: { text: '慢走。', end: true },
    },
  },

  // ---- 鐵山（鐵匠）----
  tieshan_intro: {
    id: 'tieshan_intro',
    start: 'a',
    nodes: {
      a: { text: '……要打什麼？先說清楚，我不接亂七八糟的活。', next: 'b' },
      b: { text: '鐵山。這鋪子裡的鐵，每一塊我都認得。你的劍給我看看。', set: ['met_tieshan'], choices: [
        { text: '您以前是做什麼的？', to: 'past' },
        { text: '只是路過，看看。', to: 'pass' },
      ] },
      past: { text: '替人打過兵器。打給誰的，不必問。那都是過去的事了，現在只是個守著爐子的老頭。', next: 'bye' },
      pass: { text: '看吧。好鐵不怕看。', next: 'bye' },
      bye: { text: '要修要練再來。', end: true },
    },
  },
  tieshan_repeat: {
    id: 'tieshan_repeat',
    start: 'a',
    nodes: {
      a: { text: '嗯。', choices: [
        { text: '山道上的那把巨劍是怎麼回事？', to: 'sword' },
        { text: '您怎麼會隱居在這種地方？', to: 'why' },
        { text: '打擾了。', to: 'bye' },
      ] },
      sword: { text: '那是一把真正的劍，不是擺設。據說有人拿它斬過山。現在斷了，剩下半截戳在那兒，像一塊墓碑。', next: 'bye' },
      why: { text: '……鐵打久了，會聽見它說話。有些話，我不想再聽了。', next: 'bye' },
      bye: { text: '好走。', end: true },
    },
  },
  tieshan_relic: {
    id: 'tieshan_relic',
    start: 'a',
    nodes: {
      a: { text: '等等。你掌心那個印……給我看看。', set: ['tieshan_saw_relic'], next: 'b' },
      b: { text: '不是鐵，不是玉，也不是我見過的任何東西。我替宗門修過古遺跡裡挖出來的碎片，沒有一塊像它。', next: 'c' },
      c: { text: '這東西，別隨便給人看。別問我為什麼——我也說不上來。', end: true },
    },
  },

  // ---- 顧長風（流浪修士）----
  gu_intro: {
    id: 'gu_intro',
    start: 'a',
    nodes: {
      a: { text: '……你從海上來。', next: 'b' },
      b: { text: '別緊張。靈氣不會說謊，你身上有一股和這裡的修行者都不一樣的氣息。我叫顧長風，一個閒人。', set: ['met_gu'], choices: [
        { text: '你知道我是什麼人？', to: 'who' },
        { text: '你站在這裡做什麼？', to: 'what' },
      ] },
      who: { text: '不知道。我只知道，你身上的東西，比這片大陸上多數人願意承認的，要古老得多。', next: 'bye' },
      what: { text: '看風。靈氣也有風，它從哪裡來、往哪裡去，站得久了，看得出一點端倪。這幾個月，它都在往西邊的古林聚。', next: 'bye' },
      bye: { text: '如果你願意，我有件事想請你替我看一看。', end: true },
    },
  },
  gu_repeat: {
    id: 'gu_repeat',
    start: 'a',
    nodes: {
      a: { text: '有事？', choices: [
        { text: '你為什麼不直接告訴我我是誰？', to: 'why' },
        { text: '靈氣到底怎麼了？', to: 'aura' },
        { text: '沒事。', to: 'bye' },
      ] },
      why: { text: '因為我不確定。說了半句的話，比不說更容易誤人。等我看得清楚，會告訴你。', next: 'bye' },
      aura: { text: '像一口井被攪渾了。攪的人或許不是壞意，只是不知道自己在攪。', next: 'bye' },
      bye: { text: '去吧。', end: true },
    },
  },
  gu_aura: {
    id: 'gu_aura',
    start: 'a',
    nodes: {
      a: { text: '你掌心的印，在這裡比在島上亮。你自己沒有發現嗎？', next: 'b' },
      b: { text: '這片大陸上，有些地方的靈氣一直在等一個人。我還不能說是你。但你走過的地方，它們都有反應。', end: true },
    },
  },
  gu_q6_offer: {
    id: 'gu_q6_offer',
    start: 'a',
    nodes: {
      a: { text: '古林深處有一座祭壇，原本是早年修行者祭天用的。現在它被靈氣侵蝕了，我不敢靠太近，因為我的修為太淺，容易被它拖進去。', next: 'b' },
      b: { text: '你身上的氣息很特別，或許能近前。去看看那座祭壇，回來告訴我你看到了什麼。', choices: [
        { text: '我去看看。', to: 'accept' },
        { text: '我還要想想。', to: 'later' },
      ] },
      accept: { text: '小心。如果覺得頭暈，立刻離開，不要逞強。', startQuest: 'q6_altar_trace', end: true },
      later: { text: '不急。它不會跑。', end: true },
    },
  },
  gu_q6_active: {
    id: 'gu_q6_active',
    start: 'a',
    nodes: { a: { text: '祭壇在青藤古林的中央空地，從古老的石碑往東走。如果受不了，就退回來。', end: true } },
  },
  gu_q6_turnin: {
    id: 'gu_q6_turnin',
    start: 'a',
    nodes: {
      a: { text: '你回來了。說吧，你看到了什麼。', next: 'b' },
      b: { text: '……靈氣從祭壇的裂縫往外滲，不是被誰引來的，是它自己在流。難怪古林的野獸都眼睛發綠。', next: 'c' },
      c: { text: '謝謝你。這是我給你的一點酬謝。這件事我會記著，也請你記著：源頭不在古林，古林只是它流經的地方。', completeQuest: 'q6_altar_trace', next: 'd' },
      d: { text: '往東的斷劍山道，或許能看見更多。', end: true },
    },
  },

  // ---- 林若棠（巡山司接待人）----
  lin_intro: {
    id: 'lin_intro',
    start: 'a',
    nodes: {
      a: { text: '領懸賞？登記，簽字，去做，回來報。我沒空聊天。', next: 'b' },
      b: { text: '林若棠，巡山司接待。你的身手我看一眼就知道個大概，先從簡單的做起，做得好再給你更難的。', set: ['met_lin'], choices: [
        { text: '有什麼懸賞？', to: 'bounty' },
        { text: '巡山司是做什麼的？', to: 'office' },
      ] },
      bounty: { text: '現在貼著的，是青藤古林的狼群。你要接，就跟我說。', end: true },
      office: { text: '管這一帶的除妖、探路、清道。山裡的東西越來越兇，人手卻不夠，所以懸賞才貼出去。', end: true },
    },
  },
  lin_repeat: {
    id: 'lin_repeat',
    start: 'a',
    nodes: {
      a: { text: '還有事？', choices: [
        { text: '最近的懸賞多嗎？', to: 'many' },
        { text: '你不累嗎？', to: 'tired' },
        { text: '沒事。', to: 'bye' },
      ] },
      many: { text: '比去年多了三倍。越往內陸走，越兇。我們把能接的人都接了，還是不夠。', next: 'bye' },
      tired: { text: '累。但累也得做。山裡沒人管，鎮上就沒有安穩日子。', next: 'bye' },
      bye: { text: '去吧。', end: true },
    },
  },
  lin_q5_offer: {
    id: 'lin_q5_offer',
    start: 'a',
    nodes: {
      a: { text: '青藤古林的青牙狼，成群、動作快，被咬傷的獵人已經有七八個。懸賞：擊殺五隻。', next: 'b' },
      b: { text: '提醒你：它們受傷了會叫同伴，別在同一個地方糾纏太久。', choices: [
        { text: '我接了。', to: 'accept' },
        { text: '我再準備一下。', to: 'later' },
      ] },
      accept: { text: '登記完成。回來找我報，我會核對。', startQuest: 'q5_wolf_bounty', end: true },
      later: { text: '準備好了再來。懸賞不會跑，但牠們會繼續咬人。', end: true },
    },
  },
  lin_q5_active: {
    id: 'lin_q5_active',
    start: 'a',
    nodes: { a: { text: '還沒五隻？古林在西邊。牠們成群，記得別被包圍。', end: true } },
  },
  lin_q5_turnin: {
    id: 'lin_q5_turnin',
    start: 'a',
    nodes: {
      a: { text: '五隻，核對無誤。身手不錯。', next: 'b' },
      b: { text: '這是懸賞金與獎勵。', completeQuest: 'q5_wolf_bounty', next: 'c' },
      c: { text: '下一件事，我已經給你留著了。是山道上的東西，比狼棘手得多。', end: true },
    },
  },
  lin_q8_offer: {
    id: 'lin_q8_offer',
    start: 'a',
    nodes: {
      a: { text: '斷劍山道上，有一尊用舊兵器和石頭湊成的巨像，擋在去內陸的路口。巡山司的人已經折了三個。', next: 'b' },
      b: { text: '你的名聲，我聽說了。這件事交給你，我放心一點。', choices: [
        { text: '我去。', to: 'accept' },
        { text: '我需要準備。', to: 'later' },
      ] },
      accept: { text: '登記完成。它很大，也很慢，但每一擊都能要人命。看清楚再動手。', startQuest: 'q8_colossus_bounty', end: true },
      later: { text: '好好準備，別逞強。', end: true },
    },
  },
  lin_q8_active: {
    id: 'lin_q8_active',
    start: 'a',
    nodes: { a: { text: '往東出鎮，斷劍山道的盡頭。它會先蓄力再重擊，看到它舉起武器，就往外跑。', end: true } },
  },
  lin_q8_turnin: {
    id: 'lin_q8_turnin',
    start: 'a',
    nodes: {
      a: { text: '巨像……倒了？', next: 'b' },
      b: { text: '這是你應得的。我會把這件事報給上面。', completeQuest: 'q8_colossus_bounty', next: 'c' },
      c: { text: '山道通了，內陸的路也通了。……你的路，現在才開始。', end: true },
    },
  },

  // ---- 第二章的互動物件 ----
  tablet_read: {
    id: 'tablet_read',
    start: 'a',
    nodes: {
      a: { text: '石碑上的字被苔蘚蓋住大半，勉強能讀出幾個：「……氣聚於此，七日不散，修者宜靜……」', next: 'b' },
      b: { text: '後面的字被人刻意鑿去了。鑿痕很舊，卻比周圍的字還清楚。', end: true },
    },
  },
  altar_look: {
    id: 'altar_look',
    start: 'a',
    nodes: {
      a: { text: '祭壇的石盆裡積著一層紫綠色的黏液，從裂縫一點一點往外滲，滲到哪裡，哪裡的草就發黃。', next: 'b' },
      b: { text: '你的掌心微微發燙。裂縫深處有東西在回應你，像是認得你的氣息。', next: 'c' },
      c: { text: '你退後一步。靈氣的流向，不是指向這座祭壇，而是穿過它，往東去。', end: true },
    },
  },
  outpost_look: {
    id: 'outpost_look',
    start: 'a',
    nodes: {
      a: { text: '哨站的木頭早已朽爛，牆上還插著幾支斷箭。地上有火堆的痕跡，不算舊。', next: 'b' },
      b: { text: '角落裡有一面撕碎的旗，上面的字被血糊住。很久以前，有人在這裡守過。', end: true },
    },
  },
  sword_look: {
    id: 'sword_look',
    start: 'a',
    nodes: {
      a: { text: '巨劍有三人高，劍身斷在中段，斷口像是被什麼東西生生撕開的，不是砍斷。', next: 'b' },
      b: { text: '劍柄上刻著古老的符文，周圍散落著無數小兵器。這裡曾經是一座戰場，而且打得很慘。', end: true },
    },
  },
  pass_end_look: {
    id: 'pass_end_look',
    start: 'a',
    nodes: {
      a: { text: '山道的盡頭，雲霧散開了一點。遠處的山脊像一道一道刀痕，一直延伸到看不見的地方。', next: 'b' },
      b: { text: '這片大陸比你想像的大得多。（後面的路還沒有開通。）', end: true },
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
  mist_trace: {
    id: 'mist_trace',
    start: 'a',
    nodes: {
      a: { text: '沙地上有一圈圈細細的紋路，像水波，又不是水波。霧在這裡特別濃，貼著地面緩緩轉。', next: 'b' },
      b: { text: '你掌心的印微微發熱。這片海岸的靈氣，和島上的很像，卻更亂，像是被什麼東西攪動過。', next: 'c' },
      c: { text: '遠處的林子裡，有狼嚎。不止一隻。', end: true },
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
