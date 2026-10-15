import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_THEMES, parseMap } from '../src/data/mapData';
import { WORLD_MAP_FILES } from '../src/data/worldMaps';
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
