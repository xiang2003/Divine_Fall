import type { EquipSlot } from '../data/items';
import type { AnimationSet } from './AnimationClock';
import {
  BOSS_FRAME,
  drawArchonSheet,
  drawBoatwrightSheet,
  drawElderSheet,
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
import { BUILDING_VARIANTS, SUPERSAMPLE, buildingCanvasSize, buildingKey, drawBuilding } from './BuildingArt';
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
  GHOUL: 'monster.ghoul',
  SHADE: 'monster.shade',
  HOUND: 'monster.hound',
  BOSS: 'monster.boss',
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

export const ASSET_MANIFEST: SpriteAssetDef[] = [
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
  characterSprite(SpriteKey.PLAYER, 12, drawPlayerSheet),
  characterSprite(SpriteKey.GHOUL, 8, drawGhoulSheet),
  characterSprite(SpriteKey.SHADE, 8, drawShadeSheet),
  characterSprite(SpriteKey.HOUND, 8, drawHoundSheet),
  characterSprite(SpriteKey.BOSS, 8, drawArchonSheet, BOSS_FRAME),
  characterSprite(SpriteKey.NPC_ELDER, 8, drawElderSheet),
  characterSprite(SpriteKey.NPC_HUNTER, 8, drawHunterSheet),
  characterSprite(SpriteKey.NPC_WATERER, 8, drawWatererSheet),
  characterSprite(SpriteKey.NPC_BOATWRIGHT, 8, drawBoatwrightSheet),
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

/** Which ground sprite shows an item of each equipment slot. */
export const SLOT_ICON_KEY: Record<EquipSlot, string> = {
  weapon: SpriteKey.ICON_WEAPON,
  helmet: SpriteKey.ICON_HELMET,
  chest: SpriteKey.ICON_CHEST,
  boots: SpriteKey.ICON_BOOTS,
  ring: SpriteKey.ICON_RING,
};
