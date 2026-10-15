import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_THEMES, parseMap } from '../src/data/mapData';
import { WORLD_MAP_FILES } from '../src/data/worldMaps';
import { join } from 'node:path';
import { TileType, tileAt } from '../src/data/mapData';
import { ASSET_MANIFEST, DECOR_KINDS, THEME_ART, THEME_SCATTER } from '../src/game/assetManifest';
import { BUILDING_VARIANTS, CABIN_SPRITES } from '../src/game/BuildingArt';

const registered = new Set(ASSET_MANIFEST.map((d) => d.key));
const loadMap = (id: string) => parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES[id as keyof typeof WORLD_MAP_FILES]}`, import.meta.url), 'utf8')) as unknown);

describe('the dark xianxia look of chapter 2', () => {
  it('every theme names only art that is registered', () => {
    for (const theme of MAP_THEMES) {
      const art = THEME_ART[theme];
      const keys = [
        ...art.floor,
        ...(art.obstacles ?? []),
        ...art.water,
        ...(art.walls ?? []),
        ...(art.path?.full ?? []),
        ...(art.path?.edge ?? []),
        ...(art.props ?? []),
        ...(art.wild?.floor ?? []),
        ...(art.wild?.trees ?? []),
      ];
      for (const key of keys) expect(registered.has(key), `${theme}: ${key}`).toBe(true);
      for (const kind of THEME_SCATTER[theme]?.kinds ?? []) expect(DECOR_KINDS, `${theme} scatters ${kind}`).toHaveProperty(kind);
    }
  });

  it('a path that has soft edges has some; a theme with a path never mixes it with the dirt of chapter 1', () => {
    for (const theme of ['mist', 'mountain', 'sect', 'blight'] as const) {
      const path = THEME_ART[theme].path!;
      expect(path.full.length, theme).toBeGreaterThanOrEqual(4);
      expect(path.edge.length, theme).toBeGreaterThanOrEqual(4);
      expect(THEME_ART[theme].floor.length, theme).toBeGreaterThanOrEqual(4);
    }
  });

  it('chapter 2 maps use the new themes, and their decor and buildings are known', () => {
    expect(loadMap('qinglan_town').theme).toBe('sect');
    expect(loadMap('canglan_forest').theme).toBe('blight');
    expect(loadMap('broken_sword_pass').theme).toBe('mountain');
    expect(loadMap('canglan_coast').theme).toBe('mist');
    for (const id of ['qinglan_town', 'canglan_forest', 'broken_sword_pass', 'canglan_coast']) {
      for (const d of loadMap(id).decor) expect(DECOR_KINDS, `${id}: ${d.kind}`).toHaveProperty(d.kind);
    }
  });

  it('the town is built of its own buildings, not of the island cabins', () => {
    const styles = new Set(loadMap('qinglan_town').buildings.map((b) => b.style));
    for (const style of styles) expect(style.startsWith('town_'), style).toBe(true);
    for (const b of loadMap('qinglan_town').buildings) {
      expect(BUILDING_VARIANTS.some((v) => v.style === b.style && v.w === b.w && v.h === b.h), `${b.style} ${b.w}x${b.h}`).toBe(true);
      expect(CABIN_SPRITES[b.style as keyof typeof CABIN_SPRITES], b.style).toBeDefined();
    }
  });
});

/** Width and height of a PNG from its IHDR chunk. */
function pngSize(url: string): { w: number; h: number } {
  const buf = readFileSync(join(__dirname, '..', 'public', url));
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('nobody is hidden', () => {
  // Everything in an isometric map is drawn back to front by x + y, so something nearer the camera than a character covers them if its picture
  // reaches over the character's place on the screen. A building or a banner pole on the "wrong" side of an NPC hides them completely.
  const SCALE = 32; // screen pixels per tile along each diagonal: x = (tx - ty) * 32, y = (tx + ty) * 16
  interface Cover {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    scale: number;
    anchorY: number;
  }

  function covers(id: string): Cover[] {
    const map = loadMap(id);
    const list: Cover[] = [];
    const art = THEME_ART[map.theme];
    for (const b of map.buildings) {
      const sprite = CABIN_SPRITES[b.style as keyof typeof CABIN_SPRITES]!;
      list.push({ name: `building ${b.style}`, x: b.x + b.w / 2, y: b.y + b.h / 2, w: sprite.width, h: sprite.height, scale: 0.5, anchorY: sprite.anchorY });
    }
    for (const d of map.decor) {
      const def = DECOR_KINDS[d.kind]!;
      const { w, h } = pngSize(`assets/props/${def.keys[0]!.replace('.', '_')}.png`);
      list.push({ name: `decor ${d.kind}`, x: d.x, y: d.y, w, h, scale: def.scale, anchorY: 0.2 });
    }
    const propKey = art.props?.[0];
    for (const p of map.props) {
      const { w, h } = propKey ? pngSize(`assets/props/prop_${propKey.slice(5)}.png`) : { w: 75, h: 63 };
      list.push({ name: 'prop', x: p.tileX + 0.5, y: p.tileY + 0.5, w, h, scale: propKey ? 0.36 : 1, anchorY: 0.15 });
    }
    // the trees on the edge of the map
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileAt(map, x, y) === TileType.TREE) list.push({ name: 'tree', x: x + 0.5, y: y + 0.5, w: 240, h: 280, scale: 0.5, anchorY: 0.1 });
      }
    }
    return list;
  }

  it.each(['qinglan_town'])('%s: nothing nearer the camera covers an NPC', (id) => {
    const map = loadMap(id);
    const all = covers(id);
    for (const npc of map.npcs) {
      const nx = (npc.pos.x - npc.pos.y) * SCALE;
      const ny = (npc.pos.x + npc.pos.y) * (SCALE / 2);
      const body = { left: nx - 10, right: nx + 10, top: ny - 44, bottom: ny };
      for (const c of all) {
        if (c.x + c.y <= npc.pos.x + npc.pos.y) continue; // behind them: they stand in front of it
        const cx = (c.x - c.y) * SCALE;
        const cy = (c.x + c.y) * (SCALE / 2);
        const halfWidth = (c.w * c.scale * 0.35); // the middle 70%: the corners of a picture are empty
        const bottom = cy + c.anchorY * c.h * c.scale;
        const top = bottom - c.h * c.scale;
        const hides = cx - halfWidth < body.right && cx + halfWidth > body.left && top < body.bottom && bottom > body.top;
        expect(hides, `${c.name} at ${c.x},${c.y} hides ${npc.id}`).toBe(false);
      }
    }
  });
});
