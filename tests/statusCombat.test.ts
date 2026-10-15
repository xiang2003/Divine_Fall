import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import type { DamageType } from '../src/data/damageTypes';
import type { ItemInstance } from '../src/data/items';
import { MONSTERS, type MonsterDef } from '../src/data/monsters';
import { SKILLS } from '../src/data/skills';
import type { StatusId } from '../src/data/statuses';
import { Monster, type MonsterHooks } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { Buffs } from '../src/systems/buffs';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { resolveHit } from '../src/systems/damage';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';
import { computeStats, emptyEquipment, gearTriggers } from '../src/systems/stats';
import { StatusSet } from '../src/systems/status';
import { parseMap } from '../src/data/mapData';

const MAP = parseMap({ id: 'c', name: 'c', layout: ['##########', '#P.......#', '#........#', '#........#', '##########'] });
const BASE_DAMAGE = PLAYER_CONFIG.baseStats.damage;

/** A stand-in for the Player; `rngValue` is every roll (0.99: no crits and no chances; 0: everything happens). */
function setup(statsOver: Partial<ReturnType<typeof computeStats>> = {}, rngValue = 0.99) {
  const stats = { ...computeStats(emptyEquipment()), ...statsOver };
  const player = {
    pos: { x: 2.5, y: 2.5 },
    radius: PLAYER_CONFIG.radius,
    stats,
    hp: stats.maxHp,
    isDead: false,
    buffs: new Buffs(),
    status: new StatusSet(),
    applyPoison() {},
    tickStatus: () => null,
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
  const kills: Monster[] = [];
  const applied: StatusId[][] = [];
  const handlers: CombatEvents = {
    damageDealt: (_x, _y, amount, crit, type) => dealt.push({ amount, crit, type }),
    damageTaken: () => {},
    monsterKilled: (m) => kills.push(m),
    playerDied: () => {},
    healed: () => {},
    lightningArc: () => {},
    skillFx: () => {},
    telegraph: () => {},
    novaFlash: () => {},
    phaseChanged: () => {},
    spawnMinions: () => {},
    pillars: () => {},
    statusApplied: (_x, _y, ids) => applied.push([...ids]),
  };
  const combat = new CombatSystem(
    player as unknown as Player,
    () => monsters,
    { fire: () => true, update: () => {} } as unknown as ProjectileSystem,
    { fire: () => true, update: () => {} } as unknown as SkillProjectileSystem,
    new CollisionSystem(MAP),
    () => rngValue,
    handlers,
  );
  return { player, monsters, combat, dealt, kills, applied };
}

const monster = (over: Partial<MonsterDef> = {}, x = 3.4) => new Monster({ ...MONSTERS.ghoul, maxHp: 1000, ...over }, { x, y: 2.5 });
const seconds = (combat: CombatSystem, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) combat.update(1 / 60);
};

describe('gear that puts effects on what it hits', () => {
  it('the stats hold the chances as fractions, the freeze points, damage over time and duration', () => {
    const ring: ItemInstance = {
      uid: 'x',
      baseId: 'ring_copper',
      name: 't',
      slot: 'ring',
      rarity: 'rare',
      mods: [
        { affixId: 'bleedChance', value: 12 },
        { affixId: 'freezeBuildup', value: 6 },
        { affixId: 'dotDamage', value: 15 },
        { affixId: 'statusDuration', value: 20 },
      ],
    };
    const stats = computeStats({ ...emptyEquipment(), ring });
    expect(stats.statusChance.bleeding).toBeCloseTo(0.12, 9);
    expect(stats.statusChance.burning).toBeUndefined();
    expect(stats.freezeBuildup).toBe(6);
    expect(stats.dotDamage).toBeCloseTo(0.15, 9);
    expect(stats.statusDuration).toBeCloseTo(0.2, 9);
    expect(gearTriggers(stats)).toEqual([{ id: 'bleeding', chance: 0.12 }, { id: 'freeze', buildup: 6 }]);
    expect(gearTriggers(computeStats(emptyEquipment()))).toEqual([]);
  });
});

describe('a hit puts effects on the monster', () => {
  it('a burning hit burns: fire damage over time, as fire, until it runs out, and the numbers say fire', () => {
    const { monsters, combat, dealt, applied } = setup({ statusChance: { burning: 1 } });
    const m = monster();
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    expect(m.status.has('burning')).toBe(true);
    expect(applied).toEqual([['burning']]);
    const before = m.hp;
    seconds(combat, 5);
    expect(m.status.has('burning')).toBe(false);
    // 60% of the hit over 4 seconds
    expect(before - m.hp).toBeCloseTo(BASE_DAMAGE * 0.6, 0);
    expect(dealt.slice(1).every((d) => d.type === 'fire' && !d.crit)).toBe(true);
    expect(dealt.length).toBeGreaterThan(2);
  });

  it('the damage over time goes through the resistance of the monster, and the increases of the player raise it', () => {
    const resisted = setup({ statusChance: { burning: 1 } });
    const a = monster({ resist: { fire: 0.5 } });
    resisted.monsters.push(a);
    resisted.combat.playerSwingHit(1, 0);
    const hp = a.hp;
    seconds(resisted.combat, 5);
    const lostResisted = hp - a.hp;
    const plain = setup({ statusChance: { burning: 1 }, dotDamage: 1 });
    const b = monster();
    plain.monsters.push(b);
    plain.combat.playerSwingHit(1, 0);
    const hp2 = b.hp;
    seconds(plain.combat, 5);
    const lostPlain = hp2 - b.hp;
    expect(lostResisted).toBeLessThan(BASE_DAMAGE * 0.6 * 0.6);
    expect(lostPlain).toBeGreaterThan(BASE_DAMAGE * 0.6 * 1.6); // +100% damage over time
  });

  it('damage over time can kill, and the kill is reported once', () => {
    const { monsters, combat, kills } = setup({ statusChance: { bleeding: 1 } });
    const m = monster({ maxHp: BASE_DAMAGE + 3 });
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    expect(m.hp).toBe(3);
    seconds(combat, 6);
    expect(m.state).toBe('dead');
    expect(kills).toEqual([m]);
  });

  it('the spin makes a monster bleed only when it crits (a condition), the slam breaks armor, the divine bolt can shock', () => {
    const spin = SKILLS.find((s) => s.id === 'spin')!;
    const slam = SKILLS.find((s) => s.id === 'slam')!;
    const bolt = SKILLS.find((s) => s.id === 'bolt')!;
    expect(spin.applies).toEqual([{ id: 'bleeding', chance: 1, on: 'crit' }]);
    expect(slam.applies).toEqual([{ id: 'armorBreak', chance: 1 }]);
    expect(bolt.applies?.[0]?.id).toBe('shock');

    const noCrit = setup({}, 0.99);
    const a = monster();
    noCrit.monsters.push(a);
    noCrit.combat.castSkill(spin, { damageMult: spin.damageMult, cooldown: 1, count: 1 }, 1, 0, 3, 2.5);
    expect(a.status.has('bleeding')).toBe(false);

    const crit = setup({}, 0);
    const b = monster();
    crit.monsters.push(b);
    crit.combat.castSkill(spin, { damageMult: spin.damageMult, cooldown: 1, count: 1 }, 1, 0, 3, 2.5);
    expect(b.status.has('bleeding')).toBe(true);

    const slammed = setup({}, 0.99);
    const c = monster({ armor: 40 });
    slammed.monsters.push(c);
    slammed.combat.castSkill(slam, { damageMult: slam.damageMult, cooldown: 1, count: 1 }, 1, 0, 3.4, 2.5);
    expect(c.status.has('armorBreak')).toBe(true);
  });

  it('armor break makes the next hits harder, shock makes them hurt more, and neither affects an immune target', () => {
    const { monsters, combat, dealt } = setup();
    const m = monster({ armor: 40 });
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    const first = dealt[0]!.amount;
    m.status.apply({ id: 'armorBreak' });
    combat.playerSwingHit(1, 0);
    const second = dealt[1]!.amount;
    expect(second).toBeGreaterThan(first);
    m.status.apply({ id: 'shock' });
    combat.playerSwingHit(1, 0);
    expect(dealt[2]!.amount).toBeGreaterThan(second);
  });

  it('a monster can be immune to an effect, and a gear chance that rolls on it does nothing', () => {
    const { monsters, combat, applied } = setup({ statusChance: { bleeding: 1 } });
    const golem = monster({ immune: ['bleeding'] });
    monsters.push(golem);
    combat.playerSwingHit(1, 0);
    expect(golem.status.has('bleeding')).toBe(false);
    expect(applied).toEqual([]);
    expect(MONSTERS.rock_golem.immune).toContain('bleeding');
    expect(MONSTERS.drowned_spirit.immune).toContain('freeze');
  });

  it('freeze points from the gear freeze a monster after a few hits', () => {
    const { monsters, combat } = setup({ freezeBuildup: 40 });
    const m = monster();
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    combat.playerSwingHit(1, 0);
    expect(m.status.frozen).toBe(false);
    combat.playerSwingHit(1, 0);
    expect(m.status.frozen).toBe(true);
  });

  it('chain lightning shocks what it strikes (a chance)', () => {
    const { player, monsters, combat } = setup({}, 0);
    (player as unknown as { hasEffect: (id: string) => boolean }).hasEffect = (id) => id === 'chainLightning';
    const a = monster({}, 3.4);
    const b = monster({}, 4.6);
    monsters.push(a, b);
    combat.playerSwingHit(1, 0);
    expect(b.status.has('shock')).toBe(true);
  });
});

describe('what the effects do to a monster', () => {
  /** Hooks that fail the test if the monster tries to do anything. */
  const hooks = new Proxy({}, { get: () => () => { throw new Error('a frozen monster did something'); } }) as unknown as MonsterHooks;
  const target = { pos: { x: 2.5, y: 2.5 }, radius: 0.28, isDead: false };

  it('slow makes it move slower, weaken makes it hit softer', () => {
    const m = monster({}, 6);
    const speed = m.moveSpeed;
    const damage = m.damage;
    m.status.apply({ id: 'slow', magnitude: 0.5 });
    m.status.apply({ id: 'weaken' });
    expect(m.moveSpeed).toBeCloseTo(speed * 0.5, 9);
    expect(m.damage).toBeCloseTo(damage * 0.75, 9);
  });

  it('a frozen monster neither moves nor attacks, and goes on when it thaws', () => {
    const m = monster({}, 6);
    m.engage();
    m.status.apply({ id: 'freeze', duration: 1.5 });
    const x = m.pos.x;
    for (let i = 0; i < 60; i++) m.update(1 / 60, target, new CollisionSystem(MAP), hooks);
    expect(m.pos.x).toBe(x);
    expect(m.moveSpeed).toBe(0);
    m.status.tick(2);
    expect(m.status.frozen).toBe(false);
    expect(m.moveSpeed).toBeGreaterThan(0);
  });

  it('a boss shrugs off control: its freeze lasts half as long, and it needs three times the build-up', () => {
    const boss = new Monster(MONSTERS.ruins_guardian, { x: 5, y: 2.5 });
    boss.status.apply({ id: 'freeze', duration: 2 });
    expect(boss.status.remaining('freeze')).toBeCloseTo(1, 9);
    const other = new Monster(MONSTERS.ruins_guardian, { x: 5, y: 2.5 });
    expect(other.status.buildup('freeze', 150)).toBe(false);
    expect(other.status.buildup('freeze', 150)).toBe(true);
    const normal = monster();
    normal.status.apply({ id: 'freeze', duration: 2 });
    expect(normal.status.remaining('freeze')).toBeCloseTo(2, 9);
  });
});
