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
}

/** Height of the floating icon above its ring, in art pixels. */
const ICON_LIFT = 10;
const LABEL_LIFT = 52;

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

    const drop: LootDrop = { id: this.nextId++, item, pos, picked: false, age: this.rng() * 6, ring, icon, label };
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
    for (const d of this.drops) {
      d.age += dt;
      this.place(d);
      camera.worldToScreen(d.pos.x, d.pos.y, this.screen);
      d.label.style.display = 'block';
      d.label.style.transform = `translate(${Math.round(this.screen.x)}px, ${Math.round(this.screen.y - LABEL_LIFT)}px) translate(-50%, -100%)`;
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

  private findSpot(x: number, y: number): Vec2 {
    const R = 0.2;
    for (let i = 0; i < 10; i++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = i === 0 ? 0 : this.rng() * LOOT_CONFIG.scatterRadius;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      if (!this.collision.collidesCircle(px, py, R)) return { x: px, y: py };
    }
    return { x, y };
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
