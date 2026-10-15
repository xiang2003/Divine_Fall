import type { DialogueGraph } from '../systems/dialogue';

/**
 * The second part of the story on the continent (docs/design/chapter2-part2-forgers-trial.md): the end of the mountain pass, where the player
 * finds a torn record and a map with three marks, and the town that wants the record. First drafts. Choices change flags and reputation only;
 * none of them closes the way on.
 */
export const DIALOGUES_PART2: Record<string, DialogueGraph> = {
  // ==== 山道盡頭：殘缺的地圖與記錄（暫時接在無聲鑄庭的位置，見設計文件的「〇」） ======================
  pass_end_look: {
    id: 'pass_end_look',
    start: 'a',
    nodes: {
      a: { text: '山道的盡頭，雲霧散開了。斷劍巨像倒下的地方，石壁上的青苔一片一片剝落。', next: 'b' },
      b: {
        text: '石壁底下露出一道很舊的刻痕。你掌心的印一靠近，刻痕就亮了起來，浮出一幅殘缺的大陸地圖，上面只標著三個記號：停戰碑原、百工地下城、寂錘高庭。',
        set: ['part2_started'],
        next: 'c',
      },
      c: {
        text: '地圖旁的石縫裡卡著一捲殘卷。你小心地抽出來——是一份只有半邊的記錄，字跡很舊，結尾被人撕走了。',
        set: ['has_ruin_record'],
        startQuest: 'q9_ruin_record',
        next: 'd',
      },
      d: { text: '光很快暗了下去。刻痕留在石壁上，像一條沒有走完的路。（先把記錄帶回青嵐鎮，給顧長風看看。）', end: true },
    },
  },
  pass_end_again: {
    id: 'pass_end_again',
    start: 'a',
    nodes: {
      a: { text: '石壁上的刻痕仍然留著三個記號：停戰碑原、百工地下城、寂錘高庭。', next: 'b' },
      b: { text: '風從山脊上吹過來，把雲吹成一道一道的刀痕。', end: true },
    },
  },

  // ==== 顧長風：記錄要交給誰 =================================================================================
  gu_q9_turnin: {
    id: 'gu_q9_turnin',
    start: 'a',
    nodes: {
      a: { text: '他接過殘卷，沒有立刻看，先看了看你的臉。「石壁自己亮的？……掌心的印，果然。」', next: 'b' },
      b: { text: '「你回鎮上之前，已經有人先問過我了。巡山司想要，鐵山背後的工匠聯盟想要，周伯的商會也想知道。三方都客氣，三方都想要。」', next: 'c' },
      c: {
        text: '「遺跡留給後人的，只是留的人想讓人看見的那一部分。這份東西要給誰，是你的選擇，不是我的。」',
        choices: [
          { text: '先交給你保管。', to: 'keep' },
          { text: '交給巡山司，公開研究。', to: 'patrol' },
          { text: '和工匠聯盟交換情報。', to: 'guild' },
          { text: '先不交。我想自己追查。', to: 'hidden' },
        ],
      },
      keep: {
        text: '他把殘卷收進袖子裡。「我替你收著。要用的時候，開口就是。……記著，這上面寫的，不一定是全部的事。」',
        set: ['record_gu'],
        completeQuest: 'q9_ruin_record',
        next: 'end',
      },
      patrol: {
        text: '「公開，所有人都看得到，也都能搶。你想好了，就去找林若棠。」他頓了頓。「鐵山那邊會不高興。」',
        set: ['record_patrol'],
        reputation: { patrol: 2, guild: -1, locals: 1 },
        completeQuest: 'q9_ruin_record',
        next: 'end',
      },
      guild: {
        text: '「工匠聯盟會拿他們知道的東西來換。」他點點頭。「他們懂得多，但不一定都說。林若棠大概會有話講。」',
        set: ['record_guild', 'recipe_guild_1'],
        reputation: { guild: 2, patrol: -1, merchants: 1 },
        completeQuest: 'q9_ruin_record',
        next: 'end',
      },
      hidden: {
        text: '他沒有勸。「也好。一個人追查，沒有人替你擦腳印；看見的東西，也只有你自己能對。」',
        set: ['record_hidden'],
        reputation: { merchants: -1 },
        completeQuest: 'q9_ruin_record',
        next: 'end',
      },
      end: { text: '他看向東邊的山。「三個記號。停戰碑原最近，先去那裡吧。」', end: true },
    },
  },
  gu_three_places: {
    id: 'gu_three_places',
    start: 'a',
    nodes: {
      a: { text: '「停戰碑原，百工地下城，寂錘高庭。」他像在數自己的手指。「古代的戰爭，被封存的手藝，還有那個人看著這片大陸的地方。」', next: 'b' },
      b: { text: '「那個人」是誰，他沒有說。只說：「遺跡讓你看見的，是留下記錄的人想讓後世看見的部分。去看，但別全信。」', end: true },
    },
  },

  // ==== 鎮上的三方 ===========================================================================================
  lin_record_ask: {
    id: 'lin_record_ask',
    start: 'a',
    nodes: {
      a: { text: '山道盡頭那面石壁的事，鎮上傳開了。巡山司想看一眼你帶回來的記錄。', next: 'b' },
      b: { text: '不是搶，是登記。公開研究，大家都能看。不過，給不給，是你的事。', end: true },
    },
  },
  lin_record_thanks: {
    id: 'lin_record_thanks',
    start: 'a',
    nodes: {
      a: { text: '記錄收到了。告示明天貼出去，會有人來問，也會有人來鬧。', next: 'b' },
      b: { text: '你做了該做的事。巡山司記著。', end: true },
    },
  },
  tieshan_record_ask: {
    id: 'tieshan_record_ask',
    start: 'a',
    nodes: {
      a: { text: '……聽說你從山道盡頭帶了東西回來。', next: 'b' },
      b: { text: '我不問是什麼。聯盟問了。他們願意拿手上的東西換。不吃虧。', end: true },
    },
  },
  tieshan_record_thanks: {
    id: 'tieshan_record_thanks',
    start: 'a',
    nodes: {
      a: { text: '聯盟收到了。這是配方的頭一頁，先給你。', next: 'b' },
      b: { text: '東西做出來，要用在人身上還是用在門上，是你的事。我只管打鐵。', end: true },
    },
  },
  zhou_record_ask: {
    id: 'zhou_record_ask',
    start: 'a',
    nodes: {
      a: { text: '哎，山道盡頭的事，客人們都在講。商會的人也來打聽過了，問你有沒有帶什麼東西回來。', next: 'b' },
      b: { text: '我什麼都沒說。我說，要問就問當事人。你想給誰，是你的事。', end: true },
    },
  },
  zhou_record_cold: {
    id: 'zhou_record_cold',
    start: 'a',
    nodes: {
      a: { text: '有人說，你在山道盡頭拿了東西，誰也沒告訴。', next: 'b' },
      b: { text: '我不怪你。做生意的人最怕這種事，不是怕你拿，是怕不知道。價錢，我只能算得更小心一點。', end: true },
    },
  },
};
