import * as THREE from 'three';
import { TILE_H, TILE_W } from '../config/gameConfig';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import type { GroundStrikeStyle } from '../data/monsters';

/** Seconds a stone pillar stays up after it has hit, and how long it takes to rise and to sink back. */
export const PILLAR_STAND = 1.2;
export const PILLAR_RISE = 0.18;
export const PILLAR_SINK = 0.3;
/** A burst's warning circle stays this long after it went off. */
const BURST_LINGER = 0.25;
/** The colour of the warning circle of each kind of ground strike. */
const RING_TINT: Record<GroundStrikeStyle, number> = { pillar: 0xffb060, burst: 0xff7050, root: 0x9be06a };
/** How much bigger than its picture the pillar is drawn. */
const COLUMN_SCALE = 1.4;

export type PillarPhase = 'warning' | 'standing' | 'gone';

/** One ground strike: a warning circle for `delay` seconds, then a pillar bursts out and hurts whoever is inside the circle (once). */
export class Pillar {
  phase: PillarPhase = 'warning';
  /** Seconds since the pillar was summoned. */
  age = 0;
  private struck = false;

  constructor(
    readonly pos: Vec2,
    readonly radius: number,
    readonly delay: number,
    readonly damage: number,
    /** A pillar bursts out of the floor and stays a moment; a burst is only the blast (no column). */
    readonly style: GroundStrikeStyle = 'pillar',
  ) {}

  /** Seconds the pillar (or the flash of a burst) lingers after it went off. */
  private get lingers(): number {
    return this.style === 'burst' ? BURST_LINGER : PILLAR_RISE + PILLAR_STAND + PILLAR_SINK;
  }

  /** Advances by `dt`. Returns true on the tick the pillar bursts out and `target` is inside its circle. */
  update(dt: number, target: { pos: Vec2; radius: number; isDead: boolean }): boolean {
    this.age += dt;
    if (this.phase === 'warning' && this.age >= this.delay) this.phase = 'standing';
    if (this.phase === 'standing' && this.age >= this.delay + this.lingers) this.phase = 'gone';
    if (this.phase !== 'standing' || this.struck) return false;
    this.struck = true;
    return !target.isDead && Math.hypot(target.pos.x - this.pos.x, target.pos.y - this.pos.y) <= this.radius + target.radius;
  }

  /** Warning: how far along the wait is (0 to 1). */
  get warningProgress(): number {
    return Math.min(1, this.age / this.delay);
  }

  /** How tall the pillar is drawn (0 to 1): it rises fast, stands, then sinks. */
  get height(): number {
    if (this.phase !== 'standing' || this.style === 'burst') return 0;
    const t = this.age - this.delay;
    if (t < PILLAR_RISE) return t / PILLAR_RISE;
    if (t < PILLAR_RISE + PILLAR_STAND) return 1;
    return Math.max(0, 1 - (t - PILLAR_RISE - PILLAR_STAND) / PILLAR_SINK);
  }
}

interface PillarView {
  pillar: Pillar;
  ring: THREE.Mesh;
  ringMaterial: THREE.MeshBasicMaterial;
  column: THREE.Mesh;
}

/** The ground of a boss fight: stone pillars summoned on the floor. Each shows a warning circle, then bursts out, hurts, stands a moment and sinks. */
export class PillarSystem {
  readonly group = new THREE.Group();
  private readonly views: PillarView[] = [];

  constructor(
    private readonly assets: AssetLoader,
    /** The player was inside a pillar's circle when it burst out. `damage` is before armor. */
    private readonly onHit: (damage: number) => void,
  ) {}

  get count(): number {
    return this.views.length;
  }

  add(pos: Vec2, radius: number, delay: number, damage: number, style: GroundStrikeStyle = 'pillar'): void {
    const pillar = new Pillar(pos, radius, delay, damage, style);
    const ringMaterial = this.assets.material(SpriteKey.DISC).clone();
    ringMaterial.opacity = 0;
    ringMaterial.color.setHex(RING_TINT[style]);
    const ring = new THREE.Mesh(this.assets.sharedGeometry(SpriteKey.DISC), ringMaterial);
    placeAt(ring, Layer.GROUND_DECAL, pos.x, pos.y);
    // a circle on the floor is an ellipse on the screen; the disc picture is 128 px across
    const rx = radius * (TILE_W / 2) * Math.SQRT2;
    const ry = radius * (TILE_H / 2) * Math.SQRT2;
    ring.scale.set((2 * rx) / 128, (2 * ry) / 128, 1);
    const columnKey = style === 'root' ? SpriteKey.ROOT_SPIKE : SpriteKey.PILLAR;
    const column = new THREE.Mesh(this.assets.sharedGeometry(columnKey), this.assets.material(columnKey));
    placeAt(column, Layer.OBJECT, pos.x, pos.y);
    column.visible = false;
    this.group.add(ring, column);
    this.views.push({ pillar, ring, ringMaterial, column });
  }

  update(dt: number, target: { pos: Vec2; radius: number; isDead: boolean }): void {
    for (let i = this.views.length - 1; i >= 0; i--) {
      const v = this.views[i]!;
      if (v.pillar.update(dt, target)) this.onHit(v.pillar.damage);
      if (v.pillar.phase === 'gone') {
        this.group.remove(v.ring, v.column);
        v.ringMaterial.dispose();
        this.views.splice(i, 1);
        continue;
      }
      const warning = v.pillar.phase === 'warning';
      // the circle shows during the warning, and a burst keeps it up for its flash
      v.ringMaterial.opacity = warning ? 0.35 + 0.65 * v.pillar.warningProgress : v.pillar.style === 'burst' ? 1 : 0;
      const h = v.pillar.height;
      v.column.visible = h > 0;
      v.column.scale.set(COLUMN_SCALE, COLUMN_SCALE * Math.max(0.05, h), 1);
    }
  }

  clear(): void {
    for (const v of this.views) {
      this.group.remove(v.ring, v.column);
      v.ringMaterial.dispose();
    }
    this.views.length = 0;
  }

  /** Geometry and the shared materials belong to AssetLoader; the ring copies are ours. */
  dispose(): void {
    this.clear();
  }
}
