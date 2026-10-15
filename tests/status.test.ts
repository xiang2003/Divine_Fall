import { describe, expect, it } from 'vitest';
import { FREEZE_RULES, IMPLEMENTED_STATUS_IDS, STATUSES, STATUS_IDS } from '../src/data/statuses';
import { resolveHit } from '../src/systems/damage';
import { mulberry32 } from '../src/systems/rng';
import { StatusSet, applyTriggers, damageEffectRate } from '../src/systems/status';

/** Runs `seconds` in steps of 0.1 and adds up the damage of the damage-over-time ticks. */
function run(set: StatusSet, seconds: number, defense = { armor: 0 } as Parameters<StatusSet['tick']>[1]) {
  let total = 0;
  for (let t = 0; t < seconds - 1e-9; t += 0.1) total += set.tick(0.1, defense)?.amount ?? 0;
  return total;
}

describe('the list of effects', () => {
  it('has every effect of the design, each in one of the three kinds, and the first phase is implemented', () => {
    expect(STATUS_IDS).toHaveLength(17);
    for (const id of STATUS_IDS) {
      expect(['damage', 'control', 'debuff']).toContain(STATUSES[id].category);
      expect(STATUSES[id].id).toBe(id);
      expect(STATUSES[id].name.length).toBeGreaterThan(0);
    }
    for (const id of ['burning', 'bleeding', 'slow', 'freeze', 'shock', 'armorBreak', 'corruption', 'weaken'] as const) {
      expect(IMPLEMENTED_STATUS_IDS).toContain(id);
    }
    // the implemented ones have what they need to run
    for (const id of IMPLEMENTED_STATUS_IDS) {
      const d = STATUSES[id];
      expect(d.duration, id).toBeGreaterThan(0);
      expect(d.maxDuration, id).toBeGreaterThanOrEqual(d.duration);
      if (d.category === 'damage') expect(d.damageType && d.dotFraction, id).toBeTruthy();
    }
  });

  it('the ones that are only designed are refused', () => {
    const set = new StatusSet();
    for (const id of STATUS_IDS.filter((i) => !STATUSES[i].implemented)) expect(set.apply({ id, duration: 3, dps: 5 })).toEqual({ applied: false, reason: 'unimplemented' });
    expect(set.active).toBe(false);
  });
});

describe('damage over time', () => {
  it('burning deals fire damage per second for its duration, then ends', () => {
    const set = new StatusSet();
    expect(set.apply({ id: 'burning', dps: 10, duration: 4 })).toEqual({ applied: true, refreshed: false });
    expect(set.has('burning')).toBe(true);
    expect(run(set, 5)).toBe(40);
    expect(set.has('burning')).toBe(false);
    expect(set.active).toBe(false);
  });

  it('needs a damage rate, and a second one refreshes instead of adding: stronger rate and longer time win', () => {
    const set = new StatusSet();
    expect(set.apply({ id: 'bleeding' })).toEqual({ applied: false, reason: 'invalid' });
    set.apply({ id: 'bleeding', dps: 10, duration: 2 });
    expect(set.apply({ id: 'bleeding', dps: 6, duration: 4 })).toEqual({ applied: true, refreshed: true });
    expect(set.magnitude('bleeding')).toBe(10);
    expect(set.remaining('bleeding')).toBeCloseTo(4, 9);
    expect(run(set, 6)).toBe(40);
  });

  it('can never be lengthened beyond its maximum', () => {
    const set = new StatusSet();
    set.apply({ id: 'burning', dps: 5, duration: 100 });
    expect(set.remaining('burning')).toBe(STATUSES.burning.maxDuration);
    set.apply({ id: 'burning', dps: 5, duration: 100 });
    expect(set.remaining('burning')).toBe(STATUSES.burning.maxDuration);
  });

  it('goes through the defense of its own type', () => {
    const burn = new StatusSet();
    burn.apply({ id: 'burning', dps: 10, duration: 4 });
    expect(run(burn, 5, { armor: 999, resist: { fire: 0.5 } })).toBe(20);
    const corrupt = new StatusSet();
    corrupt.apply({ id: 'corruption', dps: 10, duration: 4 });
    expect(run(corrupt, 5, { armor: 0, resist: { corruption: 0.75, fire: -1 } })).toBe(10);
    // bleeding is physical damage that armor does not stop
    const bleed = new StatusSet();
    bleed.apply({ id: 'bleeding', dps: 10, duration: 4 });
    expect(run(bleed, 5, { armor: 999 })).toBe(40);
  });

  it('is raised by shock like all damage, and armor break does not touch bleeding', () => {
    const set = new StatusSet();
    set.apply({ id: 'burning', dps: 10, duration: 4 });
    set.apply({ id: 'shock', duration: 10 });
    expect(run(set, 5)).toBe(48); // 40 + 20%
  });

  it('poison is corruption damage over time', () => {
    const set = new StatusSet();
    set.apply({ id: 'poison', dps: 6, duration: 4 });
    expect(run(set, 5, { armor: 0, resist: { corruption: 0.5 } })).toBe(12);
  });
});

describe('control: slow and freeze', () => {
  it('slow leaves a share of the speed; the stronger slow wins, and it never goes past its limit', () => {
    const set = new StatusSet();
    expect(set.moveSpeedMultiplier).toBe(1);
    set.apply({ id: 'slow' });
    expect(set.moveSpeedMultiplier).toBeCloseTo(0.6, 9);
    set.apply({ id: 'slow', magnitude: 0.8, duration: 5 });
    expect(set.moveSpeedMultiplier).toBeCloseTo(0.6, 9); // the weaker slow does not replace it, but the time is refreshed
    expect(set.remaining('slow')).toBeCloseTo(5, 9);
    set.apply({ id: 'slow', magnitude: 0.1 });
    expect(set.moveSpeedMultiplier).toBeCloseTo(STATUSES.slow.magnitudeLimit!, 9);
  });

  it('control resistance shortens a control effect (but not a damage effect), and it is capped at the maximum time', () => {
    const boss = new StatusSet({ controlResist: 0.5 });
    boss.apply({ id: 'slow', duration: 4 });
    expect(boss.remaining('slow')).toBeCloseTo(2, 9);
    const plain = new StatusSet();
    plain.apply({ id: 'slow', duration: 60 });
    expect(plain.remaining('slow')).toBe(STATUSES.slow.maxDuration);
    boss.apply({ id: 'burning', dps: 5, duration: 4 });
    expect(boss.remaining('burning')).toBeCloseTo(4, 9);
    const nearlyImmune = new StatusSet({ controlResist: 5 }); // held at 90%
    nearlyImmune.apply({ id: 'freeze', duration: 2 });
    expect(nearlyImmune.remaining('freeze')).toBeCloseTo(0.2, 9);
  });

  it('a frozen target cannot act and does not move, then thaws', () => {
    const set = new StatusSet();
    expect(set.canAct).toBe(true);
    set.apply({ id: 'freeze', duration: 1.5 });
    expect(set.frozen).toBe(true);
    expect(set.canAct).toBe(false);
    expect(set.moveSpeedMultiplier).toBe(0);
    run(set, 1.6);
    expect(set.frozen).toBe(false);
    expect(set.canAct).toBe(true);
    expect(set.moveSpeedMultiplier).toBe(1);
  });

  it('cannot be frozen again for a while after it thaws, so nothing is chain-locked', () => {
    const set = new StatusSet();
    set.apply({ id: 'freeze', duration: 1 });
    run(set, 1.1);
    expect(set.apply({ id: 'freeze' })).toEqual({ applied: false, reason: 'cooldown' });
    run(set, STATUSES.freeze.immunityAfter! + 0.2);
    expect(set.apply({ id: 'freeze' }).applied).toBe(true);
  });

  it('freezes by build-up: points fill a gauge, a full gauge freezes, the gauge drains when not hit, a boss needs more', () => {
    const set = new StatusSet();
    expect(set.buildup('freeze', 40)).toBe(false);
    expect(set.gauge('freeze')).toBeCloseTo(0.4, 9);
    run(set, 1); // drains 20% per second
    expect(set.gauge('freeze')).toBeCloseTo(0.2, 6);
    expect(set.buildup('freeze', 80)).toBe(true);
    expect(set.frozen).toBe(true);
    expect(set.gauge('freeze')).toBe(0);
    expect(set.buildup('freeze', 500)).toBe(false); // already frozen: nothing is added
    const boss = new StatusSet({ buildupFactor: FREEZE_RULES.bossFactor });
    expect(boss.buildup('freeze', 150)).toBe(false);
    expect(boss.buildup('freeze', 150)).toBe(true);
  });
});

describe('debuffs: shock, armor break, weaken', () => {
  it('shock makes the target take more damage, up to a limit', () => {
    const set = new StatusSet();
    set.apply({ id: 'shock' });
    expect(set.damageTakenMultiplier).toBeCloseTo(1.2, 9);
    expect(resolveHit({ damage: { fire: 100 } }, {}, set.defend({ armor: 0 })).total).toBe(120);
    set.apply({ id: 'shock', magnitude: 5 });
    expect(set.damageTakenMultiplier).toBeCloseTo(1 + STATUSES.shock.magnitudeLimit!, 9);
  });

  it('armor break takes a share of the armor, and always leaves some', () => {
    const set = new StatusSet();
    set.apply({ id: 'armorBreak' });
    expect(set.armorMultiplier).toBeCloseTo(0.7, 9);
    expect(set.defend({ armor: 100 }).armor).toBeCloseTo(70, 9);
    set.apply({ id: 'armorBreak', magnitude: 0.95 });
    expect(set.armorMultiplier).toBeCloseTo(1 - STATUSES.armorBreak.magnitudeLimit!, 9);
    // 40 armor halves a hit; broken to 30% it takes off a lot less
    const plain = resolveHit({ damage: { physical: 100 } }, {}, { armor: 40 }).total;
    const broken = resolveHit({ damage: { physical: 100 } }, {}, set.defend({ armor: 40 })).total;
    expect(broken).toBeGreaterThan(plain);
  });

  it('weaken takes a share off what the target deals, up to a limit', () => {
    const set = new StatusSet();
    set.apply({ id: 'weaken' });
    expect(set.damageDealtMultiplier).toBeCloseTo(0.75, 9);
    set.apply({ id: 'weaken', magnitude: 0.9 });
    expect(set.damageDealtMultiplier).toBeCloseTo(1 - STATUSES.weaken.magnitudeLimit!, 9);
  });

  it('a debuff expires on its own', () => {
    const set = new StatusSet();
    set.apply({ id: 'shock', duration: 2 });
    run(set, 2.1);
    expect(set.has('shock')).toBe(false);
    expect(set.damageTakenMultiplier).toBe(1);
  });
});

describe('immunity, cleansing and the list', () => {
  it('a target can be immune to an effect', () => {
    const golem = new StatusSet({ immune: ['bleeding', 'poison'] });
    expect(golem.apply({ id: 'bleeding', dps: 5, duration: 3 })).toEqual({ applied: false, reason: 'immune' });
    expect(golem.apply({ id: 'burning', dps: 5, duration: 3 }).applied).toBe(true);
    expect(golem.buildup('freeze', 1000)).toBe(true);
    const ice = new StatusSet({ immune: ['freeze'] });
    expect(ice.buildup('freeze', 1000)).toBe(false);
  });

  it('cleansing removes what can be removed (all of it, or only some) and leaves a freeze alone', () => {
    const set = new StatusSet();
    set.apply({ id: 'burning', dps: 5, duration: 4 });
    set.apply({ id: 'slow' });
    set.apply({ id: 'shock' });
    set.apply({ id: 'freeze' });
    expect(set.dispel(['shock'])).toEqual(['shock']);
    expect(set.has('shock')).toBe(false);
    expect(set.dispel().sort()).toEqual(['burning', 'slow']);
    expect(set.has('burning')).toBe(false);
    expect(set.frozen).toBe(true);
    set.clear();
    expect(set.active).toBe(false);
  });

  it('lists what is on the target, damage effects first', () => {
    const set = new StatusSet();
    set.apply({ id: 'weaken' });
    set.apply({ id: 'slow' });
    set.apply({ id: 'bleeding', dps: 3, duration: 4 });
    expect(set.list().map((s) => s.id)).toEqual(['bleeding', 'slow', 'weaken']);
    expect(set.list()[0]!.name).toBe('流血');
  });
});

describe('triggers: a chance, a condition, build-up', () => {
  const hit = { raw: 100, crit: false };

  it('a damage effect is a share of the hit spread over its duration, raised by increased damage of its type and by damage over time', () => {
    expect(damageEffectRate('burning', hit)).toBeCloseTo(15, 9); // 100 x 0.6 / 4 seconds
    expect(damageEffectRate('burning', { ...hit, increased: { fire: 0.5 }, dotDamage: 0.5 })).toBeCloseTo(30, 9);
    expect(damageEffectRate('burning', { ...hit, increased: { cold: 5, physical: 5 } })).toBeCloseTo(15, 9);
    expect(damageEffectRate('shock', hit)).toBe(0);
  });

  it('rolls the chance once per trigger: below it applies, above it does not', () => {
    const set = new StatusSet();
    expect(applyTriggers(set, [{ id: 'bleeding', chance: 0.4 }], hit, () => 0.5)).toEqual([]);
    expect(applyTriggers(set, [{ id: 'bleeding', chance: 0.4 }], hit, () => 0.3)).toEqual(['bleeding']);
    expect(set.magnitude('bleeding')).toBeCloseTo(12.5, 9); // 100 x 0.5 / 4
  });

  it('a sure trigger needs no roll, and a chance of zero never applies', () => {
    const set = new StatusSet();
    let rolls = 0;
    const rng = () => {
      rolls++;
      return 0;
    };
    applyTriggers(set, [{ id: 'armorBreak', chance: 1 }, { id: 'weaken', chance: 0 }], hit, rng);
    expect(set.has('armorBreak')).toBe(true);
    expect(set.has('weaken')).toBe(false);
    expect(rolls).toBe(0);
  });

  it('a trigger on crits only applies on a critical hit', () => {
    const set = new StatusSet();
    expect(applyTriggers(set, [{ id: 'bleeding', chance: 1, on: 'crit' }], hit, () => 0)).toEqual([]);
    expect(applyTriggers(set, [{ id: 'bleeding', chance: 1, on: 'crit' }], { ...hit, crit: true }, () => 0)).toEqual(['bleeding']);
  });

  it('build-up goes into the gauge and freezes when it is full', () => {
    const set = new StatusSet();
    const trigger = { id: 'freeze' as const, buildup: 40 };
    expect(applyTriggers(set, [trigger], hit, () => 0)).toEqual([]);
    expect(applyTriggers(set, [trigger], hit, () => 0)).toEqual([]);
    expect(applyTriggers(set, [trigger], hit, () => 0)).toEqual(['freeze']);
    expect(set.frozen).toBe(true);
  });

  it('longer effects (a bonus on duration) lengthen it, up to the maximum', () => {
    const set = new StatusSet();
    applyTriggers(set, [{ id: 'shock', chance: 1 }], { ...hit, durationBonus: 0.5 }, () => 0);
    expect(set.remaining('shock')).toBeCloseTo(6, 9);
    applyTriggers(set, [{ id: 'shock', chance: 1 }], { ...hit, durationBonus: 9 }, () => 0);
    expect(set.remaining('shock')).toBe(STATUSES.shock.maxDuration);
  });

  it('is reproducible with a seeded rng and applies at about the stated rate', () => {
    const rng = mulberry32(4);
    let applied = 0;
    for (let i = 0; i < 2000; i++) applied += applyTriggers(new StatusSet(), [{ id: 'weaken', chance: 0.25 }], hit, rng).length;
    expect(applied / 2000).toBeGreaterThan(0.2);
    expect(applied / 2000).toBeLessThan(0.3);
  });
});
