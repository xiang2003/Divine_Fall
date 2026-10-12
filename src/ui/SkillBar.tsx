import { LOCKED_SKILL_ACTIONS } from '../config/gameConfig';
import type { SkillView } from '../game/Game';

/** Q W E (usable) and R T (locked until Phase 5). Cooldown shows as a draining overlay with seconds left. */
export function SkillBar({ skills }: { skills: readonly SkillView[] }) {
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
    </div>
  );
}
