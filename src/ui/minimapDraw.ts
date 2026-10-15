import { TileType, tileAt, type MapData, type MapTheme } from '../data/mapData';

/**
 * The round minimap: the whole map is drawn once into an offscreen picture (rotated like the game view, so "up" on the minimap
 * is "up" on screen), then each frame the picture is shifted so the player is in the middle and the moving dots are drawn on top.
 */

/** Pixels per world unit along each iso axis (a tile is 2 * SCALE wide and SCALE tall). */
export const MINIMAP_SCALE = 5;

export interface Point {
  x: number;
  y: number;
}

/** What the minimap shows right now (world units). */
export interface MinimapView {
  map: MapData;
  player: Point;
  npcs: readonly Point[];
  monsters: readonly Point[];
  /** Elites and the boss. */
  bosses: readonly Point[];
  things: readonly Point[];
  portals: readonly Point[];
}

/** World position -> minimap pixels (before centring on the player). */
export function minimapProject(x: number, y: number, scale = MINIMAP_SCALE): Point {
  return { x: (x - y) * scale, y: ((x + y) * scale) / 2 };
}

const FLOOR_COLOR: Record<MapTheme, string> = {
  stone: '#5b5566',
  ruins: '#4f5a55',
  core: '#5a5648',
  mist: '#9a8a68',
  grass: '#3f6a37',
  sand: '#b59a63',
  cave: '#4b5568',
};
const PATH_COLOR = '#8d6a3f';
const WATER_COLOR = '#2f5f86';
const WALL_COLOR = '#17131d';
const TREE_COLOR: Record<MapTheme, string> = { stone: '#26212e', ruins: '#26212e', core: '#3a362c', mist: '#6b5d3c', grass: '#1f3a22', sand: '#6b5d3c', cave: '#2a303d' };

/** The colour of one tile on the minimap, or null for empty space. */
export function minimapTileColor(map: MapData, x: number, y: number): string | null {
  const theme = map.theme;
  switch (tileAt(map, x, y)) {
    case TileType.FLOOR:
      return map.ground[y * map.width + x] === 1 ? PATH_COLOR : map.ground[y * map.width + x] === 2 ? FLOOR_COLOR.grass : FLOOR_COLOR[theme];
    case TileType.WATER:
      return WATER_COLOR;
    case TileType.TREE:
      return map.ground[y * map.width + x] === 2 ? TREE_COLOR.grass : TREE_COLOR[theme];
    case TileType.WALL:
      return WALL_COLOR;
    default:
      return null;
  }
}

export interface MapLayer {
  canvas: HTMLCanvasElement;
  /** Where the world origin (0, 0) lies in the picture. */
  originX: number;
  originY: number;
}

/** Draws the whole map once. */
export function renderMapLayer(map: MapData, scale = MINIMAP_SCALE): MapLayer {
  const originX = map.height * scale + scale * 2;
  const originY = scale * 2;
  const canvas = document.createElement('canvas');
  canvas.width = (map.width + map.height) * scale + scale * 4;
  canvas.height = Math.ceil(((map.width + map.height) * scale) / 2) + scale * 4;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const color = minimapTileColor(map, x, y);
        if (!color) continue;
        // the tile's four corners, projected
        const top = minimapProject(x, y, scale);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(originX + top.x, originY + top.y);
        ctx.lineTo(originX + top.x + scale, originY + top.y + scale / 2);
        ctx.lineTo(originX + top.x, originY + top.y + scale);
        ctx.lineTo(originX + top.x - scale, originY + top.y + scale / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  return { canvas, originX, originY };
}

const DOT = {
  player: '#ffffff',
  npc: '#ffd84a',
  monster: '#e5604f',
  boss: '#ff3df0',
  thing: '#8fe3ff',
  portal: '#6ad0ff',
};

function dot(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: Point, view: Point, color: string, radius: number): void {
  const a = minimapProject(p.x, p.y);
  const b = minimapProject(view.x, view.y);
  const x = cx + a.x - b.x;
  const y = cy + a.y - b.y;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Draws one frame into a canvas of `size` x `size` CSS pixels (the caller has already scaled the context for the pixel ratio). */
export function drawMinimap(ctx: CanvasRenderingContext2D, size: number, layer: MapLayer, view: MinimapView): void {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#07060b';
  ctx.fillRect(0, 0, size, size);
  const p = minimapProject(view.player.x, view.player.y);
  ctx.drawImage(layer.canvas, c - (layer.originX + p.x), c - (layer.originY + p.y));
  for (const pt of view.portals) dot(ctx, c, c, pt, view.player, DOT.portal, 3);
  for (const pt of view.things) dot(ctx, c, c, pt, view.player, DOT.thing, 2.2);
  for (const pt of view.npcs) dot(ctx, c, c, pt, view.player, DOT.npc, 3);
  for (const pt of view.monsters) dot(ctx, c, c, pt, view.player, DOT.monster, 2.4);
  for (const pt of view.bosses) dot(ctx, c, c, pt, view.player, DOT.boss, 3.4);
  dot(ctx, c, c, view.player, view.player, DOT.player, 3.2);
  ctx.restore();
}
