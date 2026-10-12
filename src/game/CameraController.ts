import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/gameConfig';
import { sceneToWorld, worldToSceneX, worldToSceneY, type Vec2 } from './iso';

/** Fixed-zoom orthographic camera that smoothly follows a scene-space point. */
export class CameraController {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private viewWidth = 1;
  private viewHeight = 1;

  constructor() {
    this.camera.position.z = 10;
  }

  /** Call whenever the canvas size (in CSS pixels) changes. */
  resize(width: number, height: number): void {
    this.viewWidth = Math.max(1, width);
    this.viewHeight = Math.max(1, height);
    const halfW = this.viewWidth / 2 / CAMERA_CONFIG.zoom;
    const halfH = this.viewHeight / 2 / CAMERA_CONFIG.zoom;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  /** Jump straight to a scene position (used on spawn). */
  snapTo(sceneX: number, sceneY: number): void {
    this.camera.position.x = sceneX;
    this.camera.position.y = sceneY;
  }

  /** Frame-rate independent exponential follow. */
  follow(sceneX: number, sceneY: number, dt: number): void {
    const k = CAMERA_CONFIG.followSharpness;
    const t = k <= 0 ? 1 : 1 - Math.exp(-k * dt);
    this.camera.position.x += (sceneX - this.camera.position.x) * t;
    this.camera.position.y += (sceneY - this.camera.position.y) * t;
  }

  /** Converts a world position into CSS pixels relative to the canvas (for DOM overlays). */
  worldToScreen(wx: number, wy: number, out: Vec2): Vec2 {
    out.x = (worldToSceneX(wx, wy) - this.camera.position.x) * CAMERA_CONFIG.zoom + this.viewWidth / 2;
    out.y = this.viewHeight / 2 - (worldToSceneY(wx, wy) - this.camera.position.y) * CAMERA_CONFIG.zoom;
    return out;
  }

  /** Converts a pointer position (CSS px relative to the canvas) into world-grid coordinates. */
  pointerToWorld(px: number, py: number, out: Vec2): Vec2 {
    const sx = this.camera.position.x + (px - this.viewWidth / 2) / CAMERA_CONFIG.zoom;
    const sy = this.camera.position.y - (py - this.viewHeight / 2) / CAMERA_CONFIG.zoom;
    return sceneToWorld(sx, sy, out);
  }
}
