import type { Vec2 } from '../game/iso';

/** On-disk map format (public/maps/*.json). Rendering and collision are both derived from this. */
export interface DungeonMapFile {
  id: string;
  name: string;
  /** Human-readable legend; informational only. */
  legend?: Record<string, string>;
  /** One string per row; `layout[y][x]` is tile (x, y). All rows must have equal length. */
  layout: string[];
  /** Named arrival points as tile coordinates, e.g. `{ "from_forest": { "x": 3, "y": 5 } }`. "start" is always the "P" tile. */
  entrances?: Record<string, { x: number; y: number }>;
  /** Walk-in doors to other maps. */
  portals?: PortalFile[];
  /** Characters standing on the map (tile coordinates; the definition lives in data/npcs.ts). */
  npcs?: { id: string; x: number; y: number }[];
}

/** On-disk portal: a tile rectangle that moves the player to `to.entrance` of map `to.map`. */
export interface PortalFile {
  id: string;
  x: number;
  y: number;
  /** Size in tiles (default 1). */
  w?: number;
  h?: number;
  to: { map: string; entrance: string };
  /** The portal only works while this world flag is set. */
  requiresFlag?: string;
  /** Shown when the player walks in while `requiresFlag` is not set. */
  blockedText?: string;
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

/** A door to another map (rectangle in world units). */
export interface Portal {
  id: string;
  rect: Rect;
  to: { map: string; entrance: string };
  requiresFlag?: string;
  blockedText?: string;
}

/** An NPC standing somewhere on a map. */
export interface NpcPlacement {
  id: string;
  /** Centre of its tile, in world units. */
  pos: Vec2;
}

/** The entrance every map has: where a new game (or a restart) puts the player. */
export const DEFAULT_ENTRANCE = 'start';

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
  /** Named arrival points in world units (centre of the tile). Does not include the implicit "start". */
  entrances: Record<string, Vec2>;
  portals: Portal[];
  npcs: NpcPlacement[];
}

const CRATE_HALF = 0.36;

export function tileAt(map: MapData, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return TileType.VOID;
  return (map.tiles[y * map.width + x] ?? TileType.VOID) as TileType;
}

function tileAtRaw(tiles: Uint8Array, width: number, height: number, x: number, y: number): TileType {
  if (x < 0 || y < 0 || x >= width || y >= height) return TileType.VOID;
  return (tiles[y * width + x] ?? TileType.VOID) as TileType;
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


  const entrances: Record<string, Vec2> = {};
  for (const [name, at] of Object.entries(file.entrances ?? {})) {
    if (name === DEFAULT_ENTRANCE) throw new MapParseError(`Entrance name "${DEFAULT_ENTRANCE}" is reserved for the "P" tile`);
    const { x, y } = at as { x: number; y: number };
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new MapParseError(`Entrance "${name}" needs integer tile x / y`);
    if (tileAtRaw(tiles, width, height, x, y) !== TileType.FLOOR) {
      throw new MapParseError(`Entrance "${name}" at (${x}, ${y}) is not on a floor tile`);
    }
    entrances[name] = { x: x + 0.5, y: y + 0.5 };
  }

  const portals: Portal[] = [];
  for (const p of file.portals ?? []) {
    if (typeof p?.id !== 'string' || typeof p.to?.map !== 'string' || typeof p.to?.entrance !== 'string') {
      throw new MapParseError('Every portal needs a string "id" and "to": { "map", "entrance" }');
    }
    if (portals.some((o) => o.id === p.id)) throw new MapParseError(`Duplicate portal id "${p.id}"`);
    const w = p.w ?? 1;
    const h = p.h ?? 1;
    if (![p.x, p.y, w, h].every(Number.isInteger) || w < 1 || h < 1) {
      throw new MapParseError(`Portal "${p.id}" needs integer x / y and a size of at least 1`);
    }
    for (let ty = p.y; ty < p.y + h; ty++) {
      for (let tx = p.x; tx < p.x + w; tx++) {
        if (tileAtRaw(tiles, width, height, tx, ty) !== TileType.FLOOR) {
          throw new MapParseError(`Portal "${p.id}" covers (${tx}, ${ty}), which is not a floor tile`);
        }
      }
    }
    portals.push({
      id: p.id,
      rect: { minX: p.x, minY: p.y, maxX: p.x + w, maxY: p.y + h },
      to: { map: p.to.map, entrance: p.to.entrance },
      requiresFlag: p.requiresFlag,
      blockedText: p.blockedText,
    });
  }

  const npcs: NpcPlacement[] = [];
  for (const n of file.npcs ?? []) {
    if (typeof n?.id !== 'string' || !Number.isInteger(n.x) || !Number.isInteger(n.y)) {
      throw new MapParseError('Every NPC needs a string "id" and integer tile x / y');
    }
    if (npcs.some((o) => o.id === n.id)) throw new MapParseError(`NPC "${n.id}" is placed twice`);
    if (tileAtRaw(tiles, width, height, n.x, n.y) !== TileType.FLOOR) {
      throw new MapParseError(`NPC "${n.id}" at (${n.x}, ${n.y}) is not on a floor tile`);
    }
    if (props.some((p) => p.tileX === n.x && p.tileY === n.y)) {
      throw new MapParseError(`NPC "${n.id}" at (${n.x}, ${n.y}) stands on a crate`);
    }
    npcs.push({ id: n.id, pos: { x: n.x + 0.5, y: n.y + 0.5 } });
  }

  return { id: file.id, name: file.name, width, height, tiles, props, spawns, entrances, portals, npcs };
}
