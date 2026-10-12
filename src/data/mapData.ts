import type { Vec2 } from '../game/iso';

/** On-disk map format (public/maps/*.json). Rendering and collision are both derived from this. */
export interface DungeonMapFile {
  id: string;
  name: string;
  /** Human-readable legend; informational only. */
  legend?: Record<string, string>;
  /** One string per row; `layout[y][x]` is tile (x, y). All rows must have equal length. */
  layout: string[];
}

export const TileType = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Axis-aligned rectangle in world units (min/max corners). */
export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Prop {
  kind: 'crate';
  /** Tile coordinate the prop stands on. */
  tileX: number;
  tileY: number;
  /** Footprint in world units (blocks movement). */
  bounds: Rect;
}

export interface MapSpawns {
  player: Vec2;
  monsters: Vec2[];
  elites: Vec2[];
  boss: Vec2 | null;
  exit: Vec2 | null;
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Row-major, index = y * width + x. */
  tiles: Uint8Array;
  props: Prop[];
  spawns: MapSpawns;
}

const CRATE_HALF = 0.36;

export function tileAt(map: MapData, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return TileType.VOID;
  return (map.tiles[y * map.width + x] ?? TileType.VOID) as TileType;
}

export class MapParseError extends Error {}

/** Validates a raw JSON value and turns it into runtime MapData. Throws MapParseError with a clear message. */
export function parseMap(raw: unknown): MapData {
  if (typeof raw !== 'object' || raw === null) throw new MapParseError('Map file is not an object');
  const file = raw as Partial<DungeonMapFile>;
  if (typeof file.id !== 'string' || typeof file.name !== 'string') {
    throw new MapParseError('Map file needs string "id" and "name"');
  }
  const layout = file.layout;
  if (!Array.isArray(layout) || layout.length === 0 || !layout.every((r) => typeof r === 'string')) {
    throw new MapParseError('Map "layout" must be a non-empty array of strings');
  }
  const width = layout[0]!.length;
  const height = layout.length;
  if (width === 0) throw new MapParseError('Map rows must not be empty');

  const tiles = new Uint8Array(width * height);
  const props: Prop[] = [];
  const spawns: MapSpawns = { player: { x: 0, y: 0 }, monsters: [], elites: [], boss: null, exit: null };
  let playerSet = false;

  for (let y = 0; y < height; y++) {
    const row = layout[y]!;
    if (row.length !== width) {
      throw new MapParseError(`Map row ${y} has length ${row.length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const center: Vec2 = { x: x + 0.5, y: y + 0.5 };
      let tile: TileType = TileType.FLOOR;
      switch (ch) {
        case ' ':
          tile = TileType.VOID;
          break;
        case '#':
          tile = TileType.WALL;
          break;
        case '.':
          break;
        case 'P':
          if (playerSet) throw new MapParseError('Map has more than one player spawn "P"');
          playerSet = true;
          spawns.player = center;
          break;
        case 'm':
          spawns.monsters.push(center);
          break;
        case 'e':
          spawns.elites.push(center);
          break;
        case 'B':
          if (spawns.boss) throw new MapParseError('Map has more than one boss spawn "B"');
          spawns.boss = center;
          break;
        case 'X':
          if (spawns.exit) throw new MapParseError('Map has more than one exit "X"');
          spawns.exit = center;
          break;
        case 'c':
          props.push({
            kind: 'crate',
            tileX: x,
            tileY: y,
            bounds: {
              minX: center.x - CRATE_HALF,
              minY: center.y - CRATE_HALF,
              maxX: center.x + CRATE_HALF,
              maxY: center.y + CRATE_HALF,
            },
          });
          break;
        default:
          throw new MapParseError(`Unknown map character "${ch}" at (${x}, ${y})`);
      }
      tiles[y * width + x] = tile;
    }
  }
  if (!playerSet) throw new MapParseError('Map has no player spawn "P"');

  return { id: file.id, name: file.name, width, height, tiles, props, spawns };
}
