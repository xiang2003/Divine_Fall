import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig';
import type { NpcPlacement, Rect } from '../data/mapData';
import { getNpc, type NpcDef } from '../data/npcs';
import { SpriteKey } from '../game/assetManifest';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import { Layer, placeAt, type Vec2 } from '../game/iso';
import { DirectionalAnimator } from '../game/DirectionalAnimator';

/** Half the side of the square an NPC blocks (world units). */
export const NPC_HALF = 0.3;
/** A click this close to an NPC (world units) means "talk to it" rather than "walk there". */
export const NPC_CLICK_RADIUS = 0.7;
/** The player can start a conversation from this far (centre to centre, world units). */
export const NPC_TALK_RANGE = 1.9;

/** Is this placement present given the world flags (checked when a map is entered)? */
export function npcPresent(p: Pick<NpcPlacement, 'requiresFlag' | 'hiddenByFlag'>, hasFlag: (name: string) => boolean): boolean {
  if (p.requiresFlag && !hasFlag(p.requiresFlag)) return false;
  if (p.hiddenByFlag && hasFlag(p.hiddenByFlag)) return false;
  return true;
}

/** The solid square an NPC occupies, for CollisionSystem. */
export function npcBounds(pos: Vec2): Rect {
  return { minX: pos.x - NPC_HALF, minY: pos.y - NPC_HALF, maxX: pos.x + NPC_HALF, maxY: pos.y + NPC_HALF };
}

export class Npc {
  readonly def: NpcDef;
  readonly pos: Vec2;
  private readonly animator: DirectionalAnimator;
  private readonly shadow: THREE.Mesh;
  private readonly tag: HTMLDivElement;
  private readonly marker: HTMLSpanElement;
  private readonly screen: Vec2 = { x: 0, y: 0 };

  constructor(
    placement: NpcPlacement,
    readonly group: THREE.Group,
    assets: AssetLoader,
    tagLayer: HTMLElement,
    onClick: (npc: Npc) => void,
  ) {
    this.def = getNpc(placement.id);
    this.pos = { ...placement.pos };
    this.animator = new DirectionalAnimator(assets, this.def.spriteKey);
    this.animator.setScale(this.def.scale);
    this.shadow = new THREE.Mesh(assets.sharedGeometry(SpriteKey.SHADOW), assets.material(SpriteKey.SHADOW));
    this.shadow.scale.setScalar(0.62 * this.def.scale);
    this.group.add(this.shadow, this.animator.mesh);
    placeAt(this.shadow, Layer.GROUND_DECAL, this.pos.x, this.pos.y);
    placeAt(this.animator.mesh, Layer.OBJECT, this.pos.x, this.pos.y);

    this.tag = document.createElement('div');
    this.tag.className = 'npc-tag';
    const name = document.createElement('div');
    name.className = 'npc-name';
    name.textContent = this.def.name;
    const title = document.createElement('div');
    title.className = 'npc-title';
    title.textContent = this.def.title;
    this.marker = document.createElement('span');
    this.marker.className = 'npc-marker';
    this.marker.style.display = 'none';
    this.tag.append(this.marker, name, title);
    this.tag.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(this);
    });
    // The click must not also be read as a "move here" press on the canvas underneath.
    this.tag.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.tag.addEventListener('contextmenu', (e) => e.preventDefault());
    tagLayer.appendChild(this.tag);
  }

  /** "!" (a quest to offer), "?" (a quest to turn in) or null. */
  setMarker(symbol: string | null): void {
    this.marker.style.display = symbol ? 'block' : 'none';
    this.marker.textContent = symbol ?? '';
    this.marker.className = symbol === '?' ? 'npc-marker turnin' : 'npc-marker';
  }

  /** Turns to face a point (the player) and keeps the name tag on the sprite. */
  update(dt: number, camera: CameraController, face: Vec2 | null): void {
    if (face) this.animator.setFacingWorld(face.x - this.pos.x, face.y - this.pos.y);
    this.animator.update(dt);
    camera.worldToScreen(this.pos.x, this.pos.y, this.screen);
    const lift = this.def.tagHeight * this.def.scale * CAMERA_CONFIG.zoom;
    this.tag.style.transform = `translate(${Math.round(this.screen.x)}px, ${Math.round(this.screen.y - lift)}px) translate(-50%, -100%)`;
  }

  dispose(): void {
    this.animator.dispose();
    this.tag.remove();
    this.group.remove(this.shadow, this.animator.mesh);
  }
}

/** All NPCs of the current map. */
export class NpcSystem {
  readonly group = new THREE.Group();
  readonly all: Npc[] = [];
  private readonly tagLayer: HTMLDivElement;

  constructor(
    placements: readonly NpcPlacement[],
    assets: AssetLoader,
    container: HTMLElement,
    private readonly camera: CameraController,
    onClick: (npc: Npc) => void,
  ) {
    this.tagLayer = document.createElement('div');
    this.tagLayer.className = 'npc-layer';
    container.appendChild(this.tagLayer);
    for (const p of placements) this.all.push(new Npc(p, this.group, assets, this.tagLayer, onClick));
  }

  /** The NPC closest to `from` within `range`, or null. */
  nearest(from: Vec2, range: number): Npc | null {
    let best: Npc | null = null;
    let bestDist = range;
    for (const n of this.all) {
      const d = Math.hypot(n.pos.x - from.x, n.pos.y - from.y);
      if (d <= bestDist) {
        best = n;
        bestDist = d;
      }
    }
    return best;
  }

  /** Puts a quest marker over every NPC according to `markerFor`. */
  setMarkers(markerFor: (npcId: string) => string | null): void {
    for (const n of this.all) n.setMarker(markerFor(n.def.id));
  }

  update(dt: number, player: Vec2): void {
    for (const n of this.all) n.update(dt, this.camera, player);
  }

  dispose(): void {
    for (const n of this.all) n.dispose();
    this.all.length = 0;
    this.tagLayer.remove();
    this.group.clear();
  }
}
