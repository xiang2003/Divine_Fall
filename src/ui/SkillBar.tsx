import { LOCKED_SKILL_ACTIONS } from '../config/gameConfig';
import type { PotionSlotView, SkillView } from '../game/Game';

/** A potion bottle drawn with shapes, so it needs no picture file. */
function Bottle({ kind }: { kind: 'health' | 'mana' }) {
  const [light, dark] = kind === 'health' ? ['#f0604f', '#8e1d16'] : ['#7d9bff', '#2c3aa0'];
  return (
    <svg className="potion-bottle" viewBox="0 0 32 40" aria-hidden="true">
      <rect x="12" y="2" width="8" height="5" rx="1" fill="#8a6a3a" />
      <rect x="13" y="6" width="6" height="6" fill="#cfd8e6" fillOpacity="0.55" />
      <path d="M13 12 L19 12 L27 22 L27 33 Q27 38 22 38 L10 38 Q5 38 5 33 L5 22 Z" fill="#cfd8e6" fillOpacity="0.25" stroke="#d8c9a0" strokeWidth="1.5" />
      <path d="M7 24 L25 24 L25 33 Q25 36 22 36 L10 36 Q7 36 7 33 Z" fill={dark} />
      <path d="M7 24 L25 24 L25 28 L7 28 Z" fill={light} />
      <ellipse cx="11" cy="28" rx="1.6" ry="3" fill="#fff" fillOpacity="0.45" />
    </svg>
  );
}

/** Q W E (usable) and R T (locked until Phase 5), then the three potion slots (1 2 3). Cooldown shows as a draining overlay with seconds left. */
export function SkillBar({ skills, potions }: { skills: readonly SkillView[]; potions: readonly PotionSlotView[] }) {
  return (
    <div className="hud-skills">
      {skills.map((s) => {
        const fraction = s.total > 0 ? Math.min(1, s.remaining / s.total) : 0;
        return (
          <div
            key={s.id}
            className={`skill-slot ${s.ready ? 'ready' : 'cooling'}`}
            title={`${s.name}（${s.keyLabel}）\n${s.description}`}
          >
            <span className="skill-key">{s.keyLabel}</span>
            <span className="skill-name">{s.name}</span>
            {!s.ready && (
              <>
                <div className="skill-cooldown" style={{ height: `${fraction * 100}%` }} />
                <span className="skill-seconds">{s.remaining.toFixed(1)}</span>
              </>
            )}
          </div>
        );
      })}
      {LOCKED_SKILL_ACTIONS.map((action) => (
        <div key={action} className="skill-slot locked" title="尚未解鎖">
          <span className="skill-key">{action.slice(5)}</span>
          <span className="skill-name">未解鎖</span>
        </div>
      ))}
      <div className="skill-divider" />
      {potions.map((slot) => {
        const p = slot.potion;
        return (
          <div
            key={slot.keyLabel}
            className={`skill-slot potion-slot ${!p ? 'empty' : p.charges > 0 ? 'ready' : 'drained'}`}
            title={
              p
                ? `${p.name}（${slot.keyLabel}）　充能 ${p.charges} / ${p.maxCharges}\n${p.description}\n每次使用消耗 1 充能；擊殺怪物回復部分，回村全滿。`
                : `藥水欄（${slot.keyLabel}）：空`
            }
          >
            <span className="skill-key">{slot.keyLabel}</span>
            {p && (
              <>
                <Bottle kind={p.id} />
                {/* the sweep climbs as kills charge the next use */}
                {p.fraction > 0 && <div className="potion-charge" style={{ height: `${p.fraction * 100}%` }} />}
                <span className="potion-count">
                  {p.charges}/{p.maxCharges}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
