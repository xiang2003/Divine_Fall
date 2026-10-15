import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import type { DamageType } from '../src/data/damageTypes';
import { MONSTERS, type MonsterDef } from '../src/data/monsters';
import { STATUSES } from '../src/data/statuses';
import { Monster, type MonsterHooks } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { Buffs } from '../src/systems/buffs';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { resolveHit } from '../src/systems/damage';
import { helpersAllowed } from '../src/systems/summons';
import { computeStats, emptyEquipment } from '../src/systems/stats';
import { StatusSet } from '../src/systems/status';
import { parseMap } from '../src/data/mapData';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';

const HALL = parseMap({ id: 'h', name: 'h', layout: ['############', '#P.........#', '#..........#', '#..........#', '############'] });

describe('the mark', () => {
  it('makes the target take 15% more, up to 30%, and multiplies with shock', () => {
    const set = new StatusSet();
    expect(STATUSES.mark.implemented).toBe(true);
    set.apply({ id: 'mark' });
    expect(set.damageTakenMultiplier).toBeCloseTo(1.15, 9);
    expect(resolveHit({ damage: { physical: 100 } }, {}, set.defend({ armor: 0 })).total).toBe(115);
    set.apply({ id: 'shock' });
    expect(set.damageTakenMultiplier).toBeCloseTo(1.15 * 1.2, 9);
    set.apply({ id: 'mark', magnitude: 5 });
    expect(set.damageTakenMultiplier).toBeCloseTo(1.3 * 1.2, 9);
  });

  it('wears off, and is not on a target that cannot be marked', () => {
    const set = new StatusSet();
    set.apply({ id: 'mark', duration: 2 });
    set.tick(2.1);
    expect(set.has('mark')).toBe(false);
    expect(new StatusSet({ immune: ['mark'] }).apply({ id: 'mark' })).toEqual({ applied: false, reason: 'immune' });
  });
});

/** A stand-in for the Player with a real status set, to see what monsters put on it. */
function rig() {
  const stats = computeStats(emptyEquipment());
  const status = new StatusSet();
  const player = {
    pos: { x: 2.5, y: 2.5 },
    radius: PLAYER_CONFIG.radius,
    stats,
    hp: 1000,
    isDead: false,
    buffs: new Buffs(),
    status,
    applyPoison() {},
    applySlow() {},
    tickStatus: () => null,
    hasEffect: () => false,
    heal: () => 0,
    takeDamage(raw: number, type: DamageType = 'physical') {
      const amount = resolveHit({ damage: { [type]: raw } }, {}, status.defend({ armor: 0 })).total;
      player.hp -= amount;
      return { amount, died: false };
    },
  };
  const monsters: Monster[] = [];
  const shown: string[][] = [];
  const dealt: number[] = [];
  const events: CombatEvents = {
    damageDealt: (_x, _y, amount) => dealt.push(amount),
    damageTaken: () => {},
    monsterKilled: () => {},
    playerDied: () => {},
    healed: () => {},
    lightningArc: () => {},
    skillFx: () => {},
    telegraph: () => {},
    novaFlash: () => {},
    phaseChanged: () => {},
    spawnMinions: () => {},
    pillars: () => {},
    statusApplied: (_x, _y, ids) => shown.push([...ids]),
  };
  const combat = new CombatSystem(
    player as unknown as Player,
    () => monsters,
    { fire: () => true, update: () => {} } as unknown as ProjectileSystem,
    { fire: () => true, update: () => {} } as unknown as SkillProjectileSystem,
    new CollisionSystem(HALL),
    () => 0.99,
    events,
  );
  return { player, monsters, combat, shown, dealt, status };
}

describe('what monsters put on the player', () => {
  const marker: MonsterDef = { ...MONSTERS.ghoul, applies: [{ id: 'mark', chance: 1 }] };

  it('a blow that carries an effect puts it on the player, tells the player so, and the next blows hurt more', () => {
    const { player, combat, shown, status } = rig();
    const m = new Monster(marker, { x: 2.9, y: 2.5 });
    combat.meleeStrike(m);
    expect(status.has('mark')).toBe(true);
    expect(shown).toEqual([['mark']]);
    const first = marker.damage;
    const before = player.hp;
    combat.meleeStrike(m);
    expect(before - player.hp).toBe(Math.round(first * 1.15));
  });

  it('a blow that misses puts nothing on the player, and a chance below 1 is rolled', () => {
    const { player, combat, status } = rig();
    const far = new Monster(marker, { x: 8, y: 2.5 });
    combat.meleeStrike(far);
    expect(status.has('mark')).toBe(false);
    const rare = new Monster({ ...MONSTERS.ghoul, applies: [{ id: 'mark', chance: 0.5 }] }, { x: 2.9, y: 2.5 });
    combat.meleeStrike(rare); // the roll of this rig is 0.99: above the chance
    expect(status.has('mark')).toBe(false);
    expect(player.hp).toBeLessThan(1000);
  });

  it('a weakened player deals less', () => {
    const { monsters, combat, dealt, status } = rig();
    const m = new Monster({ ...MONSTERS.ghoul, maxHp: 1000 }, { x: 3.4, y: 2.5 });
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    status.apply({ id: 'weaken' });
    combat.playerSwingHit(1, 0);
    expect(dealt[1]).toBe(Math.round(dealt[0]! * 0.75));
  });
});

/** Hooks that record what a monster does. */
function recorder() {
  const log = { novas: [] as number[], telegraphs: [] as number[], splits: [] as [string, number][], melee: 0 };
  const hooks: MonsterHooks = {
    meleeStrike: () => void log.melee++,
    fireProjectile: () => {},
    novaStrike: (_m, radius) => void log.novas.push(radius),
    telegraph: (_m, radius) => void log.telegraphs.push(radius),
    phaseChanged: () => {},
    split: (_m, into, count) => void log.splits.push([into, count]),
    summonPillars: () => {},
  };
  return { hooks, log };
}
const target = { pos: { x: 2.5, y: 2.5 }, radius: 0.28, isDead: false };

describe('the guard stance', () => {
  const guardian: MonsterDef = {
    ...MONSTERS.ghoul,
    maxHp: 1000,
    isBoss: true,
    bossAttacks: [{ id: 'guard', kind: 'guard', minPhase: 0, weight: 1, duration: 2, damageMult: 1.5, radius: 3, hitFraction: 0.9, reduction: 0.8 }],
  };

  function intoGuard() {
    const m = new Monster(guardian, { x: 4.5, y: 2.5 });
    const { hooks, log } = recorder();
    const collision = new CollisionSystem(HALL);
    m.engage();
    for (let i = 0; i < 120 && !m.guarding; i++) m.update(1 / 60, target, collision, hooks);
    return { m, hooks, log, collision };
  }

  const run = (m: Monster, seconds: number, hooks: MonsterHooks, collision: CollisionSystem) => {
    for (let t = 0; t < seconds; t += 1 / 60) m.update(1 / 60, target, collision, hooks);
  };

  it('takes a fraction of the damage while it holds the stance, and the number reported is what it took', () => {
    const { m } = intoGuard();
    expect(m.guarding).toBe(true);
    const hp = m.hp;
    m.takeDamage(100);
    expect(hp - m.hp).toBe(20);
    expect(m.lastDamageTaken).toBe(20);
    expect(m.guarding).toBe(true); // a guard is not staggered
  });

  it('answers a hit with a counter blow when the stance ends: a warning when it was hit, the blow after', () => {
    const { m, hooks, log, collision } = intoGuard();
    m.takeDamage(50);
    run(m, 0.2, hooks, collision);
    expect(log.telegraphs).toEqual([3]);
    expect(log.novas).toEqual([]); // not yet: the counter comes at nine tenths of the stance
    run(m, 1.7, hooks, collision);
    expect(log.novas).toEqual([3]);
  });

  it('does nothing when nobody hit it, and takes full damage outside the stance', () => {
    const { m, hooks, log, collision } = intoGuard();
    run(m, 2, hooks, collision);
    expect(log.novas).toEqual([]);
    expect(log.telegraphs).toEqual([]);
    const free = new Monster(guardian, { x: 4.5, y: 2.5 });
    const hp = free.hp;
    free.takeDamage(100);
    expect(hp - free.hp).toBe(100);
  });
});

describe('calling for help', () => {
  const caller: MonsterDef = { ...MONSTERS.ghoul, maxHp: 1000, summons: { into: 'war_soul', count: 2, every: 8, max: 4 } };

  it('calls its helpers every so often while it sees the player, the first time after half the interval', () => {
    const m = new Monster(caller, { x: 6.5, y: 2.5 });
    const { hooks, log } = recorder();
    const collision = new CollisionSystem(HALL);
    m.engage();
    for (let t = 0; t < 3.5; t += 1 / 60) m.update(1 / 60, target, collision, hooks);
    expect(log.splits).toEqual([]);
    for (let t = 0; t < 1; t += 1 / 60) m.update(1 / 60, target, collision, hooks);
    expect(log.splits).toEqual([['war_soul', 2]]);
    for (let t = 0; t < 8; t += 1 / 60) m.update(1 / 60, target, collision, hooks);
    expect(log.splits).toHaveLength(1); // not again before another interval has passed
    for (let t = 0; t < 2; t += 1 / 60) m.update(1 / 60, target, collision, hooks);
    expect(log.splits).toHaveLength(2);
  });

  it('never has more helpers than its limit, and the limit does not touch other kinds of helper', () => {
    const summons = caller.summons!;
    expect(helpersAllowed(summons, 'war_soul', 2, 0)).toBe(2);
    expect(helpersAllowed(summons, 'war_soul', 2, 3)).toBe(1);
    expect(helpersAllowed(summons, 'war_soul', 2, 4)).toBe(0);
    expect(helpersAllowed(summons, 'war_soul', 2, 9)).toBe(0);
    expect(helpersAllowed(summons, 'something_else', 3, 99)).toBe(3);
    expect(helpersAllowed(undefined, 'war_soul', 3, 99)).toBe(3);
  });
});
