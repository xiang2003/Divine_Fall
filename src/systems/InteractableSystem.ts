import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig';
import type { InteractablePlacement } from '../data/mapData';
import { getInteractable, type InteractableDef } from '../data/interactables';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import { Layer, placeAt, type Vec2 } from '../game/iso';

/** The player can examine something from this far (centre to centre, world units). */
export const INTERACT_RANGE = 1.9;
/** Height of the tag above the feet, in art pixels. */
const TAG_HEIGHT = 46;

/** Is this object present right now, given the world flags? */
export function interactableVisible(def: Pick<InteractableDef, 'requiresFlag' | 'hideFlag'>, hasFlag: (name: string) => boolean): boolean {
  if (def.requiresFlag && !hasFlag(def.requiresFlag)) return false;
  if (def.hideFlag && hasFlag(def.hideFlag)) return false;
  return true;
}

export class Interactable {
  readonly def: InteractableDef;
  readonly pos: Vec2;
  visible = true;
  private readonly mesh: THREE.Mesh | null;
  private readonly tag: HTMLDivElement;
  private readonly screen: Vec2 = { x: 0, y: 0 };
  private age = Math.random() * 6;

  constructor(
    placement: InteractablePlacement,
    private readonly group: THREE.Group,
    assets: AssetLoader,
    tagLayer: HTMLElement,
    onClick: (it: Interactable) => void,
  ) {
    this.def = getInteractable(placement.id);
    this.pos = { ...placement.pos };
    if (this.def.spriteKey) {
      this.mesh = new THREE.Mesh(assets.sharedGeometry(this.def.spriteKey), assets.material(this.def.spriteKey));
      placeAt(this.mesh, Layer.OBJECT, this.pos.x, this.pos.y);
      group.add(this.mesh);
    } else {
      this.mesh = null;
    }
    this.tag = document.createElement('div');
    this.tag.className = 'npc-tag interact-tag';
    const name = document.createElement('div');
    name.className = 'npc-name';
    name.textContent = this.def.name;
    const prompt = document.createElement('div');
    prompt.className = 'npc-title';
    prompt.textContent = this.def.prompt;
    this.tag.append(name, prompt);
    this.tag.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(this);
    });
    this.tag.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.tag.addEventListener('contextmenu', (e) => e.preventDefault());
    tagLayer.appendChild(this.tag);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.mesh) this.mesh.visible = visible;
    this.tag.style.display = visible ? 'block' : 'none';
  }

  update(dt: number, camera: CameraController): void {
    if (!this.visible) return;
    this.age += dt;
    // a slow pulse so the object reads as "alive"
    if (this.mesh) {
      const k = 1 + Math.sin(this.age * 2.4) * 0.035;
      this.mesh.scale.set(k, k, 1);
    }
    camera.worldToScreen(this.pos.x, this.pos.y, this.screen);
    const lift = TAG_HEIGHT * CAMERA_CONFIG.zoom;
    this.tag.style.transform = `translate(${Math.round(this.screen.x)}px, ${Math.round(this.screen.y - lift)}px) translate(-50%, -100%)`;
  }

  dispose(): void {
    if (this.mesh) this.group.remove(this.mesh);
    this.tag.remove();
  }
}

/** All examinable things of the current map. */
export class InteractableSystem {
  readonly group = new THREE.Group();
  readonly all: Interactable[] = [];
  private readonly tagLayer: HTMLDivElement;

  constructor(
    placements: readonly InteractablePlacement[],
    assets: AssetLoader,
    container: HTMLElement,
    private readonly camera: CameraController,
    onClick: (it: Interactable) => void,
    hasFlag: (name: string) => boolean,
  ) {
    this.tagLayer = document.createElement('div');
    this.tagLayer.className = 'npc-layer';
    container.appendChild(this.tagLayer);
    for (const p of placements) {
      const it = new Interactable(p, this.group, assets, this.tagLayer, onClick);
      it.setVisible(interactableVisible(it.def, hasFlag));
      this.all.push(it);
    }
  }

  /** The closest visible one within `range`, or null. */
  nearest(from: Vec2, range: number): Interactable | null {
    let best: Interactable | null = null;
    let bestDist = range;
    for (const it of this.all) {
      if (!it.visible) continue;
      const d = Math.hypot(it.pos.x - from.x, it.pos.y - from.y);
      if (d <= bestDist) {
        best = it;
        bestDist = d;
      }
    }
    return best;
  }

  update(dt: number, hasFlag: (name: string) => boolean): void {
    for (const it of this.all) {
      const show = interactableVisible(it.def, hasFlag);
      if (show !== it.visible) it.setVisible(show);
      it.update(dt, this.camera);
    }
  }

  dispose(): void {
    for (const it of this.all) it.dispose();
    this.all.length = 0;
    this.tagLayer.remove();
    this.group.clear();
  }
}
