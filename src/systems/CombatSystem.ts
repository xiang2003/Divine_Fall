import { PLAYER_CONFIG } from '../config/gameConfig';
import { LEGENDARY_EFFECTS } from '../data/legendaryEffects';
import type { GroundStrikeStyle } from '../data/monsters';
import type { SkillDef } from '../data/skills';
import type { BoltTarget } from '../entities/Bolt';
import type { Vec2 } from '../game/iso';
import type { ShotEffects } from '../entities/Projectile';
import {
  MELEE_STRIKE_SLACK,
  type Monster,
  type MonsterHooks,
} from '../entities/Monster';
import type { Player } from '../entities/Player';
import type { DamageType } from '../data/damageTypes';
import { inAttackArc } from './combatMath';
import { resolveHit, type Offense } from './damage';
import type { CollisionSystem } from './CollisionSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { SkillProjectileSystem } from './SkillProjectileSystem';
import type { SkillStats } from './skills';
import type { Rng } from './rng';

/** Things the rest of the game wants to react to (floating numbers, HUD, kill counts). */
export interface CombatEvents {
  /** The player hurt a monster. (x, y) is where to show the number; `type` is the kind of damage that did the most (it colours the number). */
  damageDealt(x: number, y: number, amount: number, crit: boolean, type?: DamageType): void;
  /** The player took damage after armor or resistance. */
  damageTaken(x: number, y: number, amount: number, type?: DamageType): void;
  /** Fired once per kill, after on-kill legendary effects were applied. */
  monsterKilled(monster: Monster): void;
  playerDied(): void;
  /** The player regained health (show a green number). */
  healed(x: number, y: number, amount: number): void;
  /** A chain-lightning arc to draw between two world points. */
  lightningArc(ax: number, ay: number, bx: number, by: number): void;
  /** A skill area effect to draw (a ring for the spin, a disc for the slam). */
  skillFx(kind: 'spin' | 'slam', x: number, y: number, radius: number): void;
  /** A blast is winding up: show a ground warning of `radius` for `duration` seconds. */
  telegraph(owner: Monster, x: number, y: number, radius: number, duration: number): void;
  /** A blast just went off. */
  novaFlash(x: number, y: number, radius: number): void;
  /** A boss entered a new phase (1 = second phase, ...). */
  phaseChanged(boss: Monster, phase: number): void;
  /** Copies of the monster `defId` should appear around `owner`. */
  spawnMinions(owner: Monster, defId: string, count: number): void;
  /** Ground strikes were summoned: a circle of `radius` at each point, going off after `delay` seconds for `damage` (before armor). `style` is a stone pillar bursting out, or a plain burst of resentment. */
  pillars(points: readonly Vec2[], radius: number, delay: number, damage: number, style?: GroundStrikeStyle): void;
  /** A poison cloud was lobbed onto (x, y): a warning circle for `delay` seconds, then it lingers for `duration` seconds and poisons whoever stands in it (`dps`). */
  pool?(x: number, y: number, radius: number, delay: number, duration: number, dps: number): void;
}

/** Spawn the projectile slightly in front of the caster so it doesn't start inside its body. */
const MUZZLE_OFFSET = 0.4;

/**
 * Applies damage rules: resolves the player's swings against monsters, monster melee strikes and
 * projectile hits against the player. All randomness comes from the injected `rng`.
 * Implements MonsterHooks so monsters can call back without knowing about the player or the rules.
 */
export class CombatSystem implements MonsterHooks {
  constructor(
    private readonly player: Player,
    private readonly monsters: () => readonly Monster[],
    private readonly projectiles: ProjectileSystem,
    private readonly skillBolts: SkillProjectileSystem,
    private readonly collision: CollisionSystem,
    private readonly rng: Rng,
    private readonly events: CombatEvents,
  ) {}

  /** The strike moment of a player swing: hits every living monster inside the swing arc. */
  playerSwingHit(dirX: number, dirY: number): void {
    const { stats, pos } = this.player;
    let firstHit: Monster | null = null;
    for (const m of this.monsters()) {
      if (!m.hittable) continue;
      const hit = inAttackArc(
        pos.x,
        pos.y,
        dirX,
        dirY,
        m.pos.x,
        m.pos.y,
        m.def.radius,
        stats.attackRange,
        PLAYER_CONFIG.attackArcHalfAngle,
      );
      if (!hit) continue;
      firstHit ??= m;
      this.strike(m, 'physical', 1);
    }
    // Legendary: one roll per swing that connected.
    if (firstHit && this.player.hasEffect('chainLightning') && this.rng() < LEGENDARY_EFFECTS.chainLightning.chance) {
      this.chainLightning(firstHit);
    }
  }

  meleeStrike(monster: Monster, damageMult = 1): void {
    if (this.player.isDead) return;
    if (monster.reachTo(this.player) > monster.def.attackRange + MELEE_STRIKE_SLACK) return;
    this.hurtPlayer(monster.damage * damageMult, monster);
  }

  novaStrike(monster: Monster, radius: number, damageMult = 1): void {
    this.events.novaFlash(monster.pos.x, monster.pos.y, radius);
    if (this.player.isDead) return;
    const dist = Math.hypot(this.player.pos.x - monster.pos.x, this.player.pos.y - monster.pos.y);
    if (dist <= radius + this.player.radius) this.hurtPlayer(monster.damage * damageMult, monster);
  }

  telegraph(monster: Monster, radius: number, duration: number): void {
    this.events.telegraph(monster, monster.pos.x, monster.pos.y, radius, duration);
  }

  phaseChanged(monster: Monster, phase: number): void {
    this.events.phaseChanged(monster, phase);
  }

  split(monster: Monster, into: string, count: number): void {
    this.events.spawnMinions(monster, into, count);
  }

  /** The first pillar comes up right where the player stands; the others around it, on floor that is free. */
  dropPool(monster: Monster, x: number, y: number): void {
    const pool = monster.def.pool;
    if (pool) this.events.pool?.(x, y, pool.radius, pool.delay, pool.duration, pool.dps);
  }

  summonPillars(monster: Monster, count: number, radius: number, delay: number, damageMult: number, style: GroundStrikeStyle = 'pillar'): void {
    const centre = this.player.pos;
    const points: Vec2[] = [{ x: centre.x, y: centre.y }];
    for (let i = 1; i < count; i++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = this.rng() * Math.PI * 2;
        const distance = 1.6 + this.rng() * 3.4;
        const x = centre.x + Math.cos(angle) * distance;
        const y = centre.y + Math.sin(angle) * distance;
        if (this.collision.collidesCircle(x, y, 0.4)) continue;
        points.push({ x, y });
        break;
      }
    }
    this.events.pillars(points, radius, delay, monster.damage * damageMult, style);
  }

  fireProjectile(monster: Monster, dirX: number, dirY: number, damageMult = 1): void {
    this.projectiles.fire(
      monster.pos.x + dirX * MUZZLE_OFFSET,
      monster.pos.y + dirY * MUZZLE_OFFSET,
      dirX,
      dirY,
      monster.def.projectileSpeed ?? 6,
      monster.damage * damageMult,
      monster,
      monster.def.homing ? { homing: monster.def.homing } : null,
    );
  }

  /** The effect moment of a skill cast (called by the player when the cast animation reaches its hit frame). */
  castSkill(def: SkillDef, stats: SkillStats, dirX: number, dirY: number, aimX: number, aimY: number): void {
    const { pos } = this.player;
    switch (def.kind) {
      case 'spin': {
        const radius = def.radius ?? 2;
        for (const m of this.monsters()) {
          if (!m.hittable) continue;
          if (Math.hypot(m.pos.x - pos.x, m.pos.y - pos.y) <= radius + m.def.radius) this.skillHit(m, stats.damageMult, def.damageType);
        }
        this.events.skillFx('spin', pos.x, pos.y, radius);
        break;
      }
      case 'bolt': {
        const spread = def.spread ?? 0.2;
        const base = Math.atan2(dirY, dirX);
        for (let i = 0; i < stats.count; i++) {
          const angle = base + (i - (stats.count - 1) / 2) * spread;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          this.skillBolts.fire(pos.x + dx * 0.5, pos.y + dy * 0.5, dx, dy, def.speed ?? 12, def.range ?? 10, stats.damageMult, def.damageType);
        }
        break;
      }
      case 'slam': {
        // The target is where the cursor was, but no farther than the range of the skill from the player.
        const range = def.range ?? 6;
        const vx = aimX - pos.x;
        const vy = aimY - pos.y;
        const len = Math.hypot(vx, vy);
        const k = len > range ? range / len : 1;
        const tx = pos.x + vx * k;
        const ty = pos.y + vy * k;
        const radius = def.radius ?? 2;
        for (const m of this.monsters()) {
          if (!m.hittable) continue;
          if (Math.hypot(m.pos.x - tx, m.pos.y - ty) <= radius + m.def.radius) {
            if (!this.skillHit(m, stats.damageMult, def.damageType)) m.stun(def.stunSeconds ?? 1);
          }
        }
        this.events.skillFx('slam', tx, ty, radius);
        break;
      }
    }
  }

  /** A player bolt reached an enemy. */
  boltHit(target: BoltTarget, damageMult: number, type: DamageType = 'physical'): void {
    const m = this.monsters().find((x) => x === target);
    if (m && m.hittable) this.skillHit(m, damageMult, type);
  }

  /** A skill hit: the attack damage as `type`, x the skill's multiplier, with crits. Returns true if it killed the monster. */
  private skillHit(m: Monster, damageMult: number, type: DamageType = 'physical'): boolean {
    return this.strike(m, type, damageMult);
  }

  /** What the player's attacks bring: increased damage by type and the crit numbers. */
  private offense(): Offense {
    const { stats } = this.player;
    return { increased: stats.increased, critChance: stats.critChance, critMultiplier: stats.critDamage };
  }

  /**
   * One of the player's hits on a monster, through the shared damage rules: the attack stat as damage of `type`, the skill's multiplier,
   * the player's increased damage and crit, then the monster's armor or resistance. Returns true if it killed the monster.
   */
  private strike(m: Monster, type: DamageType, skillMultiplier: number): boolean {
    const hit = resolveHit({ damage: { [type]: this.player.stats.damage }, skillMultiplier, canCrit: true }, this.offense(), m.defense, this.rng);
    return this.damageMonster(m, hit.total, hit.crit, hit.dominant);
  }

  /** Moves projectiles and bolts, applying the ones that reached their targets. */
  update(dt: number): void {
    // poison that is already in the blood keeps ticking
    const tick = this.player.tickPoison(dt);
    if (tick) {
      this.events.damageTaken(this.player.pos.x, this.player.pos.y, tick.amount);
      if (tick.died) this.events.playerDied();
    }
    this.projectiles.update(dt, this.collision, this.player, (p) => this.hurtPlayer(p.damage, p.owner, p.effects));
    this.skillBolts.update(dt, this.collision, this.monsters(), (target, bolt) => this.boltHit(target, bolt.damageMult, bolt.damageType));
  }

  /** Applies final damage to a monster, reports it, and handles the kill. */
  private damageMonster(m: Monster, amount: number, crit: boolean, type: DamageType = 'physical'): boolean {
    const killed = m.takeDamage(amount);
    this.events.damageDealt(m.pos.x, m.pos.y, amount, crit, type);
    if (killed) this.registerKill(m);
    return killed;
  }

  /** On-kill legendary effects first, then the kill is announced (so a heal shows before loot spawns). */
  private registerKill(m: Monster): void {
    if (m.def.phantom) return; // an illusion: no rewards, no on-kill effects
    const cfg = LEGENDARY_EFFECTS;
    if (this.player.hasEffect('lifeOnKill')) {
      const heal = Math.max(cfg.lifeOnKill.minHeal, Math.round(this.player.stats.maxHp * cfg.lifeOnKill.healRatio));
      const restored = this.player.heal(heal);
      if (restored > 0) this.events.healed(this.player.pos.x, this.player.pos.y, Math.round(restored));
    }
    if (this.player.hasEffect('killFrenzy')) {
      this.player.buffs.hasteAttack(cfg.killFrenzy.duration, cfg.killFrenzy.attackSpeedBonus);
    }
    const burst = m.def.deathBurst;
    if (burst && this.rng() < burst.chance) {
      this.events.pillars([{ x: m.pos.x, y: m.pos.y }], burst.radius, burst.delay, m.damage * burst.damageMult, 'burst');
    }
    this.events.monsterKilled(m);
  }

  /** Jumps from `source` to the nearest unhit living monster, up to maxTargets times. */
  private chainLightning(source: Monster): void {
    const cfg = LEGENDARY_EFFECTS.chainLightning;
    const damage = this.player.stats.damage * cfg.damageRatio;
    const struck = new Set<Monster>([source]);
    this.events.lightningArc(this.player.pos.x, this.player.pos.y, source.pos.x, source.pos.y);
    let from = source;
    for (let i = 0; i < cfg.maxTargets; i++) {
      let best: Monster | null = null;
      let bestDist: number = cfg.range;
      for (const m of this.monsters()) {
        if (!m.hittable || struck.has(m)) continue;
        const d = Math.hypot(m.pos.x - from.pos.x, m.pos.y - from.pos.y);
        if (d <= bestDist) {
          best = m;
          bestDist = d;
        }
      }
      if (!best) break;
      struck.add(best);
      this.events.lightningArc(from.pos.x, from.pos.y, best.pos.x, best.pos.y);
      // lightning damage: the monster's lightning resistance applies, and so does the player's increased lightning damage; it does not crit
      const hit = resolveHit({ damage: { lightning: damage } }, { increased: this.player.stats.increased }, best.defense);
      this.damageMonster(best, hit.total, false, 'lightning');
      from = best;
    }
  }

  /**
   * Applies a monster hit to the player. `source` (if known) adds its elite effects: lifesteal heals it by a
   * share of the damage dealt, and lightning adds a second, separate hit that armor also reduces.
   */
  /** A trap hurt the player (armor applies, a dodge avoids it). */
  trapHit(rawDamage: number, type: DamageType = 'physical'): void {
    this.hurtPlayer(rawDamage, null, null, type);
  }

  private hurtPlayer(rawDamage: number, source: Monster | null = null, effects: ShotEffects | null = null, type: DamageType = source?.def.damageType ?? 'physical'): void {
    const result = this.player.takeDamage(rawDamage, type);
    if (result.amount === 0) return; // dodged (invulnerable) or already dead
    this.events.damageTaken(this.player.pos.x, this.player.pos.y, result.amount, type);
    if (result.died) {
      this.events.playerDied();
      return;
    }
    const poison = effects?.poison ?? source?.def.poison;
    const slow = effects?.slow ?? source?.def.slow;
    if (poison) this.player.applyPoison(poison.dps, poison.duration);
    if (slow) this.player.applySlow(slow.factor, slow.duration);
    if (!source) return;
    if (source.stats.lifestealRatio > 0) source.heal(Math.round(result.amount * source.stats.lifestealRatio));
    if (source.stats.lightningRatio > 0) {
      this.events.lightningArc(source.pos.x, source.pos.y, this.player.pos.x, this.player.pos.y);
      const extra = this.player.takeDamage(Math.max(1, Math.round(rawDamage * source.stats.lightningRatio)), 'lightning');
      if (extra.amount > 0) this.events.damageTaken(this.player.pos.x, this.player.pos.y, extra.amount, 'lightning');
      if (extra.died) this.events.playerDied();
    }
  }
}
