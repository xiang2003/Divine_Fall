import type { MapData } from '../data/mapData';
import { portalBlockedReason } from './portals';

/** Where a map sits on the world-map screen (percent of the panel) and what kind of place it is. */
export interface WorldMapPlacement {
  x: number;
  y: number;
  kind: string;
}

export interface WorldNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  /** The player has been here. */
  visited: boolean;
  /** The player is here now. */
  current: boolean;
}

/** A connection between two maps (one line, however many portals join them). */
export interface WorldEdge {
  a: string;
  b: string;
  /** At least one of the portals between them is closed right now. */
  locked: boolean;
  /** What the closed portal says, if anything. */
  hint: string | null;
}

export interface WorldGraphView {
  nodes: WorldNode[];
  edges: WorldEdge[];
}

/**
 * The world as a graph for the map screen: a node per map, an edge per pair of maps joined by a portal.
 * An edge counts as locked while any portal between the two is blocked by a world flag.
 */
export function buildWorldGraph(
  maps: readonly MapData[],
  layout: Readonly<Record<string, WorldMapPlacement>>,
  flags: ReadonlySet<string>,
  visited: ReadonlySet<string>,
  currentId: string,
): WorldGraphView {
  const nodes: WorldNode[] = maps.map((m) => {
    const place = layout[m.id] ?? { x: 50, y: 50, kind: '' };
    return { id: m.id, name: m.name, kind: place.kind, x: place.x, y: place.y, visited: visited.has(m.id), current: m.id === currentId };
  });

  const edges = new Map<string, WorldEdge>();
  for (const map of maps) {
    for (const portal of map.portals) {
      const [a, b] = [map.id, portal.to.map].sort() as [string, string];
      const key = `${a}|${b}`;
      const edge = edges.get(key) ?? { a, b, locked: false, hint: null };
      const reason = portalBlockedReason(portal, flags);
      if (reason) {
        edge.locked = true;
        edge.hint ??= reason;
      }
      edges.set(key, edge);
    }
  }
  return { nodes, edges: [...edges.values()] };
}
