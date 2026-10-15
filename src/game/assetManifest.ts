import type { EquipSlot } from '../data/items';
import type { AnimationSet } from './AnimationClock';
import {
  BOSS_FRAME,
  drawArchonSheet,
  drawBoatwrightSheet,
  drawElderSheet,
  drawEchoSheet,
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
import { SPIKE_SPRITE, drawArrowSlit, drawChunk, drawCloud, drawDisc, drawGlow, drawRipple, drawRootSpike, drawPillarColumn, drawSpikes, drawTorch } from './HazardArt';
import { drawCliffWall, drawMossyWall } from './RuinsArt';
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
  HERO: 'char.hero',
  GHOUL: 'monster.ghoul',
  SHADE: 'monster.shade',
  HOUND: 'monster.hound',
  WOLF: 'monster.wolf',
  VIPER: 'monster.viper',
  GEL: 'monster.spring_gel',
  BAT: 'monster.crystal_bat',
  DEER: 'monster.corroded_deer',
  GOLEM: 'monster.rock_golem',
  ATTENDANT: 'monster.stone_attendant',
  MASK: 'monster.mask_spirit',
  WATCHER: 'monster.core_watcher',
  BOAR: 'monster.cleft_boar',
  GREEN_FANG: 'monster.green_fang_wolf',
  VINE_APE: 'monster.vine_ape',
  ROT_FLOWER: 'monster.rot_flower',
  WARDEN: 'monster.old_wood_warden',
  BLADE_WOLF: 'monster.mountain_blade_wolf',
  SWORDSMAN: 'monster.exiled_swordsman',
  CULTIST: 'monster.fallen_cultivator',
  COLOSSUS: 'monster.broken_sword_colossus',
  SPIRIT: 'monster.drowned_spirit',
  REVENANT: 'monster.wreck_revenant',
  RIPPLE: 'fx.ripple',
  CHUNK: 'fx.chunk',
  DISC: 'fx.disc',
  ROOT_SPIKE: 'fx.root_spike',
  CLOUD: 'fx.cloud',
  PILLAR: 'fx.pillar',
  WARPED: 'monster.warped',
  WATER_SHADE: 'monster.water_shade',
  ECHO: 'monster.echo',
  BOSS: 'monster.boss',
  SHARD: 'object.shard',
  GOLD_SMALL: 'object.gold_small',
  GOLD_MID: 'object.gold_mid',
  GOLD_BIG: 'object.gold_big',
  RELIC: 'object.relic',
  SPIKES_HIDDEN: 'trap.spikes_hidden',
  SPIKES_WARN: 'trap.spikes_warn',
  SPIKES_UP: 'trap.spikes_up',
  SLIT: 'trap.slit',
  SLIT_HOT: 'trap.slit_hot',
  TORCH_A: 'fx.torch_a',
  TORCH_B: 'fx.torch_b',
  GLOW: 'fx.glow',
  NPC_ELDER: 'npc.elder',
  NPC_HUNTER: 'npc.hunter',
  NPC_WATERER: 'npc.waterer',
  NPC_BOATWRIGHT: 'npc.boatwright',
  NPC_ZHOU: 'npc.zhou',
  NPC_QINGHE: 'npc.qinghe',
  NPC_TIESHAN: 'npc.tieshan',
  NPC_GU: 'npc.gu',
  NPC_LIN: 'npc.lin',
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
/**
 * The ground of chapter 2 (generated textures turned into tiles by tools/prepare_tiles.py): a floor set and a path set per theme.
 * `full` tiles fill a floor or the middle of a path; `edge` patches are soft-edged and are laid over the floor along the sides of a path.
 */
export const TILE_SETS = {
  flag: { full: 8, edge: 0 },
  flagroad: { full: 8, edge: 6 },
  soil: { full: 8, edge: 0 },
  trail: { full: 8, edge: 6 },
  rock: { full: 8, edge: 0 },
  rockroad: { full: 8, edge: 6 },
  ash: { full: 8, edge: 0 },
  ashtrail: { full: 8, edge: 6 },
} as const;
export type TileSetName = keyof typeof TILE_SETS;
/** How big a heap of 墜金 is drawn, as a fraction of its picture's pixel size (it was 0.5 at first, which was too big: now a fifth of that). */
export const GOLD_ICON_SCALE = 0.1;
/** Dead trees (forest, town, the wet woods of the coast), sword cairns and pillars (the pass), black sea rocks (the coast): generated pictures. */
export const DEAD_TREE_KEYS = ['a', 'c', 'e', 'f', 'g'].map((n) => `terrain.tree_dead_${n}`);
export const SPIRE_KEYS = ['a', 'b', 'c'].map((n) => `terrain.spire_${n}`);
export const SEA_ROCK_KEYS = ['a', 'b'].map((n) => `terrain.rock_sea_${n}`);
/** The solid props of Qinglan Town, in place of crates and barrels: sealed jars, burial urns, a coffin. */
export const TOWN_PROP_KEYS = ['jar_a', 'jar_b', 'jar_c'].map((n) => `prop.${n}`);
const tileKeys = (set: TileSetName, edge: boolean): string[] =>
  Array.from({ length: edge ? TILE_SETS[set].edge : TILE_SETS[set].full }, (_, i) => `terrain.${set}_${edge ? 'edge_' : ''}${i}`);
const tilePath = (set: TileSetName) => ({ full: tileKeys(set, false), edge: tileKeys(set, true) });
export interface PathArt {
  full: readonly string[];
  edge: readonly string[];
}
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
export const DECOR_KINDS: Record<string, { keys: readonly string[]; scale: number; /** drawn hovering and bobbing (floating crystals) */ floats?: boolean }> = {
  stump: { keys: ['decor.stump_a', 'decor.stump_b', 'decor.stump_c', 'decor.stump_d'], scale: 0.6 },
  firewood: { keys: ['decor.firewood_a', 'decor.firewood_b', 'decor.firewood_c'], scale: 0.6 },
  cauldron: { keys: ['decor.cauldron'], scale: 0.6 },
  bush: { keys: ['plant.bush01', 'plant.bush03', 'plant.bush05'], scale: 0.5 },
  shrub: { keys: ['plant.shrub1-01', 'plant.shrub1-03', 'plant.shrub2-01'], scale: 0.5 },
  tuft: { keys: ['plant.grasses01', 'plant.grasses03', 'plant.grasses05', 'plant.weed01', 'plant.weed03'], scale: 0.5 },
  palm: { keys: ['plant.palm01', 'plant.palm03', 'plant.palm05'], scale: 0.5 },
  tropical: { keys: ['plant.tropical01'], scale: 0.5 },
  // generated pictures (docs/art/props): glowing moss and creeping vines
  moss: { keys: ['decor.moss_a', 'decor.moss_b'], scale: 0.4 },
  vines: { keys: ['decor.vines_a', 'decor.vines_b', 'decor.vines_c'], scale: 0.4 },
  // the primordial core: root tangles, floating crystal shards, and the core itself
  roots: { keys: ['decor.roots_a', 'decor.roots_b'], scale: 0.4 },
  shard: { keys: ['decor.shard_a', 'decor.shard_b'], scale: 0.32, floats: true },
  core: { keys: ['decor.core'], scale: 0.5 },
  // the Mist Coast
  fungus: { keys: ['decor.fungus_c', 'decor.fungus_d'], scale: 0.4 },
  // the dark xianxia dressing of chapter 2 (generated pictures, see docs/design/chapter2-art-direction.md)
  lantern: { keys: ['decor.lantern'], scale: 0.4 },
  censer: { keys: ['decor.censer'], scale: 0.3 },
  banner: { keys: ['decor.banner'], scale: 0.4 },
  bones: { keys: ['decor.bones'], scale: 0.4 },
  grave: { keys: ['decor.grave'], scale: 0.45 },
  lion: { keys: ['decor.lion'], scale: 0.5 },
  tablet: { keys: ['decor.tablet_a'], scale: 0.42 },
  altar: { keys: ['decor.altar_a'], scale: 0.45 },
  driftwood: { keys: ['decor.driftwood_a', 'decor.driftwood_b'], scale: 0.4 },
  anchor: { keys: ['decor.anchor'], scale: 0.4 },
};
export const THEME_SCATTER: Record<MapTheme, { kinds: readonly string[]; density: number } | null> = {
  stone: null,
  ruins: { kinds: ['vines', 'moss', 'vines'], density: 0.05 },
  core: { kinds: ['roots', 'shard', 'roots', 'vines', 'shard'], density: 0.06 },
  mist: { kinds: ['driftwood', 'bones', 'driftwood', 'fungus'], density: 0.022 },
  mountain: { kinds: ['bones', 'bones', 'shard'], density: 0.006 },
  sect: null,
  blight: { kinds: ['fungus', 'bones', 'roots', 'fungus', 'vines'], density: 0.03 },
  grass: { kinds: ['tuft', 'tuft', 'tuft', 'bush', 'shrub'], density: 0.07 },
  sand: { kinds: ['palm', 'tuft', 'tropical'], density: 0.015 },
  cave: { kinds: ['moss', 'moss', 'vines'], density: 0.045 },
};
export const MURK_KEYS = [0, 1].map((i) => `terrain.murk_${i}`);
export const BOULDER_KEYS = [0, 1, 2].map((i) => `terrain.boulder_${i}`);
export const PILLAR_KEYS = [0, 1, 2].map((i) => `terrain.pillar_${i}`);
/** The cave's "T" tiles: clusters of glowing crystal (generated pictures; the drawn rock pillar is the fallback). */
export const CRYSTAL_KEYS = [0, 1, 2].map((i) => `terrain.crystal_${i}`);
/** The ruins' wall blocks: stone with moss and vines (drawn with canvas code, see RuinsArt). */
/** The core's "T" tiles: giant carved pillars wrapped in roots (generated pictures). */
export const CORE_PILLAR_KEYS = [0, 1].map((i) => `terrain.core_pillar_${i}`);
export const MOSSY_WALL_KEYS = [0, 1, 2, 3].map((i) => `tile.wall_mossy_${i}`);
/** The cliffs of the broken-sword pass: the plain wall block in dark slate, cracked and chipped. */
export const CLIFF_WALL_KEYS = [0, 1, 2].map((i) => `tile.wall_cliff_${i}`);

/** What a map theme is made of: floor tiles, what a "T" tile looks like, and its water. */
export interface ThemeArt {
  /** Floor tile keys; `floorPick` (if given) lists which to use, repeated for frequency, otherwise a checkerboard of two. */
  floor: readonly string[];
  floorPick?: readonly number[];
  /** Sprites for "T" tiles; null means they are drawn like walls. */
  obstacles: readonly string[] | null;
  water: readonly string[];
  /** Wall block variants, chosen per tile; omitted means the plain wall. */
  walls?: readonly string[];
  /** The tiles of a path ("," in the layout); omitted means the dirt path of chapter 1. */
  path?: PathArt;
  /** The solid props ("c" in the layout); omitted means crates and barrels. */
  props?: readonly string[];
  /** What the grass patches of this map (the `grass` mask of a map file) are made of; omitted means green grass and trees. */
  wild?: { floor: readonly string[]; trees: readonly string[] };
}

const PICK8 = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const THEME_ART: Record<MapTheme, ThemeArt> = {
  stone: { floor: [SpriteKey.FLOOR_A, SpriteKey.FLOOR_B], obstacles: null, water: SEA_KEYS },
  ruins: { floor: [SpriteKey.FLOOR_A, SpriteKey.FLOOR_B], obstacles: null, water: SEA_KEYS, walls: MOSSY_WALL_KEYS },
  core: { floor: [SpriteKey.FLOOR_A, SpriteKey.FLOOR_B], obstacles: CORE_PILLAR_KEYS, water: SEA_KEYS, walls: MOSSY_WALL_KEYS },
  grass: { floor: GRASS_KEYS, floorPick: GRASS_PICK, obstacles: TREE_KEYS, water: SEA_KEYS },
  sand: { floor: SAND_KEYS, floorPick: [0, 0, 1], obstacles: BOULDER_KEYS, water: SEA_KEYS },
  mist: {
    floor: tileKeys('ash', false),
    floorPick: PICK8,
    obstacles: SEA_ROCK_KEYS,
    water: SEA_KEYS,
    path: tilePath('ashtrail'),
    wild: { floor: tileKeys('soil', false), trees: DEAD_TREE_KEYS },
  },
  mountain: { floor: tileKeys('rock', false), floorPick: PICK8, obstacles: SPIRE_KEYS, water: MURK_KEYS, path: tilePath('rockroad'), walls: CLIFF_WALL_KEYS },
  sect: { floor: tileKeys('flag', false), floorPick: PICK8, obstacles: DEAD_TREE_KEYS, water: SEA_KEYS, path: tilePath('flagroad'), props: TOWN_PROP_KEYS },
  blight: { floor: tileKeys('soil', false), floorPick: PICK8, obstacles: DEAD_TREE_KEYS, water: SEA_KEYS, path: tilePath('trail') },
  // about one in three obstacles is a crystal cluster, the rest are plain rock pillars
  cave: { floor: CAVE_KEYS, floorPick: [0, 0, 1], obstacles: [PILLAR_KEYS[0]!, CRYSTAL_KEYS[0]!, PILLAR_KEYS[1]!, PILLAR_KEYS[2]!, CRYSTAL_KEYS[1]!, PILLAR_KEYS[0]!, PILLAR_KEYS[1]!, CRYSTAL_KEYS[2]!, PILLAR_KEYS[2]!], water: MURK_KEYS },
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
function propSprite(key: string, url: string, scale: number, anchorY: number, placeholder: () => HTMLCanvasElement = () => drawCrate()): SpriteAssetDef {
  return {
    key,
    url,
    frameWidth: 0,
    frameHeight: 0,
    measure: true,
    displayScale: scale,
    smooth: true,
    anchor: { x: 0.5, y: anchorY },
    placeholder,
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

/** Frame size of the 4-facing pixel-art character sheets and how much they are enlarged (see directionalCharacters below). */
const CHARACTER_FRAME = { width: 64, height: 64, scale: 1 };

export const ASSET_MANIFEST: SpriteAssetDef[] = [
  terrainSprite(SpriteKey.SHARD, 64, 64, 0.25, drawShard),
  terrainSprite(SpriteKey.RELIC, 64, 64, 0.25, drawRelic),
  // third-party tiles (rubberduck, CC0; see ASSETS.md): 128 x 64 images shown at half size
  ...SAND_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawSandTile(i % 2), `assets/tiles/sand_${i}.png`)),
  ...CAVE_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawCaveTile(i % 2), `assets/tiles/cave_${i}.png`)),
  ...(Object.keys(TILE_SETS) as TileSetName[]).flatMap((set) =>
    [false, true].flatMap((edge) => tileKeys(set, edge).map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawCaveTile(i % 2), `assets/tiles/${set}_${edge ? 'edge_' : ''}${i}.png`))),
  ),
  ...SEA_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawWaterTile('sea', i % 2), `assets/tiles/sea_${i}.png`)),
  ...DIRT_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawDirtTile(i), `assets/tiles/dirt_${i}.png`)),
  ...DIRT_EDGE_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawDirtTile(i), `assets/tiles/dirt_edge_${i}.png`)),
  ...PROP_NAMES.map((name) => propSprite(`prop.${name}`, `assets/props/prop_${name}.png`, 1, 0.22)),
  // 墜金, the money monsters drop: three sizes of heap (generated pictures)
  ...([[SpriteKey.GOLD_SMALL, 'small'], [SpriteKey.GOLD_MID, 'mid'], [SpriteKey.GOLD_BIG, 'big']] as const).map(([key, size]) =>
    propSprite(key, `assets/props/gold_${size}.png`, GOLD_ICON_SCALE, 0.3, enlarged(drawShard, 64, 64)),
  ),

  ...TOWN_PROP_KEYS.map((key) => propSprite(key, `assets/props/prop_${key.slice(5)}.png`, 0.36, 0.15)),
  ...DEAD_TREE_KEYS.map((key) => propSprite(key, `assets/props/${key.replace('terrain.', '')}.png`, 0.5, 0.1, enlarged(drawTreeBlock, 256, 256))),
  ...SPIRE_KEYS.map((key) => propSprite(key, `assets/props/${key.replace('terrain.', '')}.png`, 0.36, 0.1, enlarged(() => drawRock('pillar', 0), 64, 64))),
  ...SEA_ROCK_KEYS.map((key) => propSprite(key, `assets/props/${key.replace('terrain.', '')}.png`, 0.5, 0.2, enlarged(() => drawRock('boulder', 0), 64, 64))),
  ...Object.values(DECOR_KINDS).flatMap((k) => k.keys.map((key) => propSprite(key, `assets/props/${key.replace('.', '_')}.png`, k.scale, 0.2))),
  ...MURK_KEYS.map((key, i) => terrainSprite(key, 64, 32, 0.5, () => drawWaterTile('murk', i))),
  // beach boulders: generated pictures (docs/art/props), shown at 0.45x; the drawn rock is the fallback
  ...BOULDER_KEYS.map((key, i) => propSprite(key, `assets/props/boulder_${i}.png`, 0.45, 0.27, enlarged(() => drawRock('boulder', i), 64, 64))),
  ...PILLAR_KEYS.map((key, i) => terrainSprite(key, 64, 64, 0.25, () => drawRock('pillar', i))),
  ...CRYSTAL_KEYS.map((key, i) => propSprite(key, `assets/props/crystal_${i}.png`, 0.34, 0.2, enlarged(() => drawRock('pillar', i), 170, 220))),
  ...CORE_PILLAR_KEYS.map((key, i) => propSprite(key, `assets/props/core_pillar_${i}.png`, 0.42, 0.14, enlarged(() => drawRock('pillar', i), 170, 220))),
  ...MOSSY_WALL_KEYS.map((key, i): SpriteAssetDef => ({ key, frameWidth: 64, frameHeight: 64, anchor: { x: 0.5, y: 0.25 }, placeholder: () => drawMossyWall(i) })),
  ...CLIFF_WALL_KEYS.map((key, i): SpriteAssetDef => ({ key, frameWidth: 64, frameHeight: 64, anchor: { x: 0.5, y: 0.25 }, placeholder: () => drawCliffWall(i) })),
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
  ...directionalMonsters(),
  characterSprite(SpriteKey.WARPED, 8, drawWarpedSheet),
  characterSprite(SpriteKey.WATER_SHADE, 8, drawWaterShadeSheet),
  characterSprite(SpriteKey.ECHO, 8, drawEchoSheet, 64),
  characterSprite(SpriteKey.BOSS, 8, drawArchonSheet, BOSS_FRAME),
  ...directionalCharacters(),
  // the ruins' hazards and torches: drawn with canvas code (HazardArt)
  { key: SpriteKey.SPIKES_HIDDEN, frameWidth: SPIKE_SPRITE.width, frameHeight: SPIKE_SPRITE.height, anchor: { x: 0.5, y: 0.25 }, placeholder: () => drawSpikes('hidden') },
  { key: SpriteKey.SPIKES_WARN, frameWidth: SPIKE_SPRITE.width, frameHeight: SPIKE_SPRITE.height, anchor: { x: 0.5, y: 0.25 }, placeholder: () => drawSpikes('warn') },
  { key: SpriteKey.SPIKES_UP, frameWidth: SPIKE_SPRITE.width, frameHeight: SPIKE_SPRITE.height, anchor: { x: 0.5, y: 0.25 }, placeholder: () => drawSpikes('up') },
  { key: SpriteKey.SLIT, frameWidth: 24, frameHeight: 32, anchor: { x: 0.5, y: 0.5 }, placeholder: () => drawArrowSlit(false) },
  { key: SpriteKey.SLIT_HOT, frameWidth: 24, frameHeight: 32, anchor: { x: 0.5, y: 0.5 }, placeholder: () => drawArrowSlit(true) },
  { key: SpriteKey.TORCH_A, frameWidth: 20, frameHeight: 34, anchor: { x: 0.5, y: 0 }, placeholder: () => drawTorch(0) },
  { key: SpriteKey.TORCH_B, frameWidth: 20, frameHeight: 34, anchor: { x: 0.5, y: 0 }, placeholder: () => drawTorch(1) },
  { key: SpriteKey.CLOUD, frameWidth: 128, frameHeight: 128, smooth: true, anchor: { x: 0.5, y: 0.5 }, placeholder: drawCloud },
  { key: SpriteKey.ROOT_SPIKE, frameWidth: 40, frameHeight: 84, anchor: { x: 0.5, y: 0.1 }, placeholder: drawRootSpike },
  { key: SpriteKey.DISC, frameWidth: 128, frameHeight: 128, smooth: true, anchor: { x: 0.5, y: 0.5 }, placeholder: drawDisc },
  { key: SpriteKey.RIPPLE, frameWidth: 48, frameHeight: 24, smooth: true, anchor: { x: 0.5, y: 0.5 }, placeholder: drawRipple },
  { key: SpriteKey.CHUNK, frameWidth: 12, frameHeight: 10, anchor: { x: 0.5, y: 0.5 }, placeholder: drawChunk },
  { key: SpriteKey.PILLAR, frameWidth: 40, frameHeight: 84, anchor: { x: 0.5, y: 0.1 }, placeholder: drawPillarColumn },
  { key: SpriteKey.GLOW, frameWidth: 128, frameHeight: 128, smooth: true, anchor: { x: 0.5, y: 0.5 }, placeholder: drawGlow },
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
 * Characters with 4 facings (front, right, back, left): pixel art made from the characters' turnaround drawings (see ASSETS.md and
 * tools/prepare_sprites.py). Each sheet is 12 columns (4 idle frames, 8 roll frames) x 4 rows (one per facing) of 64 px frames, drawn without
 * smoothing. The walk, attack, hurt and death poses are acted out by DirectionalAnimator; the dodge roll has its own frames. If an image fails to load, the old
 * procedural figure stands in (one frame repeated).
 */

/** 4 idle frames + 8 roll frames per facing (see DirectionalAnimator IDLE_FRAMES / ROLL_FRAMES). */
export const CHARACTER_SHEET = { columns: 12, rows: 4 };

function directionalPlaceholder(base: () => HTMLCanvasElement, frame: number, baseFrame = 64): () => HTMLCanvasElement {
  return () => {
    const art = base(); // the procedural sheets start with a square idle frame at the top left
    const [canvas, ctx] = makeCanvas(frame * CHARACTER_SHEET.columns, frame * CHARACTER_SHEET.rows);
    const source = baseFrame;
    for (let r = 0; r < CHARACTER_SHEET.rows; r++) {
      for (let c = 0; c < CHARACTER_SHEET.columns; c++) {
        ctx.drawImage(art, 0, 0, source, source, c * frame, r * frame, frame, frame);
      }
    }
    return canvas;
  };
}

function directionalSheet(key: string, name: string, base: () => HTMLCanvasElement, frame = CHARACTER_FRAME.width, baseFrame = 64): SpriteAssetDef {
  return {
    key,
    url: `assets/characters/${name}.png`,
    frameWidth: frame,
    frameHeight: frame,
    displayScale: CHARACTER_FRAME.scale,
    // the soles are on row 62 of the 64 px frame, with the outline below them (tools/prepare_sprites.py BASELINE)
    anchor: { x: 0.5, y: 2 / frame },
    placeholder: directionalPlaceholder(base, frame, baseFrame),
  };
}

/** A monster with 4 facings: same layout as a character's sheet but only the 4 idle frames per facing (no roll). Big ones use a larger frame. */
function directionalMonster(key: string, name: string, base: () => HTMLCanvasElement, frame = CHARACTER_FRAME.width, baseFrame = 64): SpriteAssetDef {
  return { ...directionalSheet(key, name, base, frame, baseFrame), url: `assets/monsters/${name}.png` };
}

function directionalMonsters(): SpriteAssetDef[] {
  return [
    directionalMonster(SpriteKey.WOLF, 'forest_wolf', drawHoundSheet),
    directionalMonster(SpriteKey.VIPER, 'forest_viper', drawShadeSheet),
    directionalMonster(SpriteKey.GEL, 'spring_gel', drawWaterShadeSheet),
    directionalMonster(SpriteKey.BAT, 'crystal_bat', drawShadeSheet),
    directionalMonster(SpriteKey.DEER, 'corroded_deer', drawArchonSheet, BOSS_FRAME, BOSS_FRAME),
    directionalMonster(SpriteKey.GOLEM, 'rock_golem', drawEchoSheet, 96),
    directionalMonster(SpriteKey.ATTENDANT, 'stone_attendant', drawEchoSheet, 80),
    directionalMonster(SpriteKey.MASK, 'mask_spirit', drawShadeSheet),
    directionalMonster(SpriteKey.WATCHER, 'core_watcher', drawArchonSheet, 128, BOSS_FRAME),
    directionalMonster(SpriteKey.BOAR, 'cleft_boar', drawHoundSheet),
    directionalMonster(SpriteKey.SPIRIT, 'drowned_spirit', drawWaterShadeSheet, 80),
    directionalMonster(SpriteKey.REVENANT, 'wreck_revenant', drawGhoulSheet, 80),
    // chapter 2: the green-vine forest and the broken-sword pass (frame sizes follow tools/prepare_sprites.py)
    directionalMonster(SpriteKey.GREEN_FANG, 'green_fang_wolf', drawHoundSheet),
    directionalMonster(SpriteKey.VINE_APE, 'vine_ape', drawGhoulSheet, 96),
    directionalMonster(SpriteKey.ROT_FLOWER, 'rot_flower', drawShadeSheet, 80),
    directionalMonster(SpriteKey.WARDEN, 'old_wood_warden', drawArchonSheet, 128, BOSS_FRAME),
    directionalMonster(SpriteKey.BLADE_WOLF, 'mountain_blade_wolf', drawHoundSheet),
    directionalMonster(SpriteKey.SWORDSMAN, 'exiled_swordsman', drawGhoulSheet, 80),
    directionalMonster(SpriteKey.CULTIST, 'fallen_cultivator', drawShadeSheet, 80),
    directionalMonster(SpriteKey.COLOSSUS, 'broken_sword_colossus', drawArchonSheet, 128, BOSS_FRAME),
  ];
}

function directionalCharacters(): SpriteAssetDef[] {
  return [
    directionalSheet(SpriteKey.HERO, 'hero', drawPlayerSheet),
    directionalSheet(SpriteKey.NPC_ELDER, 'elder_qiyi', drawElderSheet),
    directionalSheet(SpriteKey.NPC_HUNTER, 'hunter_yanya', drawHunterSheet),
    directionalSheet(SpriteKey.NPC_WATERER, 'waterer_xi', drawWatererSheet),
    directionalSheet(SpriteKey.NPC_BOATWRIGHT, 'boatwright_laodu', drawBoatwrightSheet),
    directionalSheet(SpriteKey.NPC_ZHOU, 'innkeeper_zhoubo', drawElderSheet),
    directionalSheet(SpriteKey.NPC_QINGHE, 'herbalist_qinghe', drawWatererSheet),
    directionalSheet(SpriteKey.NPC_TIESHAN, 'blacksmith_tieshan', drawBoatwrightSheet),
    directionalSheet(SpriteKey.NPC_GU, 'wanderer_guchangfeng', drawHunterSheet),
    directionalSheet(SpriteKey.NPC_LIN, 'patrol_linruotang', drawWatererSheet),
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
