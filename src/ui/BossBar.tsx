import type { BossView } from '../game/Game';

/** The boss health bar. White ticks mark where the next phases begin; the phase number is shown on the right. */
export function BossBar({ boss }: { boss: BossView }) {
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  return (
    <div className="panel boss-bar">
      <div className="boss-name">
        <span>{boss.name}</span>
        <span>
          階段 {boss.phase + 1} / {boss.phaseCount}
        </span>
      </div>
      <div className="boss-track">
        <div className="boss-fill" style={{ width: `${ratio * 100}%` }} />
        {/* Phase thresholds are fixed fractions of max HP: 66% and 33% for a three-phase boss. */}
        {Array.from({ length: boss.phaseCount - 1 }, (_, i) => (
          <div
            key={i}
            className="boss-pip"
            style={{ left: `${(1 - (i + 1) / boss.phaseCount) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
