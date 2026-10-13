import * as THREE from 'three';
import type { SpriteAssetDef } from './assetManifest';

/** Resolves a path under the site base, so it works on a GitHub Pages sub-path. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/') ? base + path : `${base}/${path}`;
}

interface LoadedSprite {
  def: SpriteAssetDef;
  texture: THREE.Texture;
  material: THREE.MeshBasicMaterial;
  sheetWidth: number;
  sheetHeight: number;
}

/**
 * Loads every sprite in the manifest once and shares textures/materials between users.
 * A missing or broken image never aborts loading: the error is recorded in `errors`
 * and the procedural placeholder is used instead.
 */
export class AssetLoader {
  /** Human-readable load problems, surfaced in the HUD. */
  readonly errors: string[] = [];
  private readonly sprites = new Map<string, LoadedSprite>();
  private readonly sharedGeometries = new Map<string, THREE.BufferGeometry>();

  constructor(private readonly defs: readonly SpriteAssetDef[]) {}

  async loadAll(): Promise<void> {
    const loader = new THREE.TextureLoader();
    await Promise.all(
      this.defs.map(async (original) => {
        let def = original;
        let texture: THREE.Texture | null = null;
        if (def.url) {
          try {
            texture = await loader.loadAsync(assetUrl(def.url));
          } catch {
            this.errors.push(`素材載入失敗：${def.url}（已改用佔位圖）`);
          }
        }
        texture ??= new THREE.CanvasTexture(def.placeholder());
        this.configureTexture(texture, def.smooth === true);
        const image = texture.image as { width: number; height: number };
        if (def.measure) def = { ...def, frameWidth: image.width, frameHeight: image.height };
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide, // sprites are mirrored with a negative scale
          toneMapped: false,
        });
        this.sprites.set(def.key, {
          def,
          texture,
          material,
          sheetWidth: image.width,
          sheetHeight: image.height,
        });
      }),
    );
  }

  def(key: string): SpriteAssetDef {
    return this.get(key).def;
  }

  material(key: string): THREE.MeshBasicMaterial {
    return this.get(key).material;
  }

  texture(key: string): THREE.Texture {
    return this.get(key).texture;
  }

  /** A geometry per sprite key showing frame 0, shared by every static sprite using that key. */
  sharedGeometry(key: string): THREE.BufferGeometry {
    let geo = this.sharedGeometries.get(key);
    if (!geo) {
      geo = this.createGeometry(key, 0, 0);
      this.sharedGeometries.set(key, geo);
    }
    return geo;
  }

  /** A new quad (anchored at the sprite's pivot) showing the given frame. Caller must dispose it. */
  createGeometry(key: string, col: number, row: number): THREE.BufferGeometry {
    const s = this.get(key);
    const { frameWidth, frameHeight, anchor, displayScale = 1 } = s.def;
    const fw = frameWidth * displayScale;
    const fh = frameHeight * displayScale;
    const geo = new THREE.PlaneGeometry(fw, fh);
    geo.translate((0.5 - anchor.x) * fw, (0.5 - anchor.y) * fh, 0);
    this.setFrameUv(geo, key, col, row);
    return geo;
  }

  /** Points the quad's UVs at a frame of the sheet. */
  setFrameUv(geo: THREE.BufferGeometry, key: string, col: number, row: number): void {
    const s = this.get(key);
    const u0 = (col * s.def.frameWidth) / s.sheetWidth;
    const u1 = ((col + 1) * s.def.frameWidth) / s.sheetWidth;
    const v1 = 1 - (row * s.def.frameHeight) / s.sheetHeight;
    const v0 = v1 - s.def.frameHeight / s.sheetHeight;
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    // PlaneGeometry vertex order: top-left, top-right, bottom-left, bottom-right
    uv.setXY(0, u0, v1);
    uv.setXY(1, u1, v1);
    uv.setXY(2, u0, v0);
    uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }

  dispose(): void {
    for (const s of this.sprites.values()) {
      s.texture.dispose();
      s.material.dispose();
    }
    for (const g of this.sharedGeometries.values()) g.dispose();
    this.sprites.clear();
    this.sharedGeometries.clear();
  }

  private get(key: string): LoadedSprite {
    const s = this.sprites.get(key);
    if (!s) throw new Error(`Sprite "${key}" is not loaded`);
    return s;
  }

  private configureTexture(t: THREE.Texture, smooth: boolean): void {
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    t.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
}
