import * as THREE from 'three';
import { TileType, tileAt, type MapData } from '../data/mapData';
import type { AssetLoader } from './AssetLoader';
import { GRASS_KEYS, GRASS_PICK, SpriteKey, TREE_KEYS } from './assetManifest';
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
    if (map.spawns.exit) this.buildExit(map.spawns.exit, assets);
    for (const portal of map.portals) {
      for (let y = portal.rect.minY; y < portal.rect.maxY; y++) {
        for (let x = portal.rect.minX; x < portal.rect.maxX; x++) this.buildExit({ x: x + 0.5, y: y + 0.5 }, assets);
      }
    }
  }

  private buildFloor(map: MapData, assets: AssetLoader): void {
    const grass = map.theme === 'grass';
    const variants = grass ? GRASS_KEYS : [SpriteKey.FLOOR_A, SpriteKey.FLOOR_B];
    const tilesPerVariant: { x: number; y: number }[][] = variants.map(() => []);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = tileAt(map, x, y);
        // Trees and buildings stand on grass, so outdoor maps get a ground tile under them too.
        const underBuilding = map.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
        if (tile !== TileType.FLOOR && !(grass && (tile === TileType.TREE || underBuilding))) continue;
        const variant = grass ? GRASS_PICK[tileHash(x, y) % GRASS_PICK.length]! : (x + y) % 2;
        tilesPerVariant[variant]!.push({ x, y });
      }
    }
    const m = new THREE.Matrix4();
    variants.forEach((key, i) => {
      const tiles = tilesPerVariant[i]!;
      if (tiles.length === 0) return;
      const mesh = new THREE.InstancedMesh(assets.sharedGeometry(key), assets.material(key), tiles.length);
      tiles.forEach((t, n) => {
        m.makeTranslation(worldToSceneX(t.x + 0.5, t.y + 0.5), worldToSceneY(t.x + 0.5, t.y + 0.5), 0);
        mesh.setMatrixAt(n, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = sortKey(Layer.GROUND, 0, 0);
      this.root.add(mesh);
    });
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
        const treeKey = TREE_KEYS[tileHash(x, y) % TREE_KEYS.length]!;
        const wall =
          tile === TileType.TREE
            ? new THREE.Mesh(assets.sharedGeometry(treeKey), assets.material(treeKey))
            : new THREE.Mesh(wallGeo, wallMat);
        placeAt(wall, Layer.OBJECT, x + 0.5, y + 0.5);
        wall.matrixAutoUpdate = false;
        wall.updateMatrix();
        this.root.add(wall);
      }
    }
    const crateGeo = assets.sharedGeometry(SpriteKey.CRATE);
    const crateMat = assets.material(SpriteKey.CRATE);
    for (const prop of map.props) {
      const crate = new THREE.Mesh(crateGeo, crateMat);
      placeAt(crate, Layer.OBJECT, prop.tileX + 0.5, prop.tileY + 0.5);
      crate.matrixAutoUpdate = false;
      crate.updateMatrix();
      this.root.add(crate);
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
