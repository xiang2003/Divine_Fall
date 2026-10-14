import { DEFAULT_ENTRANCE, type MapData } from './mapData';

/** Every map of the game: id -> file under public/. */
export const WORLD_MAP_FILES = {
  pure_village: 'maps/pure_village.json',
  pure_forest: 'maps/pure_forest.json',
  pure_ruins: 'maps/pure_ruins.json',
  pure_spring_cave: 'maps/pure_spring_cave.json',
  pure_coast: 'maps/pure_coast.json',
} as const satisfies Record<string, string>;

export type WorldMapId = keyof typeof WORLD_MAP_FILES;

/** A new game starts here. */
export const START_MAP_ID: WorldMapId = 'pure_village';
export const START_ENTRANCE = DEFAULT_ENTRANCE;

/** Where each map is drawn on the world-map screen (percent of the panel) and what kind of place it is. */
export const WORLD_MAP_LAYOUT: Record<WorldMapId, { x: number; y: number; kind: string }> = {
  pure_village: { x: 20, y: 50, kind: '村落' },
  pure_forest: { x: 50, y: 50, kind: '野外' },
  pure_spring_cave: { x: 50, y: 17, kind: '洞窟' },
  pure_ruins: { x: 80, y: 50, kind: '遺跡' },
  pure_coast: { x: 20, y: 84, kind: '海岸' },
};

/** Coming back to a town refills the potions. */
export function isTown(mapId: string): boolean {
  return isWorldMapId(mapId) && WORLD_MAP_LAYOUT[mapId].kind === '村落';
}

export function isWorldMapId(id: string): id is WorldMapId {
  return Object.prototype.hasOwnProperty.call(WORLD_MAP_FILES, id);
}

/** Cross-map consistency check: every portal must lead to a map and entrance that exist. Returns human-readable problems. */
export function checkWorldLinks(maps: readonly MapData[]): string[] {
  const byId = new Map(maps.map((m) => [m.id, m]));
  const problems: string[] = [];
  for (const map of maps) {
    for (const portal of map.portals) {
      const target = byId.get(portal.to.map);
      if (!target) {
        problems.push(`${map.id}/${portal.id}: target map "${portal.to.map}" does not exist`);
        continue;
      }
      if (portal.to.entrance !== DEFAULT_ENTRANCE && !(portal.to.entrance in target.entrances)) {
        problems.push(`${map.id}/${portal.id}: map "${target.id}" has no entrance "${portal.to.entrance}"`);
      }
    }
  }
  return problems;
}
