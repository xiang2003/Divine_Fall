import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig';
import { ELITE_AFFIXES } from '../data/eliteAffixes';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import { EffectAssets, HealthBar } from '../game/effects';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import { SpriteAnimator } from '../game/SpriteAnimator';
import { CORPSE_LIFETIME, type Monster, type MonsterState } from './Monster';

/** Seconds at the end of a corpse's life during which it sinks away. */
const CORPSE_FADE = 0.6;

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
export class MonsterView {
  readonly group = new THREE.Group();
  private readonly animator: SpriteAnimator;
  private readonly shadow: THREE.Mesh;
  private readonly bar: HealthBar;
  private readonly nameplate: HTMLDivElement | null = null;
  private readonly screen: Vec2 = { x: 0, y: 0 };
  private shownState: MonsterState | null = null;

  constructor(
    private readonly monster: Monster,
    assets: AssetLoader,
    effects: EffectAssets,
    /** Where to put the name plate of an elite / boss; null disables name plates. */
    nameplateLayer: HTMLElement | null,
    camera: CameraController,
  ) {
    this.animator = new SpriteAnimator(assets, monster.def.spriteKey, 'idle');
    this.animator.setScale(monster.scale);
    this.shadow = new THREE.Mesh(assets.sharedGeometry(SpriteKey.SHADOW), assets.material(SpriteKey.SHADOW));
    this.shadow.scale.setScalar((monster.def.radius > 0.28 ? 1.15 : 0.95) * monster.scale * (monster.isBoss ? 1.6 : 1));
    this.bar = new HealthBar(effects, monster.isBoss ? 'boss' : monster.isElite ? 'elite' : 'normal');
    this.bar.visible = false;
    this.group.add(this.shadow, this.animator.mesh, this.bar.group);

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
      nameplateLayer.appendChild(el);
      this.nameplate = el;
    }
    this.update(0, camera);
  }

  update(dt: number, camera: CameraController): void {
    const m = this.monster;

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
    this.animator.update(dt);

    const dead = m.state === 'dead';
    placeAt(this.shadow, Layer.GROUND_DECAL, m.pos.x, m.pos.y);
    // Corpses lie on the ground so living things never sort behind them.
    placeAt(this.animator.mesh, dead ? Layer.GROUND_DECAL : Layer.OBJECT, m.pos.x, m.pos.y);
    this.shadow.visible = !dead;

    const fade = dead ? Math.min(1, Math.max(0, (CORPSE_LIFETIME - m.stateTime) / CORPSE_FADE)) : 1;
    this.animator.mesh.scale.y = m.scale * fade;

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

  dispose(): void {
    this.animator.dispose();
    this.bar.dispose();
    this.nameplate?.remove();
    this.group.clear();
  }
}
