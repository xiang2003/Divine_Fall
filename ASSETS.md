# 素材清單 Asset Register

規則：不使用來源或授權不明的圖片；不使用商業遊戲擷取的資產；每加入一項外部素材，必須在此登記
名稱、來源網址、作者、授權與用途，並將授權文字（或連結）一併保存。

## 目前使用中（Phase 1）

所有圖像目前都是由 [src/game/PlaceholderArt.ts](src/game/PlaceholderArt.ts) 在執行時以 Canvas 繪製的**佔位圖**，
由本專案自行撰寫，沒有引入任何外部素材，也沒有任何授權問題。

| Key | 用途 | 來源 | 授權 |
| --- | --- | --- | --- |
| tile.floor_a / tile.floor_b | 地板（兩種色調） | 專案內建佔位圖 | 專案自有 |
| tile.floor_exit | 出口符文地板 | 專案內建佔位圖 | 專案自有 |
| tile.wall | 牆體方塊 | 專案內建佔位圖 | 專案自有 |
| prop.crate | 木箱（障礙物） | 專案內建佔位圖 | 專案自有 |
| fx.shadow | 角色腳下陰影 | 專案內建佔位圖 | 專案自有 |
| fx.move_marker | 點擊移動的地面目標標記 | 專案內建佔位圖 | 專案自有 |
| char.player | 玩家（待機 / 行走 / 攻擊 / 受傷 / 死亡，單一朝向） | 專案內建佔位圖 | 專案自有 |
| monster.ghoul / monster.shade / monster.hound | 屍鬼、祭影、獵犬（動畫同上） | 專案內建佔位圖 | 專案自有 |
| fx.orb | 遠程怪的投射物光球 | 專案內建佔位圖 | 專案自有 |
| item.weapon / helmet / chest / boots / ring | 五種裝備部位的圖示（地面與背包共用） | 專案內建佔位圖 | 專案自有 |
| monster.boss | 墮神執政官（96×96 大尺寸，動畫同其他角色） | 專案內建佔位圖 | 專案自有 |
| fx.bolt | 玩家神罰之矢的金色光球 | 專案內建佔位圖 | 專案自有 |
| fx.loot_ring | 地面掉落物的品質光圈（執行時依品質染色） | 專案內建佔位圖 | 專案自有 |

## 如何替換成真實素材

1. 把 PNG 放進 `public/assets/<類別>/`。
2. 在 [src/game/assetManifest.ts](src/game/assetManifest.ts) 對應條目加上 `url: 'assets/characters/xxx.png'`，並確認
   `frameWidth` / `frameHeight` / `anchor` / `animations` 與圖片一致。
3. 在本檔登記來源與授權。

若 `url` 載入失敗，遊戲不會崩潰：會改用佔位圖，並在畫面左上角顯示警告。

## 候選來源（**尚未下載、授權尚未逐包確認**）

以下僅是研究方向。實際下載時必須回到各素材頁面確認授權條款，不可僅憑此清單假設。

- Kenney（kenney.nl）：Isometric Dungeon Tiles、Isometric Prototype Tiles 等。Kenney 素材通常標示為 CC0，但需逐包確認。
- OpenGameArt（opengameart.org）：怪物、角色動畫、音效、物品圖示。授權因作品而異（CC0 / CC-BY / CC-BY-SA / GPL…），
  需逐件確認是否允許商業使用及是否要求署名。
- itch.io：只使用頁面明確標示免費與授權條件的素材包。

**風格一致性提醒**：不同來源的等角比例、像素密度、色調可能差異很大。目前的投影基準是 64×32 的 2:1 菱形圖塊
（`TILE_W` / `TILE_H` in [src/config/gameConfig.ts](src/config/gameConfig.ts)），挑選素材時請以此為準，或在 manifest 中調整。

## 候選來源：Free-Game-Dev-Assets 目錄（2026-10-13 閱讀，**尚未下載任何素材**）

[TMHSDigital/Free-Game-Dev-Assets](https://github.com/TMHSDigital/Free-Game-Dev-Assets) 是一份「來源索引」（392 個來源，不代管素材），
每筆記錄來源自己宣稱的授權與最後查證日期。**下表的授權是該目錄的記載，不是我逐一到來源網站確認的結果**；實際採用前必須回到來源頁面確認，
並依本檔規則登記名稱、網址、作者、授權與用途。

| 用途 | 候選 | 目錄記載的授權 | 備註 |
| --- | --- | --- | --- |
| 介面 | Kenney UI Pack | CC0 | 按鈕、面板、滑桿 |
| 音效 | Kenney Interface Sounds / Impact Sounds | CC0 | 介面點擊、打擊聲 |
| 字型 | Noto Sans（含 CJK） | SIL OFL 1.1 | 繁體中文介面字型的候選 |
| 字型 | Ark Pixel Font | SIL OFL 1.1 | 像素風 CJK，但目錄註明**缺少大量漢字**，不能直接當主字型 |
| 圖示 | game-icons.net | CC-BY-3.0 | **需署名**（`Icons made by {author}`） |
| 音樂 | Kevin MacLeod（incompetech）、Eric Skiff（Resistor Anthems） | CC-BY-4.0 | **需署名**，格式見各來源 |
| 地城圖塊 / 角色 | Kenney Roguelike/RPG Pack、Kenney Tiny Dungeon、Ninja Adventure、0x72 DungeonTileset II | CC0 | 見下方的**投影不相容**警告 |

**投影不相容警告**：本專案是 2:1 等角菱形（64×32 圖塊）。目錄裡的 2D 圖塊與角色包幾乎都是 **16×16 的 3/4 俯視**（地面從上往下看、
建築與角色從正面看），**不是等角投影**。我只用關鍵字搜尋過目錄，沒有找到可直接使用的等角角色包。
所以：UI、音效、字型、圖示可以直接評估採用；地城圖塊與角色若要採用，需要決定是「改成 3/4 俯視風格」還是「另外找或自製等角素材」。
這是美術風格決策，請你決定。
