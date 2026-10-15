import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { MONSTERS } from '../src/data/monsters';
import { Monster } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { applyArmor } from '../src/systems/combatMath';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import type { SkillProjectileSystem } from '../src/systems/SkillProjectileSystem';
import { parseMap } from '../src/data/mapData';
import { Buffs } from '../src/systems/buffs';
import { StatusSet } from '../src/systems/status';
import { computeStats, emptyEquipment } from '../src/systems/stats';
import type { LegendaryEffectId } from '../src/data/legendaryEffects';

const MAP = parseMap({
  id: 'c',
  name: 'c',
  layout: ['##########', '#P.......#', '#........#', '#........#', '##########'],
});

/** Minimal stand-in for Player: same damage rules, no rendering. */
function fakePlayer(armor = 5, effects: LegendaryEffectId[] = []) {
  const stats = { ...computeStats(emptyEquipment()), armor };
  const p = {
    pos: { x: 2.5, y: 2.5 },
    radius: PLAYER_CONFIG.radius,
    stats,
    hp: stats.maxHp,
    isDead: false,
    buffs: new Buffs(),
    status: new StatusSet(),
    get isPoisoned() {
      return p.status.has('poison');
    },
    applyPoison(dps: number, duration: number) {
      p.status.apply({ id: 'poison', dps, duration });
    },
    tickStatus(dt: number) {
      const tick = p.status.tick(dt, { armor: stats.armor });
      if (!tick || p.isDead) return null;
      p.hp = Math.max(0, p.hp - tick.amount);
      if (p.hp === 0) p.isDead = true;
      return { amount: tick.amount, died: p.isDead, type: 'corruption' as const };
    },
    hasEffect: (id: LegendaryEffectId) => effects.includes(id),
    heal(amount: number) {
      const before = p.hp;
      p.hp = Math.min(stats.maxHp, p.hp + amount);
      return p.hp - before;
    },
    takeDamage(raw: number) {
      if (p.isDead) return { amount: 0, died: false };
      const amount = applyArmor(raw, stats.armor);
      p.hp = Math.max(0, p.hp - amount);
      if (p.hp === 0) {
        p.isDead = true;
        return { amount, died: true };
      }
      return { amount, died: false };
    },
  };
  return p;
}

function setup(rngValue = 0.99, armor = 5, effects: LegendaryEffectId[] = []) {
  const player = fakePlayer(armor, effects);
  const monsters: Monster[] = [];
  const fired: { damage: number }[] = [];
  const events = {
    dealt: [] as { amount: number; crit: boolean }[],
    taken: [] as number[],
    kills: [] as Monster[],
    deaths: 0,
    heals: [] as number[],
    arcs: [] as [number, number, number, number][],
    strikes: [] as { points: readonly { x: number; y: number }[]; radius: number; delay: number; damage: number; style?: string }[],
  };
  const projectiles = {
    fire: (_x: number, _y: number, _dx: number, _dy: number, _speed: number, damage: number) => {
      fired.push({ damage });
      return true;
    },
    update: () => {},
  } as unknown as ProjectileSystem;
  const handlers: CombatEvents = {
    damageDealt: (_x, _y, amount, crit) => events.dealt.push({ amount, crit }),
    damageTaken: (_x, _y, amount) => events.taken.push(amount),
    monsterKilled: (m) => events.kills.push(m),
    playerDied: () => events.deaths++,
    healed: (_x, _y, amount) => events.heals.push(amount),
    lightningArc: (ax, ay, bx, by) => events.arcs.push([ax, ay, bx, by]),
    skillFx: () => {},
    telegraph: () => {},
    novaFlash: () => {},
    phaseChanged: () => {},
    spawnMinions: () => {},
    pillars: (points, radius, delay, damage, style) => events.strikes.push({ points, radius, delay, damage, style }),
  };
  const combat = new CombatSystem(
    player as unknown as Player,
    () => monsters,
    projectiles,
    { fire: () => true, update: () => {} } as unknown as SkillProjectileSystem,
    new CollisionSystem(MAP),
    () => rngValue,
    handlers,
  );
  return { player, monsters, combat, events, fired };
}

describe('CombatSystem: player swings', () => {
  it('damages only monsters inside the arc', () => {
    const { monsters, combat, events } = setup();
    const front = new Monster(MONSTERS.ghoul, { x: 3.7, y: 2.5 });
    const behind = new Monster(MONSTERS.ghoul, { x: 1.3, y: 2.5 });
    const far = new Monster(MONSTERS.ghoul, { x: 8.5, y: 2.5 });
    monsters.push(front, behind, far);
    combat.playerSwingHit(1, 0);
    expect(front.hp).toBeLessThan(MONSTERS.ghoul.maxHp);
    expect(behind.hp).toBe(MONSTERS.ghoul.maxHp);
    expect(far.hp).toBe(MONSTERS.ghoul.maxHp);
    expect(events.dealt).toHaveLength(1);
  });

  it('uses the injected rng for crits', () => {
    const crit = setup(0); // rng 0 -> always crit
    crit.monsters.push(new Monster(MONSTERS.ghoul, { x: 3.5, y: 2.5 }));
    crit.combat.playerSwingHit(1, 0);
    expect(crit.events.dealt[0]).toEqual({
      amount: Math.round(crit.player.stats.damage * crit.player.stats.critDamage),
      crit: true,
    });

    const plain = setup(0.99);
    plain.monsters.push(new Monster(MONSTERS.ghoul, { x: 3.5, y: 2.5 }));
    plain.combat.playerSwingHit(1, 0);
    expect(plain.events.dealt[0]).toEqual({ amount: plain.player.stats.damage, crit: false });
  });

  it('hits every monster in the arc and reports each kill exactly once', () => {
    const { monsters, combat, events } = setup(0);
    const a = new Monster(MONSTERS.hound, { x: 3.4, y: 2.2 });
    const b = new Monster(MONSTERS.hound, { x: 3.4, y: 2.8 });
    monsters.push(a, b);
    // Two crits (18) are not enough for 22 HP; the third kills both.
    combat.playerSwingHit(1, 0);
    expect(events.kills).toHaveLength(0);
    combat.playerSwingHit(1, 0);
    expect(events.kills).toHaveLength(2);
    // Swinging at corpses does nothing more.
    combat.playerSwingHit(1, 0);
    expect(events.kills).toHaveLength(2);
    expect(events.dealt).toHaveLength(4);
  });

  it('rapid repeated swings never damage a corpse or double-count a kill', () => {
    const { player, monsters, combat, events } = setup(0.99);
    const m = new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 });
    monsters.push(m);
    for (let i = 0; i < 30; i++) combat.playerSwingHit(1, 0);
    expect(events.kills).toHaveLength(1);
    expect(m.hp).toBe(0);
    expect(events.dealt.length).toBe(Math.ceil(MONSTERS.ghoul.maxHp / player.stats.damage));
  });
});

describe('CombatSystem: damage to the player', () => {
  it('melee strikes connect only when the player is within reach, and armor applies', () => {
    const { player, combat, events } = setup(0.99, 40);
    const m = new Monster(MONSTERS.ghoul, { x: 3.1, y: 2.5 });
    combat.meleeStrike(m);
    expect(events.taken).toEqual([Math.round(MONSTERS.ghoul.damage / 2)]); // 40 armor halves it
    expect(player.hp).toBe(100 - events.taken[0]!);

    m.pos.x = 7.5; // out of reach
    combat.meleeStrike(m);
    expect(events.taken).toHaveLength(1);
  });

  it('projectile hits go through the same armor rules via the hit handler', () => {
    const { combat, fired } = setup();
    const shade = new Monster(MONSTERS.shade, { x: 6.5, y: 2.5 });
    combat.fireProjectile(shade, -1, 0);
    expect(fired).toEqual([{ damage: MONSTERS.shade.damage }]);
  });

  it('announces player death exactly once and ignores hits afterwards', () => {
    const { player, combat, events } = setup(0.99, 0);
    const m = new Monster(MONSTERS.ghoul, { x: 3.1, y: 2.5 });
    for (let i = 0; i < 40; i++) combat.meleeStrike(m);
    expect(player.isDead).toBe(true);
    expect(player.hp).toBe(0);
    expect(events.deaths).toBe(1);
    const hits = events.taken.length;
    combat.meleeStrike(m);
    expect(events.taken).toHaveLength(hits);
    expect(events.taken.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(100);
  });
});

describe('CombatSystem: legendary effects', () => {
  it('chain lightning jumps to the nearest unhit enemies, at most maxTargets, never the same one twice', () => {
    // rng 0 -> always procs (0 < chance) and always crits for the main hit; arcs ignore crit.
    const { player, monsters, combat, events } = setup(0, 5, ['chainLightning']);
    const first = new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 });
    const chain = [1, 2, 3, 4].map((i) => new Monster(MONSTERS.ghoul, { x: 3.4 + i * 1.5, y: 2.5 }));
    monsters.push(first, ...chain);
    combat.playerSwingHit(1, 0);
    const arcDamage = Math.round(player.stats.damage * 0.6);
    // first monster took the swing; exactly 3 of the 4 others were hit by arcs, nearest first
    expect(events.arcs).toHaveLength(4); // player -> first, then 3 jumps
    expect(chain[0]!.hp).toBe(MONSTERS.ghoul.maxHp - arcDamage);
    expect(chain[1]!.hp).toBe(MONSTERS.ghoul.maxHp - arcDamage);
    expect(chain[2]!.hp).toBe(MONSTERS.ghoul.maxHp - arcDamage);
    expect(chain[3]!.hp).toBe(MONSTERS.ghoul.maxHp);
  });

  it('chain lightning does not proc without the effect, without a hit, or when the roll fails', () => {
    const noEffect = setup(0, 5, []);
    noEffect.monsters.push(new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 }), new Monster(MONSTERS.ghoul, { x: 5, y: 2.5 }));
    noEffect.combat.playerSwingHit(1, 0);
    expect(noEffect.events.arcs).toHaveLength(0);

    const miss = setup(0, 5, ['chainLightning']);
    miss.monsters.push(new Monster(MONSTERS.ghoul, { x: 8.5, y: 2.5 }));
    miss.combat.playerSwingHit(1, 0);
    expect(miss.events.arcs).toHaveLength(0);

    const failedRoll = setup(0.99, 5, ['chainLightning']);
    failedRoll.monsters.push(new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 }), new Monster(MONSTERS.ghoul, { x: 5, y: 2.5 }));
    failedRoll.combat.playerSwingHit(1, 0);
    expect(failedRoll.events.arcs).toHaveLength(0);
  });

  it('chain lightning can finish off enemies and counts those kills too', () => {
    const { monsters, combat, events } = setup(0, 5, ['chainLightning']);
    const weak = new Monster(MONSTERS.hound, { x: 5, y: 2.5 });
    weak.hp = 1;
    monsters.push(new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 }), weak);
    combat.playerSwingHit(1, 0);
    expect(events.kills).toContain(weak);
  });

  it('life on kill heals a percentage of max HP (at least the minimum), capped at max', () => {
    const { player, monsters, combat, events } = setup(0.99, 5, ['lifeOnKill']);
    player.hp = 50;
    const m = new Monster(MONSTERS.hound, { x: 3.4, y: 2.5 });
    m.hp = 1;
    monsters.push(m);
    combat.playerSwingHit(1, 0);
    expect(player.hp).toBe(50 + Math.round(player.stats.maxHp * 0.06));
    expect(events.heals).toEqual([Math.round(player.stats.maxHp * 0.06)]);

    // at full health there is nothing to restore and no number is shown
    const full = setup(0.99, 5, ['lifeOnKill']);
    const m2 = new Monster(MONSTERS.hound, { x: 3.4, y: 2.5 });
    m2.hp = 1;
    full.monsters.push(m2);
    full.combat.playerSwingHit(1, 0);
    expect(full.events.heals).toHaveLength(0);
  });

  it('kill frenzy grants an attack speed buff on kill only', () => {
    const { player, monsters, combat } = setup(0.99, 5, ['killFrenzy']);
    const m = new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 });
    monsters.push(m);
    combat.playerSwingHit(1, 0); // hit, not a kill
    expect(player.buffs.attackSpeedMultiplier).toBe(1);
    m.hp = 1;
    combat.playerSwingHit(1, 0);
    expect(player.buffs.attackSpeedMultiplier).toBeCloseTo(1.3, 9);
  });
});

describe('CombatSystem: poison', () => {
  it('a hit from a poisonous monster poisons the player, and the poison keeps ticking until it runs out', () => {
    const { player, combat, events } = setup();
    const viper = new Monster(MONSTERS.forest_viper, { x: 4.5, y: 2.5 });
    combat.meleeStrike(viper);
    expect(player.isPoisoned).toBe(true);
    const afterHit = player.hp;
    expect(events.taken).toHaveLength(1);
    for (let i = 0; i < 60 * 5; i++) combat.update(1 / 60);
    expect(player.isPoisoned).toBe(false);
    const poison = MONSTERS.forest_viper.poison!;
    const ticks = Math.floor(poison.duration / 0.5);
    expect(afterHit - player.hp).toBe(poison.dps * poison.duration); // a fraction of a point is carried, nothing is lost
    expect(events.taken).toHaveLength(1 + ticks);
  });

  it('poison that kills reports the death once', () => {
    const { player, combat, events } = setup();
    player.hp = 3;
    player.applyPoison(10, 4);
    for (let i = 0; i < 60 * 3; i++) combat.update(1 / 60);
    expect(player.isDead).toBe(true);
    expect(events.deaths).toBe(1);
  });

  it('a monster without venom does not poison', () => {
    const { player, combat } = setup();
    combat.meleeStrike(new Monster(MONSTERS.ghoul, { x: 2.9, y: 2.5 }));
    expect(player.isPoisoned).toBe(false);
  });
});

describe('CombatSystem: what happens when some monsters die', () => {
  const kill = (rng: number, id: 'wreck_revenant' | 'mask_phantom') => {
    const t = setup(rng);
    const m = new Monster(MONSTERS[id], { x: 3.7, y: 2.5 });
    t.monsters.push(m);
    m.takeDamage(m.maxHp - 1);
    t.combat.playerSwingHit(1, 0);
    return { ...t, m };
  };

  it('a wreck revenant may burst with resentment where it fell: a warning circle that goes off later', () => {
    const lucky = kill(0, 'wreck_revenant');
    expect(lucky.m.isDead).toBe(true);
    const def = MONSTERS.wreck_revenant.deathBurst;
    expect(lucky.events.strikes).toHaveLength(1);
    expect(lucky.events.strikes[0]).toMatchObject({ radius: def.radius, delay: def.delay, style: 'burst' });
    expect(lucky.events.strikes[0]!.points).toEqual([{ x: 3.7, y: 2.5 }]);
    expect(lucky.events.strikes[0]!.damage).toBeCloseTo(lucky.m.damage * def.damageMult);
    expect(lucky.events.kills).toEqual([lucky.m]); // it is still an ordinary kill
  });

  it('...and often does not', () => {
    const unlucky = kill(0.99, 'wreck_revenant');
    expect(unlucky.m.isDead).toBe(true);
    expect(unlucky.events.strikes).toEqual([]);
  });

  it('a phantom is not a kill: no rewards, no events', () => {
    const t = kill(0, 'mask_phantom');
    expect(t.m.isDead).toBe(true);
    expect(t.events.kills).toEqual([]);
  });
});
