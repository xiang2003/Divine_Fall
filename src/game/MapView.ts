import * as THREE from 'three';
import { TileType, tileAt, type MapData } from '../data/mapData';
import type { AssetLoader } from './AssetLoader';
import { DECOR_KINDS, DIRT_EDGE_KEYS, DIRT_KEYS, PROP_KEYS, SpriteKey, THEME_ART, THEME_SCATTER } from './assetManifest';
import { buildingKey } from './BuildingArt';
import { Layer, placeAt, sortKey, worldToSceneX, worldToSceneY } from './iso';

/** Stable pseudo-random number per tile, so a map always looks the same (variant of grass, kind of tree). */
function tileHash(x: number, y: number): number {
  let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Builds the static scene objects for a map: floor (instanced), walls and props (individually
 * depth-sorted meshes). Contains no game logic; collision uses MapData directly.
 */
export class MapView {
  readonly root = new THREE.Group();

  constructor(map: MapData, assets: AssetLoader) {
    this.buildFloor(map, assets);
    this.buildWallsAndProps(map, assets);
    this.buildDecor(map, assets);
    if (map.spawns.exit) this.buildExit(map.spawns.exit, assets);
    for (const portal of map.portals) {
      for (let y = portal.rect.minY; y < portal.rect.maxY; y++) {
        for (let x = portal.rect.minX; x < portal.rect.maxX; x++) this.buildExit({ x: x + 0.5, y: y + 0.5 }, assets);
      }
    }
  }

  private buildFloor(map: MapData, assets: AssetLoader): void {
    const art = THEME_ART[map.theme];
    const stone = map.theme === 'stone';
    // tiles to draw per sprite key (floor variants and water variants)
    const groups = new Map<string, { x: number; y: number }[]>();
    const add = (key: string, x: number, y: number) => {
      const list = groups.get(key);
      if (list) list.push({ x, y });
      else groups.set(key, [{ x, y }]);
    };
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = tileAt(map, x, y);
        if (tile === TileType.WATER) {
          add(art.water[tileHash(x, y) % art.water.length]!, x, y);
          continue;
        }
        // Obstacles ("T") and buildings stand on the ground of outdoor maps, so those get a floor tile under them too.
        const underBuilding = map.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
        if (tile !== TileType.FLOOR && !(!stone && (tile === TileType.TREE || underBuilding))) continue;
        const index = art.floorPick ? art.floorPick[tileHash(x, y) % art.floorPick.length]! : (x + y) % 2;
        if (tile === TileType.FLOOR && map.ground[y * map.width + x] === 1 && !stone) {
          // A dirt path: whole tiles in the middle; along its sides the grass stays and a soft-edged patch is laid over it.
          const dirtAt = (dx: number, dy: number) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) return true;
            return map.ground[ny * map.width + nx] === 1 || tileAt(map, nx, ny) !== TileType.FLOOR;
          };
          const inside = dirtAt(1, 0) && dirtAt(-1, 0) && dirtAt(0, 1) && dirtAt(0, -1) && dirtAt(1, 1) && dirtAt(-1, -1) && dirtAt(1, -1) && dirtAt(-1, 1);
          if (inside) {
            add(DIRT_KEYS[tileHash(x, y) % DIRT_KEYS.length]!, x, y);
          } else {
            add(art.floor[index]!, x, y);
            add(DIRT_EDGE_KEYS[tileHash(y, x) % DIRT_EDGE_KEYS.length]!, x, y);
          }
          continue;
        }
        add(art.floor[index]!, x, y);
      }
    }
    const m = new THREE.Matrix4();
    for (const [key, tiles] of groups) {
      const mesh = new THREE.InstancedMesh(assets.sharedGeometry(key), assets.material(key), tiles.length);
      tiles.forEach((t, n) => {
        m.makeTranslation(worldToSceneX(t.x + 0.5, t.y + 0.5), worldToSceneY(t.x + 0.5, t.y + 0.5), 0);
        mesh.setMatrixAt(n, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      // path edges are laid over the grass tile of the same cell
      mesh.renderOrder = sortKey(Layer.GROUND, 0, 0) + (DIRT_EDGE_KEYS.includes(key) ? 1 : 0);
      this.root.add(mesh);
    }
  }

  private buildWallsAndProps(map: MapData, assets: AssetLoader): void {
    const covered = new Set<number>();
    for (const b of map.buildings) {
      for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) covered.add(ty * map.width + tx);
      const key = buildingKey(b.style, b.w, b.h);
      const sprite = new THREE.Mesh(assets.sharedGeometry(key), assets.material(key));
      // Sorted at the middle of its footprint, like every other object.
      placeAt(sprite, Layer.OBJECT, b.x + b.w / 2, b.y + b.h / 2);
      sprite.matrixAutoUpdate = false;
      sprite.updateMatrix();
      this.root.add(sprite);
    }
    const wallGeo = assets.sharedGeometry(SpriteKey.WALL);
    const wallMat = assets.material(SpriteKey.WALL);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = tileAt(map, x, y);
        if (tile !== TileType.WALL && tile !== TileType.TREE) continue;
        if (covered.has(y * map.width + x)) continue; // drawn by its building sprite
        const obstacles = THEME_ART[map.theme].obstacles;
        const obstacleKey = obstacles ? obstacles[tileHash(x, y) % obstacles.length]! : null;
        const wall =
          tile === TileType.TREE && obstacleKey
            ? new THREE.Mesh(assets.sharedGeometry(obstacleKey), assets.material(obstacleKey))
            : new THREE.Mesh(wallGeo, wallMat);
        placeAt(wall, Layer.OBJECT, x + 0.5, y + 0.5);
        wall.matrixAutoUpdate = false;
        wall.updateMatrix();
        this.root.add(wall);
      }
    }
    for (const prop of map.props) {
      const propKey = PROP_KEYS[tileHash(prop.tileX, prop.tileY) % PROP_KEYS.length]!;
      const crate = new THREE.Mesh(assets.sharedGeometry(propKey), assets.material(propKey));
      placeAt(crate, Layer.OBJECT, prop.tileX + 0.5, prop.tileY + 0.5);
      crate.matrixAutoUpdate = false;
      crate.updateMatrix();
      this.root.add(crate);
    }
  }

  /**
   * Loose decoration: what the map lists under "decor", plus nature sprinkled over open ground (never on a path, on a prop or
   * a building, or near anything the player needs to find: entrances, doors, characters, things to examine, spawns).
   */
  private buildDecor(map: MapData, assets: AssetLoader): void {
    const place = (kind: string, x: number, y: number, pick: number): void => {
      const def = DECOR_KINDS[kind];
      if (!def) return;
      const key = def.keys[pick % def.keys.length]!;
      const sprite = new THREE.Mesh(assets.sharedGeometry(key), assets.material(key));
      placeAt(sprite, Layer.OBJECT, x, y);
      sprite.matrixAutoUpdate = false;
      sprite.updateMatrix();
      this.root.add(sprite);
    };
    map.decor.forEach((d, i) => place(d.kind, d.x, d.y, tileHash(Math.floor(d.x * 7) + i, Math.floor(d.y * 7))));

    const scatter = THEME_SCATTER[map.theme];
    if (!scatter) return;
    const keepClear: { x: number; y: number }[] = [
      map.spawns.player,
      ...Object.values(map.entrances),
      ...map.npcs.map((n) => n.pos),
      ...map.interactables.map((i) => i.pos),
      ...map.portals.map((p) => ({ x: (p.rect.minX + p.rect.maxX) / 2, y: (p.rect.minY + p.rect.maxY) / 2 })),
      ...map.spawns.monsters,
      ...map.spawns.elites,
    ];
    if (map.spawns.boss) keepClear.push(map.spawns.boss);
    const crates = new Set(map.props.map((p) => p.tileY * map.width + p.tileX));
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) !== TileType.FLOOR || map.ground[y * map.width + x] === 1 || crates.has(y * map.width + x)) continue;
        const h = tileHash(x * 3 + 11, y * 5 + 7);
        if ((h % 10000) / 10000 >= scatter.density) continue;
        // keep it out of the way: portals are rectangles, so measure from their tiles as well
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (keepClear.some((p) => Math.hypot(p.x - cx, p.y - cy) < 1.6)) continue;
        if (map.portals.some((p) => cx > p.rect.minX - 1.2 && cx < p.rect.maxX + 1.2 && cy > p.rect.minY - 1.2 && cy < p.rect.maxY + 1.2)) continue;
        // a neighbouring wall, tree or building would swallow the sprite
        let blocked = false;
        for (let dy = -1; dy <= 1 && !blocked; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (tileAt(map, x + dx, y + dy) !== TileType.FLOOR) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) continue;
        const kind = scatter.kinds[(h >>> 8) % scatter.kinds.length]!;
        const ox = ((h >>> 16) % 100) / 100 - 0.5;
        const oy = ((h >>> 22) % 100) / 100 - 0.5;
        place(kind, cx + ox * 0.5, cy + oy * 0.5, h >>> 4);
      }
    }
  }

  private buildExit(exit: { x: number; y: number }, assets: AssetLoader): void {
    const marker = new THREE.Mesh(
      assets.sharedGeometry(SpriteKey.FLOOR_EXIT),
      assets.material(SpriteKey.FLOOR_EXIT),
    );
    placeAt(marker, Layer.GROUND_DECAL, exit.x, exit.y);
    marker.matrixAutoUpdate = false;
    marker.updateMatrix();
    this.root.add(marker);
  }

  /** Geometry and materials belong to AssetLoader; only the scene graph is released here. */
  dispose(): void {
    for (const child of this.root.children) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
    }
    this.root.clear();
  }
}
