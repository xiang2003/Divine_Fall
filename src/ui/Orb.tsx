/** A round gauge (health, mana): a glass ball whose liquid level is the fraction, with text over it. */
export function Orb({ kind, fraction, main, sub, title }: { kind: 'hp' | 'mp'; fraction: number; main: string; sub: string; title: string }) {
  const level = Math.max(0, Math.min(1, fraction));
  return (
    <div className={`orb orb-${kind}`} title={title}>
      <div className="orb-glass">
        <div className="orb-liquid" style={{ height: `${level * 100}%` }} />
        <div className="orb-shine" />
      </div>
      <div className="orb-text">
        <span className="orb-main">{main}</span>
        <span className="orb-sub">{sub}</span>
      </div>
    </div>
  );
}

/** The experience bar under the skill bar: level on the left, a thin bar, the numbers on the right. */
export function XpBar({ level, xp, xpToNext }: { level: number; xp: number; xpToNext: number }) {
  const fraction = xpToNext > 0 ? Math.max(0, Math.min(1, xp / xpToNext)) : 1;
  return (
    <div className="xp-bar" title="經驗">
      <span className="xp-level">Lv {level}</span>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className="xp-numbers">{xpToNext > 0 ? `${xp} / ${xpToNext}` : 'MAX'}</span>
    </div>
  );
}
