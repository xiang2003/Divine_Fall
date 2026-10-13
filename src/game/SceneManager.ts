import * as THREE from 'three';
import type { MapData } from '../data/mapData';
import type { AssetLoader } from './AssetLoader';
import { DebugOverlay } from './DebugOverlay';
import { MapView } from './MapView';

/** Owns the WebGL renderer, the scene graph, and the static map visuals. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private mapView: MapView | null = null;
  private debug: DebugOverlay | null = null;

  constructor(container: HTMLElement) {
    // Antialiasing is off on purpose: the art is pixel-based and drawn with nearest filtering.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor('#0b0a10');
    this.renderer.sortObjects = true;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.tabIndex = -1;
    container.appendChild(this.renderer.domElement);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Removes the current map's visuals (the next `loadMap` replaces them). */
  unloadMap(): void {
    if (this.mapView) this.scene.remove(this.mapView.root);
    if (this.debug) this.scene.remove(this.debug.root);
    this.mapView?.dispose();
    this.debug?.dispose();
    this.mapView = null;
    this.debug = null;
  }

  loadMap(map: MapData, assets: AssetLoader): DebugOverlay {
    this.unloadMap();
    this.mapView = new MapView(map, assets);
    this.debug = new DebugOverlay(map);
    this.scene.add(this.mapView.root, this.debug.root);
    return this.debug;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  dispose(): void {
    this.mapView?.dispose();
    this.debug?.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
