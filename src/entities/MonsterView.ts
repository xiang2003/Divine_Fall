import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig';
import { ELITE_AFFIXES } from '../data/eliteAffixes';
import type { StatusId } from '../data/statuses';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import { EffectAssets, HealthBar } from '../game/effects';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import { DirectionalAnimator } from '../game/DirectionalAnimator';
import { SpriteAnimator } from '../game/SpriteAnimator';
import { CORPSE_LIFETIME, type Monster, type MonsterState } from './Monster';

/** Seconds at the end of a corpse's life during which it sinks away. */
const CORPSE_FADE = 0.6;
/** A stone monster breaks into this many pieces, which fall under this pull (scene pixels per second squared). */
const CHUNK_COUNT = 9;
const CHUNK_GRAVITY = 420;

const ANIMATION_FOR_STATE: Record<MonsterState, string> = {
  idle: 'idle',
  chase: 'walk',
  attack: 'attack',
  hurt: 'hurt',
  dead: 'die',
};

/**
 * Draws one Monster: sprite animation, shadow, health bar and (for elites and bosses) a name plate.
 * Reads the monster's state; never changes it.
 */
/** The tint of the figure for each status effect on it, and which one wins when there are several. */
const STATUS_TINT: Partial<Record<StatusId, readonly [number, number, number]>> = {
  freeze: [0.62, 0.86, 1],
  burning: [1, 0.64, 0.34],
  shock: [1, 1, 0.55],
  corruption: [0.8, 0.6, 1],
  bleeding: [1, 0.6, 0.6],
  armorBreak: [0.92, 0.82, 0.62],
  weaken: [0.76, 0.72, 0.95],
  slow: [0.66, 0.9, 1],
};
const STATUS_TINT_ORDER: readonly StatusId[] = ['freeze', 'burning', 'shock', 'corruption', 'bleeding', 'armorBreak', 'weaken', 'slow'];

export class MonsterView {
  readonly group = new THREE.Group();
  private readonly animator: SpriteAnimator | DirectionalAnimator;
  /** Set when the monster has 4-facing art (the same object as `animator`). */
  private readonly directional: DirectionalAnimator | null;
  private readonly shadow: THREE.Mesh;
  private readonly bar: HealthBar;
  /** The pulsing core (see MonsterDef.glow), or null. */
  private readonly glow: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } | null = null;
  private clock = 0;
  /** The pieces a stone monster falls apart into (scene pixels relative to where it stood), once it has died. */
  private readonly chunks: { mesh: THREE.Mesh; x: number; y: number; vx: number; vy: number; floor: number; size: number }[] = [];
  private shattered = false;
  /** The ripples that show where an ambusher lies hidden. */
  private readonly ripple: THREE.Mesh | null = null;
  private readonly nameplate: HTMLDivElement | null = null;
  /** The line of the name plate that lists the status effects on the monster. */
  private statusLine: HTMLDivElement | null = null;
  private shownStatuses = '';
  private shownFrozen = false;
  private readonly screen: Vec2 = { x: 0, y: 0 };
  private shownState: MonsterState | null = null;

  constructor(
    private readonly monster: Monster,
    private readonly assets: AssetLoader,
    effects: EffectAssets,
    /** Where to put the name plate of an elite / boss; null disables name plates. */
    nameplateLayer: HTMLElement | null,
    camera: CameraController,
  ) {
    this.directional = monster.def.directional
      ? new DirectionalAnimator(assets, monster.def.spriteKey, monster.def.attackStyle ?? 'lunge', { hop: monster.def.hop, flyer: monster.def.flyer })
      : null;
    this.animator = this.directional ?? new SpriteAnimator(assets, monster.def.spriteKey, 'idle');
    this.animator.setScale(monster.scale);
    this.shadow = new THREE.Mesh(assets.sharedGeometry(SpriteKey.SHADOW), assets.material(SpriteKey.SHADOW));
    this.shadow.scale.setScalar((monster.def.radius > 0.28 ? 1.15 : 0.95) * monster.scale * (monster.isBoss ? 1.6 : 1));
    this.bar = new HealthBar(effects, monster.isBoss ? 'boss' : monster.isElite ? 'elite' : 'normal');
    this.bar.visible = false;
    this.group.add(this.shadow, this.animator.mesh, this.bar.group);
    if (monster.def.phantom) this.directional?.setGhost(true);
    if (monster.def.ambush) {
      this.ripple = new THREE.Mesh(assets.sharedGeometry(SpriteKey.RIPPLE), assets.material(SpriteKey.RIPPLE));
      this.group.add(this.ripple);
    }
    if (monster.def.glow) {
      const material = assets.material(SpriteKey.GLOW).clone();
      material.blending = THREE.AdditiveBlending;
      material.color.setHex(monster.def.glow.color);
      const mesh = new THREE.Mesh(assets.sharedGeometry(SpriteKey.GLOW), material);
      mesh.scale.setScalar(monster.def.glow.size * monster.scale);
      this.group.add(mesh);
      this.glow = { mesh, material };
    }

    if (nameplateLayer && (monster.isElite || monster.isBoss)) {
      const el = document.createElement('div');
      el.className = `nameplate ${monster.isBoss ? 'boss' : 'elite'}`;
      const title = document.createElement('div');
      title.className = 'nameplate-title';
      title.textContent = monster.isBoss ? monster.def.name : `菁英 · ${monster.def.name}`;
      el.appendChild(title);
      if (monster.affixes.length > 0) {
        const affixes = document.createElement('div');
        affixes.className = 'nameplate-affixes';
        affixes.textContent = monster.affixes.map((id) => ELITE_AFFIXES[id].name).join(' · ');
        el.appendChild(affixes);
      }
      this.statusLine = document.createElement('div');
      this.statusLine.className = 'nameplate-status';
      el.appendChild(this.statusLine);
      nameplateLayer.appendChild(el);
      this.nameplate = el;
    }
    this.update(0, camera);
  }

  update(dt: number, camera: CameraController): void {
    const m = this.monster;
    this.clock += dt;

    if (m.state !== this.shownState) {
      this.shownState = m.state;
      // Fit the attack animation to the monster's real attack length so the visible strike frame
      // lines up with the moment damage is applied.
      if (m.state === 'attack') {
        this.animator.setSpeed(this.animator.durationOf('attack') / m.attackDuration);
      } else {
        this.animator.setSpeed(1);
      }
      this.animator.play(ANIMATION_FOR_STATE[m.state], true);
    } else if (m.state === 'chase') {
      // Standing still while in range (waiting out a cooldown) looks idle, not like walking in place.
      this.animator.play(m.moving ? 'walk' : 'idle');
    }

    this.animator.setFlipX(m.facing < 0);
    if (this.directional) {
      this.directional.setFacingWorld(m.facingDir.x, m.facingDir.y);
      this.directional.setHurtFlash(m.state === 'hurt');
      this.directional.setEnraged(m.berserk);
      if (m.def.hop) this.directional.setGait(m.hopPhase);
    }
    this.updateStatus(m);
    this.animator.update(dt);

    const dead = m.state === 'dead';
    placeAt(this.shadow, Layer.GROUND_DECAL, m.pos.x, m.pos.y);
    // Corpses lie on the ground so living things never sort behind them.
    placeAt(this.animator.mesh, dead ? Layer.GROUND_DECAL : Layer.OBJECT, m.pos.x, m.pos.y);
    if (this.directional) {
      // the hop of a pounce, the recoil of a hit
      this.animator.mesh.position.x += this.directional.offsetX;
      this.animator.mesh.position.y += this.directional.offsetY;
    }
    this.shadow.visible = !dead && !m.hidden;
    if (dead && m.def.shatters) this.updateChunks(dt, m);
    if (m.def.ambush) this.updateAmbush(m);

    const fade = dead ? Math.min(1, Math.max(0, (CORPSE_LIFETIME - m.stateTime) / CORPSE_FADE)) : 1;
    if (this.directional) this.directional.setFade(fade * m.emergeProgress);
    else this.animator.mesh.scale.y = m.scale * fade;

    if (this.glow && m.def.glow) {
      const g = m.def.glow;
      this.glow.mesh.visible = !dead;
      this.glow.mesh.position.x = this.animator.mesh.position.x;
      this.glow.mesh.position.y = this.animator.mesh.position.y + g.height * m.scale * this.animator.mesh.scale.y;
      this.glow.mesh.renderOrder = this.animator.mesh.renderOrder + 1;
      this.glow.material.opacity = 0.6 + 0.4 * Math.sin(this.clock * g.hz * Math.PI * 2);
    }

    this.bar.visible = !dead && m.hp < m.maxHp;
    if (this.bar.group.visible) {
      this.bar.setRatio(m.hp / m.maxHp);
      this.bar.place(m.pos.x, m.pos.y, m.def.barHeight * m.scale);
    }

    if (this.nameplate) {
      if (dead) {
        this.nameplate.style.display = 'none';
      } else {
        camera.worldToScreen(m.pos.x, m.pos.y, this.screen);
        const lift = (m.def.barHeight * m.scale + 14) * CAMERA_CONFIG.zoom;
        this.nameplate.style.display = 'block';
        this.nameplate.style.transform = `translate(${Math.round(this.screen.x)}px, ${Math.round(this.screen.y - lift)}px) translate(-50%, -100%)`;
      }
    }
  }

  /** The status effects on the monster: its tint, a frozen figure holding still, and the list on the name plate of an elite or a boss. */
  private updateStatus(m: Monster): void {
    const list = m.status.list();
    if (this.directional) {
      const top = STATUS_TINT_ORDER.find((id) => list.some((s) => s.id === id));
      this.directional.setStatusTint(top ? (STATUS_TINT[top] ?? null) : null);
    }
    const frozen = m.status.frozen && m.state !== 'dead';
    if (frozen !== this.shownFrozen) {
      this.shownFrozen = frozen;
      if (frozen) this.animator.setSpeed(0);
      else this.shownState = null; // picks the animation speed of its state again
    }
    if (this.statusLine) {
      const key = list.map((s) => s.id).join(',');
      if (key !== this.shownStatuses) {
        this.shownStatuses = key;
        this.statusLine.replaceChildren(
          ...list.map((s) => {
            const span = document.createElement('span');
            span.textContent = s.name;
            span.style.color = s.color;
            return span;
          }),
        );
      }
    }
  }

  /** An ambusher is only ripples on the water until it surfaces; then it rises out of them. */
  private updateAmbush(m: Monster): void {
    const ripple = this.ripple;
    if (!ripple) return;
    ripple.visible = m.hidden;
    if (m.hidden) {
      placeAt(ripple, Layer.GROUND_DECAL, m.pos.x, m.pos.y);
      ripple.scale.setScalar(1 + 0.12 * Math.sin(this.clock * 4));
    }
    this.animator.mesh.visible = !m.hidden;
  }

  /** Breaks the corpse into stones that fly out, fall, and lie where they land until the corpse goes. */
  private updateChunks(dt: number, m: Monster): void {
    if (!this.shattered) {
      this.shattered = true;
      this.animator.mesh.visible = false;
      for (let i = 0; i < CHUNK_COUNT; i++) {
        const mesh = new THREE.Mesh(this.assets.sharedGeometry(SpriteKey.CHUNK), this.assets.material(SpriteKey.CHUNK));
        this.group.add(mesh);
        this.chunks.push({
          mesh,
          x: (Math.random() - 0.5) * 16,
          y: 16 + Math.random() * 30,
          vx: (Math.random() - 0.5) * 140,
          vy: 70 + Math.random() * 90,
          floor: -Math.random() * 8,
          size: (0.8 + Math.random() * 0.9) * m.scale,
        });
      }
    }
    const shrink = Math.min(1, Math.max(0, (CORPSE_LIFETIME - m.stateTime) / CORPSE_FADE));
    for (const c of this.chunks) {
      if (c.y > c.floor) {
        c.vy -= CHUNK_GRAVITY * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.y <= c.floor) {
          c.y = c.floor;
          c.vx = 0;
          c.vy = 0;
        }
      }
      placeAt(c.mesh, Layer.GROUND_DECAL, m.pos.x, m.pos.y);
      c.mesh.position.x += c.x;
      c.mesh.position.y += c.y;
      c.mesh.scale.setScalar(c.size * shrink);
    }
  }

  dispose(): void {
    this.glow?.material.dispose();
    this.animator.dispose();
    this.bar.dispose();
    this.nameplate?.remove();
    this.group.clear();
  }
}
