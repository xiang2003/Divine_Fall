import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/data/mapData';
import { CABIN_SPRITES } from '../src/game/BuildingArt';
import { ASSET_MANIFEST, DECOR_KINDS, PROP_KEYS, THEME_SCATTER } from '../src/game/assetManifest';
import { DIRECTION_COUNT, directionIndex } from '../src/game/directions';

const PUBLIC = join(__dirname, '..', 'public');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('asset manifest', () => {
  const withUrl = ASSET_MANIFEST.filter((d) => d.url);

  it('has unique keys', () => {
    const keys = ASSET_MANIFEST.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('points every url at an existing file', () => {
    const missing = withUrl.filter((d) => !existsSync(join(PUBLIC, d.url!))).map((d) => d.url);
    expect(missing).toEqual([]);
  });

  it('has sheets whose pixel size is a whole number of frames', () => {
    for (const def of withUrl.filter((d) => !d.measure && d.url!.endsWith('.png'))) {
      const { width, height } = pngSize(join(PUBLIC, def.url!));
      expect(width % def.frameWidth, `${def.url} width ${width} vs frame ${def.frameWidth}`).toBe(0);
      expect(height % def.frameHeight, `${def.url} height ${height} vs frame ${def.frameHeight}`).toBe(0);
    }
  });

  it('declares the building images at their real size', () => {
    for (const [style, cabin] of Object.entries(CABIN_SPRITES)) {
      expect(pngSize(join(PUBLIC, cabin!.url)), style).toEqual({ width: cabin!.width, height: cabin!.height });
      expect(cabin!.anchorY).toBeGreaterThan(0);
      expect(cabin!.anchorY).toBeLessThan(1);
    }
  });

  it('lists decor kinds whose sprites all exist in the manifest', () => {
    const keys = new Set(ASSET_MANIFEST.map((d) => d.key));
    for (const [kind, def] of Object.entries(DECOR_KINDS)) {
      for (const key of def.keys) expect(keys.has(key), `${kind}: ${key}`).toBe(true);
    }
    for (const key of PROP_KEYS) expect(keys.has(key), key).toBe(true);
    for (const scatter of Object.values(THEME_SCATTER)) {
      for (const kind of scatter?.kinds ?? []) expect(DECOR_KINDS[kind], kind).toBeDefined();
    }
  });
});

describe('map files', () => {
  const dir = join(PUBLIC, 'maps');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');

  it.each(files)('%s parses, and its decor kinds are known', (file) => {
    const map = parseMap(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    for (const d of map.decor) expect(DECOR_KINDS[d.kind], `${file}: ${d.kind}`).toBeDefined();
    for (const b of map.buildings) expect(b.style, file).toBeTruthy();
  });
});

describe('map ground and decor', () => {
  it('reads "," as a walkable dirt path', () => {
    const map = parseMap({ id: 'x', name: 'X', layout: ['#####', '#P,,#', '#...#', '#####'] });
    expect(map.ground[1 * 5 + 2]).toBe(1);
    expect(map.ground[1 * 5 + 3]).toBe(1);
    expect(map.ground[2 * 5 + 2]).toBe(0);
  });

  it('parses decor and rejects decor that is not on floor', () => {
    const layout = ['#####', '#P..#', '#...#', '#####'];
    const map = parseMap({ id: 'x', name: 'X', layout, decor: [{ kind: 'stump', x: 2.5, y: 1.5 }] });
    expect(map.decor).toEqual([{ kind: 'stump', x: 2.5, y: 1.5 }]);
    expect(() => parseMap({ id: 'x', name: 'X', layout, decor: [{ kind: 'stump', x: 0.5, y: 0.5 }] })).toThrow(/not on a floor tile/);
    expect(() => parseMap({ id: 'x', name: 'X', layout, decor: [{ kind: 3, x: 1, y: 1 }] })).toThrow(/decor/);
  });
});

describe('directionIndex', () => {
  it('maps the four world axes to the diagonal screen directions', () => {
    // +x runs to the lower right of the screen (front-right), +y to the lower left (front-left)
    expect(directionIndex(1, 0)).toBe(2);
    expect(directionIndex(0, 1)).toBe(4);
    expect(directionIndex(-1, 0)).toBe(6);
    expect(directionIndex(0, -1)).toBe(0);
  });

  it('maps straight down / up / left / right on screen', () => {
    expect(directionIndex(1, 1)).toBe(3); // toward the camera
    expect(directionIndex(-1, -1)).toBe(7); // away from it
    expect(directionIndex(1, -1)).toBe(1);
    expect(directionIndex(-1, 1)).toBe(5);
  });

  it('always lands in range', () => {
    for (let a = 0; a < 360; a += 7) {
      const i = directionIndex(Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(DIRECTION_COUNT);
    }
  });
});
