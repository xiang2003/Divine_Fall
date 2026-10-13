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
| tile.grass_a / tile.grass_b | 草地（兩種綠） | 專案內建佔位圖 | 專案自有 |
| tile.tree | 樹（與牆同樣的佔地，可擋路） | 專案內建佔位圖 | 專案自有 |
| npc.elder / hunter / waterer / boatwright | 四位 NPC（祈漪、岩牙、汐、老舵），與玩家同一套人形繪製法換配色與配件 | 專案內建佔位圖 | 專案自有 |
| building.home / elder / store / boat / well | 草屋四種配色與水井（等角、2 倍解析度繪製） | 專案內建佔位圖（[BuildingArt.ts](src/game/BuildingArt.ts)） | 專案自有 |
| fx.loot_ring | 地面掉落物的品質光圈（執行時依品質染色） | 專案內建佔位圖 | 專案自有 |

## 目前使用中的第三方素材（2026-10-13 加入）

兩個都是 OpenGameArt 上標示 **CC0 1.0（公眾領域貢獻，免署名）** 的素材。授權依各作品頁面的標示；我下載的壓縮檔裡
沒有附授權文字檔（只有網頁上的標示），所以授權連結保存在這裡。**我是讀作品頁面確認的，沒有法律意見。**
用到的檔案已由 [tools/prepare_assets.py](tools/prepare_assets.py) 處理（裁切、調亮），原始下載不放進專案。

| 專案內檔案 | 用途 | 原作品 | 作者 | 授權 | 修改 |
| --- | --- | --- | --- | --- | --- |
| public/assets/tiles/grass_0 – grass_5.png | 草地地面（128×64，顯示為 64×32） | [stylized grassland tileset](https://opengameart.org/content/stylized-grassland-tileset)（`ground_grasses.png`） | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 從大圖裁出 6 塊素樸的菱形，未改色 |
| public/assets/trees/tree_0 – tree_6.png | 樹（闊葉樹 ×3、杉樹 ×4；256×256，顯示為 128×128） | [Free isometric plants-pack](https://opengameart.org/content/free-isometric-plants-pack)（`bigtree01-03`、`pine-none01-04`） | rubberduck（打包），模型與貼圖來自 yughues | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 原圖幾乎全黑，已調亮並微調飽和度 |

## 本機 AI 生成的角色圖（2026-10-13）

在這台電腦的 ComfyUI 上以 **Z-Image-Turbo**（Tongyi-MAI / Z-Image Team，Hugging Face 頁面標示 **Apache-2.0**，未限制商用與輸出）
生成，工作流程是 ComfyUI 內建的 `image_z_image_turbo` 範本（文字編碼器 qwen_3_4b、VAE ae.safetensors）。
**我只確認了主模型頁面的授權標示；VAE 與文字編碼器的授權沒有逐一查證。** 生成圖是否可享著作權保護因地區而異，這點沒有法律意見。
生成流程與工具本身沒有花費（本機執行，沒有使用付費 API）。

| 專案內檔案 | 內容 | 生成設定 | 後處理 |
| --- | --- | --- | --- |
| public/assets/art/hero_full.webp | 主角的精緻全身插畫（640×935） | 832×1216、8 步、seed 20261013 | 縮小並存成 WebP |
| public/assets/art/hero_pixel.png | 主角的像素小人（37×53，透明背景） | 1024×1024、8 步、seed 7771，粉紅色純色背景 | 縮成 64×64 取樣、去背與地面陰影、裁切、22 色調色盤（[tools/prepare_character_art.py](tools/prepare_character_art.py)） |

**提示詞（英文原文）**

- 全身圖：*Full-body character concept art of a young wanderer from a remote primordial island, androgynous, short messy dark hair, calm determined eyes, wearing a layered teal and cream linen tunic with brown leather straps and wrapped forearms, faint glowing golden veins along both forearms (ancient divine blood), a rusty iron short sword at the hip, simple leather sandals, standing pose, three-quarter view, entire body from head to toe visible, dark fantasy, highly detailed painterly illustration, soft rim light, plain flat light gray studio background, no text, no watermark*
- 像素小人：*Pixel art game sprite of a chibi young adventurer, short messy dark hair, teal and cream tunic with brown leather straps, golden glowing lines on forearms, small rusty short sword at the hip, big head small body, full body, standing, front three-quarter view, crisp 1-pixel dark outline, flat shading, limited color palette, 16-bit RPG style, centered, solid flat pure magenta background*

**使用處**：載入畫面（全身圖）、HUD 左下角的肖像（像素小人）。遊戲內的主角佔位圖已改成相同的配色（青綠上衣、黑髮）。
像素小人**只是一張靜態圖**，沒有行走或攻擊動畫，所以不能直接取代遊戲內角色的動畫表。

**下載過、評估後沒有採用的**（沒有放進專案）：

| 作品 | 授權（頁面標示） | 為什麼沒用 |
| --- | --- | --- |
| [400+ Isometric Town Tiles](https://opengameart.org/content/400-isometric-town-tiles)（Screaming Brain Studios） | CC0 | 建築是**現代都市**風格（窗戶、磚牆、鐵梯），不適合原始小島 |
| [Isometric Miniature Dungeon](https://opengameart.org/content/isometric-miniature-dungeon)（Kenney） | CC0 | 砂岩色調的地城，等做遺跡與洞窟時再評估；它附有等角角色（待機、跑步、撿取，**沒有攻擊動畫**） |

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
