import * as THREE from 'three';
import type { Monster } from '../entities/Monster';
import { Projectile, type ProjectileOutcome, type ProjectileTarget, type ShotEffects } from '../entities/Projectile';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, sortKey, worldToSceneX, worldToSceneY } from '../game/iso';
import type { CollisionSystem } from './CollisionSystem';

/** Hard cap on simultaneous projectiles; further shots are dropped rather than allocating. */
const MAX_PROJECTILES = 24;
const PROJECTILE_LIFE = 3;
/** Height of the orb above the ground, in art pixels. */
const FLIGHT_HEIGHT = 18;

/** The tint of a poisonous monster's projectile (venom). */
const VENOM_COLOR = 0x8fe05a;

interface Slot {
  projectile: Projectile;
  mesh: THREE.Mesh;
}

/** Owns a fixed pool of projectiles and their meshes. Nothing is created or destroyed during play. */
export class ProjectileSystem {
  readonly group = new THREE.Group();
  private readonly slots: Slot[] = [];
  private readonly orbMaterial: THREE.MeshBasicMaterial;
  /** One tinted copy of the orb material per colour that has been used (venom green, gel, crystal...). */
  private readonly tinted = new Map<number, THREE.MeshBasicMaterial>();

  constructor(assets: AssetLoader) {
    const geometry = assets.sharedGeometry(SpriteKey.ORB);
    const material = assets.material(SpriteKey.ORB);
    this.orbMaterial = material;
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.slots.push({ projectile: new Projectile(), mesh });
    }
  }

  /** Launches a projectile, or returns false if the pool is exhausted. */
  fire(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    owner: Monster | null = null,
    effects: ShotEffects | null = null,
  ): boolean {
    const slot = this.slots.find((s) => !s.projectile.active);
    if (!slot) return false;
    slot.projectile.launch(x, y, dirX, dirY, speed, damage, PROJECTILE_LIFE, owner, effects);
    const tint = effects?.tint ?? owner?.def.projectileTint ?? (effects?.poison || owner?.def.poison ? VENOM_COLOR : null);
    slot.mesh.material = this.materialFor(tint);
    slot.mesh.visible = true;
    this.place(slot);
    return true;
  }

  /** Advances every projectile; `onHit` is called for each one that reaches the target. */
  update(
    dt: number,
    collision: CollisionSystem,
    target: ProjectileTarget,
    onHit: (projectile: Projectile) => void,
  ): void {
    for (const slot of this.slots) {
      const p = slot.projectile;
      if (!p.active) continue;
      const outcome: ProjectileOutcome = p.update(dt, collision, target);
      if (outcome === 'hit') onHit(p);
      if (outcome === null) this.place(slot);
      else slot.mesh.visible = false;
    }
  }

  /** Removes everything in flight (on respawn). */
  clear(): void {
    for (const slot of this.slots) {
      slot.projectile.active = false;
      slot.mesh.visible = false;
    }
  }

  get activeCount(): number {
    return this.slots.reduce((n, s) => n + (s.projectile.active ? 1 : 0), 0);
  }

  dispose(): void {
    // Geometry and the orb material belong to AssetLoader; the tinted copies are ours.
    for (const m of this.tinted.values()) m.dispose();
    this.tinted.clear();
    this.group.clear();
    this.slots.length = 0;
  }

  private materialFor(tint: number | null): THREE.MeshBasicMaterial {
    if (tint === null) return this.orbMaterial;
    let m = this.tinted.get(tint);
    if (!m) {
      m = this.orbMaterial.clone();
      m.color.setHex(tint);
      this.tinted.set(tint, m);
    }
    return m;
  }

  private place(slot: Slot): void {
    const { x, y } = slot.projectile.pos;
    slot.mesh.position.set(worldToSceneX(x, y), worldToSceneY(x, y) + FLIGHT_HEIGHT, 0);
    slot.mesh.renderOrder = sortKey(Layer.OBJECT, x, y);
  }
}
