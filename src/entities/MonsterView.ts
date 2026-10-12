import * as THREE from 'three';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { EffectAssets, HealthBar } from '../game/effects';
import { Layer, placeAt } from '../game/iso';
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

/** Draws one Monster: sprite animation, shadow and health bar. Reads the monster's state; never changes it. */
export class MonsterView {
  readonly group = new THREE.Group();
  private readonly animator: SpriteAnimator;
  private readonly shadow: THREE.Mesh;
  private readonly bar: HealthBar;
  private shownState: MonsterState | null = null;

  constructor(
    private readonly monster: Monster,
    assets: AssetLoader,
    effects: EffectAssets,
  ) {
    this.animator = new SpriteAnimator(assets, monster.def.spriteKey, 'idle');
    this.shadow = new THREE.Mesh(assets.sharedGeometry(SpriteKey.SHADOW), assets.material(SpriteKey.SHADOW));
    this.shadow.scale.setScalar(monster.def.radius > 0.28 ? 1.15 : 0.95);
    this.bar = new HealthBar(effects);
    this.bar.visible = false;
    this.group.add(this.shadow, this.animator.mesh, this.bar.group);
    this.update(0);
  }

  update(dt: number): void {
    const m = this.monster;

    if (m.state !== this.shownState) {
      this.shownState = m.state;
      // Fit the attack animation to the monster's real attack length so the visible strike frame
      // lines up with the moment damage is applied.
      if (m.state === 'attack') {
        this.animator.setSpeed(this.animator.durationOf('attack') / m.def.attackDuration);
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
    this.animator.mesh.scale.y = fade;

    this.bar.visible = !dead && m.hp < m.def.maxHp;
    if (this.bar.group.visible) {
      this.bar.setRatio(m.hp / m.def.maxHp);
      this.bar.place(m.pos.x, m.pos.y, m.def.barHeight);
    }
  }

  dispose(): void {
    this.animator.dispose();
    this.bar.dispose();
    this.group.clear();
  }
}
