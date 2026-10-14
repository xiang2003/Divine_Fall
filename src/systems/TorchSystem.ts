import * as THREE from 'three';
import type { TorchPlacement } from '../data/mapData';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';

/** How bright a torch burns when nobody is near, how near the player must be for full brightness, and how far away it is back to the dim level. */
export const TORCH_DIM = 0.28;
export const TORCH_NEAR = 2.5;
export const TORCH_FAR = 6;
/** The cold blue-green of the light. */
const TORCH_LIGHT = 0x5fd2ff;
/** How quickly the brightness follows (per second). */
const FOLLOW = 6;
/** Seconds a flame frame is shown. */
const FLICKER = 0.13;
/** Height of the flame's foot above the floor on the wall face, in scene pixels. */
const TORCH_HEIGHT = 12;

/** The brightness (TORCH_DIM to 1) a torch aims for when the player is `distance` away. */
export function torchTarget(distance: number): number {
  const t = Math.max(0, Math.min(1, (TORCH_FAR - distance) / (TORCH_FAR - TORCH_NEAR)));
  return TORCH_DIM + (1 - TORCH_DIM) * t;
}

interface Torch {
  placement: TorchPlacement;
  frames: [THREE.Mesh, THREE.Mesh];
  /** The glow around the flame and the pool of light it throws on the floor. */
  halo: THREE.Mesh;
  pool: THREE.Mesh;
  level: number;
  clock: number;
}

/** Blue-green wall torches. They burn low until the player walks by, then flare up and light the floor around them. */
export class TorchSystem {
  readonly group = new THREE.Group();
  private readonly torches: Torch[] = [];
  private readonly glowMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(placements: readonly TorchPlacement[], assets: AssetLoader) {
    const glowGeometry = assets.sharedGeometry(SpriteKey.GLOW);
    const glow = (): [THREE.Mesh, THREE.MeshBasicMaterial] => {
      const material = assets.material(SpriteKey.GLOW).clone();
      material.blending = THREE.AdditiveBlending;
      material.color.setHex(TORCH_LIGHT);
      this.glowMaterials.push(material);
      const mesh = new THREE.Mesh(glowGeometry, material);
      this.group.add(mesh);
      return [mesh, material];
    };
    placements.forEach((p, i) => {
      const faceX = p.pos.x + p.dir.x * 0.5;
      const faceY = p.pos.y + p.dir.y * 0.5;
      const flame = (key: string): THREE.Mesh => {
        const mesh = new THREE.Mesh(assets.sharedGeometry(key), assets.material(key));
        placeAt(mesh, Layer.OBJECT, faceX + p.dir.x * 0.06, faceY + p.dir.y * 0.06); // just in front of the wall so it sorts after it
        mesh.position.y += TORCH_HEIGHT;
        this.group.add(mesh);
        return mesh;
      };
      const frames: [THREE.Mesh, THREE.Mesh] = [flame(SpriteKey.TORCH_A), flame(SpriteKey.TORCH_B)];
      const [halo] = glow();
      placeAt(halo, Layer.OBJECT, faceX + p.dir.x * 0.07, faceY + p.dir.y * 0.07);
      halo.position.y += TORCH_HEIGHT + 14;
      halo.scale.setScalar(0.7);
      const [pool] = glow();
      // the light on the floor: a flat ellipse on the ground a little way out from the wall
      placeAt(pool, Layer.GROUND_DECAL, faceX + p.dir.x * 0.9, faceY + p.dir.y * 0.9);
      pool.scale.set(2.8, 1.4, 1);
      this.torches.push({ placement: p, frames, halo, pool, level: TORCH_DIM, clock: i * 0.07 });
    });
    this.apply();
  }

  update(dt: number, player: Vec2): void {
    for (const t of this.torches) {
      const d = Math.hypot(player.x - t.placement.pos.x, player.y - t.placement.pos.y);
      t.level += (torchTarget(d) - t.level) * Math.min(1, dt * FOLLOW);
      t.clock += dt;
    }
    this.apply();
  }

  /** Current brightness of each torch (for tests and debugging). */
  get levels(): readonly number[] {
    return this.torches.map((t) => t.level);
  }

  private apply(): void {
    this.torches.forEach((t) => {
      const frame = Math.floor(t.clock / FLICKER) % 2;
      t.frames[0].visible = frame === 0;
      t.frames[1].visible = frame === 1;
      const flameScale = 0.85 + 0.3 * t.level;
      t.frames[0].scale.setScalar(flameScale);
      t.frames[1].scale.setScalar(flameScale);
      (t.halo.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.75 * t.level;
      (t.pool.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.88 * Math.max(0, (t.level - TORCH_DIM) / (1 - TORCH_DIM));
    });
  }

  /** Geometry belongs to AssetLoader; the glow materials are clones owned here. */
  dispose(): void {
    for (const m of this.glowMaterials) m.dispose();
    this.glowMaterials.length = 0;
    this.group.clear();
    this.torches.length = 0;
  }
}
