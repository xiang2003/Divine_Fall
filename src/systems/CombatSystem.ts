import { PLAYER_CONFIG } from '../config/gameConfig';
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
  monsterKilled(monster: Monster): void;
  playerDied(): void;
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
      const roll = rollDamage(stats.damage, stats.critChance, stats.critDamage, this.rng);
      const killed = m.takeDamage(roll.amount);
      this.events.damageDealt(m.pos.x, m.pos.y, roll.amount, roll.crit);
      if (killed) this.events.monsterKilled(m);
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

  private hurtPlayer(rawDamage: number): void {
    const result = this.player.takeDamage(rawDamage);
    if (result.amount === 0) return;
    this.events.damageTaken(this.player.pos.x, this.player.pos.y, result.amount);
    if (result.died) this.events.playerDied();
  }
}
