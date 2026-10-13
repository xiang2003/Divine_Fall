import { DEFAULT_ENTRANCE, type MapData, type Portal } from '../data/mapData';
import type { Vec2 } from '../game/iso';

/** The portal whose rectangle contains the point, if any. */
export function findPortalAt(map: MapData, x: number, y: number): Portal | null {
  for (const p of map.portals) {
    if (x >= p.rect.minX && x < p.rect.maxX && y >= p.rect.minY && y < p.rect.maxY) return p;
  }
  return null;
}

/** Why a portal is closed right now (text for the player), or null if it can be used. */
export function portalBlockedReason(portal: Portal, flags: ReadonlySet<string>): string | null {
  if (portal.requiresFlag && !flags.has(portal.requiresFlag)) return portal.blockedText ?? '此路不通。';
  return null;
}

/** Where a named entrance is on a map. "start" is the "P" tile; unknown names return null. */
export function resolveEntrance(map: MapData, name: string): Vec2 | null {
  if (name === DEFAULT_ENTRANCE) return { ...map.spawns.player };
  const at = map.entrances[name];
  return at ? { ...at } : null;
}
