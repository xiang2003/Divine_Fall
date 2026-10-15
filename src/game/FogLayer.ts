import * as THREE from 'three';
import { SpriteKey } from './assetManifest';
import type { AssetLoader } from './AssetLoader';
import { Layer, sortKey } from './iso';

/** Fog over a map: big soft pale clouds that drift slowly across the whole view, drawn over everything. */

/** The clouds tile the world in a rectangle this big (scene pixels): a cloud that leaves one side of it comes back on the other. */
const PERIOD_X = 1000;
const PERIOD_Y = 640;
const CLOUD_COUNT = 14;
/** Opacity of one cloud at fog thickness 1. */
const MAX_OPACITY = 0.42;
const FOG_COLOR = 0xdce6ec;

interface Cloud {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** `value` brought into [-period / 2, period / 2). */
export function wrapAround(value: number, period: number): number {
  return ((((value + period / 2) % period) + period) % period) - period / 2;
}

export class FogLayer {
  readonly group = new THREE.Group();
  private readonly clouds: Cloud[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];

  /** `thickness` is 0 to 1 (see MapData.fog). */
  constructor(assets: AssetLoader, thickness: number) {
    // fixed pseudo-random clouds, so the fog looks the same every visit
    let s = 12345;
    const random = (): number => {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const material = assets.material(SpriteKey.CLOUD).clone();
      material.color.setHex(FOG_COLOR);
      material.opacity = MAX_OPACITY * thickness * (0.6 + 0.4 * random());
      this.materials.push(material);
      const mesh = new THREE.Mesh(assets.sharedGeometry(SpriteKey.CLOUD), material);
      const size = 2.4 + random() * 2;
      mesh.scale.set(size, size * 0.6, 1);
      mesh.renderOrder = sortKey(Layer.FOREGROUND, 0, 0);
      this.group.add(mesh);
      this.clouds.push({ mesh, x: (random() - 0.5) * PERIOD_X, y: (random() - 0.5) * PERIOD_Y, vx: 5 + random() * 9, vy: (random() - 0.5) * 4 });
    }
  }

  /** Drifts the clouds; `cameraX` / `cameraY` is where the camera looks (scene pixels), so the fog always covers the screen. */
  update(dt: number, cameraX: number, cameraY: number): void {
    for (const c of this.clouds) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.mesh.position.x = cameraX + wrapAround(c.x - cameraX, PERIOD_X);
      c.mesh.position.y = cameraY + wrapAround(c.y - cameraY, PERIOD_Y);
    }
  }

  /** Geometry belongs to AssetLoader; the cloud materials are copies owned here. */
  dispose(): void {
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    this.group.clear();
    this.clouds.length = 0;
  }
}
