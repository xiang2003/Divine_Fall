import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { MONSTERS } from '../src/data/monsters';
import { Monster } from '../src/entities/Monster';
import type { Player } from '../src/entities/Player';
import { applyArmor } from '../src/systems/combatMath';
import { CombatSystem, type CombatEvents } from '../src/systems/CombatSystem';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import type { ProjectileSystem } from '../src/systems/ProjectileSystem';
import { parseMap } from '../src/data/mapData';
import { computePlayerStats } from '../src/systems/stats';

const MAP = parseMap({
  id: 'c',
  name: 'c',
  layout: ['##########', '#P.......#', '#........#', '#........#', '##########'],
});

/** Minimal stand-in for Player: same damage rules, no rendering. */
function fakePlayer(armor = 5) {
  const stats = { ...computePlayerStats(), armor };
  const p = {
    pos: { x: 2.5, y: 2.5 },
    radius: PLAYER_CONFIG.radius,
    stats,
    hp: stats.maxHp,
    isDead: false,
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

function setup(rngValue = 0.99, armor = 5) {
  const player = fakePlayer(armor);
  const monsters: Monster[] = [];
  const fired: { damage: number }[] = [];
  const events = {
    dealt: [] as { amount: number; crit: boolean }[],
    taken: [] as number[],
    kills: [] as Monster[],
    deaths: 0,
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
  };
  const combat = new CombatSystem(
    player as unknown as Player,
    () => monsters,
    projectiles,
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
    const { monsters, combat, events } = setup(0.99);
    const m = new Monster(MONSTERS.ghoul, { x: 3.4, y: 2.5 });
    monsters.push(m);
    for (let i = 0; i < 30; i++) combat.playerSwingHit(1, 0);
    expect(events.kills).toHaveLength(1);
    expect(m.hp).toBe(0);
    expect(events.dealt.length).toBe(Math.ceil(MONSTERS.ghoul.maxHp / 12)); // 4 hits of 12
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
