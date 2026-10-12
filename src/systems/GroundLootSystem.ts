import * as THREE from 'three';
import { LOOT_CONFIG } from '../config/gameConfig';
import type { ItemInstance } from '../data/items';
import { RARITIES, RARITY_INFO, rarityRank, type Rarity } from '../data/rarity';
import { SLOT_ICON_KEY, SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import { Layer, placeAt, sortKey, worldToSceneX, worldToSceneY, type Vec2 } from '../game/iso';
import type { CollisionSystem } from './CollisionSystem';
import type { Rng } from './rng';

export interface LootDrop {
  readonly id: number;
  readonly item: ItemInstance;
  readonly pos: Vec2;
  /** Set once the item has been taken; a picked drop can never be taken again. */
  picked: boolean;
  age: number;
  readonly ring: THREE.Mesh;
  readonly icon: THREE.Mesh;
  readonly label: HTMLDivElement;
  /** Estimated label width in CSS pixels. */
  readonly labelWidth: number;
}

/** Height of the floating icon above its ring, in art pixels. */
const ICON_LIFT = 10;
const LABEL_LIFT = 52;
/** Height of one label row in CSS pixels, used to stack overlapping labels. */
const LABEL_ROW = 22;
/** Rough label width per character (CJK text at 13-14px), used for overlap checks without touching the DOM. */
const LABEL_CHAR_WIDTH = 14;
/** Items try to land at least this far apart. */
const MIN_DROP_SPACING = 0.5;

/**
 * Items lying on the floor: a tinted glow ring, a bobbing icon and a clickable name label (DOM, so text stays
 * crisp). Clicking a label reports the drop through `onLabelClick`; nothing here touches the inventory.
 */
export class GroundLootSystem {
  readonly group = new THREE.Group();
  private readonly drops: LootDrop[] = [];
  private readonly ringMaterials: Record<Rarity, THREE.MeshBasicMaterial>;
  private readonly layer: HTMLDivElement;
  private readonly screen: Vec2 = { x: 0, y: 0 };
  // Scratch buffers for label stacking (reused every frame, never reallocated).
  private readonly placedX = new Float32Array(LOOT_CONFIG.maxGroundDrops + 8);
  private readonly placedY = new Float32Array(LOOT_CONFIG.maxGroundDrops + 8);
  private readonly placedW = new Float32Array(LOOT_CONFIG.maxGroundDrops + 8);
  private nextId = 1;
  private readonly onLayerClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drop-id]');
    if (!el) return;
    const drop = this.drops.find((d) => d.id === Number(el.dataset.dropId));
    if (drop) this.onLabelClick(drop);
  };
  private readonly onLayerContextMenu = (e: Event) => e.preventDefault();

  constructor(
    private readonly assets: AssetLoader,
    container: HTMLElement,
    private readonly collision: CollisionSystem,
    private readonly rng: Rng,
    private readonly onLabelClick: (drop: LootDrop) => void,
  ) {
    const ringTexture = assets.texture(SpriteKey.LOOT_RING);
    this.ringMaterials = Object.fromEntries(
      RARITIES.map((r) => [
        r,
        new THREE.MeshBasicMaterial({
          map: ringTexture,
          color: RARITY_INFO[r].color,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      ]),
    ) as Record<Rarity, THREE.MeshBasicMaterial>;

    this.layer = document.createElement('div');
    this.layer.className = 'loot-layer';
    this.layer.addEventListener('click', this.onLayerClick);
    this.layer.addEventListener('contextmenu', this.onLayerContextMenu);
    container.appendChild(this.layer);
  }

  get all(): readonly LootDrop[] {
    return this.drops;
  }

  /** Drops `item` near (x, y), nudged onto open floor. Returns the new drop. */
  spawnNear(item: ItemInstance, x: number, y: number): LootDrop {
    const pos = this.findSpot(x, y);
    if (this.drops.length >= LOOT_CONFIG.maxGroundDrops) this.evictWeakest();

    const rarity = item.rarity;
    const ring = new THREE.Mesh(this.assets.sharedGeometry(SpriteKey.LOOT_RING), this.ringMaterials[rarity]);
    const icon = new THREE.Mesh(
      this.assets.sharedGeometry(SLOT_ICON_KEY[item.slot]),
      this.assets.material(SLOT_ICON_KEY[item.slot]),
    );
    this.group.add(ring, icon);

    const label = document.createElement('div');
    label.className = `loot-label ${rarity}`;
    label.style.color = RARITY_INFO[rarity].color;
    label.textContent = item.name;
    label.style.display = 'none';
    this.layer.appendChild(label);

    const labelWidth = item.name.length * LABEL_CHAR_WIDTH + 14;
    const drop: LootDrop = { id: this.nextId++, item, pos, picked: false, age: this.rng() * 6, ring, icon, label, labelWidth };
    label.dataset.dropId = String(drop.id);
    this.drops.push(drop);
    this.place(drop);
    return drop;
  }

  /** Nearest unpicked drop within `range` of `from`, or null. */
  nearest(from: Vec2, range: number): LootDrop | null {
    let best: LootDrop | null = null;
    let bestDist = range;
    for (const d of this.drops) {
      if (d.picked) continue;
      const dist = Math.hypot(d.pos.x - from.x, d.pos.y - from.y);
      if (dist <= bestDist) {
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }

  /** Removes a drop from the world (after it was picked up). Idempotent. */
  remove(drop: LootDrop): void {
    const i = this.drops.indexOf(drop);
    if (i === -1) return;
    drop.picked = true;
    this.drops.splice(i, 1);
    this.group.remove(drop.ring, drop.icon);
    drop.label.remove();
  }

  update(dt: number, camera: CameraController): void {
    let placed = 0;
    for (const d of this.drops) {
      d.age += dt;
      this.place(d);
      camera.worldToScreen(d.pos.x, d.pos.y, this.screen);
      const x = this.screen.x;
      let y = this.screen.y - LABEL_LIFT;
      // Stack this label above any already-placed label it would overlap, so every name stays clickable.
      for (let attempt = 0; attempt < 12; attempt++) {
        let clash = -1;
        for (let i = 0; i < placed; i++) {
          if (Math.abs(this.placedX[i]! - x) < (this.placedW[i]! + d.labelWidth) / 2 && Math.abs(this.placedY[i]! - y) < LABEL_ROW) {
            clash = i;
            break;
          }
        }
        if (clash === -1) break;
        y = this.placedY[clash]! - LABEL_ROW;
      }
      if (placed < this.placedX.length) {
        this.placedX[placed] = x;
        this.placedY[placed] = y;
        this.placedW[placed] = d.labelWidth;
        placed++;
      }
      d.label.style.display = 'block';
      d.label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    }
  }

  clear(): void {
    for (const d of [...this.drops]) this.remove(d);
  }

  dispose(): void {
    this.clear();
    this.layer.removeEventListener('click', this.onLayerClick);
    this.layer.removeEventListener('contextmenu', this.onLayerContextMenu);
    this.layer.remove();
    for (const m of Object.values(this.ringMaterials)) m.dispose();
    this.group.clear();
  }

  private place(d: LootDrop): void {
    placeAt(d.ring, Layer.GROUND_DECAL, d.pos.x, d.pos.y);
    const pulse = d.item.rarity === 'legendary' ? 1.25 + Math.sin(d.age * 4) * 0.12 : 1;
    d.ring.scale.set(pulse, pulse, 1);
    d.icon.position.x = worldToSceneX(d.pos.x, d.pos.y);
    d.icon.position.y = worldToSceneY(d.pos.x, d.pos.y) + ICON_LIFT + Math.sin(d.age * 3) * 2;
    d.icon.renderOrder = sortKey(Layer.OBJECT, d.pos.x, d.pos.y);
  }

  /** Picks a free-floor spot near (x, y), preferring one not on top of another item. */
  private findSpot(x: number, y: number): Vec2 {
    const R = 0.2;
    let fallback: Vec2 | null = null;
    for (let i = 0; i < 16; i++) {
      const angle = this.rng() * Math.PI * 2;
      // The search widens with each failed attempt so a pile of drops fans out.
      const dist = i === 0 ? 0 : this.rng() * LOOT_CONFIG.scatterRadius * (1 + i / 6);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      if (this.collision.collidesCircle(px, py, R)) continue;
      fallback ??= { x: px, y: py };
      if (this.drops.every((d) => Math.hypot(d.pos.x - px, d.pos.y - py) >= MIN_DROP_SPACING)) return { x: px, y: py };
    }
    return fallback ?? { x, y };
  }

  /** Makes room by removing the oldest item of the lowest rarity on the ground (never silently the best loot). */
  private evictWeakest(): void {
    let victim: LootDrop | null = null;
    for (const d of this.drops) {
      if (!victim || rarityRank(d.item.rarity) < rarityRank(victim.item.rarity)) victim = d;
    }
    if (victim) this.remove(victim);
  }
}
