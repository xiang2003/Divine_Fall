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
import { Buffs, PoisonEffect } from '../src/systems/buffs';
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
    poison: new PoisonEffect(),
    get isPoisoned() {
      return p.poison.active;
    },
    applyPoison(dps: number, duration: number) {
      p.poison.apply(dps, duration);
    },
    tickPoison(dt: number) {
      const amount = p.poison.tick(dt);
      if (amount === 0 || p.isDead) return null;
      p.hp = Math.max(0, p.hp - amount);
      if (p.hp === 0) p.isDead = true;
      return { amount, died: p.isDead };
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
    pillars: () => {},
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
    const { player, combat, events } = setup(0.99, 100);
    const m = new Monster(MONSTERS.ghoul, { x: 3.1, y: 2.5 });
    combat.meleeStrike(m);
    expect(events.taken).toEqual([Math.round(MONSTERS.ghoul.damage / 2)]); // 100 armor halves it
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
    expect(afterHit - player.hp).toBe(ticks * Math.max(1, Math.round(poison.dps * 0.5)));
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
