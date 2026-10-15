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
| terrain.sand / cave / sea / murk | 沙灘、洞窟地面，海水與混濁泉水（2 倍解析度繪製） | 專案內建佔位圖（[TerrainArt.ts](src/game/TerrainArt.ts)） | 專案自有 |
| terrain.boulder / pillar | 沙灘的大石頭、洞窟的石筍 | 專案內建佔位圖（同上） | 專案自有 |
| building.ferry | 擱淺的渡船 | 專案內建佔位圖（[BuildingArt.ts](src/game/BuildingArt.ts)） | 專案自有 |
| monster.warped / water_shade / echo | 畸變體、水影、仿神守衛（原有人形與獸形佔位圖的新配色） | 專案內建佔位圖（[CharacterArt.ts](src/game/CharacterArt.ts)） | 專案自有 |
| object.shard / object.relic | 洞底的發光碎片、遺跡的初胎之印 | 專案內建佔位圖（[TerrainArt.ts](src/game/TerrainArt.ts)） | 專案自有 |
| fx.loot_ring | 地面掉落物的品質光圈（執行時依品質染色） | 專案內建佔位圖 | 專案自有 |

## 目前使用中的第三方素材（2026-10-13 加入）

兩個都是 OpenGameArt 上標示 **CC0 1.0（公眾領域貢獻，免署名）** 的素材。授權依各作品頁面的標示；我下載的壓縮檔裡
沒有附授權文字檔（只有網頁上的標示），所以授權連結保存在這裡。**我是讀作品頁面確認的，沒有法律意見。**
用到的檔案已由 [tools/prepare_assets.py](tools/prepare_assets.py) 處理（裁切、調亮），原始下載不放進專案。

| 專案內檔案 | 用途 | 原作品 | 作者 | 授權 | 修改 |
| --- | --- | --- | --- | --- | --- |
| public/assets/tiles/grass_0 – grass_5.png | 草地地面（128×64，顯示為 64×32） | [stylized grassland tileset](https://opengameart.org/content/stylized-grassland-tileset)（`ground_grasses.png`） | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 從大圖裁出 6 塊素樸的菱形，未改色 |
| public/assets/trees/tree_0 – tree_6.png | 樹（闊葉樹 ×3、杉樹 ×4；256×256，顯示為 128×128） | [Free isometric plants-pack](https://opengameart.org/content/free-isometric-plants-pack)（`bigtree01-03`、`pine-none01-04`） | rubberduck（打包），模型與貼圖來自 yughues | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 原圖幾乎全黑，已調亮並微調飽和度 |

## 第二批第三方素材：房屋、道具、地面、角色（2026-10-13 加入）

**上面「目前使用中（Phase 1）」表格裡的玩家、NPC、房屋、道具、沙灘／洞窟／海水地面現在都改用下列圖片；
原本的程式繪製佔位圖留作「圖片載入失敗時的備援」。** 怪物、遺跡的牆、洞窟的石筍仍是佔位圖。

四個作品都是 OpenGameArt 上標示 **CC0 1.0** 的素材（我讀作品頁面確認標示，下載的壓縮檔沒有附授權文字檔，沒有法律意見）。
處理腳本：[tools/prepare_assets.py](tools/prepare_assets.py)（地面、道具、房屋、植物）。原始下載不放進專案。角色不再用第三方素材，見下面「遊戲內的角色精靈」。

| 專案內檔案 | 用途 | 原作品 | 作者 | 授權 | 修改 |
| --- | --- | --- | --- | --- | --- |
| public/assets/buildings/cabin_home / elder / store / boat / shed.png | 五種木屋（家、祈漪、雜貨、老舵、小棚） | [isometric log cabins](https://opengameart.org/content/isometric-log-cabins)（`wooden_buildings_01.png`） | rubberduck | CC0 | 從 4×4 的大圖裁出，調亮 |
| public/assets/buildings/prop_tent.png、prop_campfire.png | 獵人營地的帳篷與營火 | [isometric props and tents](https://opengameart.org/content/isometric-props-and-tents)（`props_tilesets.zip`） | rubberduck | CC0 | 裁切、調亮 |
| public/assets/props/prop_*.png | 木箱、木桶與其堆疊（障礙物，依格子位置挑一種） | 同上 | rubberduck | CC0 | 裁切、調亮 |
| public/assets/props/decor_stump_*.png、decor_firewood_*.png | 樹樁、柴堆（裝飾，不擋路） | 同上 | rubberduck | CC0 | 裁切、調亮 |
| public/assets/props/decor_cauldron.png | 鐵鍋（裝飾） | 同上；作者在頁面註明這件取自 [Lowpoly Medieval Village Pack](https://opengameart.org/content/lowpoly-medieval-village-pack) | rubberduck（原模型作者頁面未列名） | 作者標示整包為 CC0；**原包的授權我沒有另外查證** | 裁切、調亮 |
| public/assets/tiles/dirt_*.png、dirt_edge_*.png | 土路（中間整格、兩側帶柔邊的補丁） | [updated grassland tileset (stylized)](https://opengameart.org/content/updated-grassland-tileset-stylized)（`dirt_tiles.png`） | rubberduck | CC0 | 裁切、調亮 |
| public/assets/tiles/sand_*.png、sea_*.png | 沙灘地面、海水（128×64，顯示為 64×32） | 同上（`sand_tiles.png`、`water_v01.png`） | rubberduck | CC0 | 裁切、調亮 |
| public/assets/tiles/cave_*.png | 洞窟地面 | 同上（`dirt_tiles.png` 的石板色調，重新上色成藍灰） | rubberduck | CC0 | 裁切、改色 |
| public/assets/props/plant_*.png | 灌木、矮樹叢、草叢、雜草、棕櫚、熱帶植物（草地與沙灘的散布裝飾） | [Free isometric plants-pack](https://opengameart.org/content/free-isometric-plants-pack) | rubberduck（打包），模型與貼圖 yughues | CC0 | 調亮 |

**已知的風格落差**：房屋、樹、道具、植物仍是第三方的 3D 渲染圖，與角色的半寫實像素插畫風格不完全一致。

## 地圖物件：水井、海邊岩石、渡船（2026-10-15，本機 AI 生成）

這三樣原本是程式畫的佔位圖，看起來太假，現在換成圖片：用本機 ComfyUI 的 **Z-Image-Turbo**（Apache-2.0，沒有使用付費 API，沒有套 LoRA）
生成「等角視角的 3D 渲染風單一物件」，風格對齊第三方的木屋與樹；背景要求純洋紅色，再用色鍵去背（洋紅背景、含投影一起去掉）。
原圖在 [docs/art/props/](docs/art/props/)，種子與完整提示詞在 [docs/art/prop-prompts.json](docs/art/prop-prompts.json)，
處理腳本是 [tools/prepare_props.py](tools/prepare_props.py)；程式畫的舊版保留，作為圖片載入失敗時的備援。

| 專案內檔案 | 用途 | 大小（像素；遊戲以一半顯示） |
| --- | --- | --- |
| public/assets/buildings/well.png | 村子廣場的水井（石砌井圈、木頂、水桶） | 130×177 |
| public/assets/buildings/ferry.png | 斷潮海岸擱淺的渡船（深灰金屬板船身、淡色骨肋、藍色提燈） | 520×481 |
| public/assets/props/boulder_0 / 1 / 2.png | 沙灘邊界的岩石堆（三種，依格子位置挑一種；遊戲以 0.45 倍顯示） | 170×約 105 |

**已知的限制**：沙地邊緣還留有一點淡淡的粉紅色（洋紅殘留）；岩石底下的沙堆顏色比沙灘的地磚亮一點；
渡船的位置與大小是我對著畫面調的，船頭方向是模型畫出來的。洞窟的石筍與遺跡的牆仍是程式畫的佔位圖。

## 墜金的圖（2026-10-15，本機 AI 生成）

怪物掉的金幣堆，三種大小：public/assets/props/gold_small.png、gold_mid.png、gold_big.png（古錢、金元寶與一枚碎玉環，帶一點冷青色的光）。做法同上一節（本機 Z-Image-Turbo、純綠背景去背、沒有第三方素材），
提示詞在 [docs/art/prop-prompts.json](docs/art/prop-prompts.json)。小堆與中堆一開始被畫在桌子與托盤上，補了「沒有桌子、托盤、底座」重畫。

## 第二章的暗色仙俠美術（2026-10-15，本機 AI 生成 + 程式處理）

依使用者的意見，第二章的環境與建築改成暗色仙俠、帶黑暗奇幻的調性（方向見 [chapter2-art-direction.md](docs/design/chapter2-art-direction.md)）。
做法與前面相同：本機 ComfyUI 的 Z-Image-Turbo，沒有付費 API、沒有 LoRA；提示詞與種子在 [docs/art/prop-prompts.json](docs/art/prop-prompts.json)，
用 [tools/gen_zimage.py](tools/gen_zimage.py) 出圖到 `docs/art/props/`；這一批用**純綠背景**去背（暗紅色的木頭和洋紅背景太像，會被挖洞），
去背時把邊緣的綠色溢色去掉（[tools/prepare_props.py](tools/prepare_props.py)）。**沒有第三方素材。**

| 專案內檔案 | 用途 |
| --- | --- |
| public/assets/buildings/town_inn、town_herbal、town_smithy、town_office、town_house_a、town_house_b.png | 青嵐鎮的客棧、藥鋪、鐵匠鋪、巡山司、兩種民宅（取代原本島上的木屋） |
| public/assets/buildings/town_gate.png、town_stall.png、town_board.png | 牌坊、破布棚攤位、告示板（取代原本的條紋攤位與告示板） |
| public/assets/props/prop_jar_a/b/c.png | 封罈、骨灰罈、棺木（青嵐鎮的「c」格，取代木箱與木桶） |
| public/assets/props/decor_lantern、censer、banner、bones、grave、lion.png | 石燈、香爐、殘旗、白骨、墓碑、石獅（青嵐鎮的裝飾） |
| public/assets/props/tree_dead_a/c/e/f/g.png | 枯樹（古林、青嵐鎮的外圍、海岸後面的濕林；取代綠色的樹） |
| public/assets/props/spire_a/b/c.png | 劍塚與折斷的石柱（斷劍山道的障礙；取代沙地圈裡的岩石） |
| public/assets/props/rock_sea_a/b.png | 黑色礁石（迷霧海岸的障礙） |
| public/assets/props/decor_fungus_c/d.png | 長在骷髏與朽木上的蕈（古林的地面裝飾；**取代原本偏可愛的淡青色蕈 fungus_a/b，兩張已刪除**） |
| public/assets/props/decor_driftwood_a/b.png | 朽木板與破船桅（迷霧海岸；取代原本偏亮的木頭堆） |
| public/assets/tiles/flag_、flagroad_、soil_、trail_、rock_、rockroad_、ash_、ashtrail_ 開頭的檔案 | 第二章的地面：青石板與石板路、腐土與小徑、山岩與古道、灰礫灘與小徑（柔邊補丁是檔名有 `edge_` 的） |

**地磚**：先生成八張俯視的無縫材質（`tex_*.webp`，存在 docs/art/props/），再用 [tools/prepare_tiles.py](tools/prepare_tiles.py) 轉 45 度、壓成 128×64 的菱形，
每組從材質的不同位置、翻轉與轉向切 8 塊，並把亮度拉到材質平均、降低對比，鄰近的磚才不會像棋盤。
**懸崖牆**（斷劍山道）是程式畫的（[RuinsArt.ts](src/game/RuinsArt.ts) 的 `drawCliffWall`）：原本的牆塊乘上冷灰藍，加上裂紋、崩邊與鏽痕。
**整體調色**是 CSS（[styles.css](src/styles.css)）：冷色疊色、降低飽和與暗角。

**已知的限制**：香爐的煙是偏亮的綠色；兩隻怪物（腐靈花妖、藤甲猿）還是原本偏可愛的畫法；青嵐鎮的地面是均勻的灰，變化不多；
迷霧海岸的灰礫灘很平；NPC 的像素小人與 3D 渲染的場景畫風有落差；樹與礁石的種類只有 3 到 5 種，邊緣的樹牆看得出重複。

## 第二章後半：青藤古林、青嵐鎮、斷劍山道（2026-10-15，本機 AI 生成 + 程式繪製）

做法與前面相同（本機 ComfyUI 的 Z-Image-Turbo，沒有付費 API、沒有 LoRA）。種子與提示詞在 [docs/art/turnaround-prompts.json](docs/art/turnaround-prompts.json)、
[docs/art/character-prompts.json](docs/art/character-prompts.json) 與 [docs/art/prop-prompts.json](docs/art/prop-prompts.json)；轉面原圖在 [docs/art/turnarounds/](docs/art/turnarounds/)。

**八種怪物**（像素精靈，`public/assets/monsters/`）：green_fang_wolf（青牙狼）、mountain_blade_wolf（山地刃狼，兩種狼用同一種畫法）、vine_ape（藤甲猿）、rot_flower（腐靈花妖）、
old_wood_warden（古木巡守者，Boss）、exiled_swordsman（流亡刀客）、fallen_cultivator（墮靈修士）、broken_sword_colossus（斷劍巨像，Boss）。
**青牙狼被呼叫來的同伴**（`green_fang_ally`）與青牙狼共用圖。

**五位 NPC**（形象圖 `public/assets/art/characters/`、對話頭像 `art/portraits/`、地圖上的像素小人 `public/assets/characters/`）：innkeeper_zhoubo（周伯）、herbalist_qinghe（沈青禾）、
blacksmith_tieshan（鐵山）、wanderer_guchangfeng（顧長風）、patrol_linruotang（林若棠）。做法與第一章的角色一樣：先畫一張形象圖，再用局部重繪補出正面、朝左的側面與背面，縮成像素。

**場景小物**（生成圖；這批用新的「自動底色」去背，見 [tools/prepare_props.py](tools/prepare_props.py)，它跟著圖片自己的背景色走並把比背景暗的紫色陰影一起去掉）：

| 專案內檔案 | 用途 |
| --- | --- |
| ~~decor_fungus_a/b.png~~ | 已被暗色版的 fungus_c/d 取代並刪除（見上一節） |
| public/assets/props/decor_tablet_a.png | 古老石碑（古林中央空地，可查看） |
| public/assets/props/decor_altar_a.png | 被侵蝕的祭壇（古林，任務「靈氣的痕跡」） |
| public/assets/buildings/sword.png | 斷裂的巨劍（山道的戰場） |
| public/assets/buildings/outpost.png | 廢棄的哨站（山道） |
| public/assets/buildings/stall.png、noticeboard.png | 市集攤位、懸賞告示板（**已不再使用**，青嵐鎮改用 town_stall、town_board；檔案還在，BuildingArt 仍登記著） |

**青嵐鎮的房屋**一開始用的是島上村子的木屋（第三方 CC0 圖），後來已換成專屬的暗色仙俠建築（見上一節）。
**程式畫的**：根刺（Boss 召喚的）、毒霧。

**已知的限制**：只有待機有畫格，其餘動作是程式演出；兩種狼和本島的野狼長得很像；紫色陰影在哨站的圍籬裡還有一點殘留；NPC 的轉面是模型另外畫的，服裝的細節在不同面之間有出入。

## 迷霧海岸的怪物與場景（2026-10-15，本機 AI 生成 + 程式繪製）

做法與前面相同（本機 ComfyUI 的 Z-Image-Turbo，沒有付費 API、沒有 LoRA）。種子與提示詞在 [docs/art/turnaround-prompts.json](docs/art/turnaround-prompts.json) 與 [docs/art/prop-prompts.json](docs/art/prop-prompts.json)。

| 專案內檔案 | 內容 |
| --- | --- |
| public/assets/monsters/cleft_boar.png | 裂角野豬（256×256） |
| public/assets/monsters/wreck_revenant.png | 沉船怨骸（320×320，80 像素的格子） |
| public/assets/monsters/drowned_spirit.png | 溺靈水妖（320×320，80 像素的格子） |
| public/assets/buildings/wreck.png | 擱淺的沉船（520×570，當作建築畫在 5×3 格上） |
| public/assets/props/decor_driftwood_a/b.png | 浮木堆（地面裝飾，不擋路） |
| public/assets/props/decor_anchor.png | 生鏽的船錨（地面裝飾） |

**荒林野狼沿用林道野狼的圖**（同一種動物；只是數值與行為不同，見 README）。**程式畫的**：霧（白色的柔邊雲，鋪在地面之上、所有物件與角色之下，所以不會把怪物洗成灰色，[HazardArt.ts](src/game/HazardArt.ts) 的 `drawCloud`）、水面的漣漪（水妖潛伏時）。

**重畫過一次**（第一版的怨骸與水妖腳下帶著地面陰影、霧氣與水窪，縮成像素後變成怪異的色塊，怨骸又暗又糊，野豬的「背面」其實是側面）：新版提示詞明確禁止地面、陰影、水窪、霧；野豬的背面改用「沿著脊椎從正後方看」的描述重畫；人形的背面描述不再提到「尾巴」（第一次畫出了尾巴）。像素腳本新增 `brightness` 選項，怨骸提亮了。

**已知的限制**：只有待機有畫格，其餘動作是程式演出；水妖的透明感只靠藍色調表現（不是真的半透明）；怨骸的綠色發光眼睛縮成像素後看不見；怨骸與水妖腳下還有一小塊灰色殘影；沉船很大（比 5×3 格的腳印高很多），走到它後面角色會被擋住，目前沒有淡出；
沉船、浮木、船錨是同一批生成圖，木頭的顏色和島上的建築不太一致。

## 初胎核心的怪物與場景（2026-10-15，本機 AI 生成 + 程式繪製）

做法與源泉洞相同（本機 ComfyUI 的 Z-Image-Turbo，沒有付費 API、沒有 LoRA）：

**三種新怪物**（像素精靈；種子與提示詞在 [docs/art/turnaround-prompts.json](docs/art/turnaround-prompts.json)，原圖在 [docs/art/turnarounds/](docs/art/turnarounds/)）：

| 專案內檔案 | 怪物 |
| --- | --- |
| public/assets/monsters/stone_attendant.png | 胎岩侍者（320×320，80 像素的格子） |
| public/assets/monsters/mask_spirit.png | 殘面靈（256×256） |
| public/assets/monsters/core_watcher.png | 初胎守望者（Boss，512×512，128 像素的格子） |

殘面靈只有一張圖（面具從後面看只是凹的），四個方向共用同一張；幻影用同一張圖加上半透明與淡藍色。

**場景小物**（生成圖，去背後縮放；漂浮水晶用橘色底，其餘用洋紅底，見 [tools/prepare_props.py](tools/prepare_props.py)）：

| 專案內檔案 | 用途 |
| --- | --- |
| public/assets/props/core_pillar_0..1.png | 巨大石柱（核心的 `T` 圖塊，擋路） |
| public/assets/props/decor_shard_a/b.png | 漂浮水晶（地面上方飄浮、上下輕輕浮動，不擋路） |
| public/assets/props/decor_roots_a/b.png | 樹根叢（地面裝飾，不擋路） |
| public/assets/props/decor_core.png | 初胎核心本體（Boss 房中央的發光球與石環） |

**程式畫的（沒有圖檔）**：Boss 召喚的石柱與預警圓盤、胎岩侍者死後的石塊碎片（[HazardArt.ts](src/game/HazardArt.ts)）。

**已知的限制**：只有待機有畫格，其餘動作是程式演出；胎岩侍者與遺跡的胎岩魔像長得相近（都是石頭巨人，差在侍者比較瘦、身上有青色符文）；守望者的背面是模型另外畫的，細節和正面有出入；
核心本體的石環底部在去背時被吃掉一些。

## 源泉洞與初胎遺跡的怪物與場景（2026-10-15，本機 AI 生成 + 程式繪製）

全部在本機 ComfyUI 的 Z-Image-Turbo 上完成（沒有使用付費 API，沒有套 LoRA），流程和野狼、毒蛇相同：

**四種新怪物**（像素精靈，方向與待機格式同其他怪物；大的用 96 像素的格子）：

1. 先各畫一張基礎圖（朝右的四分之三側面），挑最好的；再用局部重繪補出**正面**與**背面**（蝙蝠、鹿、魔像）。
   凝膠是圓的，四個方向共用同一張圖。種子與提示詞在 [docs/art/turnaround-prompts.json](docs/art/turnaround-prompts.json)，
   原圖在 [docs/art/turnarounds/](docs/art/turnarounds/)（`spring_gel_*`、`crystal_bat_*`、`corroded_deer_*`、`rock_golem_*`）。
2. [tools/prepare_sprites.py](tools/prepare_sprites.py) 縮成像素精靈（去背、共用調色盤、硬邊、描邊）。

| 專案內檔案 | 怪物 |
| --- | --- |
| public/assets/monsters/spring_gel.png | 源泉凝膠（256×256） |
| public/assets/monsters/crystal_bat.png | 晶翼蝠（256×256） |
| public/assets/monsters/corroded_deer.png | 蝕靈鹿（Boss，384×384） |
| public/assets/monsters/rock_golem.png | 胎岩魔像（384×384） |

凝膠與魔像胸口的核心在遊戲裡另外加了一層會脈動的發光（程式畫），因為縮成像素後調色盤把核心的亮度壓暗了。

**場景小物**（生成圖，去背後縮放；水晶用橘色底，其他用洋紅底，見 [tools/prepare_props.py](tools/prepare_props.py)，提示詞在 [docs/art/prop-prompts.json](docs/art/prop-prompts.json)）：

| 專案內檔案 | 用途 |
| --- | --- |
| public/assets/props/crystal_0..2.png | 洞窟裡的水晶叢（取代三分之一的石柱，擋路） |
| public/assets/props/decor_moss_a/b.png | 發光苔癬（地面裝飾，不擋路；洞窟與遺跡都會撒） |
| public/assets/props/decor_vines_a/b/c.png | 藤蔓（地面裝飾，不擋路；洞窟與遺跡都會撒） |

**程式畫的（沒有圖檔）**：遺跡的長滿青苔與藤蔓的牆（[RuinsArt.ts](src/game/RuinsArt.ts)，4 種）、地刺（三個狀態）、箭孔、牆上的青藍火把與光暈（[HazardArt.ts](src/game/HazardArt.ts)）。

**已知的限制**：只有待機有畫格，其餘動作（彈跳、蝙蝠的拍翅、蝕靈鹿的衝刺、魔像的重擊）是程式演出；蝕靈鹿與魔像的背面是模型另外畫的，細節和正面有出入（魔像背面看得到的發光核心被省掉了）；
水晶的底座（石頭與苔）去背時被吃掉一些，邊緣有零星的殘留；蝙蝠的正面與背面翅膀展開比側面寬很多，在小格子裡有點擠。

## 森林怪物：野狼與毒蛇（2026-10-15，像素風，本機 AI 生成）

臍帶林道原本放的是程式畫的「林牙獸」佔位圖，改成比較正常的野生動物：**野狼**（會撲咬）與**毒蛇**（吐毒液）。做法和地圖上的角色一樣，
全部在本機 ComfyUI 的 Z-Image-Turbo 上完成（沒有使用付費 API，沒有套 LoRA）：

1. 先各畫一張基礎圖（朝右的四分之三側面），挑最好的；再用局部重繪補出**正面**與**背面**（狼的背面是「從後方看、頭轉向左」）；
   左側是右側的鏡像。種子與提示詞在 [docs/art/turnaround-prompts.json](docs/art/turnaround-prompts.json)，原圖在 [docs/art/turnarounds/](docs/art/turnarounds/)
   （`forest_wolf_*`、`forest_viper_*`），基礎圖也在 [docs/art/monsters/](docs/art/monsters/)。
2. [tools/prepare_sprites.py](tools/prepare_sprites.py) 與角色用同一套流程縮成像素精靈（去背、共用調色盤、硬邊、描邊）：狼側面長 46 像素，
   蛇側面長 34 像素（蛇用了 44 色調色盤，不然顏色會糊成一片）；每個方向 4 格待機，沒有翻滾格。

| 專案內檔案 | 怪物 |
| --- | --- |
| public/assets/monsters/forest_wolf.png | 野狼（256×256，4 方向 × 4 格） |
| public/assets/monsters/forest_viper.png | 毒蛇（256×256，4 方向 × 4 格） |

**已知的限制**：只有待機有畫格，走路、撲咬、吐毒、受傷、死亡都是程式演出（見 DirectionalAnimator：狼蹲下、跳起、落地，蛇後仰、前衝）；
自動縮成像素後，蛇的花紋糊掉，只剩橄欖褐色的一團；狼的背面只是後側視角，不是正後方。

## 遊戲內的角色精靈（2026-10-14，像素風，本機處理）

**地圖上看到的人物與「形象圖」是分開的兩套**：形象圖（上面的大張插畫）用在載入畫面、頭像、對話；地圖上走動的是像素小人，
各有正面、右、背面、左四個方向和 4 格待機動畫。之後形象圖要換風格，不會影響地圖上的小人。

像素小人是用每個角色的「正面、側面、背面」三張轉面圖縮出來的（轉面圖由本機 ComfyUI 的 Z-Image-Turbo 以形象圖為底局部重繪而成，
沒有使用付費 API）。Puny Characters（Shade，CC0）已經不再使用，相關檔案與腳本已移除。

1. 轉面圖原檔放在 [docs/art/turnarounds/](docs/art/turnarounds/)（`<角色>_front / left / back.webp`），種子與完整提示詞在
   [docs/art/turnaround-prompts.json](docs/art/turnaround-prompts.json)。每個角色每個方向各畫兩個種子，我用眼睛挑最好的一張。
2. [tools/prepare_sprites.py](tools/prepare_sprites.py) 去背、去掉腳下的灰色投影、每個角色用同一個縮放比例縮成約 38 到 54 像素高
   （轉身時大小不變）、提高飽和度與對比、把顏色減到每個角色共用的 28 色調色盤（不抖色）、邊緣變成硬邊（沒有半透明像素）、
   外面描一圈深色輪廓，放進 64×64 的格子。右側是左側的鏡像。
3. 待機是經典的「呼吸起伏」：上半身每隔兩格下沉一個像素，雙腳不動。
4. **閃避翻滾**（Space）有真正的畫格：每個方向 8 格，第一格是蹲下，之後把人物壓成團身的一顆球（變矮、變寬），每格轉 45 度（用最近鄰取樣，所以每一格都對齊像素格，不會糊）；正面與右邊順時針、背面與左邊逆時針翻。翻滾的時間等於閃避衝刺的時間（0.2 秒），中途有一小段跳起。
5. 輸出 `public/assets/characters/<角色>.png`（768×256，4 方向 × 12 格：先 4 格待機、再 8 格翻滾），遊戲不做平滑處理地畫出。

| 專案內檔案 | 角色 | 高度（像素） |
| --- | --- | --- |
| public/assets/characters/hero.png | 主角 | 50 |
| public/assets/characters/elder_qiyi.png | 祈漪 | 45 |
| public/assets/characters/hunter_yanya.png | 岩牙 | 54（含弓尖） |
| public/assets/characters/waterer_xi.png | 汐 | 41 |
| public/assets/characters/boatwright_laodu.png | 老舵 | 38 |

**已知的限制**
- **是自動縮出來的像素風，不是手繪的像素畫**：細節（臉、配件）在 40 到 50 像素高時大多糊掉，只剩輪廓、髮型與主要顏色。
- **只有待機與翻滾有畫格**。走路、攻擊、受傷、死亡由程式演出：走路＝上下跳動加左右微擺、攻擊＝往前衝並前傾、受傷＝變紅並後退、死亡＝倒下淡出。
  沒有手腳擺動，所以看起來是「滑步」。
- **各視角之間有些不一致**：轉面圖是模型分別生成的，例如岩牙的長弓在側面看不到、主角的短劍在正面看不到。
- **右側是左側鏡像**，不對稱的東西（劍掛的邊、手持木杖的手）在右側會換邊。
- 角色高度是我定的，汐與老舵比較矮。

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

**使用處**：載入畫面（全身圖）、HUD 左下角的肖像（像素小人）。這兩張與遊戲內的主角（見「遊戲內的角色精靈」）不是同一個造型。
像素小人**只是一張靜態圖**，沒有行走或攻擊動畫，所以不能直接取代遊戲內角色的動畫表。

## 五位角色的形象圖（2026-10-14，本機 AI 生成）

同樣在本機 ComfyUI 用 **Z-Image-Turbo**（Apache-2.0，授權與工作流程說明見上一節）生成，沒有使用付費 API。畫風參考你提供的附圖
（半寫實、帶像素顆粒感的插畫）。這些是形象圖；地圖上走動的像素小人是另一套（見下一節）。
生成設定：832×1216、8 步，轉成 WebP（品質 92）。每張的種子與完整英文提示詞在 [docs/art/character-prompts.json](docs/art/character-prompts.json)。

| 專案內檔案 | 角色 | 種子 |
| --- | --- | --- |
| public/assets/art/characters/hero.webp | 主角（中性，青綠亞麻束腰、腰間短劍、前臂金色紋路） | 5102 |
| public/assets/art/characters/elder_qiyi.webp | 祈漪（老婆婆，草繩披肩、木杖、貝殼串） | 5201 |
| public/assets/art/characters/hunter_yanya.webp | 岩牙（壯年男獵人，弓、匕首、爪痕） | 5301 |
| public/assets/art/characters/waterer_xi.webp | 汐（瘦小白皙的年輕女性，竹桶與布包） | 5901 |
| public/assets/art/characters/boatwright_laodu.webp | 老舵（矮壯的男船匠，編辮鬍、雪茄、皮圍裙） | 5702 |

**性別是我替沒有指定的角色選的預設**（設計文件只明確寫了汐是女性）：主角中性、祈漪女、岩牙男、老舵男。
**已知的偏差**：主角的劍比「短劍」長一點、金色紋路很淡；老舵為了避開模型自行加上的尖耳朵，提示詞改寫成「矮壯的人類男子」，
所以不太像矮人；五人的轉身角度不一致（有的接近 30 度，有的偏正面）；汐的矮小單張圖看不出來。
**對話用的半身像**（public/assets/art/portraits/*.webp，透明背景）是從上面這五張全身圖去背後裁出上半身，
處理腳本是 [tools/prepare_portraits.py](tools/prepare_portraits.py)，不是另外生成的。
第一輪的草稿（較卡通，已被取代）與其他備選圖在 docs/art/cast-drafts/，沒有提交。

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
