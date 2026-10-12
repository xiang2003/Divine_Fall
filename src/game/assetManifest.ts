import type { AnimationSet } from './AnimationClock';
import {
  drawGhoulSheet,
  drawHoundSheet,
  drawOrb,
  drawPlayerSheet,
  drawShadeSheet,
  characterAnimations,
} from './CharacterArt';
import { drawCrate, drawFloorTile, drawMoveMarker, drawShadow, drawWallBlock } from './PlaceholderArt';

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
  PLAYER: 'char.player',
  GHOUL: 'monster.ghoul',
  SHADE: 'monster.shade',
  HOUND: 'monster.hound',
} as const;

export const ASSET_MANIFEST: SpriteAssetDef[] = [
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
  characterSprite(SpriteKey.PLAYER, 12, drawPlayerSheet),
  characterSprite(SpriteKey.GHOUL, 8, drawGhoulSheet),
  characterSprite(SpriteKey.SHADE, 8, drawShadeSheet),
  characterSprite(SpriteKey.HOUND, 8, drawHoundSheet),
];

/** Standard 64x64 character sheet; attackFps sets how long (4 frames / fps) the attack animation lasts. */
function characterSprite(key: string, attackFps: number, placeholder: () => HTMLCanvasElement): SpriteAssetDef {
  return {
    key,
    frameWidth: 64,
    frameHeight: 64,
    anchor: { x: 0.5, y: 4 / 64 },
    animations: characterAnimations(attackFps),
    placeholder,
  };
}
