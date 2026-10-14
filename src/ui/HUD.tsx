import { useEffect, useRef, useState } from 'react';
import { BRANDING } from '../config/branding';
import type { GameSnapshot } from '../game/Game';
import { EquipmentSummary } from './EquipmentPanel';
import { Inventory, type InventoryActions } from './Inventory';
import { BossBar } from './BossBar';
import { DialogueBox, type DialogueActions } from './DialogueBox';
import { QuestLog, QuestTracker } from './QuestPanels';
import { WorldMapPanel } from './WorldMapPanel';
import { getNpc } from '../data/npcs';
import { assetUrl } from '../game/AssetLoader';
import { Minimap } from './Minimap';
import { Orb } from './Orb';
import type { MinimapView } from './minimapDraw';
import { SkillBar } from './SkillBar';

const TOAST_MS = 1200;

function npcName(id: string): string {
  try {
    return getNpc(id).name;
  } catch {
    return id;
  }
}

/** Red screen-edge flash each time the player takes damage (restarts on every new hit). */
function HitFlash({ hitSeq }: { hitSeq: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || hitSeq === 0) return;
    el.classList.remove('active');
    void el.offsetWidth; // force reflow so the CSS animation restarts
    el.classList.add('active');
  }, [hitSeq]);
  return <div className="hit-flash" ref={ref} />;
}

/** Shows the latest notice briefly; a new notice (new seq) restarts the timer. */
function Toast({ notice }: { notice: GameSnapshot['notice'] }) {
  const [hiddenSeq, setHiddenSeq] = useState(0);
  const seq = notice?.seq ?? 0;
  useEffect(() => {
    if (!seq) return;
    const id = window.setTimeout(() => setHiddenSeq(seq), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [seq]);
  if (!notice || hiddenSeq === notice.seq) return null;
  return <div className="panel hud-toast">{notice.text}</div>;
}

/** HUD: loading / error screens, health, kill counter, hit flash, death screen, controls hint and debug readout. */
export function HUD({
  snapshot,
  onRestart,
  inventoryActions,
  dialogueActions,
  getMinimapView,
  onCloseQuestLog,
  onCloseWorldMap,
  onDismissChapterEnd,
}: {
  snapshot: GameSnapshot;
  onRestart: () => void;
  inventoryActions: InventoryActions;
  dialogueActions: DialogueActions;
  getMinimapView: () => MinimapView | null;
  onCloseQuestLog: () => void;
  onCloseWorldMap: () => void;
  onDismissChapterEnd: () => void;
}) {
  if (snapshot.phase === 'loading') {
    return (
      <div className="screen">
        <img className="title-art" src={assetUrl('assets/art/hero_full.webp')} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <h1 className="title">{BRANDING.titleZh}</h1>
        <div className="subtitle">{BRANDING.titleEn}</div>
        <p className="muted">載入中…</p>
      </div>
    );
  }

  if (snapshot.phase === 'error') {
    return (
      <div className="screen">
        <h1 className="title">{BRANDING.titleZh}</h1>
        <p className="error">無法啟動遊戲</p>
        <p className="muted">{snapshot.error}</p>
      </div>
    );
  }

  return (
    <div className="hud">
      <div className="hud-location">
        <div className="hud-location-name">{snapshot.mapName}</div>
        <div className="hud-location-sub">
          擊殺 {snapshot.kills} · 剩餘 {snapshot.monstersAlive} / {snapshot.monstersTotal}
        </div>
      </div>
      <div className="hud-hint">左鍵 移動 · 右鍵 攻擊 · Space 閃避 · Q W E 技能 · I 背包 · J 任務 · M 地圖 · F 互動 · F3 除錯</div>
      <HitFlash hitSeq={snapshot.hitSeq} />
      {snapshot.fade > 0 && <div className="fade-overlay" style={{ opacity: snapshot.fade }} />}
      <div className="hud-hero">
        <div className="hud-hero-clip">
          <img className="hud-hero-face" src={assetUrl('assets/art/portraits/hero.webp')} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
        <span className="hud-hero-level">{snapshot.level}</span>
      </div>
      <Orb kind="hp" fraction={snapshot.playerHp / Math.max(1, snapshot.playerMaxHp)} main={`${snapshot.playerHp}`} sub={`/ ${snapshot.playerMaxHp}`} title="生命" />
      <Orb
        kind="xp"
        fraction={snapshot.xpToNext > 0 ? snapshot.xp / snapshot.xpToNext : 1}
        main={`Lv ${snapshot.level}`}
        sub={snapshot.xpToNext > 0 ? `${snapshot.xp} / ${snapshot.xpToNext}` : 'MAX'}
        title="經驗"
      />
      <div className="hud-minimap-slot">
        <Minimap getView={getMinimapView} title="小地圖（M：世界地圖）" />
      </div>
      {(snapshot.buffs.haste || snapshot.buffs.frenzy || snapshot.buffs.poison) && (
        <div className="hud-buffs">
          {snapshot.buffs.poison && <span className="buff buff-poison">中毒</span>}
          {snapshot.buffs.haste && <span className="buff buff-haste">疾行 +移速</span>}
          {snapshot.buffs.frenzy && <span className="buff buff-frenzy">狂熱 +攻速</span>}
        </div>
      )}
      {snapshot.boss && <BossBar boss={snapshot.boss} />}
      {snapshot.bossDefeated && (
        <div className="victory-banner">
          <strong>Boss 已被擊敗</strong>
          <span>拾取戰利品（點擊名稱或按 F）</span>
        </div>
      )}
      <SkillBar skills={snapshot.skills} />
      {!snapshot.inventoryOpen && <EquipmentSummary equipment={snapshot.inventory.equipment} />}
      {snapshot.inventoryOpen && <Inventory view={snapshot.inventory} {...inventoryActions} />}
      {!snapshot.inventoryOpen && <QuestTracker quests={snapshot.quests} npcName={npcName} />}
      {snapshot.worldMapOpen && <WorldMapPanel graph={snapshot.worldMap} onClose={onCloseWorldMap} />}
      {snapshot.questLogOpen && <QuestLog quests={snapshot.quests} npcName={npcName} onClose={onCloseQuestLog} />}
      {snapshot.chapterEnd && (
        <div className="chapter-end" onContextMenu={(e) => e.preventDefault()}>
          <h2>第一章　純源島</h2>
          <p className="chapter-end-line">渡船載著你離開了島。</p>
          <p className="muted">初胎之印在你的掌心微微發亮。海的另一邊，有一片你從未見過的陸地。</p>
          <p className="muted">（第一章完。後面的故事還沒有寫。）</p>
          <button type="button" onClick={onDismissChapterEnd}>
            回到島上繼續探索
          </button>
        </div>
      )}
      {snapshot.dialogue && <DialogueBox dialogue={snapshot.dialogue} {...dialogueActions} />}
      <Toast notice={snapshot.notice} />
      {snapshot.playerDead && (
        <div className="death-screen">
          <h2>你已倒下</h2>
          <p className="muted">神性的碎片仍在低語……</p>
          <button type="button" onClick={onRestart}>
            重新開始
          </button>
        </div>
      )}
      {snapshot.warnings.length > 0 && (
        <div className="panel hud-warning">
          {snapshot.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}
      {snapshot.debug && (
        <div className="panel hud-top-right mono">
          FPS {snapshot.fps}
          <br />
          位置 {snapshot.playerX.toFixed(2)}, {snapshot.playerY.toFixed(2)}
          <br />
          F4 掉落傳奇 · F6 穿上傳奇 · F7 重生怪物 · F8 傳送 · F9 升一級 · F10 開關封石與海岸路
        </div>
      )}
    </div>
  );
}
