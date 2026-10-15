import * as THREE from 'three';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import type { CollisionSystem } from './CollisionSystem';
import type { Rng } from './rng';

/** One heap of gold on the floor. */
export interface GoldPile {
  readonly amount: number;
  readonly pos: Vec2;
  age: number;
  readonly sprite: THREE.Mesh;
  readonly ring: THREE.Mesh;
}

/** The player picks a heap up by walking over it, and a heap near the player slides towards them once it has settled. */
export const GOLD_CONFIG = {
  pickupRange: 0.6,
  magnetRange: 2.6,
  magnetSpeed: 9,
  /** Seconds a heap lies still before it can be pulled in. */
  settleTime: 0.45,
  scatterRadius: 0.7,
  /** Heaps beyond this count are merged into the oldest one rather than dropped (no gold is ever lost). */
  maxPiles: 40,
} as const;

/** The glow ring under a heap, shrunk along with the heap itself. */
const RING_SCALE = 0.5;

/** Which picture a heap of this size uses. */
export function goldSpriteKey(amount: number): string {
  return amount >= 60 ? SpriteKey.GOLD_BIG : amount >= 12 ? SpriteKey.GOLD_MID : SpriteKey.GOLD_SMALL;
}

/** Gold dropped by monsters: heaps lying on the floor, collected by walking near them. Nothing here touches the player's purse; `collect` does. */
export class GoldSystem {
  readonly group = new THREE.Group();
  private readonly piles: GoldPile[] = [];
  private readonly ringMaterial: THREE.MeshBasicMaterial;

  constructor(
    private readonly assets: AssetLoader,
    private readonly collision: CollisionSystem,
    private readonly rng: Rng,
  ) {
    this.ringMaterial = new THREE.MeshBasicMaterial({
      map: assets.texture(SpriteKey.LOOT_RING),
      color: '#ffd84a',
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }

  get all(): readonly GoldPile[] {
    return this.piles;
  }

  get total(): number {
    return this.piles.reduce((sum, p) => sum + p.amount, 0);
  }

  /** Drops a heap of `amount` near (x, y), nudged onto open floor. */
  spawnNear(amount: number, x: number, y: number): GoldPile | null {
    if (amount <= 0) return null;
    if (this.piles.length >= GOLD_CONFIG.maxPiles) {
      // too many heaps lying about: the oldest one is replaced by a bigger one that holds both
      const oldest = this.piles[0]!;
      this.remove(oldest);
      amount += oldest.amount;
    }
    const pos = this.findSpot(x, y);
    const key = goldSpriteKey(amount);
    const sprite = new THREE.Mesh(this.assets.sharedGeometry(key), this.assets.material(key));
    const ring = new THREE.Mesh(this.assets.sharedGeometry(SpriteKey.LOOT_RING), this.ringMaterial);
    this.group.add(ring, sprite);
    const pile: GoldPile = { amount, pos, age: 0, sprite, ring };
    this.piles.push(pile);
    this.place(pile);
    return pile;
  }

  /** Moves the heaps near the player towards them and hands each one it reaches to `collect`. */
  update(dt: number, player: Vec2, canCollect: boolean, collect: (amount: number, at: Vec2) => void): void {
    for (const pile of [...this.piles]) {
      pile.age += dt;
      if (canCollect && pile.age >= GOLD_CONFIG.settleTime) {
        const dx = player.x - pile.pos.x;
        const dy = player.y - pile.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= GOLD_CONFIG.pickupRange) {
          this.remove(pile);
          collect(pile.amount, { x: pile.pos.x, y: pile.pos.y });
          continue;
        }
        if (dist <= GOLD_CONFIG.magnetRange) {
          const step = Math.min(dist, GOLD_CONFIG.magnetSpeed * dt);
          pile.pos.x += (dx / dist) * step;
          pile.pos.y += (dy / dist) * step;
        }
      }
      this.place(pile);
    }
  }

  remove(pile: GoldPile): void {
    const i = this.piles.indexOf(pile);
    if (i === -1) return;
    this.piles.splice(i, 1);
    this.group.remove(pile.ring, pile.sprite);
  }

  clear(): void {
    for (const p of [...this.piles]) this.remove(p);
  }

  dispose(): void {
    this.clear();
    this.ringMaterial.dispose();
    this.group.clear();
  }

  private place(pile: GoldPile): void {
    placeAt(pile.ring, Layer.GROUND_DECAL, pile.pos.x, pile.pos.y);
    pile.ring.scale.set(RING_SCALE, RING_SCALE, 1);
    placeAt(pile.sprite, Layer.OBJECT, pile.pos.x, pile.pos.y);
  }

  /** A free-floor spot near (x, y). */
  private findSpot(x: number, y: number): Vec2 {
    const R = 0.2;
    for (let i = 0; i < 12; i++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = i === 0 ? 0 : this.rng() * GOLD_CONFIG.scatterRadius * (1 + i / 6);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      if (!this.collision.collidesCircle(px, py, R)) return { x: px, y: py };
    }
    return { x, y };
  }
}
