import { describe, expect, it } from 'vitest';
import { DAMAGE_RULES, DAMAGE_TYPES, DAMAGE_TYPE_INFO, RESIST_TYPES, isDamageType } from '../src/data/damageTypes';
import {
  DOT_TICK,
  DotSet,
  armorReduction,
  baselineDamage,
  convertDamage,
  defenseMultiplier,
  effectiveResist,
  increasedMultiplier,
  moreMultiplier,
  resolveHit,
} from '../src/systems/damage';
import { mulberry32 } from '../src/systems/rng';

const REF = baselineDamage(1); // 8

describe('the six damage types', () => {
  it('have fixed identifiers, labels and colours, and everything but physical has a resistance', () => {
    expect([...DAMAGE_TYPES]).toEqual(['physical', 'fire', 'cold', 'lightning', 'corruption', 'divine']);
    for (const t of DAMAGE_TYPES) {
      expect(DAMAGE_TYPE_INFO[t].label.length).toBeGreaterThan(0);
      expect(DAMAGE_TYPE_INFO[t].color).toMatch(/^#[0-9a-f]{6}$/);
      expect(isDamageType(t)).toBe(true);
    }
    expect([...RESIST_TYPES]).toEqual(DAMAGE_TYPES.filter((t) => t !== 'physical'));
    expect(isDamageType('poison')).toBe(false);
  });
});

describe('resistances', () => {
  const fire100 = (resist: number, extra: object = {}) => resolveHit({ damage: { fire: 100 } }, {}, { armor: 0, resist: { fire: resist }, ...extra }).total;

  it('follow the table of the design: -50% takes 150, 0% takes 100, 30% takes 70, 75% takes 25', () => {
    expect(fire100(-0.5)).toBe(150);
    expect(fire100(0)).toBe(100);
    expect(fire100(0.3)).toBe(70);
    expect(fire100(0.75)).toBe(25);
  });

  it('stop at the cap of 75% and the floor of -100%', () => {
    expect(fire100(1.2)).toBe(25);
    expect(fire100(-3)).toBe(200);
    expect(effectiveResist({ armor: 0, resist: { fire: 9 } }, 'fire')).toBe(DAMAGE_RULES.resistCap);
    expect(effectiveResist({ armor: 0, resist: { fire: -9 } }, 'fire')).toBe(DAMAGE_RULES.resistFloor);
  });

  it('can have a higher cap, but only when it is said so', () => {
    expect(fire100(0.9, { resistCap: { fire: 0.9 } })).toBe(10);
    expect(fire100(0.9)).toBe(25);
  });

  it('are separate for every type', () => {
    const defense = { armor: 0, resist: { fire: 0.5, cold: 0.1, lightning: -0.2, corruption: 0.75, divine: 0 } };
    const take = (type: 'fire' | 'cold' | 'lightning' | 'corruption' | 'divine') => resolveHit({ damage: { [type]: 100 } }, {}, defense).total;
    expect([take('fire'), take('cold'), take('lightning'), take('corruption'), take('divine')]).toEqual([50, 90, 120, 25, 100]);
  });

  it('a reduction placed on the target comes off before the cap, a penetration after it, and they are not the same thing', () => {
    // 50% resistance with 20 points of reduction is 30%
    expect(fire100(0.5, { resistReduction: { fire: 0.2 } })).toBe(70);
    // 10 points of penetration on top: 20%
    expect(resolveHit({ damage: { fire: 100 } }, { penetration: { fire: 0.1 } }, { armor: 0, resist: { fire: 0.5 }, resistReduction: { fire: 0.2 } }).total).toBe(80);
    // 90% is held at the 75% cap first; a reduction of 10 leaves 80, which is held at 75% again; penetration 20 then takes it to 55%
    const defense = { armor: 0, resist: { fire: 0.9 }, resistReduction: { fire: 0.1 } };
    expect(resolveHit({ damage: { fire: 100 } }, {}, defense).total).toBe(25);
    expect(resolveHit({ damage: { fire: 100 } }, { penetration: { fire: 0.2 } }, defense).total).toBe(45);
    // penetration cannot take a resistance below the floor
    expect(effectiveResist({ armor: 0, resist: { fire: -1 } }, 'fire', 0.5)).toBe(-1);
  });
});

describe('armor', () => {
  it('reduces physical damage by armor / (armor + 5 x the attacker\'s baseline damage)', () => {
    expect(REF).toBe(8);
    expect(armorReduction(0, REF)).toBe(0);
    expect(armorReduction(40, REF)).toBeCloseTo(0.5, 9); // 40 / (40 + 5 * 8)
    expect(armorReduction(120, REF)).toBeCloseTo(0.75, 9);
    expect(armorReduction(-30, REF)).toBe(0); // negative armor does not amplify
    expect(resolveHit({ damage: { physical: 100 } }, {}, { armor: 40 }).total).toBe(50);
  });

  it('is capped at 75%', () => {
    expect(armorReduction(1_000_000, REF)).toBe(0.75);
    expect(resolveHit({ damage: { physical: 100 } }, {}, { armor: 1_000_000 }).total).toBe(25);
  });

  it('is measured against the attacker\'s level: the same armor holds less against a higher-level attacker', () => {
    expect(baselineDamage(10)).toBeGreaterThan(baselineDamage(1));
    expect(baselineDamage(100)).toBeCloseTo(8 * Math.pow(1.045, 99), 6);
    expect(armorReduction(40, baselineDamage(30))).toBeLessThan(armorReduction(40, baselineDamage(1)));
    expect(resolveHit({ damage: { physical: 100 }, referenceDamage: baselineDamage(30) }, {}, { armor: 40 }).total).toBeGreaterThan(50);
  });

  it('is partly ignored by armor penetration, before the reduction is worked out', () => {
    // half of 80 armor is 40: 50% reduction
    expect(resolveHit({ damage: { physical: 100 } }, { penetration: { physical: 0.5 } }, { armor: 80 }).total).toBe(50);
    expect(armorReduction(80, REF, 1)).toBe(0);
  });

  it('does nothing to damage that is not physical, and a resistance does nothing to physical damage', () => {
    expect(resolveHit({ damage: { fire: 100 } }, {}, { armor: 1000 }).total).toBe(100);
    expect(resolveHit({ damage: { physical: 100 } }, {}, { armor: 0, resist: { fire: 0.75, cold: 0.75 } }).total).toBe(100);
  });
});

describe('the order of a direct hit', () => {
  it('multiplies base x skill x (1 + increased) x every "more" x crit, then defends', () => {
    const offense = { increased: { physical: 0.2, all: 0.3 }, more: [1.2, 1.1], critChance: 1, critMultiplier: 1.5 };
    const rng = mulberry32(1);
    const hit = resolveHit({ damage: { physical: 100 }, skillMultiplier: 2, canCrit: true }, offense, { armor: 0 }, rng);
    // 100 x 2 x 1.5 x (1.2 x 1.1 = 1.32) x 1.5
    expect(hit.crit).toBe(true);
    expect(hit.total).toBe(594);
    const defended = resolveHit({ damage: { physical: 100 }, skillMultiplier: 2, canCrit: true }, offense, { armor: 40 }, mulberry32(1));
    expect(defended.total).toBe(297); // the same, halved by 40 armor, after the crit
  });

  it('"increased" of a type and of everything are added together, then multiply once; "more" multiplies one after the other', () => {
    expect(increasedMultiplier('fire', { fire: 0.2, all: 0.3, cold: 5 })).toBeCloseTo(1.5, 9);
    expect(increasedMultiplier('cold', { fire: 0.2 })).toBe(1);
    expect(increasedMultiplier('fire', { fire: -5 })).toBe(0);
    expect(moreMultiplier([1.2, 1.1, 1.5])).toBeCloseTo(1.98, 9);
    expect(moreMultiplier()).toBe(1);
    // two 20% increased: +40%, but two 20% more: +44%
    expect(resolveHit({ damage: { physical: 100 } }, { increased: { physical: 0.4 } }).total).toBe(140);
    expect(resolveHit({ damage: { physical: 100 } }, { more: [1.2, 1.2] }).total).toBe(144);
  });

  it('an increase only helps the type it is for', () => {
    const hit = resolveHit({ damage: { physical: 100, fire: 100 } }, { increased: { fire: 1 } });
    expect(hit.byType).toEqual({ physical: 100, fire: 200 });
  });

  it('defends each type on its own and adds them up', () => {
    const hit = resolveHit({ damage: { physical: 100, fire: 100 } }, {}, { armor: 40, resist: { fire: 0.3 } });
    expect(hit.byType).toEqual({ physical: 50, fire: 70 });
    expect(hit.total).toBe(120);
    expect(hit.dominant).toBe('fire');
  });

  it('shows, subtracts and checks death with one number: the total is the sum of its parts', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const hit = resolveHit(
        { damage: { physical: 3 + rng() * 80, fire: rng() * 40, divine: rng() * 20 }, skillMultiplier: 0.5 + rng(), canCrit: true },
        { critChance: 0.3, increased: { fire: rng() } },
        { armor: rng() * 100, resist: { fire: rng() - 0.3, divine: 0.2 } },
        rng,
      );
      const sum = Object.values(hit.byType).reduce((a, b) => a + b, 0);
      expect(hit.total).toBe(sum);
      expect(Number.isInteger(hit.total)).toBe(true);
      expect(hit.total).toBeGreaterThanOrEqual(1);
    }
  });

  it('a hit with any damage does at least 1, and a hit with none does nothing', () => {
    expect(resolveHit({ damage: { physical: 1 } }, {}, { armor: 1e9 }).total).toBe(1);
    expect(resolveHit({ damage: {} }).total).toBe(0);
    expect(resolveHit({ damage: { physical: 50 }, skillMultiplier: 0 }).total).toBe(0);
  });
});

describe('critical hits', () => {
  it('only hits that may crit can, a crit multiplies by the multiplier, and the multiplier is at least 100%', () => {
    expect(resolveHit({ damage: { physical: 100 } }, { critChance: 1 }, undefined, mulberry32(1)).crit).toBe(false);
    const crit = resolveHit({ damage: { physical: 100 }, canCrit: true }, { critChance: 1 }, undefined, mulberry32(1));
    expect(crit.crit).toBe(true);
    expect(crit.total).toBe(150); // the default multiplier is 150%
    expect(resolveHit({ damage: { physical: 100 }, canCrit: true }, { critChance: 1, critMultiplier: 0.2 }, undefined, mulberry32(1)).total).toBe(100);
    expect(resolveHit({ damage: { physical: 100 }, canCrit: true }, { critChance: 1, critMultiplier: 2.5 }, undefined, mulberry32(1)).total).toBe(250);
  });

  it('the chance is held between 0% and 100%, and a crit is rolled once for the whole hit', () => {
    expect(resolveHit({ damage: { physical: 100 }, canCrit: true }, { critChance: -3 }, undefined, () => 0).crit).toBe(false);
    expect(resolveHit({ damage: { physical: 100 }, canCrit: true }, { critChance: 7 }, undefined, () => 0.999).crit).toBe(true);
    let rolls = 0;
    resolveHit({ damage: { physical: 50, fire: 50, cold: 50 }, canCrit: true }, { critChance: 0.5 }, undefined, () => {
      rolls++;
      return 0.1;
    });
    expect(rolls).toBe(1);
  });

  it('a crit multiplies before defense: armor works on the critical damage', () => {
    const hit = resolveHit({ damage: { physical: 100 }, canCrit: true }, { critChance: 1 }, { armor: 40 }, mulberry32(1));
    expect(hit.total).toBe(75); // 150 halved
  });
});

describe('damage conversion', () => {
  it('splits damage by the ratio, and each part is defended as its new type', () => {
    expect(convertDamage({ physical: 100 }, [{ from: 'physical', to: 'fire', ratio: 0.5 }])).toEqual({ physical: 50, fire: 50 });
    const hit = resolveHit({ damage: { physical: 100 } }, { conversions: [{ from: 'physical', to: 'fire', ratio: 0.5 }] }, { armor: 40, resist: { fire: 0.5 } });
    expect(hit.byType).toEqual({ physical: 25, fire: 25 });
  });

  it('what was converted is increased as its new type', () => {
    const hit = resolveHit({ damage: { physical: 100 } }, { conversions: [{ from: 'physical', to: 'fire', ratio: 0.5 }], increased: { fire: 1, physical: 0.2 } });
    expect(hit.byType).toEqual({ physical: 60, fire: 100 });
  });

  it('never converts the same damage twice', () => {
    const out = convertDamage({ physical: 100 }, [
      { from: 'physical', to: 'fire', ratio: 1 },
      { from: 'fire', to: 'cold', ratio: 1 },
    ]);
    expect(out).toEqual({ fire: 100, physical: 0 });
    // but fire that was there to begin with does convert
    expect(convertDamage({ physical: 100, fire: 40 }, [{ from: 'fire', to: 'cold', ratio: 1 }])).toEqual({ physical: 100, fire: 0, cold: 40 });
  });

  it('never converts more than 100% of a type: the ratios are scaled down together', () => {
    const out = convertDamage({ physical: 100 }, [
      { from: 'physical', to: 'fire', ratio: 0.8 },
      { from: 'physical', to: 'cold', ratio: 0.8 },
    ]);
    expect(out.fire).toBeCloseTo(50, 9);
    expect(out.cold).toBeCloseTo(50, 9);
    expect(out.physical ?? 0).toBeCloseTo(0, 9);
    const sum = Object.values(out).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('keeps the total damage the same, and ignores nonsense (no ratio, converting to itself)', () => {
    const out = convertDamage({ physical: 60, divine: 40 }, [
      { from: 'physical', to: 'corruption', ratio: 0.25 },
      { from: 'divine', to: 'divine', ratio: 1 },
      { from: 'divine', to: 'fire', ratio: 0 },
    ]);
    expect(out).toEqual({ physical: 45, corruption: 15, divine: 40 });
  });
});

describe('damage over time', () => {
  const total = (set: DotSet, seconds: number, defense = { armor: 0 } as Parameters<DotSet['tick']>[1]) => {
    let sum = 0;
    for (let t = 0; t < seconds; t += 0.1) sum += set.tick(0.1, defense)?.amount ?? 0;
    return sum;
  };

  it('deals dps x duration in ticks, then ends', () => {
    const dot = new DotSet();
    dot.apply({ id: 'burn', type: 'fire', dps: 10, duration: 3 });
    expect(dot.active).toBe(true);
    expect(total(dot, 4)).toBe(30);
    expect(dot.active).toBe(false);
    expect(dot.tick(1)).toBeNull();
  });

  it('applying the same effect again refreshes it instead of stacking: the stronger rate and the longer time win', () => {
    const dot = new DotSet();
    dot.apply({ id: 'burn', type: 'fire', dps: 10, duration: 2 });
    dot.apply({ id: 'burn', type: 'fire', dps: 6, duration: 3 });
    expect(dot.count('burn')).toBe(1);
    expect(total(dot, 5)).toBe(30); // 10 per second for 3 seconds, not 16 and not for 2 + 3
    dot.apply({ id: 'burn', type: 'fire', dps: 20, duration: 1 });
    dot.apply({ id: 'burn', type: 'fire', dps: 4, duration: 2 });
    expect(total(dot, 4)).toBe(40); // 20 for 2 seconds
  });

  it('different effects run side by side', () => {
    const dot = new DotSet();
    dot.apply({ id: 'burn', type: 'fire', dps: 10, duration: 2 });
    dot.apply({ id: 'bleed', type: 'physical', dps: 4, duration: 2 });
    expect(total(dot, 3)).toBe(28);
  });

  it('stacks only when told to, up to a maximum, each with its own rate', () => {
    const dot = new DotSet();
    for (let i = 0; i < 5; i++) dot.apply({ id: 'rot', type: 'corruption', dps: 2, duration: 2, maxStacks: 3 });
    expect(dot.count('rot')).toBe(3);
    expect(total(dot, 3)).toBe(12); // three stacks of 2 per second for 2 seconds
  });

  it('is reduced by the resistance of its own type, and bleeding ignores armor unless it says otherwise', () => {
    const resisted = new DotSet();
    resisted.apply({ id: 'burn', type: 'fire', dps: 10, duration: 2 });
    expect(total(resisted, 3, { armor: 500, resist: { fire: 0.5 } })).toBe(10);
    const bleed = new DotSet();
    bleed.apply({ id: 'bleed', type: 'physical', dps: 10, duration: 2 });
    expect(total(bleed, 3, { armor: 500 })).toBe(20);
    const armored = new DotSet();
    armored.apply({ id: 'bleed', type: 'physical', dps: 10, duration: 2, armorApplies: true });
    expect(total(armored, 3, { armor: 40 })).toBe(10); // 50% at the baseline damage of 8
  });

  it('never crits and reports the type it dealt', () => {
    const dot = new DotSet();
    dot.apply({ id: 'rot', type: 'corruption', dps: 8, duration: 1 });
    let tick = null;
    for (let i = 0; i < 20 && !tick; i++) tick = dot.tick(0.1);
    expect(tick).toEqual({ amount: 4, byType: { corruption: 4 } });
    expect(DOT_TICK).toBe(0.5);
  });

  it('ignores effects that do nothing', () => {
    const dot = new DotSet();
    dot.apply({ id: 'x', type: 'fire', dps: 0, duration: 5 });
    dot.apply({ id: 'y', type: 'fire', dps: 5, duration: 0 });
    expect(dot.active).toBe(false);
    dot.apply({ id: 'z', type: 'fire', dps: 5, duration: 5 });
    dot.clear();
    expect(dot.active).toBe(false);
  });
});

describe('defense multiplier helper', () => {
  it('is what is left of a hit of that type', () => {
    expect(defenseMultiplier('physical', { armor: 40 })).toBeCloseTo(0.5, 9);
    expect(defenseMultiplier('cold', { armor: 40, resist: { cold: 0.4 } })).toBeCloseTo(0.6, 9);
    expect(defenseMultiplier('divine', { armor: 0 })).toBe(1);
  });
});
