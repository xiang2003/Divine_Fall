import * as THREE from 'three';
import { Layer, sortKey, worldToSceneX, worldToSceneY } from './iso';

/** Shared geometry and materials for health bars. One per Game; call dispose() on teardown. */
export class EffectAssets {
  /** Unit quad whose left-centre is the origin, so scaling x grows it rightwards. */
  readonly barGeometry = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
  readonly barBg = flatMaterial('#120c10', 0.85);
  readonly barFill = flatMaterial('#d8483c', 1);

  dispose(): void {
    this.barGeometry.dispose();
    this.barBg.dispose();
    this.barFill.dispose();
  }
}

function flatMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

const BAR_WIDTH = 26;
const BAR_HEIGHT = 4;

/** A small floating health bar. Geometry and materials are shared via EffectAssets. */
export class HealthBar {
  readonly group = new THREE.Group();
  private readonly bg: THREE.Mesh;
  private readonly fill: THREE.Mesh;

  constructor(assets: EffectAssets) {
    this.bg = new THREE.Mesh(assets.barGeometry, assets.barBg);
    this.bg.scale.set(BAR_WIDTH + 2, BAR_HEIGHT + 2, 1);
    this.bg.position.x = -BAR_WIDTH / 2 - 1;
    this.fill = new THREE.Mesh(assets.barGeometry, assets.barFill);
    this.fill.scale.set(BAR_WIDTH, BAR_HEIGHT, 1);
    this.fill.position.x = -BAR_WIDTH / 2;
    this.group.add(this.bg, this.fill);
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  setRatio(ratio: number): void {
    this.fill.scale.x = Math.max(0.0001, BAR_WIDTH * Math.min(1, Math.max(0, ratio)));
  }

  /** Floats `height` art-pixels above the feet at world (wx, wy). */
  place(wx: number, wy: number, height: number): void {
    this.group.position.set(worldToSceneX(wx, wy), worldToSceneY(wx, wy) + height, 0);
    const order = sortKey(Layer.FOREGROUND, wx, wy);
    this.bg.renderOrder = order;
    this.fill.renderOrder = order + 1;
  }

  dispose(): void {
    this.group.clear();
  }
}

const SLASH_SEGMENTS = 14;
const SLASH_INNER = 0.45;

/**
 * The visible crescent of a melee swing, drawn on the ground in world space (so it is
 * skewed correctly by the isometric projection). Pre-allocated and reused for every swing.
 */
export class SlashEffect {
  readonly mesh: THREE.Mesh;
  private readonly positions: THREE.BufferAttribute;
  private readonly material: THREE.MeshBasicMaterial;
  private age = 0;
  private duration = 0;

  constructor() {
    const vertexCount = (SLASH_SEGMENTS + 1) * 2;
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
    geometry.setAttribute('position', this.positions);
    const index: number[] = [];
    for (let i = 0; i < SLASH_SEGMENTS; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(index);
    this.material = new THREE.MeshBasicMaterial({
      color: '#fff1c4',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  /** Shows a swing centred on the player's feet, opening `halfAngle` each side of (dirX, dirY). */
  trigger(wx: number, wy: number, dirX: number, dirY: number, range: number, halfAngle: number, duration: number): void {
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i <= SLASH_SEGMENTS; i++) {
      const a = base - halfAngle + (2 * halfAngle * i) / SLASH_SEGMENTS;
      const c = Math.cos(a);
      const s = Math.sin(a);
      this.setVertex(i * 2, wx + c * range * SLASH_INNER, wy + s * range * SLASH_INNER);
      this.setVertex(i * 2 + 1, wx + c * range, wy + s * range);
    }
    this.positions.needsUpdate = true;
    this.mesh.renderOrder = sortKey(Layer.OBJECT, wx, wy) + 1;
    this.age = 0;
    this.duration = Math.max(0.05, duration);
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (!this.mesh.visible) return;
    this.age += dt;
    const p = this.age / this.duration;
    if (p >= 1) {
      this.mesh.visible = false;
      return;
    }
    // Quick flash that fades through the swing.
    this.material.opacity = 0.75 * (1 - p) * (1 - p);
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private setVertex(i: number, wx: number, wy: number): void {
    this.positions.setXYZ(i, worldToSceneX(wx, wy), worldToSceneY(wx, wy), 0);
  }
}
