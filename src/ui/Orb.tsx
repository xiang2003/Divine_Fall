/** A round gauge (health, experience): a glass ball whose liquid level is the fraction, with text over it. */
export function Orb({ kind, fraction, main, sub, title }: { kind: 'hp' | 'xp'; fraction: number; main: string; sub: string; title: string }) {
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
