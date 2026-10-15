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

  // ==== 停戰碑原：被省略的停戰條款（三份互相矛盾的記錄，和一座沒有神像的碑）============================
  rec_win: {
    id: 'rec_win',
    start: 'a',
    nodes: {
      a: { text: '石碑的字被人用朱漆重描過，筆畫齊整，一個字也沒有缺。你的手指擦過碑面，碑上有一點蠟，是這幾年還有人來上過香。', next: 'b' },
      b: {
        text: '「……大戰蔓延七載，生靈塗炭。鑄神者瓦爾坎臨於原上，一言止戈，兩軍俱退。我軍得勝，天下乃安。」',
        set: ['truce_read_win'],
        startQuest: 'q10_truce_records',
        next: 'c',
      },
      c: { text: '末尾是一長串列功的名號，沒有一個提到戰死的人。這是勝方寫的。（原上還有別的記錄。）', end: true },
    },
  },
  rec_lose: {
    id: 'rec_lose',
    start: 'a',
    nodes: {
      a: { text: '黑色的碑面裂了，字不是刻的，是有人用刀尖一筆一筆劃上去的，每一劃都很用力。碑腳下纏著鏽斷的鎖鏈。', next: 'b' },
      b: {
        text: '「……戰端非我所起。起事者還活著，鑄神者卻只令兩軍罷兵，不問是非。我們的死者，沒有一個得到說法。」',
        set: ['truce_read_lose'],
        startQuest: 'q10_truce_records',
        next: 'c',
      },
      c: { text: '字的最後一筆拖得很長，像是刻的人沒有力氣了。這是敗方寫的。（原上還有別的記錄。）', end: true },
    },
  },
  rec_folk: {
    id: 'rec_folk',
    start: 'a',
    nodes: {
      a: { text: '一堆石頭壓著一捆竹簡和麻布，繩子已經朽了，有人用一只裂開的陶碗壓住它，免得被風吹走。', next: 'b' },
      b: {
        text: '「……那位大人給兩邊一次機會，讓他們自己談停。談的那幾天，有一方的軍隊悄悄換了方向，轉到我們村子來。那幾天死的，不是兵。」',
        set: ['truce_read_folk'],
        startQuest: 'q10_truce_records',
        next: 'c',
      },
      c: { text: '沒有署名，也沒有年月。這是誰寫的，已經沒有人知道了。（原上還有別的記錄。）', end: true },
    },
  },
  stele_look: {
    id: 'stele_look',
    start: 'a',
    nodes: {
      a: { text: '碑很高，上半一個字也沒有，像是有人刻意留白。下半密密麻麻是誓約的條文，大半已經被風磨平，讀不成句。', next: 'b' },
      b: { text: '碑前的地上，插著一圈斷了的兵器。原上還有幾處地方立著別的記錄，或許能拿來對照。', end: true },
    },
  },
  stele_partial: {
    id: 'stele_partial',
    start: 'a',
    nodes: {
      a: { text: '你把讀過的那幾份記錄放在心裡，一句一句去對碑上殘存的條文。有幾處對得上，有幾處完全不對。', next: 'b' },
      b: { text: '碑上缺的地方，不是一個人能補上的。原上還有別的記錄沒有讀。', end: true },
    },
  },
  stele_collate: {
    id: 'stele_collate',
    start: 'a',
    nodes: {
      a: { text: '勝方、敗方、民間。你把三份記錄並排放在心裡，再去對碑上殘存的誓約條文。', next: 'b' },
      b: { text: '勝方沒有說謊：戰爭確實在那一天停住了，沒有再蔓延。敗方沒有說謊：沒有人追究起事的人，死者確實沒有得到說法。民間也沒有說謊：停下來之前，有人利用了那幾天的空隙。', next: 'c' },
      c: { text: '三份都是真的。三份都只寫了對寫的人有用的那一半。碑上留白的上半，大概原本要寫的就是那些誰也不肯簽字的部分。', next: 'd' },
      d: {
        text: '你想起顧長風說過的話：遺跡留給後人的，只是留的人想讓人看見的那一部分。——祂的中立並非沒有作用。祂擋下了戰火，卻沒有替受害的人裁決，也沒有確保弱勢的一方得到補償。',
        set: ['truce_understood'],
        interact: 'plateau_stele',
        completeQuest: 'q10_truce_records',
        next: 'e',
      },
      e: { text: '風從碑腳下穿過去，吹動那圈斷兵器上的破布。你不知道該不該為此責怪誰。', end: true },
    },
  },
  stele_again: {
    id: 'stele_again',
    start: 'a',
    nodes: {
      a: { text: '碑上半仍是空白。你想過這個留白應該是誰的，後來覺得，也許誰都不該填。', end: true },
    },
  },
  gu_truce: {
    id: 'gu_truce',
    start: 'a',
    nodes: {
      a: { text: '你把停戰碑原的事說了。他聽完，靜了一會兒。「三份都是真的，所以才難辦。」', next: 'b' },
      b: { text: '「只有一份記錄的時候，人總會想把它當成全部。有三份的時候，就得自己去承認：缺的那一塊，誰也補不上。」', next: 'c' },
      c: { text: '他笑了一下，笑得不太像在笑。「那位大人若真有什麼過錯，大概就在那一塊裡面。我不急著定他的罪。」', end: true },
    },
  },
};
