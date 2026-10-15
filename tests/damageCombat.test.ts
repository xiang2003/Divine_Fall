import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import type { DamageType } from '../src/data/damageTypes';
import { MONSTERS, type MonsterDef } from '../src/data/monsters';
import { SKILLS } from '../src/data/skills';
import { Monster } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { resolveHit } from '../src/systems/damage';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';
import { parseMap } from '../src/data/mapData';
import { Buffs, PoisonEffect } from '../src/systems/buffs';
import { computeStats, emptyEquipment } from '../src/systems/stats';
import type { ItemInstance } from '../src/data/items';

const MAP = parseMap({ id: 'c', name: 'c', layout: ['##########', '#P.......#', '#........#', '#........#', '##########'] });

/** A stand-in for the Player that defends with the real rules (armor and resistances of its stats). */
function setup(statsOver: Partial<ReturnType<typeof computeStats>> = {}) {
  const stats = { ...computeStats(emptyEquipment()), ...statsOver };
  const player = {
    pos: { x: 2.5, y: 2.5 },
    radius: PLAYER_CONFIG.radius,
    stats,
    hp: stats.maxHp,
    isDead: false,
    buffs: new Buffs(),
    poison: new PoisonEffect(),
    applyPoison() {},
    tickPoison: () => null,
    hasEffect: () => false,
    heal: () => 0,
    takeDamage(raw: number, type: DamageType = 'physical') {
      const amount = resolveHit({ damage: { [type]: raw } }, {}, { armor: stats.armor, resist: stats.resist }).total;
      player.hp = Math.max(0, player.hp - amount);
      return { amount, died: player.hp === 0 };
    },
  };
  const monsters: Monster[] = [];
  const dealt: { amount: number; type?: DamageType; crit: boolean }[] = [];
  const taken: { amount: number; type?: DamageType }[] = [];
  const handlers: CombatEvents = {
    damageDealt: (_x, _y, amount, crit, type) => dealt.push({ amount, crit, type }),
    damageTaken: (_x, _y, amount, type) => taken.push({ amount, type }),
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
  };
  const combat = new CombatSystem(
    player as unknown as Player,
    () => monsters,
    { fire: () => true, update: () => {} } as unknown as ProjectileSystem,
    { fire: () => true, update: () => {} } as unknown as SkillProjectileSystem,
    new CollisionSystem(MAP),
    () => 0.99, // never crits
    handlers,
  );
  return { player, monsters, combat, dealt, taken };
}

const monster = (over: Partial<MonsterDef>, x = 3.4) => new Monster({ ...MONSTERS.ghoul, maxHp: 1000, ...over }, { x, y: 2.5 });

describe('what the player deals goes through the defense of the monster', () => {
  it('a monster armor reduces the swing, like the armor of the player does', () => {
    const { monsters, combat, dealt } = setup();
    monsters.push(monster({ armor: 40 }));
    combat.playerSwingHit(1, 0);
    expect(dealt[0]).toMatchObject({ amount: Math.round(PLAYER_CONFIG.baseStats.damage / 2), type: 'physical' });
  });

  it('the bolt deals divine damage: a divine resistance reduces it, armor does not, and the number says divine', () => {
    const bolt = SKILLS.find((s) => s.id === 'bolt')!;
    expect(bolt.damageType).toBe('divine');
    const { monsters, combat, dealt } = setup();
    const armored = monster({ armor: 1000 });
    const resistant = monster({ resist: { divine: 0.5 } }, 4);
    monsters.push(armored, resistant);
    combat.boltHit(armored, bolt.damageMult, 'divine');
    combat.boltHit(resistant, bolt.damageMult, 'divine');
    const full = Math.round(PLAYER_CONFIG.baseStats.damage * bolt.damageMult);
    expect(dealt[0]).toMatchObject({ amount: full, type: 'divine' });
    expect(dealt[1]).toMatchObject({ amount: Math.round(full / 2), type: 'divine' });
  });

  it('increased damage of a type helps that type only', () => {
    const { monsters, combat, dealt } = setup({ increased: { physical: 0, fire: 0, cold: 0, lightning: 0, corruption: 0, divine: 1 } });
    const m = monster({});
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    combat.boltHit(m, 1, 'divine');
    expect(dealt[0]!.amount).toBe(PLAYER_CONFIG.baseStats.damage); // physical: no change
    expect(dealt[1]!.amount).toBe(PLAYER_CONFIG.baseStats.damage * 2); // +100% divine
  });

  it('a negative resistance makes the monster take extra', () => {
    const { monsters, combat, dealt } = setup();
    const m = monster({ resist: { divine: -0.5 } });
    monsters.push(m);
    combat.boltHit(m, 1, 'divine');
    expect(dealt[0]!.amount).toBe(Math.round(PLAYER_CONFIG.baseStats.damage * 1.5));
  });
});

describe('what monsters deal goes through the defense of the player', () => {
  const resist = { fire: 0, cold: 0.5, lightning: 0, corruption: 0, divine: 0 };

  it('a hit of a kind is reduced by that resistance and only that one, and the number says its kind', () => {
    const { monsters, combat, taken, player } = setup({ resist, armor: 0 });
    const cold = monster({ damage: 40, damageType: 'cold' });
    const physical = monster({ damage: 40 });
    monsters.push(cold, physical);
    combat.meleeStrike(cold);
    combat.meleeStrike(physical);
    expect(taken).toEqual([
      { amount: 20, type: 'cold' },
      { amount: 40, type: 'physical' },
    ]);
    expect(player.hp).toBe(player.stats.maxHp - 60);
  });

  it('armor does not help against a kind with a resistance of its own', () => {
    const { monsters, combat, taken } = setup({ resist, armor: 1000 });
    const corruption = monster({ damage: 40, damageType: 'corruption' });
    monsters.push(corruption);
    combat.meleeStrike(corruption);
    expect(taken[0]).toEqual({ amount: 40, type: 'corruption' });
  });

  it('what shows, what is subtracted and what decides death are the same number', () => {
    const { monsters, combat, taken, player } = setup({ resist, armor: 0 });
    const m = monster({ damage: 33, damageType: 'cold' });
    monsters.push(m);
    const before = player.hp;
    combat.meleeStrike(m);
    expect(before - player.hp).toBe(taken[0]!.amount);
  });

  it('slams carry the type of the monster that made them', () => {
    const { monsters, combat, taken } = setup({ resist, armor: 0 });
    const m = monster({ damage: 40, damageType: 'cold' });
    monsters.push(m);
    combat.novaStrike(m, 5);
    expect(taken[0]).toEqual({ amount: 20, type: 'cold' });
  });
});

describe('the monsters of the game', () => {
  it('every damage type, armor and resistance in the data is valid', () => {
    for (const def of Object.values(MONSTERS) as MonsterDef[]) {
      if (def.damageType) expect(['physical', 'fire', 'cold', 'lightning', 'corruption', 'divine']).toContain(def.damageType);
      if (def.armor !== undefined) expect(def.armor).toBeGreaterThanOrEqual(0);
      for (const v of Object.values(def.resist ?? {})) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(0.75);
      }
    }
  });

  it('there are monsters of several kinds, so that resistances on the gear matter', () => {
    const types = new Set((Object.values(MONSTERS) as MonsterDef[]).map((m) => m.damageType ?? 'physical'));
    expect(types.has('cold')).toBe(true);
    expect(types.has('corruption')).toBe(true);
    expect(types.has('divine')).toBe(true);
  });
});

describe('gear', () => {
  const item = (mods: { affixId: string; value: number }[]): ItemInstance => ({ uid: 'x', baseId: 'ring_copper', name: 't', slot: 'ring', rarity: 'magic', mods });

  it('resistance and increased-damage affixes show up in the stats as fractions', () => {
    const stats = computeStats({ ...emptyEquipment(), ring: item([{ affixId: 'coldRes', value: 12 }, { affixId: 'divineDamage', value: 10 }]) });
    expect(stats.resist.cold).toBeCloseTo(0.12, 9);
    expect(stats.increased.divine).toBeCloseTo(0.1, 9);
    expect(stats.resist.fire).toBe(0);
    expect(stats.increased.physical).toBe(0);
  });
});
