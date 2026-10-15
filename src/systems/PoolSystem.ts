import * as THREE from 'three';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import { TILE_H, TILE_W } from '../config/gameConfig';

/** While someone stands in a cloud, the poison is renewed to last this many seconds past their last moment in it. */
export const POOL_POISON_SECONDS = 1.2;

export type PoolPhase = 'warning' | 'active' | 'gone';

/** One poison cloud on the ground: a warning circle for `delay` seconds, then it lingers for `duration` seconds and poisons whoever stands in it. */
export class PoisonPool {
  phase: PoolPhase = 'warning';
  age = 0;

  constructor(
    readonly pos: Vec2,
    readonly radius: number,
    readonly delay: number,
    readonly duration: number,
    readonly dps: number,
  ) {}

  /** Advances by `dt`. Returns true when the cloud is up and `target` stands in it. */
  update(dt: number, target: { pos: Vec2; radius: number; isDead: boolean }): boolean {
    this.age += dt;
    if (this.phase === 'warning' && this.age >= this.delay) this.phase = 'active';
    if (this.phase === 'active' && this.age >= this.delay + this.duration) this.phase = 'gone';
    if (this.phase !== 'active' || target.isDead) return false;
    return Math.hypot(target.pos.x - this.pos.x, target.pos.y - this.pos.y) <= this.radius + target.radius;
  }

  /** How far the cloud has faded (1 while it lingers, falling to 0 in its last second). */
  get strength(): number {
    if (this.phase !== 'active') return 0;
    return Math.min(1, (this.delay + this.duration - this.age) / 1);
  }
}

interface PoolView {
  pool: PoisonPool;
  disc: THREE.Mesh;
  cloud: THREE.Mesh;
  discMaterial: THREE.MeshBasicMaterial;
  cloudMaterial: THREE.MeshBasicMaterial;
}

const POISON_GREEN = 0x8fe05a;

/** Lingering poison clouds that monsters lob onto the ground (see PoolDef). */
export class PoolSystem {
  readonly group = new THREE.Group();
  private readonly views: PoolView[] = [];
  private clock = 0;

  constructor(
    private readonly assets: AssetLoader,
    /** The target stood in a cloud this tick: poison it for `seconds` at `dps`. */
    private readonly onTouch: (dps: number, seconds: number) => void,
  ) {}

  get count(): number {
    return this.views.length;
  }

  add(pos: Vec2, radius: number, delay: number, duration: number, dps: number): void {
    const pool = new PoisonPool(pos, radius, delay, duration, dps);
    const make = (key: string): [THREE.Mesh, THREE.MeshBasicMaterial] => {
      const material = this.assets.material(key).clone();
      material.color.setHex(POISON_GREEN);
      material.opacity = 0;
      const mesh = new THREE.Mesh(this.assets.sharedGeometry(key), material);
      placeAt(mesh, Layer.GROUND_DECAL, pos.x, pos.y);
      const rx = radius * (TILE_W / 2) * Math.SQRT2;
      const ry = radius * (TILE_H / 2) * Math.SQRT2;
      mesh.scale.set((2 * rx) / 128, (2 * ry) / 128, 1);
      this.group.add(mesh);
      return [mesh, material];
    };
    const [disc, discMaterial] = make(SpriteKey.DISC);
    const [cloud, cloudMaterial] = make(SpriteKey.CLOUD);
    this.views.push({ pool, disc, cloud, discMaterial, cloudMaterial });
  }

  update(dt: number, target: { pos: Vec2; radius: number; isDead: boolean }): void {
    this.clock += dt;
    for (let i = this.views.length - 1; i >= 0; i--) {
      const v = this.views[i]!;
      if (v.pool.update(dt, target)) this.onTouch(v.pool.dps, POOL_POISON_SECONDS);
      if (v.pool.phase === 'gone') {
        this.group.remove(v.disc, v.cloud);
        v.discMaterial.dispose();
        v.cloudMaterial.dispose();
        this.views.splice(i, 1);
        continue;
      }
      if (v.pool.phase === 'warning') {
        v.discMaterial.opacity = 0.3 + 0.5 * Math.min(1, v.pool.age / v.pool.delay);
        v.cloudMaterial.opacity = 0;
      } else {
        const s = v.pool.strength;
        v.discMaterial.opacity = 0.35 * s;
        v.cloudMaterial.opacity = (0.45 + 0.12 * Math.sin(this.clock * 3 + v.pool.pos.x)) * s;
      }
    }
  }

  clear(): void {
    for (const v of this.views) {
      this.group.remove(v.disc, v.cloud);
      v.discMaterial.dispose();
      v.cloudMaterial.dispose();
    }
    this.views.length = 0;
  }

  /** Geometry and the shared materials belong to AssetLoader; the copies are ours. */
  dispose(): void {
    this.clear();
  }
}
