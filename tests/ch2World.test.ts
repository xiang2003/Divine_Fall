import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogues';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { MONSTERS } from '../src/data/monsters';
import { INTERACTABLES } from '../src/data/interactables';
import { TileType, parseMap, tileAt, type MapData } from '../src/data/mapData';
import { WORLD_MAP_FILES, isTown } from '../src/data/worldMaps';
import { validateDialogue } from '../src/systems/dialogue';

const load = (id: string): MapData => parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES[id as keyof typeof WORLD_MAP_FILES]}`, import.meta.url), 'utf8')) as unknown);
const IDS = ['canglan_forest', 'qinglan_town', 'broken_sword_pass', 'truce_plateau'] as const;

function reach(map: MapData) {
  const key = (x: number, y: number) => y * map.width + x;
  const blocked = new Set<number>();
  for (const p of map.props) blocked.add(key(p.tileX, p.tileY));
  for (const n of map.npcs) blocked.add(key(Math.floor(n.pos.x), Math.floor(n.pos.y)));
  const seen = new Set<number>();
  const start = { x: Math.floor(map.spawns.player.x), y: Math.floor(map.spawns.player.y) };
  const queue = [start];
  seen.add(key(start.x, start.y));
  while (queue.length) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (tileAt(map, nx, ny) === TileType.FLOOR && !blocked.has(key(nx, ny)) && !seen.has(key(nx, ny))) {
        seen.add(key(nx, ny));
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return (p: { x: number; y: number }) => seen.has(key(Math.floor(p.x), Math.floor(p.y)));
}

describe.each(IDS)('%s', (id) => {
  const map = load(id);
  const at = reach(map);

  it('has a start, every portal and entrance leads somewhere real, and the way back exists', () => {
    for (const portal of map.portals) {
      expect(WORLD_MAP_FILES[portal.to.map as keyof typeof WORLD_MAP_FILES], `${id}/${portal.id}`).toBeDefined();
      const target = load(portal.to.map);
      expect(portal.to.entrance === 'start' || portal.to.entrance in target.entrances, `${id}/${portal.id} -> ${portal.to.map}`).toBe(true);
      expect(target.portals.some((p) => p.to.map === id), `${portal.to.map} leads back to ${id}`).toBe(true);
    }
  });

  it('can be walked from the start to everything that matters', () => {
    const spots = [
      ...map.spawns.monsters,
      ...map.spawns.elites,
      ...(map.spawns.boss ? [map.spawns.boss] : []),
      ...map.interactables.map((i) => i.pos),
      ...Object.values(map.entrances),
      ...map.portals.map((p) => ({ x: (p.rect.minX + p.rect.maxX) / 2, y: (p.rect.minY + p.rect.maxY) / 2 })),
    ];
    for (const p of spots) expect(at(p), `${id}: ${p.x},${p.y}`).toBe(true);
    // the people of a town stand next to a place that can be reached
    for (const n of map.npcs) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at({ x: n.pos.x + dx!, y: n.pos.y + dy! }));
      expect(near, `${id}: ${n.id} cannot be talked to`).toBe(true);
    }
  });

  it('is sealed: no floor touches void or the map edge', () => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y);
        if (t !== TileType.FLOOR && t !== TileType.WATER) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(tileAt(map, x + dx, y + dy), `leak at ${x},${y}`).not.toBe(TileType.VOID);
      }
    }
  });

  it('uses only monsters, NPCs and interactables that are defined', () => {
    const ids = [...(map.population?.monsters ?? []), ...(map.population?.elites ?? []), ...(map.population?.boss ? [map.population.boss] : [])];
    for (const m of ids) expect(MONSTERS, `${id}: ${m}`).toHaveProperty(m);
    expect(map.spawns.monsters.length).toBe(map.population?.monsters.length ?? 0);
    for (const n of map.npcs) expect(NPCS, n.id).toHaveProperty(n.id);
    for (const i of map.interactables) expect(INTERACTABLES, i.id).toHaveProperty(i.id);
  });
});

describe('the green-vine forest', () => {
  const map = load('canglan_forest');
  it('keeps the road to the town shut until the old wood warden is down', () => {
    const toTown = map.portals.find((p) => p.to.map === 'qinglan_town')!;
    expect(toTown.requiresFlag).toBe('canglan_forest_boss_defeated');
    expect(map.population?.boss).toBe('old_wood_warden');
    expect(map.population?.monsters.filter((m) => m === 'green_fang_wolf').length).toBeGreaterThanOrEqual(5); // enough for the bounty
  });
});

describe('the town and the pass', () => {
  it('Qinglan is a town: it refills the potions, and has all five people', () => {
    expect(isTown('qinglan_town')).toBe(true);
    expect(isTown('canglan_forest')).toBe(false);
    expect(load('qinglan_town').npcs.map((n) => n.id).sort()).toEqual(['blacksmith_tieshan', 'herbalist_qinghe', 'innkeeper_zhoubo', 'patrol_linruotang', 'wanderer_guchangfeng']);
    expect(load('qinglan_town').spawns.monsters).toHaveLength(0);
  });

  it('the pass ends in the arena of the colossus, and its look-out opens only afterwards', () => {
    const pass = load('broken_sword_pass');
    expect(pass.population?.boss).toBe('broken_sword_colossus');
    expect(INTERACTABLES.pass_end!.requiresFlag).toBe('broken_sword_pass_boss_defeated');
  });
});

describe('chapter 2 quests and conversations', () => {
  const forest = load('canglan_forest');
  const pass = load('broken_sword_pass');

  it('every quest has a giver who exists and offers it, and objectives that can be done', () => {
    for (const id of ['q5_wolf_bounty', 'q6_altar_trace', 'q7_warden_bounty', 'q8_colossus_bounty']) {
      const q = QUESTS[id]!;
      expect(q, id).toBeDefined();
      const giver = NPCS[q.giver!]!;
      expect(giver, `${id}: giver`).toBeDefined();
      const offers = giver.conversation.topics.filter((t) => t.kind === 'quest' && JSON.stringify(t.if).includes(`"${id}"`));
      expect(offers.length, `${id} is offered by ${q.giver}`).toBe(1);
      const turnIn = giver.conversation.topics.filter((t) => t.kind === 'turnin' && JSON.stringify(t.if).includes(`"${id}"`));
      expect(turnIn.length, `${id} is turned in to ${q.giver}`).toBe(1);
      expect(Object.values(DIALOGUES[offers[0]!.graph!]!.nodes).some((n) => n.startQuest === id)).toBe(true);
      expect(Object.values(DIALOGUES[turnIn[0]!.graph!]!.nodes).some((n) => n.completeQuest === id)).toBe(true);
    }
  });

  it('the objectives point at things that exist', () => {
    const wolves = QUESTS.q5_wolf_bounty!.objectives[0]!;
    expect(wolves).toMatchObject({ type: 'kill', monster: 'green_fang_wolf', map: 'canglan_forest' });
    expect((wolves as { count: number }).count).toBeLessThanOrEqual(forest.population!.monsters.filter((m) => m === 'green_fang_wolf').length * 3);
    expect(forest.interactables.map((i) => i.id)).toContain('forest_altar');
    expect(QUESTS.q6_altar_trace!.objectives[0]).toMatchObject({ type: 'interact', target: 'forest_altar' });
    expect(QUESTS.q7_warden_bounty!.objectives[0]).toMatchObject({ type: 'kill', boss: true, map: 'canglan_forest' });
    expect(QUESTS.q8_colossus_bounty!.objectives[0]).toMatchObject({ type: 'kill', boss: true, map: 'broken_sword_pass' });
    expect(pass.population!.boss).toBe('broken_sword_colossus');
  });

  it('the colossus bounty comes after the wolf bounty', () => {
    expect(QUESTS.q8_colossus_bounty!.requires).toEqual(['q5_wolf_bounty']);
  });

  it('every dialogue graph is sound', () => {
    for (const g of Object.values(DIALOGUES)) expect(validateDialogue(g), g.id).toEqual([]);
  });

  it('every interactable and every NPC topic points at a real graph', () => {
    for (const it of Object.values(INTERACTABLES)) for (const rule of it.dialogue) expect(DIALOGUES, it.id).toHaveProperty(rule.graph);
    for (const npc of Object.values(NPCS)) {
      expect(DIALOGUES, `${npc.id} intro`).toHaveProperty(npc.conversation.intro.graph);
      for (const t of npc.conversation.topics) {
        if (t.kind === 'shop') continue; // a shop opens the merchant's stock, not a conversation
        expect(DIALOGUES, `${npc.id}: ${t.label}`).toHaveProperty(t.graph!);
      }
    }
  });
});
