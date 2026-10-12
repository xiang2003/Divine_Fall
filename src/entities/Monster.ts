import type { MonsterDef } from '../data/monsters';
import type { Vec2 } from '../game/iso';
import { AttackTimer } from '../systems/AttackTimer';
import type { CollisionSystem } from '../systems/CollisionSystem';

export type MonsterState = 'idle' | 'chase' | 'attack' | 'hurt' | 'dead';

/** What a monster needs to know about the thing it is hunting (the player). */
export interface MonsterTarget {
  readonly pos: Vec2;
  readonly radius: number;
  readonly isDead: boolean;
}

/** Side effects of a monster's attack, implemented by the combat system. */
export interface MonsterHooks {
  /** Strike frame of a melee attack. The hook decides whether it connects. */
  meleeStrike(monster: Monster): void;
  /** Strike frame of a ranged attack: spawn a projectile along (dirX, dirY). */
  fireProjectile(monster: Monster, dirX: number, dirY: number): void;
}

/** Fraction of the attack animation at which the blow lands. */
export const MONSTER_HIT_FRACTION = 0.55;
/** Stagger (hurt) duration in seconds. */
export const HURT_DURATION = 0.25;
/** Minimum time between two staggers, so a flurry of hits can't stun-lock a monster. */
export const HURT_POISE_INTERVAL = 0.5;
/** Seconds without line of sight before a chasing monster gives up. */
export const LOSE_SIGHT_TIME = 2;
/** Gives up if the target runs farther than detectRange * this. */
export const LEASH_FACTOR = 2;
/** Seconds a corpse stays before it can be removed. */
export const CORPSE_LIFETIME = 4;
/** Extra reach allowed at the moment of a melee strike, so a step back doesn't dodge a blow already in flight. */
export const MELEE_STRIKE_SLACK = 0.35;

const STUCK_TIMEOUT = 1;
const HOME_ARRIVE = 0.3;
const HOME_SPEED_FACTOR = 0.6;

let nextId = 1;

/**
 * One enemy. Pure game logic (no rendering): a five-state machine
 * idle -> chase -> attack, with hurt (stagger) and dead. Stats come from its MonsterDef.
 */
export class Monster {
  readonly id = nextId++;
  readonly pos: Vec2;
  readonly home: Vec2;
  hp: number;
  state: MonsterState = 'idle';
  /** Seconds spent in the current state. */
  stateTime = 0;
  /** True on ticks where the monster actually moved; drives the walk animation. */
  moving = false;
  /** Horizontal facing in screen space: +1 right, -1 left. */
  facing: 1 | -1 = 1;

  private readonly attack = new AttackTimer();
  private sinceHurt = Infinity;
  /** How long the current 'hurt' state lasts (longer when stunned). */
  private hurtDuration = HURT_DURATION;
  private lostSightTime = 0;
  private stuckTime = 0;

  constructor(
    readonly def: MonsterDef,
    spawn: Vec2,
  ) {
    this.pos = { x: spawn.x, y: spawn.y };
    this.home = { x: spawn.x, y: spawn.y };
    this.hp = def.maxHp;
  }

  get isDead(): boolean {
    return this.state === 'dead';
  }
  get radius(): number {
    return this.def.radius;
  }
  get removable(): boolean {
    return this.state === 'dead' && this.stateTime >= CORPSE_LIFETIME;
  }

  /** Staggers the monster for `seconds`, cancelling any attack. Returns false if it is dead. */
  stun(seconds: number): boolean {
    if (this.state === 'dead') return false;
    this.attack.cancel();
    this.sinceHurt = 0;
    this.hurtDuration = seconds;
    this.enter('hurt');
    return true;
  }

  /** Applies already-final damage. Returns true if this hit killed the monster. */
  takeDamage(amount: number): boolean {
    if (this.state === 'dead') return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.enter('dead');
      this.attack.cancel();
      this.moving = false;
      return true;
    }
    if (this.sinceHurt >= HURT_POISE_INTERVAL) {
      this.sinceHurt = 0;
      this.attack.cancel();
      this.hurtDuration = HURT_DURATION;
      this.enter('hurt');
    } else if (this.state === 'idle') {
      this.enter('chase'); // being hit always draws aggro
    }
    return false;
  }

  update(dt: number, target: MonsterTarget, collision: CollisionSystem, hooks: MonsterHooks): void {
    this.stateTime += dt;
    this.moving = false;
    if (this.state === 'dead') return;
    this.sinceHurt += dt;
    // The attack cooldown keeps running in every state; during 'attack' the timer is advanced by updateAttack.
    if (this.state !== 'attack') this.attack.update(dt);

    switch (this.state) {
      case 'hurt':
        if (this.stateTime >= this.hurtDuration) this.enter(target.isDead ? 'idle' : 'chase');
        break;
      case 'attack':
        this.updateAttack(dt, target, hooks);
        break;
      case 'idle':
        this.updateIdle(dt, target, collision);
        break;
      case 'chase':
        this.updateChase(dt, target, collision);
        break;
    }
  }

  /** Edge-to-edge distance to the target (negative when overlapping). */
  reachTo(target: MonsterTarget): number {
    return Math.hypot(target.pos.x - this.pos.x, target.pos.y - this.pos.y) - target.radius - this.def.radius;
  }

  private enter(state: MonsterState): void {
    this.state = state;
    this.stateTime = 0;
    this.stuckTime = 0;
    this.lostSightTime = 0;
  }

  private updateIdle(dt: number, target: MonsterTarget, collision: CollisionSystem): void {
    if (!target.isDead) {
      const dist = Math.hypot(target.pos.x - this.pos.x, target.pos.y - this.pos.y);
      if (
        dist <= this.def.detectRange &&
        collision.hasLineOfSight(this.pos.x, this.pos.y, target.pos.x, target.pos.y)
      ) {
        this.enter('chase');
        return;
      }
    }
    // Drift back to the spawn point after losing the player.
    if (Math.hypot(this.home.x - this.pos.x, this.home.y - this.pos.y) > HOME_ARRIVE) {
      this.moveToward(this.home.x, this.home.y, this.def.moveSpeed * HOME_SPEED_FACTOR, dt, collision, false);
    }
  }

  private updateChase(dt: number, target: MonsterTarget, collision: CollisionSystem): void {
    if (target.isDead) {
      this.enter('idle');
      return;
    }
    const dist = Math.hypot(target.pos.x - this.pos.x, target.pos.y - this.pos.y);
    const sees = collision.hasLineOfSight(this.pos.x, this.pos.y, target.pos.x, target.pos.y);
    this.lostSightTime = sees ? 0 : this.lostSightTime + dt;
    if (this.lostSightTime > LOSE_SIGHT_TIME || dist > this.def.detectRange * LEASH_FACTOR) {
      this.enter('idle');
      return;
    }

    const reach = this.reachTo(target);
    this.face(target.pos.x - this.pos.x, target.pos.y - this.pos.y);

    if (this.def.behavior === 'ranged') {
      const keep = this.def.keepDistance ?? 0;
      if (reach < keep) {
        // Too close: back away from the player.
        this.moveToward(
          this.pos.x - (target.pos.x - this.pos.x),
          this.pos.y - (target.pos.y - this.pos.y),
          this.def.moveSpeed,
          dt,
          collision,
          true,
        );
        return;
      }
      if (reach <= this.def.attackRange && sees && this.attack.canStart) {
        this.beginAttack();
        return;
      }
      if (reach > this.def.attackRange * 0.9 || !sees) {
        this.moveToward(target.pos.x, target.pos.y, this.def.moveSpeed, dt, collision, true);
      }
      return;
    }

    // melee
    if (reach <= this.def.attackRange && this.attack.canStart) {
      this.beginAttack();
      return;
    }
    if (reach > this.def.attackRange * 0.9) {
      this.moveToward(target.pos.x, target.pos.y, this.def.moveSpeed, dt, collision, true);
    }
  }

  private beginAttack(): void {
    this.attack.start(this.def.attackDuration, this.def.attackCooldown, MONSTER_HIT_FRACTION);
    this.enter('attack');
  }

  private updateAttack(dt: number, target: MonsterTarget, hooks: MonsterHooks): void {
    const { hit, finished } = this.attack.update(dt);
    if (hit && !target.isDead) {
      const dx = target.pos.x - this.pos.x;
      const dy = target.pos.y - this.pos.y;
      this.face(dx, dy);
      if (this.def.behavior === 'ranged') {
        const len = Math.hypot(dx, dy) || 1;
        hooks.fireProjectile(this, dx / len, dy / len);
      } else {
        hooks.meleeStrike(this);
      }
    }
    if (finished) this.enter(target.isDead ? 'idle' : 'chase');
  }

  private moveToward(
    tx: number,
    ty: number,
    speed: number,
    dt: number,
    collision: CollisionSystem,
    trackStuck: boolean,
  ): void {
    const dx = tx - this.pos.x;
    const dy = ty - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return;
    const step = Math.min(speed * dt, dist);
    const bx = this.pos.x;
    const by = this.pos.y;
    collision.moveCircle(this.pos, this.def.radius, (dx / dist) * step, (dy / dist) * step);
    const moved = Math.hypot(this.pos.x - bx, this.pos.y - by);
    this.moving = moved > 1e-4;
    this.face(dx, dy);
    if (!trackStuck) return;
    if (moved < step * 0.3) {
      this.stuckTime += dt;
      if (this.stuckTime >= STUCK_TIMEOUT) this.enter('idle'); // wedged against geometry: give up and head home
    } else {
      this.stuckTime = 0;
    }
  }

  private face(worldDx: number, worldDy: number): void {
    const screenX = worldDx - worldDy;
    if (Math.abs(screenX) > 1e-3) this.facing = screenX < 0 ? -1 : 1;
  }
}
