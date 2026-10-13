import { useEffect, useRef, useState } from 'react';
import { BRANDING } from '../config/branding';
import type { GameSnapshot } from '../game/Game';
import { EquipmentSummary } from './EquipmentPanel';
import { Inventory, type InventoryActions } from './Inventory';
import { BossBar } from './BossBar';
import { SkillBar } from './SkillBar';

const TOAST_MS = 1200;

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
}: {
  snapshot: GameSnapshot;
  onRestart: () => void;
  inventoryActions: InventoryActions;
}) {
  if (snapshot.phase === 'loading') {
    return (
      <div className="screen">
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
      <div className="panel hud-top-left">
        <strong>{BRANDING.titleZh}</strong> · {snapshot.mapName}
      </div>
      <div className="panel hud-bottom-left">
        左鍵 移動 · 右鍵 攻擊（可按住）· Space 閃避 · I 背包 · F 拾取 · Q W E 技能 · F3 除錯
      </div>
      <HitFlash hitSeq={snapshot.hitSeq} />
      {snapshot.fade > 0 && <div className="fade-overlay" style={{ opacity: snapshot.fade }} />}
      <div className="panel hud-hp">
        <div className="hp-track">
          <div
            className="hp-fill"
            style={{ width: `${(100 * snapshot.playerHp) / Math.max(1, snapshot.playerMaxHp)}%` }}
          />
          <span className="hp-text">
            {snapshot.playerHp} / {snapshot.playerMaxHp}
          </span>
        </div>
        <div className="hud-level">
          <span>Lv {snapshot.level}</span>
          <div className="xp-track">
            <div
              className="xp-fill"
              style={{ width: `${snapshot.xpToNext > 0 ? (100 * snapshot.xp) / snapshot.xpToNext : 100}%` }}
            />
          </div>
          <span className="muted">{snapshot.xpToNext > 0 ? `${snapshot.xp} / ${snapshot.xpToNext}` : 'MAX'}</span>
        </div>
      </div>
      <div className="panel hud-kills">
        擊殺 {snapshot.kills} · 剩餘 {snapshot.monstersAlive} / {snapshot.monstersTotal}
      </div>
      {(snapshot.buffs.haste || snapshot.buffs.frenzy) && (
        <div className="hud-buffs">
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
      <EquipmentSummary equipment={snapshot.inventory.equipment} />
      {snapshot.inventoryOpen && <Inventory view={snapshot.inventory} {...inventoryActions} />}
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
          F4 掉落傳奇 · F6 穿上傳奇 · F7 重生怪物 · F8 傳送 · F9 升一級 · F10 開關封石
        </div>
      )}
    </div>
  );
}
