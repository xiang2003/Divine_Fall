import * as THREE from 'three';
import { TileType, tileAt, type MapData } from '../data/mapData';
import { Layer, sortKey, worldToSceneX, worldToSceneY } from './iso';

const COLOR_BLOCK = new THREE.Color('#ff4d4d');
const COLOR_PROP = new THREE.Color('#ffb347');
const COLOR_SPAWN = new THREE.Color('#5ad1ff');
const COLOR_ELITE = new THREE.Color('#d98cff');
const COLOR_BOSS = new THREE.Color('#ffffff');
const COLOR_PORTAL = new THREE.Color('#66ffcc');
const CIRCLE_SEGMENTS = 24;

/** Toggleable (F3) outlines of collision shapes and spawn points, plus the player's collision circle. */
export class DebugOverlay {
  readonly root = new THREE.Group();
  private readonly playerCircle: THREE.LineLoop;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(map: MapData) {
    const positions: number[] = [];
    const colors: number[] = [];
    const seg = (ax: number, ay: number, bx: number, by: number, c: THREE.Color) => {
      positions.push(worldToSceneX(ax, ay), worldToSceneY(ax, ay), 0, worldToSceneX(bx, by), worldToSceneY(bx, by), 0);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    const box = (x0: number, y0: number, x1: number, y1: number, c: THREE.Color) => {
      seg(x0, y0, x1, y0, c);
      seg(x1, y0, x1, y1, c);
      seg(x1, y1, x0, y1, c);
      seg(x0, y1, x0, y0, c);
    };
    const cross = (p: { x: number; y: number }, c: THREE.Color) => {
      seg(p.x - 0.25, p.y, p.x + 0.25, p.y, c);
      seg(p.x, p.y - 0.25, p.x, p.y + 0.25, c);
    };

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y);
        if (t === TileType.WALL || t === TileType.TREE || t === TileType.WATER) box(x, y, x + 1, y + 1, COLOR_BLOCK);
      }
    }
    for (const p of map.props) box(p.bounds.minX, p.bounds.minY, p.bounds.maxX, p.bounds.maxY, COLOR_PROP);
    cross(map.spawns.player, COLOR_SPAWN);
    for (const m of map.spawns.monsters) cross(m, COLOR_SPAWN);
    for (const e of map.spawns.elites) cross(e, COLOR_ELITE);
    if (map.spawns.boss) cross(map.spawns.boss, COLOR_BOSS);
    if (map.spawns.exit) cross(map.spawns.exit, COLOR_BOSS);
    for (const e of Object.values(map.entrances)) cross(e, COLOR_PORTAL);
    for (const p of map.portals) box(p.rect.minX, p.rect.minY, p.rect.maxX, p.rect.maxY, COLOR_PORTAL);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.8 });
    const lines = new THREE.LineSegments(geo, mat);
    lines.renderOrder = sortKey(Layer.FOREGROUND, 0, 0);
    lines.frustumCulled = false;
    this.root.add(lines);

    // Unit-radius collision circle, projected into the isometric plane (becomes an ellipse).
    const ring: number[] = [];
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
      ring.push(worldToSceneX(Math.cos(a), Math.sin(a)), worldToSceneY(Math.cos(a), Math.sin(a)), 0);
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
    const ringMat = new THREE.LineBasicMaterial({ color: '#7dff7d', depthTest: false, transparent: true });
    this.playerCircle = new THREE.LineLoop(ringGeo, ringMat);
    this.playerCircle.renderOrder = sortKey(Layer.FOREGROUND, 0, 0) + 1;
    this.playerCircle.frustumCulled = false;
    this.root.add(this.playerCircle);

    this.disposables.push(geo, mat, ringGeo, ringMat);
    this.root.visible = false;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  toggle(): void {
    this.root.visible = !this.root.visible;
  }

  setPlayerCircle(wx: number, wy: number, radius: number): void {
    this.playerCircle.position.set(worldToSceneX(wx, wy), worldToSceneY(wx, wy), 0);
    this.playerCircle.scale.set(radius, radius, 1);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.root.clear();
  }
}
