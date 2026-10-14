import * as THREE from 'three';
import type { TrapPlacement } from '../data/mapData';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import type { CollisionSystem } from './CollisionSystem';
import { ArrowTrap, SPIKE_DAMAGE, SpikeTrap, type SpikeState } from './hazards';

/** How high above the floor the arrow slit sits on its wall face, in scene pixels; and how far in front of the slit an arrow starts. */
const SLIT_HEIGHT = 14;
const MUZZLE_DISTANCE = 0.75;

export interface TrapHooks {
  /** Spikes stabbed the player. `damage` is before armor. */
  stab(damage: number): void;
  /** A wall trap shot an arrow from (x, y) along the unit vector (dx, dy). */
  shoot(x: number, y: number, dx: number, dy: number): void;
}

interface SpikeEntry {
  logic: SpikeTrap;
  meshes: Record<SpikeState, THREE.Mesh>;
}

interface ArrowEntry {
  logic: ArrowTrap;
  slit: THREE.Mesh;
  hot: THREE.Mesh;
  muzzle: Vec2;
}

const SPIKE_KEYS: Record<SpikeState, string> = {
  hidden: SpriteKey.SPIKES_HIDDEN,
  warn: SpriteKey.SPIKES_WARN,
  up: SpriteKey.SPIKES_UP,
};

/** Runs and draws a map's traps: floor spikes that rise on a timer and wall slits that shoot poisoned arrows along the corridor. */
export class TrapSystem {
  readonly group = new THREE.Group();
  private readonly spikes: SpikeEntry[] = [];
  private readonly arrows: ArrowEntry[] = [];

  constructor(
    placements: readonly TrapPlacement[],
    assets: AssetLoader,
    private readonly collision: CollisionSystem,
    private readonly hooks: TrapHooks,
  ) {
    const sprite = (key: string): THREE.Mesh => {
      const mesh = new THREE.Mesh(assets.sharedGeometry(key), assets.material(key));
      mesh.matrixAutoUpdate = true;
      this.group.add(mesh);
      return mesh;
    };
    for (const p of placements) {
      if (p.kind === 'spikes') {
        const meshes = {
          hidden: sprite(SPIKE_KEYS.hidden),
          warn: sprite(SPIKE_KEYS.warn),
          up: sprite(SPIKE_KEYS.up),
        };
        for (const state of Object.keys(meshes) as SpikeState[]) {
          // spikes that stand up are objects (they hide what is behind them); the flat states lie on the floor
          placeAt(meshes[state], state === 'up' ? Layer.OBJECT : Layer.GROUND_DECAL, p.pos.x, p.pos.y);
        }
        this.spikes.push({ logic: new SpikeTrap(p.pos, p.phase), meshes });
      } else {
        const faceX = p.pos.x + p.dir.x * 0.5;
        const faceY = p.pos.y + p.dir.y * 0.5;
        const slit = sprite(SpriteKey.SLIT);
        const hot = sprite(SpriteKey.SLIT_HOT);
        for (const m of [slit, hot]) {
          placeAt(m, Layer.OBJECT, faceX + p.dir.x * 0.05, faceY + p.dir.y * 0.05); // just in front of the wall so it sorts after it
          m.position.y += SLIT_HEIGHT;
        }
        this.arrows.push({ logic: new ArrowTrap(p.pos, p.dir), slit, hot, muzzle: { x: p.pos.x + p.dir.x * MUZZLE_DISTANCE, y: p.pos.y + p.dir.y * MUZZLE_DISTANCE } });
      }
    }
    this.syncViews();
  }

  get count(): number {
    return this.spikes.length + this.arrows.length;
  }

  update(dt: number, target: { pos: Vec2; isDead: boolean }): void {
    for (const s of this.spikes) {
      if (s.logic.update(dt, target)) this.hooks.stab(SPIKE_DAMAGE);
    }
    for (const a of this.arrows) {
      const clear = !target.isDead && this.collision.hasLineOfSight(a.muzzle.x, a.muzzle.y, target.pos.x, target.pos.y);
      if (a.logic.update(dt, target, clear)) this.hooks.shoot(a.muzzle.x, a.muzzle.y, a.logic.dir.x, a.logic.dir.y);
    }
    this.syncViews();
  }

  private syncViews(): void {
    for (const s of this.spikes) {
      const state = s.logic.state;
      for (const key of Object.keys(s.meshes) as SpikeState[]) s.meshes[key].visible = key === state;
    }
    for (const a of this.arrows) {
      const aiming = a.logic.state === 'aim';
      a.hot.visible = aiming;
      a.slit.visible = !aiming;
    }
  }

  /** Geometry and materials belong to AssetLoader; only the scene graph is released here. */
  dispose(): void {
    this.group.clear();
    this.spikes.length = 0;
    this.arrows.length = 0;
  }
}
