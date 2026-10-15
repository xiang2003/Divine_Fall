import * as THREE from 'three';
import type { DamageType } from '../data/damageTypes';
import { Bolt, type BoltTarget } from '../entities/Bolt';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, sortKey, worldToSceneX, worldToSceneY } from '../game/iso';
import type { CollisionSystem } from './CollisionSystem';
import type { StatusTrigger } from './status';

/** Hard cap on simultaneous player bolts; extra shots are dropped rather than allocating. */
const MAX_BOLTS = 16;
const FLIGHT_HEIGHT = 20;

interface Slot {
  bolt: Bolt;
  mesh: THREE.Mesh;
}

/** A fixed pool of piercing player bolts and their meshes. */
export class SkillProjectileSystem {
  readonly group = new THREE.Group();
  private readonly slots: Slot[] = [];

  constructor(assets: AssetLoader) {
    const geometry = assets.sharedGeometry(SpriteKey.BOLT);
    const material = assets.material(SpriteKey.BOLT);
    for (let i = 0; i < MAX_BOLTS; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.slots.push({ bolt: new Bolt(), mesh });
    }
  }

  fire(x: number, y: number, dirX: number, dirY: number, speed: number, range: number, damageMult: number, damageType: DamageType = 'physical', applies: readonly StatusTrigger[] = []): boolean {
    const slot = this.slots.find((s) => !s.bolt.active);
    if (!slot) return false;
    slot.bolt.launch(x, y, dirX, dirY, speed, range / speed, damageMult, damageType, applies);
    slot.mesh.visible = true;
    this.place(slot);
    return true;
  }

  update(
    dt: number,
    collision: CollisionSystem,
    targets: Iterable<BoltTarget>,
    onHit: (target: BoltTarget, bolt: Bolt) => void,
  ): void {
    for (const slot of this.slots) {
      if (!slot.bolt.active) continue;
      const alive = slot.bolt.update(dt, collision, targets, (t) => onHit(t, slot.bolt));
      if (alive) this.place(slot);
      else slot.mesh.visible = false;
    }
  }

  clear(): void {
    for (const s of this.slots) {
      s.bolt.active = false;
      s.mesh.visible = false;
    }
  }

  get activeCount(): number {
    return this.slots.reduce((n, s) => n + (s.bolt.active ? 1 : 0), 0);
  }

  dispose(): void {
    this.group.clear();
    this.slots.length = 0;
  }

  private place(slot: Slot): void {
    const { x, y } = slot.bolt.pos;
    slot.mesh.position.set(worldToSceneX(x, y), worldToSceneY(x, y) + FLIGHT_HEIGHT, 0);
    slot.mesh.renderOrder = sortKey(Layer.OBJECT, x, y);
  }
}
