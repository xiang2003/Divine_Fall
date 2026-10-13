import type { EliteAffixId } from '../data/eliteAffixes';
import { ELITE_XP_MULT } from '../data/progression';
import type { LootTableId } from '../data/lootTables';
import type { BossAttackKind, MonsterDef } from '../data/monsters';
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
  kind: 'melee' | 'projectile' | BossAttackKind;
  duration: number;
  hitFraction: number;
  damageMult: number;
  radius: number;
  count: number;
  spread: number;
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
        this.updateAttack(dt, target, hooks);
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
      if (reach > this.def.attackRange * 0.9 || !sees) {
        this.moveToward(target.pos.x, target.pos.y, this.moveSpeed, dt, collision, true);
      }
      return;
    }

    // melee
    if (reach <= this.def.attackRange && this.attack.canStart) {
      this.beginAttack(this.standardAttack('melee'), target, hooks);
      return;
    }
    if (reach > this.def.attackRange * 0.9) {
      this.moveToward(target.pos.x, target.pos.y, this.moveSpeed, dt, collision, true);
    }
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

  private updateAttack(dt: number, target: MonsterTarget, hooks: MonsterHooks): void {
    const spec = this.currentAttack;
    const { hit, finished } = this.attack.update(dt);
    if (hit && spec) this.strike(spec, target, hooks);
    if (finished) this.enter(target.isDead ? 'idle' : 'chase');
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
      case 'cleave':
        hooks.meleeStrike(this, spec.damageMult);
        break;
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
