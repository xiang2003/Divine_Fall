import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { AttackTimer } from '../src/systems/AttackTimer';
import { applyArmor, armorMultiplier, inAttackArc, normalizeInto, rollDamage } from '../src/systems/combatMath';
import { mulberry32 } from '../src/systems/rng';

describe('armor', () => {
  it('reduces damage with diminishing returns', () => {
    expect(armorMultiplier(0)).toBe(1);
    expect(armorMultiplier(100)).toBeCloseTo(0.5, 9);
    expect(armorMultiplier(300)).toBeCloseTo(0.25, 9);
    expect(armorMultiplier(-50)).toBe(1); // negative armor does not amplify damage
  });

  it('rounds and never lets a hit do less than 1', () => {
    expect(applyArmor(10, 100)).toBe(5);
    expect(applyArmor(8, 5)).toBe(8); // 7.62 -> 8
    expect(applyArmor(1, 10_000)).toBe(1);
  });
});

describe('rollDamage', () => {
  it('crits exactly when the roll is below the crit chance', () => {
    expect(rollDamage(10, 0.25, 2, () => 0.24)).toEqual({ amount: 20, crit: true });
    expect(rollDamage(10, 0.25, 2, () => 0.25)).toEqual({ amount: 10, crit: false });
    expect(rollDamage(10, 0, 2, () => 0)).toEqual({ amount: 10, crit: false });
    expect(rollDamage(10, 1, 1.5, () => 0.99)).toEqual({ amount: 15, crit: true });
  });

  it('is reproducible with a seeded rng and crits at roughly the configured rate', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: 2000 }, () => rollDamage(12, 0.2, 1.5, rng));
    };
    expect(run(7)).toEqual(run(7));
    const crits = run(7).filter((r) => r.crit).length;
    expect(crits / 2000).toBeGreaterThan(0.15);
    expect(crits / 2000).toBeLessThan(0.25);
  });

  it('never returns less than 1', () => {
    expect(rollDamage(0.1, 0, 1, () => 0.5).amount).toBe(1);
  });
});

describe('inAttackArc', () => {
  const half = PLAYER_CONFIG.attackArcHalfAngle;
  const hit = (tx: number, ty: number, r = 0.3, range = 1.5) =>
    inAttackArc(0, 0, 1, 0, tx, ty, r, range, half);

  it('hits targets in front within range', () => {
    expect(hit(1, 0)).toBe(true);
    expect(hit(1.7, 0)).toBe(true); // centre beyond range, but its edge is within reach
  });

  it('misses targets out of range, behind, or outside the cone', () => {
    expect(hit(2.5, 0)).toBe(false);
    expect(hit(-1, 0)).toBe(false);
    expect(hit(0, 1.2)).toBe(false); // 90 degrees off a 65 degree half-angle
  });

  it('hits a target at the edge of the cone but not just past it', () => {
    const r = 1.2;
    expect(hit(r * Math.cos(half - 0.05), r * Math.sin(half - 0.05))).toBe(true);
    expect(hit(r * Math.cos(half + 0.1), r * Math.sin(half + 0.1))).toBe(false);
  });

  it('always hits something overlapping the attacker, whatever the aim', () => {
    expect(hit(-0.2, 0.1)).toBe(true);
  });
});

describe('normalizeInto', () => {
  it('normalises and falls back for a zero vector', () => {
    const out = { x: 0, y: 0 };
    normalizeInto(3, 4, out);
    expect(out).toEqual({ x: 0.6, y: 0.8 });
    normalizeInto(0, 0, out, 1, 0);
    expect(out).toEqual({ x: 1, y: 0 });
  });
});

describe('AttackTimer', () => {
  const DT = 1 / 60;
  const tick = (t: AttackTimer, seconds: number) => {
    let hits = 0;
    let finishes = 0;
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const r = t.update(DT);
      if (r.hit) hits++;
      if (r.finished) finishes++;
    }
    return { hits, finishes };
  };

  it('delivers exactly one hit per swing, at the configured moment', () => {
    const t = new AttackTimer();
    expect(t.start(0.4, 0.5, 0.5)).toBe(true);
    expect(tick(t, 0.19).hits).toBe(0); // before 0.2s
    expect(tick(t, 0.03).hits).toBe(1); // crosses 0.2s
    const rest = tick(t, 0.5);
    expect(rest.hits).toBe(0);
    expect(rest.finishes).toBe(1);
    expect(t.swinging).toBe(false);
  });

  it('refuses a new swing while swinging or cooling down, then allows it', () => {
    const t = new AttackTimer();
    t.start(0.3, 0.6, 0.5);
    expect(t.start(0.3, 0.6, 0.5)).toBe(false); // mid-swing
    tick(t, 0.35); // swing over, cooldown (0.6) still running
    expect(t.swinging).toBe(false);
    expect(t.canStart).toBe(false);
    expect(t.start(0.3, 0.6, 0.5)).toBe(false);
    tick(t, 0.3);
    expect(t.canStart).toBe(true);
  });

  it('caps rapid clicking at the attack rate', () => {
    // Try to start a swing every frame for 5 seconds with a 0.5s cooldown -> at most 10 swings.
    const t = new AttackTimer();
    let swings = 0;
    for (let i = 0; i < 300; i++) {
      if (t.start(0.3, 0.5, 0.5)) swings++;
      t.update(DT);
    }
    expect(swings).toBeGreaterThanOrEqual(9);
    expect(swings).toBeLessThanOrEqual(10);
  });

  it('never lets the cooldown be shorter than the swing itself', () => {
    const t = new AttackTimer();
    t.start(0.5, 0.1, 0.5);
    tick(t, 0.45);
    expect(t.canStart).toBe(false);
  });

  it('cancel stops the swing without delivering the hit', () => {
    const t = new AttackTimer();
    t.start(0.4, 0.5, 0.5);
    tick(t, 0.1);
    t.cancel();
    expect(tick(t, 1).hits).toBe(0);
  });

  it('reset allows an immediate new swing', () => {
    const t = new AttackTimer();
    t.start(0.4, 2, 0.5);
    t.reset();
    expect(t.canStart).toBe(true);
  });
});
