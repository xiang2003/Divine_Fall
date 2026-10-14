import type { EliteAffixId } from '../data/eliteAffixes';
import { ELITE_XP_MULT } from '../data/progression';
import type { LootTableId } from '../data/lootTables';
import type { BossAttackKind, MonsterDef, SlamDef } from '../data/monsters';
import type { Vec2 } from '../game/iso';
import { AttackTimer } from '../systems/AttackTimer';
import { chooseBossAttack, phaseForHpRatio } from '../systems/bossAI';
import type { CollisionSystem } from '../systems/CollisionSystem';
import { computeMonsterStats, type MonsterStats } from '../systems/elite';
import { defaultRng, type Rng } from '../systems/rng';

export type MonsterState = 'idle' | 'chase' | 'attack' | 'hurt' | 'dead';

/** What a monster needs to know about the thing it is hunting (the player). */
export interface MonsterTarget {
  readonly pos: Vec2;
  readonly radius: number;
  readonly isDead: boolean;
}

/** Side effects of a monster's attack, implemented by the combat system. */
export interface MonsterHooks {
  /** Strike frame of a melee attack. The hook decides whether it connects. `damageMult` scales the monster's damage. */
  meleeStrike(monster: Monster, damageMult: number): void;
  /** Strike frame of a ranged attack: spawn a projectile along (dirX, dirY). */
  fireProjectile(monster: Monster, dirX: number, dirY: number, damageMult: number): void;
  /** Strike frame of a ground blast centred on the monster: hurts the target if it is within `radius`. */
  novaStrike(monster: Monster, radius: number, damageMult: number): void;
  /** The start of a blast windup: show a warning of `radius` for `duration` seconds. */
  telegraph(monster: Monster, radius: number, duration: number): void;
  /** A boss crossed into a new phase (1 = second phase, ...). */
  phaseChanged(monster: Monster, phase: number): void;
}

/** What one attack looks like right now (normal attacks and boss moves alike). */
interface AttackSpec {
  kind: 'melee' | 'projectile' | 'pounce' | BossAttackKind;
  duration: number;
  hitFraction: number;
  damageMult: number;
  radius: number;
  count: number;
  spread: number;
  /** charge: distance of the rush in world units. */
  rush?: number;
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

/** A pounce: the fraction of the move at which the springing starts and at which the bite lands, and how much farther than the bite reach it must be. */
export const POUNCE_LEAP_START = 0.35;
export const POUNCE_HIT_FRACTION = 0.7;
const POUNCE_MIN_GAP = 0.15;

/** A charge: the windup ends and the rush starts here, and the rush is over here (fractions of the move). */
export const CHARGE_START = 0.35;
export const CHARGE_END = 0.8;

/** A circling monster turns the other way round every this many seconds. */
const STRAFE_TURN = 1.6;

const STUCK_TIMEOUT = 1;
const HOME_ARRIVE = 0.3;
const HOME_SPEED_FACTOR = 0.6;

let nextId = 1;

export interface MonsterOptions {
  /** Elite affixes. A non-empty list makes the monster an elite. */
  affixes?: readonly EliteAffixId[];
  /** Random source for boss attack choice (inject a seeded one in tests). */
  rng?: Rng;
}

/**
 * One enemy. Pure game logic (no rendering): a five-state machine
 * idle -> chase -> attack, with hurt (stagger) and dead. Stats come from its MonsterDef, scaled up for elites;
 * a boss additionally changes phase as it loses health and chooses between several attacks.
 */
export class Monster {
  readonly id = nextId++;
  readonly pos: Vec2;
  readonly home: Vec2;
  readonly affixes: readonly EliteAffixId[];
  /** Effective stats (base definition plus elite bonuses). */
  readonly stats: MonsterStats;
  hp: number;
  state: MonsterState = 'idle';
  /** Seconds spent in the current state. */
  stateTime = 0;
  /** True on ticks where the monster actually moved; drives the walk animation. */
  moving = false;
  /** Horizontal facing in screen space: +1 right, -1 left. */
  facing: 1 | -1 = 1;
  /** Which way it looks in world space (unit-ish vector; directional art picks front, right, back or left from it). */
  readonly facingDir: Vec2 = { x: 1, y: 1 };
  /** True once it has noticed the player (used to show the boss health bar). */
  engaged = false;
  /** Boss phase, 0-based. Always 0 for non-bosses. */
  phase = 0;

  private readonly attack = new AttackTimer();
  private readonly rng: Rng;
  private currentAttack: AttackSpec | null = null;
  private announcedPhase = 0;
  private sinceHurt = Infinity;
  /** How long the current 'hurt' state lasts (longer when stunned). */
  private hurtDuration = HURT_DURATION;
  private lostSightTime = 0;
  private stuckTime = 0;
  /** A pounce or charge in progress: the direction of the leap, fixed at the moment it springs. */
  private leapDir: Vec2 | null = null;
  /** True once a charge in progress has hit (it hurts once per rush). */
  private chargeHit = false;
  /** Seconds spent trying to move, for hopping monsters (they only travel while airborne). */
  private hopClock = 0;

  constructor(
    readonly def: MonsterDef,
    spawn: Vec2,
    options: MonsterOptions = {},
  ) {
    this.pos = { x: spawn.x, y: spawn.y };
    this.home = { x: spawn.x, y: spawn.y };
    this.affixes = options.affixes ?? [];
    this.rng = options.rng ?? defaultRng;
    this.stats = computeMonsterStats(def, this.affixes);
    this.hp = this.stats.maxHp;
  }

  get isDead(): boolean {
    return this.state === 'dead';
  }
  get radius(): number {
    return this.def.radius;
  }
  get isElite(): boolean {
    return this.affixes.length > 0;
  }
  get isBoss(): boolean {
    return this.def.isBoss === true;
  }
  get maxHp(): number {
    return this.stats.maxHp;
  }
  /** Base damage per hit (elite bonuses included, armor not yet applied). */
  get damage(): number {
    return this.stats.damage;
  }
  get scale(): number {
    return this.stats.scale;
  }
  /** Experience granted when this monster dies. */
  get xpReward(): number {
    return this.isElite ? Math.round(this.def.xp * ELITE_XP_MULT) : this.def.xp;
  }
  get lootTable(): LootTableId {
    return this.isElite ? 'elite' : this.def.lootTable;
  }
  get removable(): boolean {
    return this.state === 'dead' && this.stateTime >= CORPSE_LIFETIME;
  }
  get moveSpeed(): number {
    return this.stats.moveSpeed * (this.def.phaseSpeed?.[this.phase] ?? 1);
  }
  /** Seconds between the start of one attack and the next (faster in later boss phases). */
  get attackCooldown(): number {
    return this.stats.attackCooldown * (this.def.phaseCooldown?.[this.phase] ?? 1);
  }
  /** Where a hopping monster is in its hop (0 to 1; the last part of the cycle is the flight). 0 for monsters that do not hop. */
  get hopPhase(): number {
    const hop = this.def.hop;
    return hop ? (this.hopClock % hop.period) / hop.period : 0;
  }
  /** Length of the attack in progress, or of a standard attack when idle (used to fit the animation). */
  get attackDuration(): number {
    return this.currentAttack?.duration ?? this.stats.attackDuration;
  }

  /** Staggers the monster for `seconds`, cancelling any attack. Bosses cannot be staggered. */
  stun(seconds: number): boolean {
    if (this.state === 'dead' || this.isBoss) return false;
    this.attack.cancel();
    this.sinceHurt = 0;
    this.hurtDuration = seconds;
    this.enter('hurt');
    return true;
  }

  /** Restores health up to the maximum. Returns the amount actually restored. */
  heal(amount: number): number {
    if (this.state === 'dead') return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
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
    if (this.def.phaseThresholds) {
      this.phase = Math.max(this.phase, phaseForHpRatio(this.hp / this.maxHp, this.def.phaseThresholds));
    }
    if (this.isBoss) {
      // Super armor: a boss is never staggered; it just turns on whoever hurts it.
      if (this.state === 'idle') this.enter('chase');
      return false;
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
    if (this.phase !== this.announcedPhase) {
      this.announcedPhase = this.phase;
      hooks.phaseChanged(this, this.phase);
    }
    // The attack cooldown keeps running in every state; during 'attack' the timer is advanced by updateAttack.
    if (this.state !== 'attack') this.attack.update(dt);

    switch (this.state) {
      case 'hurt':
        if (this.stateTime >= this.hurtDuration) this.enter(target.isDead ? 'idle' : 'chase');
        break;
      case 'attack':
        this.updateAttack(dt, target, collision, hooks);
        break;
      case 'idle':
        this.updateIdle(dt, target, collision);
        break;
      case 'chase':
        this.updateChase(dt, target, collision, hooks);
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
    if (state === 'chase') this.engaged = true;
    if (state !== 'attack') this.currentAttack = null;
    this.leapDir = null;
    this.chargeHit = false;
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
      this.moveToward(this.home.x, this.home.y, this.moveSpeed * HOME_SPEED_FACTOR, dt, collision, false);
    }
  }

  private updateChase(dt: number, target: MonsterTarget, collision: CollisionSystem, hooks: MonsterHooks): void {
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

    if (this.def.bossAttacks) {
      this.chaseAsBoss(dt, target, collision, hooks, { reach, dist, sees });
      return;
    }

    if (this.def.behavior === 'ranged') {
      const keep = this.def.keepDistance ?? 0;
      if (reach < keep) {
        // Too close: back away from the player.
        this.moveToward(
          this.pos.x - (target.pos.x - this.pos.x),
          this.pos.y - (target.pos.y - this.pos.y),
          this.moveSpeed,
          dt,
          collision,
          true,
        );
        return;
      }
      if (reach <= this.def.attackRange && sees && this.attack.canStart) {
        this.beginAttack(this.standardAttack('projectile'), target, hooks);
        return;
      }
      if (this.def.strafe && sees && reach <= this.def.attackRange) {
        this.strafeAround(target, dt, collision);
        return;
      }
      if (reach > this.def.attackRange * 0.9 || !sees) {
        this.moveToward(target.pos.x, target.pos.y, this.moveSpeed, dt, collision, true);
      }
      return;
    }

    // melee: a pouncing monster springs from a few steps away, and bites when it is already close
    const pounce = this.def.pounce;
    if (pounce && sees && reach <= pounce.range && reach > this.def.attackRange + POUNCE_MIN_GAP && this.attack.canStart) {
      this.beginAttack(
        {
          kind: 'pounce',
          duration: pounce.duration,
          hitFraction: POUNCE_HIT_FRACTION,
          damageMult: pounce.damageMult,
          radius: 0,
          count: 1,
          spread: 0,
        },
        target,
        hooks,
      );
      return;
    }
    if (reach <= this.def.attackRange && this.attack.canStart) {
      this.beginAttack(this.def.slam ? this.slamAttack(this.def.slam) : this.standardAttack('melee'), target, hooks);
      return;
    }
    if (reach > this.def.attackRange * 0.9) {
      this.moveToward(target.pos.x, target.pos.y, this.moveSpeed, dt, collision, true);
    }
  }

  /** Keeps its distance by circling: sideways to the target, drifting in or out to stay in the middle of its range. */
  private strafeAround(target: MonsterTarget, dt: number, collision: CollisionSystem): void {
    const dx = target.pos.x - this.pos.x;
    const dy = target.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const turn = (Math.floor(this.stateTime / STRAFE_TURN) + this.id) % 2 === 0 ? 1 : -1;
    const mid = ((this.def.keepDistance ?? 0) + this.def.attackRange) / 2;
    const radial = Math.max(-1, Math.min(1, (this.reachTo(target) - mid) * 0.4));
    const dirX = -uy * turn + ux * radial;
    const dirY = ux * turn + uy * radial;
    this.moveToward(this.pos.x + dirX * 2, this.pos.y + dirY * 2, this.moveSpeed, dt, collision, false);
    this.face(dx, dy); // it keeps looking at the target while it circles
  }

  private slamAttack(slam: SlamDef): AttackSpec {
    return { kind: 'nova', duration: slam.duration, hitFraction: slam.hitFraction, damageMult: slam.damageMult, radius: slam.radius, count: 1, spread: 0 };
  }

  /** A boss picks from its repertoire whenever it is ready; otherwise it closes the distance. */
  private chaseAsBoss(
    dt: number,
    target: MonsterTarget,
    collision: CollisionSystem,
    hooks: MonsterHooks,
    ctx: { reach: number; dist: number; sees: boolean },
  ): void {
    if (this.attack.canStart) {
      const choice = chooseBossAttack(
        this.def.bossAttacks!,
        this.phase,
        { ...ctx, meleeRange: this.def.attackRange },
        this.rng,
      );
      if (choice) {
        this.beginAttack(
          {
            kind: choice.kind,
            duration: choice.duration,
            hitFraction: choice.hitFraction ?? MONSTER_HIT_FRACTION,
            damageMult: choice.damageMult,
            radius: choice.radius ?? 0,
            count: choice.count ?? 1,
            spread: choice.spread ?? 0,
            rush: choice.rush,
          },
          target,
          hooks,
        );
        return;
      }
    }
    // Keep pressing in until something is in range (and stand still while waiting out a cooldown up close).
    if (ctx.reach > this.def.attackRange * 0.9) {
      this.moveToward(target.pos.x, target.pos.y, this.moveSpeed, dt, collision, true);
    }
  }

  private standardAttack(kind: 'melee' | 'projectile'): AttackSpec {
    return {
      kind,
      duration: this.stats.attackDuration,
      hitFraction: MONSTER_HIT_FRACTION,
      damageMult: 1,
      radius: 0,
      count: 1,
      spread: 0,
    };
  }

  private beginAttack(spec: AttackSpec, target: MonsterTarget, hooks: MonsterHooks): void {
    this.attack.start(spec.duration, Math.max(this.attackCooldown, spec.duration), spec.hitFraction);
    this.enter('attack');
    this.currentAttack = spec;
    if (spec.kind === 'nova') hooks.telegraph(this, spec.radius, spec.duration * spec.hitFraction);
    this.face(target.pos.x - this.pos.x, target.pos.y - this.pos.y);
  }

  private updateAttack(dt: number, target: MonsterTarget, collision: CollisionSystem, hooks: MonsterHooks): void {
    const spec = this.currentAttack;
    if (spec?.kind === 'pounce') this.leap(spec, dt, target, collision);
    if (spec?.kind === 'charge') this.rush(spec, dt, target, collision, hooks);
    const { hit, finished } = this.attack.update(dt);
    if (hit && spec) this.strike(spec, target, hooks);
    if (finished) this.enter(target.isDead ? 'idle' : 'chase');
  }

  /**
   * The leap of a pounce: stands crouched for the first part of the move, then springs along the line to where the target
   * stood when it sprang (so a dodge or a step aside makes it land short), then stands still while it lands.
   */
  private leap(spec: AttackSpec, dt: number, target: MonsterTarget, collision: CollisionSystem): void {
    const pounce = this.def.pounce;
    if (!pounce) return;
    const progress = this.stateTime / spec.duration;
    if (progress < POUNCE_LEAP_START || progress >= POUNCE_HIT_FRACTION) return;
    if (!this.leapDir) {
      const dx = target.pos.x - this.pos.x;
      const dy = target.pos.y - this.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      this.leapDir = { x: dx / len, y: dy / len };
      this.face(dx, dy);
    }
    const step = pounce.speed * dt;
    collision.moveCircle(this.pos, this.def.radius, this.leapDir.x * step, this.leapDir.y * step);
    this.moving = true;
  }

  /**
   * The rush of a charge: stands still for the windup, then runs along the line to where the target stood when it set off (so
   * a step aside or a dodge makes it miss), hurting the target once if it runs into it, then comes to a stop.
   */
  private rush(spec: AttackSpec, dt: number, target: MonsterTarget, collision: CollisionSystem, hooks: MonsterHooks): void {
    const progress = this.stateTime / spec.duration;
    if (progress < CHARGE_START || progress >= CHARGE_END) return;
    if (!this.leapDir) {
      const dx = target.pos.x - this.pos.x;
      const dy = target.pos.y - this.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      this.leapDir = { x: dx / len, y: dy / len };
      this.face(dx, dy);
    }
    const speed = (spec.rush ?? 6) / ((CHARGE_END - CHARGE_START) * spec.duration);
    const step = speed * dt;
    collision.moveCircle(this.pos, this.def.radius, this.leapDir.x * step, this.leapDir.y * step);
    this.moving = true;
    if (!this.chargeHit && !target.isDead && this.reachTo(target) <= this.def.attackRange + MELEE_STRIKE_SLACK * 0.5) {
      this.chargeHit = true;
      hooks.meleeStrike(this, spec.damageMult);
    }
  }

  /** The moment an attack lands. */
  private strike(spec: AttackSpec, target: MonsterTarget, hooks: MonsterHooks): void {
    if (spec.kind === 'nova') {
      hooks.novaStrike(this, spec.radius, spec.damageMult); // a blast does not need a living target to go off
      return;
    }
    if (target.isDead) return;
    const dx = target.pos.x - this.pos.x;
    const dy = target.pos.y - this.pos.y;
    this.face(dx, dy);
    const len = Math.hypot(dx, dy) || 1;
    switch (spec.kind) {
      case 'melee':
      case 'pounce':
      case 'cleave':
        hooks.meleeStrike(this, spec.damageMult);
        break;
      case 'charge':
        break; // a charge hurts on contact, while it runs (see rush)
      case 'projectile':
        hooks.fireProjectile(this, dx / len, dy / len, spec.damageMult);
        break;
      case 'fan': {
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < spec.count; i++) {
          const angle = base + (i - (spec.count - 1) / 2) * spec.spread;
          hooks.fireProjectile(this, Math.cos(angle), Math.sin(angle), spec.damageMult);
        }
        break;
      }
    }
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
    const hop = this.def.hop;
    if (hop) {
      // a hopper only travels in the air: the rest of the cycle it crouches, then the flight covers the whole stretch
      this.hopClock += dt;
      const inAir = this.hopClock % hop.period >= hop.period * (1 - hop.air);
      speed = inAir ? speed / hop.air : 0;
      if (speed === 0) {
        this.moving = true; // still "walking" for the animation
        this.face(dx, dy);
        return;
      }
    }
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
    if (Math.abs(worldDx) + Math.abs(worldDy) > 1e-6) {
      const len = Math.hypot(worldDx, worldDy);
      this.facingDir.x = worldDx / len;
      this.facingDir.y = worldDy / len;
    }
    const screenX = worldDx - worldDy;
    if (Math.abs(screenX) > 1e-3) this.facing = screenX < 0 ? -1 : 1;
  }
}
