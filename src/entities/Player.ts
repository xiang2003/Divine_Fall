import * as THREE from 'three';
import { DODGE_CONFIG, PLAYER_CONFIG } from '../config/gameConfig';
import { LEGENDARY_EFFECTS, type LegendaryEffectId } from '../data/legendaryEffects';
import type { PotionDef } from '../data/potions';
import { NO_UPGRADE, type SkillDef, type SkillUpgrade } from '../data/skills';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import { DirectionalAnimator } from '../game/DirectionalAnimator';
import { AttackTimer } from '../systems/AttackTimer';
import { Buffs, DodgeController } from '../systems/buffs';
import { StatusSet } from '../systems/status';
import type { DamageType } from '../data/damageTypes';
import { normalizeInto } from '../systems/combatMath';
import { baselineDamage, resolveHit, type Defense } from '../systems/damage';
import type { CollisionSystem } from '../systems/CollisionSystem';
import { ClickMover } from '../systems/movement';
import { PotionBelt } from '../systems/potions';
import { getSkillStats, SkillCooldowns, type SkillStats } from '../systems/skills';
import type { PlayerStats } from '../systems/stats';

/** Seconds the "hurt" pose shows after a hit (only while standing still). */
const HURT_FLASH = 0.2;

export interface PlayerHooks {
  /** A swing began; (dirX, dirY) is the unit aim direction, `duration` the swing length in seconds. */
  swingStarted?(dirX: number, dirY: number, duration: number): void;
  /** The strike moment of the swing. The combat system resolves who got hit. */
  swingHit?(dirX: number, dirY: number): void;
  /** The effect moment of a skill cast. aimX / aimY is the world point the cursor was on when the cast began. */
  skillCast?(def: SkillDef, stats: SkillStats, dirX: number, dirY: number, aimX: number, aimY: number): void;
}

interface ActiveSkill {
  def: SkillDef;
  stats: SkillStats;
  aimX: number;
  aimY: number;
}

export class Player {
  /** Foot position in world units. */
  readonly pos: Vec2;
  readonly radius = PLAYER_CONFIG.radius;
  readonly group = new THREE.Group();
  readonly mover = new ClickMover();
  readonly dodge = new DodgeController();
  readonly buffs = new Buffs();
  readonly cooldowns = new SkillCooldowns();
  /** Earned skill enhancements by skill id. Empty until the progression system (Phase 5) fills it. */
  readonly skillUpgrades: Record<string, SkillUpgrade> = {};
  hooks: PlayerHooks = {};

  hp: number;
  readonly maxMana = PLAYER_CONFIG.baseMana;
  mana: number = PLAYER_CONFIG.baseMana;
  readonly potions = new PotionBelt();
  isDead = false;

  private readonly animator: DirectionalAnimator;
  private readonly shadow: THREE.Mesh;
  private readonly attack = new AttackTimer();
  private readonly swingDir: Vec2 = { x: 1, y: 1 };
  private readonly dodgeDir: Vec2 = { x: 1, y: 1 };
  /** True from the start of a dodge until the first tick after its dash (the animator runs at roll speed meanwhile). */
  private rolling = false;
  /** Everything that is on the player: poison, slow (see systems/status.ts). */
  readonly status = new StatusSet();
  private effects: ReadonlySet<LegendaryEffectId> = new Set();
  private activeSkill: ActiveSkill | null = null;
  private hurtTimer = 0;
  private sinceDamaged = Infinity;

  constructor(
    assets: AssetLoader,
    private collision: CollisionSystem,
    spawn: Vec2,
    /** Live stats object; replace its fields (not the reference) when equipment changes. */
    readonly stats: PlayerStats,
  ) {
    this.pos = { x: spawn.x, y: spawn.y };
    this.hp = stats.maxHp;
    this.animator = new DirectionalAnimator(assets, SpriteKey.HERO);
    this.shadow = new THREE.Mesh(assets.sharedGeometry(SpriteKey.SHADOW), assets.material(SpriteKey.SHADOW));
    this.shadow.scale.setScalar(0.62); // the figure is slim: a smaller shadow than the old placeholder's
    this.group.add(this.shadow, this.animator.mesh);
    this.syncVisuals();
  }

  get isSwinging(): boolean {
    return this.attack.swinging;
  }

  /** Replaces the set of active legendary effects (called whenever equipment changes). */
  setEffects(effects: Iterable<LegendaryEffectId>): void {
    this.effects = new Set(effects);
  }

  hasEffect(id: LegendaryEffectId): boolean {
    return this.effects.has(id);
  }

  /** Restores health (capped at max). Returns the amount actually restored. */
  heal(amount: number): number {
    if (this.isDead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    return this.hp - before;
  }

  /** Restores mana (capped at max). Returns the amount actually restored. */
  restoreMana(amount: number): number {
    if (this.isDead) return 0;
    const before = this.mana;
    this.mana = Math.min(this.maxMana, this.mana + amount);
    return this.mana - before;
  }

  /**
   * Drinks the potion in a belt slot, spending one charge. A charge is only spent when the potion does something:
   * drinking a health potion at full health (or a mana potion at full mana) reports "full" and keeps the charge.
   */
  usePotion(index: number): { result: 'used' | 'empty' | 'drained' | 'full' | 'dead'; def: PotionDef | null; restored: number } {
    if (this.isDead) return { result: 'dead', def: null, restored: 0 };
    const held = this.potions.peek(index);
    if (!held) return { result: 'empty', def: null, restored: 0 };
    const full = held.def.restores === 'hp' ? this.hp >= this.stats.maxHp : this.mana >= this.maxMana;
    if (full) return { result: 'full', def: held.def, restored: 0 };
    if (held.charges < 1) return { result: 'drained', def: held.def, restored: 0 };
    this.potions.take(index);
    const restored =
      held.def.restores === 'hp' ? this.heal(Math.round(this.stats.maxHp * held.def.fraction)) : this.restoreMana(Math.round(this.maxMana * held.def.fraction));
    return { result: 'used', def: held.def, restored };
  }

  /** Walk toward a world position (click-to-move). Ignored while dead, mid-swing or dodging. */
  moveTo(x: number, y: number): void {
    if (this.isDead || this.attack.swinging || this.dodge.dashing) return;
    this.mover.setTarget(x, y);
  }

  /**
   * Starts a melee swing toward a world position. Returns false if dead, already swinging or
   * still on cooldown. The swing stops the player in place.
   */
  startAttack(aimX: number, aimY: number): boolean {
    if (this.isDead || this.dodge.dashing || !this.attack.canStart) return false;
    normalizeInto(aimX - this.pos.x, aimY - this.pos.y, this.swingDir, this.swingDir.x, this.swingDir.y);

    const cooldown = 1 / (this.stats.attackSpeed * this.buffs.attackSpeedMultiplier);
    const animLength = this.animator.durationOf('attack');
    // The swing never outlasts the cooldown; at high attack speed the animation is sped up to match.
    const duration = Math.min(animLength, cooldown);
    this.attack.start(duration, cooldown, PLAYER_CONFIG.attackHitFraction);
    this.animator.setSpeed(animLength / duration);
    this.animator.play('attack', true);
    this.mover.stop();
    this.faceWorld(this.swingDir.x, this.swingDir.y);
    this.hooks.swingStarted?.(this.swingDir.x, this.swingDir.y, duration);
    return true;
  }

  /**
   * Casts a skill toward a world point. Fails (changing nothing) if dead, dodging, mid-swing, or the skill is
   * on cooldown. The cast locks the player in place; the effect lands at the hit moment of the cast, and the
   * cooldown starts immediately.
   */
  startSkill(def: SkillDef, aimX: number, aimY: number): boolean {
    if (this.isDead || this.dodge.dashing || this.attack.swinging || !this.cooldowns.ready(def.id)) return false;
    const stats = getSkillStats(def, this.skillUpgrades[def.id] ?? NO_UPGRADE);
    if (!this.attack.start(def.castTime, def.castTime, def.hitFraction, true)) return false;
    this.cooldowns.start(def.id, stats.cooldown);
    this.activeSkill = { def, stats, aimX, aimY };
    normalizeInto(aimX - this.pos.x, aimY - this.pos.y, this.swingDir, this.swingDir.x, this.swingDir.y);
    this.animator.setSpeed(this.animator.durationOf('attack') / def.castTime);
    this.animator.play('attack', true);
    this.mover.stop();
    this.faceWorld(this.swingDir.x, this.swingDir.y);
    return true;
  }

  /**
   * Starts a dodge: a quick dash toward the aim point during which the player cannot be hurt.
   * It interrupts a swing. Returns false if dead, still dashing or on cooldown.
   */
  startDodge(aimX: number, aimY: number): boolean {
    if (this.isDead || !this.dodge.ready) return false;
    this.dodge.start();
    this.rolling = true;
    this.activeSkill = null;
    normalizeInto(aimX - this.pos.x, aimY - this.pos.y, this.dodgeDir, this.swingDir.x, this.swingDir.y);
    this.attack.cancel();
    this.mover.stop();
    this.faceWorld(this.dodgeDir.x, this.dodgeDir.y);
    // one full tumble in exactly the time the dash lasts
    this.animator.setSpeed(this.animator.durationOf('roll') / DODGE_CONFIG.duration);
    this.animator.play('roll', true);
    if (this.effects.has('dodgeHaste')) {
      this.buffs.hasteMove(LEGENDARY_EFFECTS.dodgeHaste.duration, LEGENDARY_EFFECTS.dodgeHaste.speedBonus);
    }
    return true;
  }

  /** What the player's gear defends with: armor against physical damage, a resistance against each other kind. */
  get defense(): Defense {
    // what is on the player counts: a mark makes it take more, armor break takes armor away
    return this.status.defend({ armor: this.stats.armor, resist: this.stats.resist });
  }

  /**
   * Applies a hit of `type` (the player's armor or the resistance for that type is applied here, see systems/damage.ts); armor is measured
   * against the baseline damage of `attackerLevel`, so the same armor holds less against a higher level.
   * Returns the damage actually taken and whether it was fatal.
   */
  takeDamage(rawDamage: number, type: DamageType = 'physical', attackerLevel = 1): { amount: number; died: boolean } {
    if (this.isDead || this.dodge.invulnerable) return { amount: 0, died: false };
    const amount = resolveHit({ damage: { [type]: rawDamage }, referenceDamage: baselineDamage(attackerLevel) }, {}, this.defense).total;
    this.hp = Math.max(0, this.hp - amount);
    this.sinceDamaged = 0;
    this.hurtTimer = HURT_FLASH;
    if (this.hp > 0) return { amount, died: false };
    this.die();
    return { amount, died: true };
  }

  private die(): void {
    this.isDead = true;
    this.activeSkill = null;
    this.attack.cancel();
    this.mover.stop();
    this.status.clear();
    this.animator.setSpeed(1);
    this.animator.play('die', true);
  }

  get isPoisoned(): boolean {
    return this.status.has('poison') && !this.isDead;
  }

  get isSlowed(): boolean {
    return this.status.has('slow') && !this.isDead;
  }

  /** Slows the player to `factor` of its speed for `duration` seconds (a stronger slow replaces a weaker one; the time left never shortens). */
  applySlow(factor: number, duration: number): void {
    if (this.isDead) return;
    this.status.apply({ id: 'slow', magnitude: factor, duration });
  }

  /** Poisons the player (a stronger poison replaces a weaker one; the time left never shortens). */
  applyPoison(dps: number, duration: number): void {
    if (this.isDead) return;
    this.status.apply({ id: 'poison', dps, duration });
  }

  /**
   * Advances every status on the player by `dt` seconds (call it once per frame). Returns the damage of a damage-over-time tick that fell in it
   * (through the player's defense for its type: the corruption resistance works on poison, armor does not; a dodge's invulnerability does not
   * stop what is already in the blood), the kind of damage that did the most, and whether it was fatal, or null when no tick fell.
   */
  tickStatus(dt: number): { amount: number; died: boolean; type: DamageType } | null {
    if (this.isDead) return null;
    const tick = this.status.tick(dt, this.defense);
    if (!tick) return null;
    this.hp = Math.max(0, this.hp - tick.amount);
    this.sinceDamaged = 0; // no regeneration while it burns
    const died = this.hp <= 0;
    if (died) this.die();
    const type = (Object.entries(tick.byType) as [DamageType, number][]).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'corruption';
    return { amount: tick.amount, died, type };
  }

  /**
   * Moves the player into another map: new collision, new position, any swing / skill / dash / walk cancelled.
   * Health, cooldowns and buffs carry over.
   */
  enterMap(collision: CollisionSystem, at: Vec2): void {
    this.collision = collision;
    this.pos.x = at.x;
    this.pos.y = at.y;
    this.attack.reset();
    this.activeSkill = null;
    this.dodge.reset();
    this.mover.stop();
    this.animator.setSpeed(1);
    this.animator.play(this.isDead ? 'die' : 'idle', true);
    this.syncVisuals();
  }

  /** Brings the player back at `spawn` with full health. */
  respawn(spawn: Vec2): void {
    this.pos.x = spawn.x;
    this.pos.y = spawn.y;
    this.hp = this.stats.maxHp;
    this.mana = this.maxMana;
    this.potions.refill();
    this.isDead = false;
    this.hurtTimer = 0;
    this.status.clear();
    this.sinceDamaged = Infinity;
    this.attack.reset();
    this.activeSkill = null;
    this.cooldowns.reset();
    this.dodge.reset();
    this.buffs.clear();
    this.mover.stop();
    this.animator.setSpeed(1);
    this.animator.play('idle', true);
    this.syncVisuals();
  }

  update(dt: number): void {
    if (this.isDead) {
      this.animator.setHurtFlash(false);
      this.animator.update(dt);
      this.syncVisuals();
      return;
    }

    this.sinceDamaged += dt;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.animator.setHurtFlash(this.hurtTimer > 0);
    this.animator.setPoisoned(this.isPoisoned);
    this.animator.setSlowed(this.isSlowed);
    if (this.sinceDamaged > PLAYER_CONFIG.regenDelay && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + PLAYER_CONFIG.regenPerSecond * dt);
    }

    this.buffs.update(dt);
    const dash = this.dodge.update(dt);
    if (dash > 0) {
      const step = this.dodge.speed * dash;
      this.collision.moveCircle(this.pos, this.radius, this.dodgeDir.x * step, this.dodgeDir.y * step);
      this.animator.play('roll');
      this.animator.update(dt);
      this.syncVisuals();
      return;
    }
    if (this.rolling) {
      this.rolling = false;
      this.animator.setSpeed(1);
    }

    this.cooldowns.update(dt);
    const swing = this.attack.update(dt);
    if (swing.hit) {
      const skill = this.activeSkill;
      if (skill) {
        this.hooks.skillCast?.(skill.def, skill.stats, this.swingDir.x, this.swingDir.y, skill.aimX, skill.aimY);
      } else {
        this.hooks.swingHit?.(this.swingDir.x, this.swingDir.y);
      }
    }
    if (swing.finished) {
      this.animator.setSpeed(1);
      this.activeSkill = null;
    }

    let moving = false;
    if (!this.attack.swinging) {
      moving = this.mover.update(
        this.pos,
        dt,
        this.stats.moveSpeed * this.buffs.moveMultiplier * this.status.moveSpeedMultiplier,
        this.radius,
        this.collision,
      );
      if (moving) this.faceWorld(this.mover.direction.x, this.mover.direction.y);
      this.animator.play(moving ? 'walk' : this.hurtTimer > 0 ? 'hurt' : 'idle');
    }
    this.animator.update(dt);
    this.syncVisuals();
  }

  private faceWorld(dx: number, dy: number): void {
    this.animator.setFacingWorld(dx, dy);
  }

  private syncVisuals(): void {
    // Two separate meshes, both positioned at the feet. The shadow is in the ground-decal
    // layer so it never sorts over walls; the body is in the object layer sorted by depth.
    placeAt(this.shadow, Layer.GROUND_DECAL, this.pos.x, this.pos.y);
    placeAt(this.animator.mesh, this.isDead ? Layer.GROUND_DECAL : Layer.OBJECT, this.pos.x, this.pos.y);
    this.animator.mesh.position.x += this.animator.offsetX;
    this.animator.mesh.position.y += this.animator.offsetY;
    this.shadow.visible = !this.isDead;
  }

  dispose(): void {
    this.animator.dispose();
    this.group.clear();
  }
}
