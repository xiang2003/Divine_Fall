import type { Vec2 } from '../game/iso';

/** On-disk map format (public/maps/*.json). Rendering and collision are both derived from this. */
export interface DungeonMapFile {
  id: string;
  name: string;
  /** Look of the map: "stone" (default, dungeon), "ruins" (mossy walls), "core" (the deep ruins: giant pillars, roots, floating crystals), "grass", "sand" or "cave" (where "T" tiles are trees, boulders or crystals). */
  theme?: MapTheme;
  /** Human-readable legend; informational only. */
  legend?: Record<string, string>;
  /** One string per row; `layout[y][x]` is tile (x, y). All rows must have equal length. */
  layout: string[];
  /** Named arrival points as tile coordinates, e.g. `{ "from_forest": { "x": 3, "y": 5 } }`. "start" is always the "P" tile. */
  entrances?: Record<string, { x: number; y: number }>;
  /** Walk-in doors to other maps. */
  portals?: PortalFile[];
  /** Which monsters stand on this map's spawn points (ids from data/monsters.ts). Omitted: the default mix. */
  population?: { monsters?: string[]; elites?: string[]; boss?: string };
  /** Buildings drawn over a rectangle of solid ("#") tiles. `style` and size must be one of BUILDING_VARIANTS. */
  buildings?: { style: string; x: number; y: number; w: number; h: number }[];
  /** Characters standing on the map (tile coordinates; the definition lives in data/npcs.ts). A character can be on two maps if one placement is hidden by the flag that shows the other. */
  npcs?: { id: string; x: number; y: number; requiresFlag?: string; hiddenByFlag?: string }[];
  /** Loose decoration (not solid): `kind` is a key of DECOR_KINDS in game/assetManifest.ts; x / y are world units (fractions allowed). */
  decor?: { kind: string; x: number; y: number }[];
  /** Things to examine (tile coordinates; the definition lives in data/interactables.ts). */
  interactables?: { id: string; x: number; y: number }[];
  /**
   * Hazards. `spikes` stand on a floor tile (x, y) and rise and fall on a timer (`phase` shifts the timer, in seconds). `arrow` is a slit
   * in the wall tile (x, y) that shoots poisoned arrows along `dir` into the floor tile next to it.
   */
  traps?: { kind: string; x: number; y: number; dir?: string; phase?: number }[];
  /** Marks where the ground is grass on a map of another theme (the wet woods behind a beach): same size as `layout`, any character but a space marks a grass tile. Trees ("T") standing on it are drawn as trees. */
  grass?: string[];
  /** How thick the fog drifting over the map is (0 to 1; omitted: none). */
  fog?: number;
  /** The recommended level of the area (1 to 100): the monsters in it are of this level. Omitted for towns and other safe places. */
  level?: number;
  /** Wall torches: the wall tile (x, y) and the side `dir` its flame looks out on (`e` or `s`: the sides the camera sees). */
  torches?: { x: number; y: number; dir: string }[];
}

/** A side of a wall as seen from the floor next to it, in world axes: e = +x, s = +y (the two the camera sees). */
export type WallSide = 'e' | 's';

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

/** mountain: bare rock with boulders and cliff walls (the broken-sword pass). sect: dark flagstone courtyards of a mountain town (Qinglan). blight: the dead, haunted forest floor (the green-vine forest). */
/** mist: the chapter 2 landing coast (sand, rocks and driftwood, with grass and trees inland: "g" and "Y"). */
/** stone: dungeon bricks; ruins: the same with moss and vines; grass: meadow and forest; sand: beach; cave: damp cave. Decides the floor, water, wall and "T" art. */
export type MapTheme = 'stone' | 'ruins' | 'core' | 'grass' | 'sand' | 'mist' | 'mountain' | 'sect' | 'blight' | 'cave';
export const MAP_THEMES: readonly MapTheme[] = ['stone', 'ruins', 'core', 'grass', 'sand', 'mist', 'mountain', 'sect', 'blight', 'cave'];

export const TileType = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  /** Blocks like a wall but is drawn as a tree, boulder or rock pillar depending on the theme ("T" in a layout). */
  TREE: 3,
  /** Sea or pool water ("W"): blocks walking, not sight. */
  WATER: 4,
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

/** Which monsters a map uses; spawn points take them in order, cycling. */
export interface Population {
  monsters: string[];
  elites: string[];
  boss: string | null;
}

/** A building: a sprite drawn over a rectangle of solid tiles (the tiles do the blocking). */
export interface Building {
  style: string;
  /** Top-left tile and size, in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An NPC standing somewhere on a map. */
export interface NpcPlacement {
  id: string;
  /** Centre of its tile, in world units. */
  pos: Vec2;
  /** Present only while this flag is set / only while it is not set (checked when the map is entered). */
  requiresFlag?: string;
  hiddenByFlag?: string;
}

/** A piece of non-solid decoration (a stump, a stack of firewood...). */
export interface DecorPlacement {
  kind: string;
  /** World units. */
  x: number;
  y: number;
}

/** A thing to examine standing somewhere on a map. */
export interface InteractablePlacement {
  id: string;
  pos: Vec2;
}

export interface SpikeTrapPlacement {
  kind: 'spikes';
  /** Centre of its tile. */
  pos: Vec2;
  phase: number;
}

export interface ArrowTrapPlacement {
  kind: 'arrow';
  /** Centre of the wall tile the slit is in. */
  pos: Vec2;
  /** Unit vector the arrows fly along. */
  dir: Vec2;
}

export type TrapPlacement = SpikeTrapPlacement | ArrowTrapPlacement;

/** A torch on a wall. */
export interface TorchPlacement {
  /** Centre of the wall tile. */
  pos: Vec2;
  /** Unit vector pointing out of the wall, toward the floor it lights. */
  dir: Vec2;
}

const SIDE_VECTOR: Record<WallSide, Vec2> = { e: { x: 1, y: 0 }, s: { x: 0, y: 1 } };

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
  theme: MapTheme;
  width: number;
  height: number;
  /** Row-major, index = y * width + x. */
  tiles: Uint8Array;
  /** Row-major like `tiles`: 1 where the ground is a dirt path (a "," in the layout), 2 where it is grass (see `grass` in the file), else 0. */
  ground: Uint8Array;
  props: Prop[];
  spawns: MapSpawns;
  /** Named arrival points in world units (centre of the tile). Does not include the implicit "start". */
  entrances: Record<string, Vec2>;
  portals: Portal[];
  npcs: NpcPlacement[];
  buildings: Building[];
  /** Null means the default monster mix. */
  population: Population | null;
  interactables: InteractablePlacement[];
  decor: DecorPlacement[];
  /** Fog thickness, 0 for none. */
  fog: number;
  /** The recommended level of the area, or null for a place without monsters (see MapFile.level). */
  level: number | null;
  traps: TrapPlacement[];
  torches: TorchPlacement[];
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
  const ground = new Uint8Array(width * height);
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
        case 'T':
          tile = TileType.TREE;
          break;
        case 'W':
          tile = TileType.WATER;
          break;
        case '.':
          break;
        case ',':
          ground[y * width + x] = 1; // a walkable dirt path
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
    npcs.push({ id: n.id, pos: { x: n.x + 0.5, y: n.y + 0.5 }, requiresFlag: n.requiresFlag, hiddenByFlag: n.hiddenByFlag });
  }

  const interactables: InteractablePlacement[] = [];
  for (const it of file.interactables ?? []) {
    if (typeof it?.id !== 'string' || !Number.isInteger(it.x) || !Number.isInteger(it.y)) {
      throw new MapParseError('Every interactable needs a string "id" and integer tile x / y');
    }
    if (interactables.some((o) => o.id === it.id)) throw new MapParseError(`Interactable "${it.id}" is placed twice`);
    if (tileAtRaw(tiles, width, height, it.x, it.y) !== TileType.FLOOR) {
      throw new MapParseError(`Interactable "${it.id}" at (${it.x}, ${it.y}) is not on a floor tile`);
    }
    interactables.push({ id: it.id, pos: { x: it.x + 0.5, y: it.y + 0.5 } });
  }

  const buildings: Building[] = [];
  for (const b of file.buildings ?? []) {
    if (typeof b?.style !== 'string' || ![b.x, b.y, b.w, b.h].every(Number.isInteger) || b.w < 1 || b.h < 1) {
      throw new MapParseError('Every building needs a string "style" and integer x / y / w / h');
    }
    for (let ty = b.y; ty < b.y + b.h; ty++) {
      for (let tx = b.x; tx < b.x + b.w; tx++) {
        if (tileAtRaw(tiles, width, height, tx, ty) !== TileType.WALL) {
          throw new MapParseError(`Building "${b.style}" at (${b.x}, ${b.y}) covers (${tx}, ${ty}), which is not a solid "#" tile`);
        }
      }
    }
    for (const o of buildings) {
      if (b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h) {
        throw new MapParseError(`Buildings at (${b.x}, ${b.y}) and (${o.x}, ${o.y}) overlap`);
      }
    }
    buildings.push({ style: b.style, x: b.x, y: b.y, w: b.w, h: b.h });
  }

  let population: Population | null = null;
  if (file.population) {
    const list = (v: unknown, what: string): string[] => {
      if (v === undefined) return [];
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new MapParseError(`Population "${what}" must be a list of monster ids`);
      return v as string[];
    };
    const boss = file.population.boss;
    if (boss !== undefined && typeof boss !== 'string') throw new MapParseError('Population "boss" must be a monster id');
    population = { monsters: list(file.population.monsters, 'monsters'), elites: list(file.population.elites, 'elites'), boss: boss ?? null };
  }

  const decor: DecorPlacement[] = [];
  for (const d of file.decor ?? []) {
    if (typeof d?.kind !== 'string' || !Number.isFinite(d.x) || !Number.isFinite(d.y)) {
      throw new MapParseError('Every decor entry needs a string "kind" and numeric x / y');
    }
    if (tileAtRaw(tiles, width, height, Math.floor(d.x), Math.floor(d.y)) !== TileType.FLOOR) {
      throw new MapParseError(`Decor "${d.kind}" at (${d.x}, ${d.y}) is not on a floor tile`);
    }
    decor.push({ kind: d.kind, x: d.x, y: d.y });
  }

  const sideOf = (what: string, x: number, y: number, dir: unknown): Vec2 => {
    if (dir !== 'e' && dir !== 's') throw new MapParseError(`${what} at (${x}, ${y}) needs "dir" to be "e" or "s"`);
    const v = SIDE_VECTOR[dir];
    if (tileAtRaw(tiles, width, height, x, y) !== TileType.WALL) throw new MapParseError(`${what} at (${x}, ${y}) is not on a wall tile`);
    if (tileAtRaw(tiles, width, height, x + v.x, y + v.y) !== TileType.FLOOR) {
      throw new MapParseError(`${what} at (${x}, ${y}) looks out on (${x + v.x}, ${y + v.y}), which is not a floor tile`);
    }
    return v;
  };

  const traps: TrapPlacement[] = [];
  for (const t of file.traps ?? []) {
    if (!Number.isInteger(t?.x) || !Number.isInteger(t?.y)) throw new MapParseError('Every trap needs integer tile x / y');
    if (t.kind === 'spikes') {
      if (tileAtRaw(tiles, width, height, t.x, t.y) !== TileType.FLOOR) throw new MapParseError(`Spikes at (${t.x}, ${t.y}) are not on a floor tile`);
      if (props.some((p) => p.tileX === t.x && p.tileY === t.y)) throw new MapParseError(`Spikes at (${t.x}, ${t.y}) are under a crate`);
      traps.push({ kind: 'spikes', pos: { x: t.x + 0.5, y: t.y + 0.5 }, phase: t.phase ?? 0 });
    } else if (t.kind === 'arrow') {
      const dir = sideOf('Arrow trap', t.x, t.y, t.dir);
      traps.push({ kind: 'arrow', pos: { x: t.x + 0.5, y: t.y + 0.5 }, dir });
    } else {
      throw new MapParseError(`Unknown trap kind "${String(t.kind)}"`);
    }
  }

  const torches: TorchPlacement[] = [];
  for (const t of file.torches ?? []) {
    if (!Number.isInteger(t?.x) || !Number.isInteger(t?.y)) throw new MapParseError('Every torch needs integer tile x / y');
    torches.push({ pos: { x: t.x + 0.5, y: t.y + 0.5 }, dir: sideOf('Torch', t.x, t.y, t.dir) });
  }

  if (file.grass !== undefined) {
    if (!Array.isArray(file.grass) || file.grass.length !== height || !file.grass.every((r) => typeof r === 'string' && r.length === width)) {
      throw new MapParseError('Map "grass" must have the same size as "layout"');
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = tiles[y * width + x];
        if (file.grass[y]![x] !== ' ' && (t === TileType.FLOOR || t === TileType.TREE) && ground[y * width + x] === 0) ground[y * width + x] = 2;
      }
    }
  }

  const level = file.level ?? null;
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > 100)) throw new MapParseError('Map "level" must be a whole number from 1 to 100');
  const fog = file.fog ?? 0;
  if (typeof fog !== 'number' || fog < 0 || fog > 1) throw new MapParseError('Map "fog" must be a number from 0 to 1');

  const theme = file.theme ?? 'stone';
  if (!MAP_THEMES.includes(theme)) throw new MapParseError(`Unknown map theme "${String(theme)}"`);

  return { id: file.id, name: file.name, theme, width, height, tiles, ground, props, spawns, entrances, portals, npcs, buildings, population, interactables, decor, fog, level, traps, torches };
}
