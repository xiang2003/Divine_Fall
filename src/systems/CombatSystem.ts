import { PLAYER_CONFIG } from '../config/gameConfig';
import { LEGENDARY_EFFECTS } from '../data/legendaryEffects';
import {
  MELEE_STRIKE_SLACK,
  type Monster,
  type MonsterHooks,
} from '../entities/Monster';
import type { Player } from '../entities/Player';
import { inAttackArc, rollDamage } from './combatMath';
import type { CollisionSystem } from './CollisionSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { Rng } from './rng';

/** Things the rest of the game wants to react to (floating numbers, HUD, kill counts). */
export interface CombatEvents {
  /** The player hurt a monster. (x, y) is where to show the number. */
  damageDealt(x: number, y: number, amount: number, crit: boolean): void;
  /** The player took damage after armor. */
  damageTaken(x: number, y: number, amount: number): void;
  /** Fired once per kill, after on-kill legendary effects were applied. */
  monsterKilled(monster: Monster): void;
  playerDied(): void;
  /** The player regained health (show a green number). */
  healed(x: number, y: number, amount: number): void;
  /** A chain-lightning arc to draw between two world points. */
  lightningArc(ax: number, ay: number, bx: number, by: number): void;
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
    private readonly collision: CollisionSystem,
    private readonly rng: Rng,
    private readonly events: CombatEvents,
  ) {}

  /** The strike moment of a player swing: hits every living monster inside the swing arc. */
  playerSwingHit(dirX: number, dirY: number): void {
    const { stats, pos } = this.player;
    let firstHit: Monster | null = null;
    for (const m of this.monsters()) {
      if (m.isDead) continue;
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
      const roll = rollDamage(stats.damage, stats.critChance, stats.critDamage, this.rng);
      this.damageMonster(m, roll.amount, roll.crit);
    }
    // Legendary: one roll per swing that connected.
    if (firstHit && this.player.hasEffect('chainLightning') && this.rng() < LEGENDARY_EFFECTS.chainLightning.chance) {
      this.chainLightning(firstHit);
    }
  }

  meleeStrike(monster: Monster): void {
    if (this.player.isDead) return;
    if (monster.reachTo(this.player) > monster.def.attackRange + MELEE_STRIKE_SLACK) return;
    this.hurtPlayer(monster.def.damage);
  }

  fireProjectile(monster: Monster, dirX: number, dirY: number): void {
    this.projectiles.fire(
      monster.pos.x + dirX * MUZZLE_OFFSET,
      monster.pos.y + dirY * MUZZLE_OFFSET,
      dirX,
      dirY,
      monster.def.projectileSpeed ?? 6,
      monster.def.damage,
    );
  }

  /** Moves projectiles and applies the ones that reached the player. */
  update(dt: number): void {
    this.projectiles.update(dt, this.collision, this.player, (p) => this.hurtPlayer(p.damage));
  }

  /** Applies final damage to a monster, reports it, and handles the kill. */
  private damageMonster(m: Monster, amount: number, crit: boolean): void {
    const killed = m.takeDamage(amount);
    this.events.damageDealt(m.pos.x, m.pos.y, amount, crit);
    if (killed) this.registerKill(m);
  }

  /** On-kill legendary effects first, then the kill is announced (so a heal shows before loot spawns). */
  private registerKill(m: Monster): void {
    const cfg = LEGENDARY_EFFECTS;
    if (this.player.hasEffect('lifeOnKill')) {
      const heal = Math.max(cfg.lifeOnKill.minHeal, Math.round(this.player.stats.maxHp * cfg.lifeOnKill.healRatio));
      const restored = this.player.heal(heal);
      if (restored > 0) this.events.healed(this.player.pos.x, this.player.pos.y, Math.round(restored));
    }
    if (this.player.hasEffect('killFrenzy')) {
      this.player.buffs.hasteAttack(cfg.killFrenzy.duration, cfg.killFrenzy.attackSpeedBonus);
    }
    this.events.monsterKilled(m);
  }

  /** Jumps from `source` to the nearest unhit living monster, up to maxTargets times. */
  private chainLightning(source: Monster): void {
    const cfg = LEGENDARY_EFFECTS.chainLightning;
    const damage = Math.max(1, Math.round(this.player.stats.damage * cfg.damageRatio));
    const struck = new Set<Monster>([source]);
    this.events.lightningArc(this.player.pos.x, this.player.pos.y, source.pos.x, source.pos.y);
    let from = source;
    for (let i = 0; i < cfg.maxTargets; i++) {
      let best: Monster | null = null;
      let bestDist: number = cfg.range;
      for (const m of this.monsters()) {
        if (m.isDead || struck.has(m)) continue;
        const d = Math.hypot(m.pos.x - from.pos.x, m.pos.y - from.pos.y);
        if (d <= bestDist) {
          best = m;
          bestDist = d;
        }
      }
      if (!best) break;
      struck.add(best);
      this.events.lightningArc(from.pos.x, from.pos.y, best.pos.x, best.pos.y);
      this.damageMonster(best, damage, false);
      from = best;
    }
  }

  private hurtPlayer(rawDamage: number): void {
    const result = this.player.takeDamage(rawDamage);
    if (result.amount === 0) return;
    this.events.damageTaken(this.player.pos.x, this.player.pos.y, result.amount);
    if (result.died) this.events.playerDied();
  }
}
