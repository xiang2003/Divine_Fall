import type { EquipSlot } from '../data/items';
import type { AnimationSet } from './AnimationClock';
import {
  BOSS_FRAME,
  drawArchonSheet,
  drawBoatwrightSheet,
  drawElderSheet,
  drawEchoSheet,
  drawFangSheet,
  drawWarpedSheet,
  drawWaterShadeSheet,
  drawHunterSheet,
  drawWatererSheet,
  drawBolt,
  drawGhoulSheet,
  drawHoundSheet,
  drawOrb,
  drawPlayerSheet,
  drawShadeSheet,
  characterAnimations,
} from './CharacterArt';
import { drawItemIcon, drawLootRing, ICON_SIZE } from './ItemArt';
import { BUILDING_VARIANTS, CABIN_SPRITES, SUPERSAMPLE, buildingCanvasSize, buildingKey, drawBuilding } from './BuildingArt';
import { TERRAIN_SUPERSAMPLE, drawCaveTile, drawDirtTile, drawRelic, drawRock, drawSandTile, drawShard, drawWaterTile } from './TerrainArt';
import type { MapTheme } from '../data/mapData';
import { drawCrate, drawFloorTile, drawGrassTile, drawMoveMarker, drawShadow, drawTreeBlock, drawWallBlock, makeCanvas } from './PlaceholderArt';

export interface SpriteAssetDef {
  key: string;
  /**
   * Path relative to the site base (e.g. "assets/characters/hero.png").
   * Leave undefined to use the placeholder. If it is set but fails to load, the loader
   * records an error and falls back to the placeholder instead of crashing.
   */
  url?: string;
  /** Size of one frame in pixels. For single-image sprites this is the whole image. */
  frameWidth: number;
  frameHeight: number;
  /** Scene pixels per image pixel (default 1). 0.5 shows a 128x64 painted tile on the 64x32 grid. */
  displayScale?: number;
  /** The frame is the whole image: take frameWidth / frameHeight from the loaded image (for single sprites of varying size). */
  measure?: boolean;
  /** Smooth (linear) filtering for painted art; pixel art keeps the default nearest filtering. */
  smooth?: boolean;
  /** Foot / pivot point as a fraction of the frame, measured from the bottom-left. */
  anchor: { x: number; y: number };
  animations?: AnimationSet;
  /** Procedural stand-in, also used as the fallback when `url` cannot be loaded. */
  placeholder: () => HTMLCanvasElement;
}

export const SpriteKey = {
  FLOOR_A: 'tile.floor_a',
  FLOOR_B: 'tile.floor_b',
  FLOOR_EXIT: 'tile.floor_exit',
  WALL: 'tile.wall',
  CRATE: 'prop.crate',
  SHADOW: 'fx.shadow',
  MOVE_MARKER: 'fx.move_marker',
  ORB: 'fx.orb',
  BOLT: 'fx.bolt',
  LOOT_RING: 'fx.loot_ring',
  ICON_WEAPON: 'item.weapon',
  ICON_HELMET: 'item.helmet',
  ICON_CHEST: 'item.chest',
  ICON_BOOTS: 'item.boots',
  ICON_RING: 'item.ring',
  PLAYER: 'char.player',
  HERO_IDLE: 'char.hero_idle',
  HERO_RUN: 'char.hero_run',
  GHOUL: 'monster.ghoul',
  SHADE: 'monster.shade',
  HOUND: 'monster.hound',
  FANG: 'monster.fang',
  WARPED: 'monster.warped',
  WATER_SHADE: 'monster.water_shade',
  ECHO: 'monster.echo',
  BOSS: 'monster.boss',
  SHARD: 'object.shard',
  RELIC: 'object.relic',
  NPC_ELDER: 'npc.elder',
  NPC_HUNTER: 'npc.hunter',
  NPC_WATERER: 'npc.waterer',
  NPC_BOATWRIGHT: 'npc.boatwright',
} as const;

/**
 * Ground and tree art for outdoor maps (third-party, see ASSETS.md). A grass tile and a tree variant are chosen per tile
 * position with a stable hash, so a map always looks the same.
 */
export const GRASS_KEYS = [0, 1, 2, 3, 4, 5].map((i) => `tile.grass_${i}`);
export const GRASS_PICK = [0, 1, 2, 3, 4, 5] as const;
export const TREE_KEYS = [0, 1, 2, 3, 4, 5, 6].map((i) => `tree.tree_${i}`);

export const SAND_KEYS = [0, 1, 2, 3].map((i) => `terrain.sand_${i}`);
export const CAVE_KEYS = [0, 1, 2].map((i) => `terrain.cave_${i}`);
export const SEA_KEYS = [0, 1, 2, 3].map((i) => `terrain.sea_${i}`);
/** Dirt path: full tiles for the middle of a path, soft-edged patches (drawn over grass) along its sides. */
export const DIRT_KEYS = [0, 1, 2, 3].map((i) => `terrain.dirt_${i}`);
export const DIRT_EDGE_KEYS = [0, 1, 2, 3, 4, 5].map((i) => `terrain.dirt_edge_${i}`);
/** Solid props that stand on "c" tiles (crates, barrels and stacks of them), chosen per tile. */
export const PROP_NAMES = ['crate_a', 'crate_b', 'barrel', 'barrel_crate', 'barrel_crate_b', 'barrels', 'crates_pair', 'crates_stack'] as const;
export const PROP_KEYS = PROP_NAMES.map((n) => `prop.${n}`);
/**
 * Loose decoration. A map names kinds in its "decor" list; each kind is one image, or one of several chosen per spot.
 * `scatter` lists the kinds sprinkled automatically over the ground of each theme (nature only, never on paths or near anything).
 */
export const DECOR_KINDS: Record<string, { keys: readonly string[]; scale: number }> = {
  stump: { keys: ['decor.stump_a', 'decor.stump_b', 'decor.stump_c', 'decor.stump_d'], scale: 0.6 },
  firewood: { keys: ['decor.firewood_a', 'decor.firewood_b', 'decor.firewood_c'], scale: 0.6 },
  cauldron: { keys: ['decor.cauldron'], scale: 0.6 },
  bush: { keys: ['plant.bush01', 'plant.bush03', 'plant.bush05'], scale: 0.5 },
  shrub: { keys: ['plant.shrub1-01', 'plant.shrub1-03', 'plant.shrub2-01'], scale: 0.5 },
  tuft: { keys: ['plant.grasses01', 'plant.grasses03', 'plant.grasses05', 'plant.weed01', 'plant.weed03'], scale: 0.5 },
  palm: { keys: ['plant.palm01', 'plant.palm03', 'plant.palm05'], scale: 0.5 },
  tropical: { keys: ['plant.tropical01'], scale: 0.5 },
};
export const THEME_SCATTER: Record<MapTheme, { kinds: readonly string[]; density: number } | null> = {
  stone: null,
  grass: { kinds: ['tuft', 'tuft', 'tuft', 'bush', 'shrub'], density: 0.07 },
  sand: { kinds: ['palm', 'tuft', 'tropical'], density: 0.015 },
  cave: null,
};
export const MURK_KEYS = [0, 1].map((i) => `terrain.murk_${i}`);
export const BOULDER_KEYS = [0, 1, 2].map((i) => `terrain.boulder_${i}`);
export const PILLAR_KEYS = [0, 1, 2].map((i) => `terrain.pillar_${i}`);

/** What a map theme is made of: floor tiles, what a "T" tile looks like, and its water. */
export interface ThemeArt {
  /** Floor tile keys; `floorPick` (if given) lists which to use, repeated for frequency, otherwise a checkerboard of two. */
  floor: readonly string[];
  floorPick?: readonly number[];
  /** Sprites for "T" tiles; null means they are drawn like walls. */
  obstacles: readonly string[] | null;
  water: readonly string[];
}

export const THEME_ART: Record<MapTheme, ThemeArt> = {
  stone: { floor: [SpriteKey.FLOOR_A, SpriteKey.FLOOR_B], obstacles: null, water: SEA_KEYS },
  grass: { floor: GRASS_KEYS, floorPick: GRASS_PICK, obstacles: TREE_KEYS, water: SEA_KEYS },
  sand: { floor: SAND_KEYS, floorPick: [0, 0, 1], obstacles: BOULDER_KEYS, water: SEA_KEYS },
  cave: { floor: CAVE_KEYS, floorPick: [0, 0, 1], obstacles: PILLAR_KEYS, water: MURK_KEYS },
};

/** A procedural terrain sprite drawn at TERRAIN_SUPERSAMPLE x and shown at 1 / TERRAIN_SUPERSAMPLE with smoothing. */
function terrainSprite(key: string, width: number, height: number, anchorY: number, draw: () => HTMLCanvasElement, url?: string): SpriteAssetDef {
  return {
    key,
    url,
    frameWidth: width * TERRAIN_SUPERSAMPLE,
    frameHeight: height * TERRAIN_SUPERSAMPLE,
    displayScale: 1 / TERRAIN_SUPERSAMPLE,
    smooth: true,
    anchor: { x: 0.5, y: anchorY },
    placeholder: draw,
  };
}

/**
 * A third-party prop image (barrel, stump, bush...) standing on the ground, drawn at `scale` of its pixel size.
 * The frame size is not known here, so it is read from the image itself when it loads (see AssetLoader, \`measure\`).
 */
function propSprite(key: string, url: string, scale: number, anchorY: number): SpriteAssetDef {
  return {
    key,
    url,
    frameWidth: 0,
    frameHeight: 0,
    measure: true,
    displayScale: scale,
    smooth: true,
    anchor: { x: 0.5, y: anchorY },
    placeholder: () => drawCrate(),
  };
}

/** Draws a small procedural canvas onto a larger one (placeholder for a bigger image that failed to load). */
function enlarged(source: () => HTMLCanvasElement, width: number, height: number): () => HTMLCanvasElement {
  return () => {
    const src = source();
    const [canvas, ctx] = makeCanvas(width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, width, height);
    return canvas;
  };
}

function groundTile(index: number): SpriteAssetDef {
  return {
    key: GRASS_KEYS[index]!,
    url: `assets/tiles/grass_${index}.png`,
    frameWidth: 128,
    frameHeight: 64,
    displayScale: 0.5,
    smooth: true,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: enlarged(() => drawGrassTile(index % 2), 128, 64),
  };
}

function treeSprite(index: number): SpriteAssetDef {
  return {
    key: TREE_KEYS[index]!,
    url: `assets/trees/tree_${index}.png`,
    frameWidth: 256,
    frameHeight: 256,
    displayScale: 0.5,
    smooth: true,
    // The trunk stands on the base diamond, 64 of the 256 pixels above the bottom edge.
    anchor: { x: 0.5, y: 0.25 },
    placeholder: enlarged(drawTreeBlock, 256, 256),
  };
}

/** Buildings are drawn by BuildingArt at SUPERSAMPLE x resolution and shown at 1 / SUPERSAMPLE. */
function buildingSprite(style: (typeof BUILDING_VARIANTS)[number]['style'], w: number, h: number): SpriteAssetDef {
  const cabin = CABIN_SPRITES[style];
  if (cabin) {
    // Third-party render (shown at half size); if the image fails to load, the procedural drawing is stretched into its place.
    return {
      key: buildingKey(style, w, h),
      url: cabin.url,
      frameWidth: cabin.width,
      frameHeight: cabin.height,
      displayScale: 0.5,
      smooth: true,
      anchor: { x: 0.5, y: cabin.anchorY },
      placeholder: enlarged(() => drawBuilding(style, w, h), cabin.width, cabin.height),
    };
  }
  const size = buildingCanvasSize(w, h);
  return {
    key: buildingKey(style, w, h),
    frameWidth: size.width * SUPERSAMPLE,
    frameHeight: size.height * SUPERSAMPLE,
    displayScale: 1 / SUPERSAMPLE,
    smooth: true,
    // The pivot is the middle of the footprint on the ground.
    anchor: { x: size.centerX / size.width, y: (size.height - size.centerY) / size.height },
    placeholder: () => drawBuilding(style, w, h),
  };
}

/** Frame size of the 8-direction character sheets and how much they are shrunk (see directionalCharacters below). */
const CHARACTER_FRAME = { width: 132, height: 164, scale: 0.33 };

export const ASSET_MANIFEST: SpriteAssetDef[] = [
  terrainSprite(SpriteKey.SHARD, 64, 64, 0.25, drawShard),
  terrainSprite(SpriteKey.RELIC, 64, 64, 0.25, drawRelic),
  // third-party tiles (rubberduck, CC0; see ASSETS.md): 128 x 64 images shown at half size
  ...SAND_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawSandTile(i % 2), `assets/tiles/sand_${i}.png`)),
  ...CAVE_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawCaveTile(i % 2), `assets/tiles/cave_${i}.png`)),
  ...SEA_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawWaterTile('sea', i % 2), `assets/tiles/sea_${i}.png`)),
  ...DIRT_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawDirtTile(i), `assets/tiles/dirt_${i}.png`)),
  ...DIRT_EDGE_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawDirtTile(i), `assets/tiles/dirt_edge_${i}.png`)),
  ...PROP_NAMES.map((name) => propSprite(`prop.${name}`, `assets/props/prop_${name}.png`, 1, 0.22)),
  ...Object.values(DECOR_KINDS).flatMap((k) => k.keys.map((key) => propSprite(key, `assets/props/${key.replace('.', '_')}.png`, k.scale, 0.2))),
  ...MURK_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawWaterTile('murk', i))),
  ...BOULDER_KEYS.map((key, i) => terrainSprite(key, 64, 64, 0.25, () => drawRock('boulder', i))),
  ...PILLAR_KEYS.map((key, i) => terrainSprite(key, 64, 64, 0.25, () => drawRock('pillar', i))),
  ...BUILDING_VARIANTS.map((v) => buildingSprite(v.style, v.w, v.h)),
  ...GRASS_KEYS.map((_, i) => groundTile(i)),
  ...TREE_KEYS.map((_, i) => treeSprite(i)),
  {
    key: SpriteKey.FLOOR_A,
    frameWidth: 64,
    frameHeight: 32,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: () => drawFloorTile(0),
  },
  {
    key: SpriteKey.FLOOR_B,
    frameWidth: 64,
    frameHeight: 32,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: () => drawFloorTile(1),
  },
  {
    key: SpriteKey.FLOOR_EXIT,
    frameWidth: 64,
    frameHeight: 32,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: () => drawFloorTile(2),
  },
  {
    key: SpriteKey.WALL,
    frameWidth: 64,
    frameHeight: 64,
    anchor: { x: 0.5, y: 0.25 },
    placeholder: drawWallBlock,
  },
  {
    key: SpriteKey.CRATE,
    frameWidth: 48,
    frameHeight: 48,
    anchor: { x: 0.5, y: 0.25 },
    placeholder: drawCrate,
  },
  {
    key: SpriteKey.SHADOW,
    frameWidth: 40,
    frameHeight: 20,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: drawShadow,
  },
  {
    key: SpriteKey.MOVE_MARKER,
    frameWidth: 32,
    frameHeight: 16,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: drawMoveMarker,
  },
  {
    key: SpriteKey.ORB,
    frameWidth: 16,
    frameHeight: 16,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: drawOrb,
  },
  {
    key: SpriteKey.BOLT,
    frameWidth: 20,
    frameHeight: 20,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: drawBolt,
  },
  {
    key: SpriteKey.LOOT_RING,
    frameWidth: 48,
    frameHeight: 24,
    anchor: { x: 0.5, y: 0.5 },
    placeholder: drawLootRing,
  },
  itemIcon(SpriteKey.ICON_WEAPON, 'weapon'),
  itemIcon(SpriteKey.ICON_HELMET, 'helmet'),
  itemIcon(SpriteKey.ICON_CHEST, 'chest'),
  itemIcon(SpriteKey.ICON_BOOTS, 'boots'),
  itemIcon(SpriteKey.ICON_RING, 'ring'),
  characterSprite(SpriteKey.GHOUL, 8, drawGhoulSheet),
  characterSprite(SpriteKey.SHADE, 8, drawShadeSheet),
  characterSprite(SpriteKey.HOUND, 8, () => drawHoundSheet()),
  characterSprite(SpriteKey.FANG, 8, drawFangSheet),
  characterSprite(SpriteKey.WARPED, 8, drawWarpedSheet),
  characterSprite(SpriteKey.WATER_SHADE, 8, drawWaterShadeSheet),
  characterSprite(SpriteKey.ECHO, 8, drawEchoSheet, 64),
  characterSprite(SpriteKey.BOSS, 8, drawArchonSheet, BOSS_FRAME),
  ...directionalCharacters(),
];

/** Ground sprite for an item icon, standing on its bottom edge. */
function itemIcon(key: string, slot: EquipSlot): SpriteAssetDef {
  return {
    key,
    frameWidth: ICON_SIZE,
    frameHeight: ICON_SIZE,
    anchor: { x: 0.5, y: 0 },
    placeholder: () => drawItemIcon(slot),
  };
}

/** Standard 64x64 character sheet; attackFps sets how long (4 frames / fps) the attack animation lasts. */
function characterSprite(
  key: string,
  attackFps: number,
  placeholder: () => HTMLCanvasElement,
  frame = 64,
): SpriteAssetDef {
  return {
    key,
    frameWidth: frame,
    frameHeight: frame,
    anchor: { x: 0.5, y: 4 / frame },
    animations: characterAnimations(attackFps),
    placeholder,
  };
}

/**
 * Characters with 8 facing directions (Kenney's isometric figure, re-coloured; see ASSETS.md and tools/prepare_characters.py).
 * Idle sheets are 8 frames in a row (one per direction); the hero also has a run sheet of 8 rows x 10 frames.
 * Frames are 132 x 164 px, shown at a third of that size. If an image fails to load, the old procedural figure stands in.
 */

function directionalPlaceholder(base: () => HTMLCanvasElement, columns: number, rows: number): () => HTMLCanvasElement {
  return () => {
    const frame = base(); // the procedural sheets start with a 64 x 64 idle frame
    const [canvas, ctx] = makeCanvas(CHARACTER_FRAME.width * columns, CHARACTER_FRAME.height * rows);
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        ctx.drawImage(frame, 0, 0, 64, 64, c * CHARACTER_FRAME.width + 2, (r + 1) * CHARACTER_FRAME.height - 128 - 2, 128, 128);
      }
    }
    return canvas;
  };
}

function directionalSheet(key: string, url: string, columns: number, rows: number, base: () => HTMLCanvasElement): SpriteAssetDef {
  return {
    key,
    url,
    frameWidth: CHARACTER_FRAME.width,
    frameHeight: CHARACTER_FRAME.height,
    displayScale: CHARACTER_FRAME.scale,
    smooth: true,
    anchor: { x: 0.5, y: 4 / CHARACTER_FRAME.height },
    placeholder: directionalPlaceholder(base, columns, rows),
  };
}

function directionalCharacters(): SpriteAssetDef[] {
  return [
    directionalSheet(SpriteKey.HERO_IDLE, 'assets/characters/hero_idle.png', 8, 1, drawPlayerSheet),
    directionalSheet(SpriteKey.HERO_RUN, 'assets/characters/hero_run.png', 10, 8, drawPlayerSheet),
    directionalSheet(SpriteKey.NPC_ELDER, 'assets/characters/elder_idle.png', 8, 1, drawElderSheet),
    directionalSheet(SpriteKey.NPC_HUNTER, 'assets/characters/hunter_idle.png', 8, 1, drawHunterSheet),
    directionalSheet(SpriteKey.NPC_WATERER, 'assets/characters/waterer_idle.png', 8, 1, drawWatererSheet),
    directionalSheet(SpriteKey.NPC_BOATWRIGHT, 'assets/characters/boatwright_idle.png', 8, 1, drawBoatwrightSheet),
  ];
}

/** Which ground sprite shows an item of each equipment slot. */
export const SLOT_ICON_KEY: Record<EquipSlot, string> = {
  weapon: SpriteKey.ICON_WEAPON,
  helmet: SpriteKey.ICON_HELMET,
  chest: SpriteKey.ICON_CHEST,
  boots: SpriteKey.ICON_BOOTS,
  ring: SpriteKey.ICON_RING,
};
