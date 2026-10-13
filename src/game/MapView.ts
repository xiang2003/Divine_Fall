import * as THREE from 'three';
import { TileType, tileAt, type MapData } from '../data/mapData';
import type { AssetLoader } from './AssetLoader';
import { SpriteKey } from './assetManifest';
import { Layer, placeAt, sortKey, worldToSceneX, worldToSceneY } from './iso';

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
    const variants = [SpriteKey.FLOOR_A, SpriteKey.FLOOR_B];
    const tilesPerVariant: { x: number; y: number }[][] = [[], []];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) === TileType.FLOOR) tilesPerVariant[(x + y) % 2]!.push({ x, y });
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
    const wallGeo = assets.sharedGeometry(SpriteKey.WALL);
    const wallMat = assets.material(SpriteKey.WALL);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) !== TileType.WALL) continue;
        const wall = new THREE.Mesh(wallGeo, wallMat);
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
