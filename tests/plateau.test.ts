import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogues';
import { INTERACTABLES } from '../src/data/interactables';
import { TileType, parseMap, tileAt } from '../src/data/mapData';
import { MONSTERS, type MonsterDef } from '../src/data/monsters';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { WORLD_MAP_FILES } from '../src/data/worldMaps';
import { DialogueRunner, pickDialogue, validateDialogue, type DialogueContext } from '../src/systems/dialogue';
import { visibleTopics } from '../src/systems/npcTopics';
import { QuestLog } from '../src/systems/quests';
import { portalBlockedReason } from '../src/systems/portals';
import { Reputation } from '../src/systems/reputation';
import { levelScale } from '../src/data/items';

const load = (id: keyof typeof WORLD_MAP_FILES) => parseMap(JSON.parse(readFileSync(new URL(`../public/${WORLD_MAP_FILES[id]}`, import.meta.url), 'utf8')) as unknown);
const plateau = load('truce_plateau');
const pass = load('broken_sword_pass');

describe('the monsters of the plateau', () => {
  it('a soldier cuts three times and does not bleed; a wraith is spirit and calls only soul-helpers that exist', () => {
    const soldier = MONSTERS.truce_soldier;
    expect(soldier.combo?.hits).toBe(3);
    expect(soldier.immune).toContain('bleeding');
    const wraith = MONSTERS.banner_wraith;
    expect(wraith.behavior).toBe('ranged');
    expect(wraith.damageType).toBe('lightning');
    expect(wraith.summons).toBeDefined();
    const soul = MONSTERS[wraith.summons!.into as keyof typeof MONSTERS] as MonsterDef;
    expect(soul.id).toBe('war_soul');
    // the helper fades by itself, gives nothing, and is weak enough that two at a time is a nuisance and not a wall
    expect(soul.phantom).toBe(true);
    expect(soul.lifetime).toBeGreaterThan(0);
    expect(soul.xp).toBe(0);
    expect(soul.maxHp).toBeLessThan(wraith.maxHp / 3);
    expect(wraith.summons!.max).toBeGreaterThanOrEqual(wraith.summons!.count);
  });

  it('a hound comes in pairs from the side, and its bite marks the target every time', () => {
    const hound = MONSTERS.oath_hound;
    expect(hound.packSize).toBe(2);
    expect(hound.flank).toBe(true);
    expect(hound.applies).toEqual([{ id: 'mark', chance: 1 }]);
  });

  it('the general holds a shield stance, charges from the second phase and shouts in the third, and has no way to be bled', () => {
    const g = MONSTERS.nameless_general;
    expect(g.isBoss).toBe(true);
    const kinds = g.bossAttacks!.map((a) => [a.kind, a.minPhase]);
    expect(kinds).toContainEqual(['guard', 0]);
    expect(kinds).toContainEqual(['charge', 1]);
    expect(kinds).toContainEqual(['nova', 2]);
    expect(g.immune).toContain('bleeding');
    expect(g.resist?.corruption).toBeLessThan(0);
    const guard = g.bossAttacks!.find((a) => a.kind === 'guard')!;
    expect(guard.reduction).toBeGreaterThan(0.5);
    expect(guard.radius).toBeGreaterThan(2); // the counter has a reach that is worth keeping away from
  });

  it('is a step up from the pass: tougher than its boss, and the boss is above the rest', () => {
    expect(MONSTERS.nameless_general.maxHp).toBeGreaterThan(MONSTERS.broken_sword_colossus.maxHp);
    expect(MONSTERS.nameless_general.maxHp).toBeGreaterThan(MONSTERS.truce_soldier.maxHp * 8);
    expect(MONSTERS.truce_soldier.maxHp).toBeGreaterThan(MONSTERS.exiled_swordsman.maxHp);
    expect(levelScale(1)).toBe(1);
  });
});

describe('the map of the plateau', () => {
  it('is a level 24 area on the plateau theme, with the general at its east end', () => {
    expect(plateau.theme).toBe('plateau');
    expect(plateau.level).toBe(24);
    expect(plateau.population?.boss).toBe('nameless_general');
    expect(plateau.spawns.boss!.x).toBeGreaterThan(plateau.width * 0.75);
    expect(plateau.spawns.elites.length).toBeGreaterThanOrEqual(2);
  });

  it('has all three kinds of monster, in a believable mix', () => {
    const counts: Record<string, number> = {};
    for (const m of plateau.population!.monsters) counts[m] = (counts[m] ?? 0) + 1;
    expect(Object.keys(counts).sort()).toEqual(['banner_wraith', 'oath_hound', 'truce_soldier']);
    for (const n of Object.values(counts)) expect(n).toBeGreaterThanOrEqual(4);
  });

  it('has the truce stele as a solid building in the middle, with a place to stand in front of it', () => {
    const stele = plateau.buildings.find((b) => b.style === 'truce_stele')!;
    expect(stele).toBeDefined();
    for (let y = stele.y; y < stele.y + stele.h; y++) for (let x = stele.x; x < stele.x + stele.w; x++) expect(tileAt(plateau, x, y)).toBe(TileType.WALL);
    const use = plateau.interactables.find((i) => i.id === 'plateau_stele')!;
    expect(tileAt(plateau, Math.floor(use.pos.x), Math.floor(use.pos.y))).toBe(TileType.FLOOR);
    expect(Math.abs(use.pos.x - (stele.x + stele.w / 2))).toBeLessThan(4);
    expect(use.pos.y).toBeGreaterThan(stele.y + stele.h);
    expect(Math.abs(stele.x + stele.w / 2 - plateau.width / 2)).toBeLessThan(plateau.width * 0.15);
  });

  it('has the three records, each with a picture standing where it is read', () => {
    const ids = plateau.interactables.map((i) => i.id).sort();
    expect(ids).toEqual(['plateau_folk', 'plateau_lose', 'plateau_stele', 'plateau_win']);
    const raw = JSON.parse(readFileSync(new URL('../public/maps/truce_plateau.json', import.meta.url), 'utf8')) as { decor: { kind: string; x: number; y: number }[] };
    for (const [id, kind] of [['plateau_win', 'record_win'], ['plateau_lose', 'record_lose'], ['plateau_folk', 'record_folk']] as const) {
      const at = plateau.interactables.find((i) => i.id === id)!;
      const picture = raw.decor.find((d) => d.kind === kind);
      expect(picture, kind).toBeDefined();
      expect(Math.hypot(picture!.x - at.pos.x, picture!.y - at.pos.y)).toBeLessThan(1);
    }
  });

  it('is entered from the pass only once the colossus is down, and leads back', () => {
    const gate = pass.portals.find((p) => p.to.map === 'truce_plateau')!;
    expect(gate.requiresFlag).toBe('broken_sword_pass_boss_defeated');
    expect(portalBlockedReason(gate, new Set())).toBe('巨像還擋在路上。');
    expect(portalBlockedReason(gate, new Set(['broken_sword_pass_boss_defeated']))).toBeNull();
    expect(plateau.entrances.from_pass).toBeDefined();
    expect(plateau.portals[0]!.to).toEqual({ map: 'broken_sword_pass', entrance: 'from_plateau' });
    expect(pass.entrances.from_plateau).toBeDefined();
  });
});

function world() {
  const flags = new Set<string>();
  const rep = new Reputation();
  const quests = new QuestLog(QUESTS);
  const ctx: DialogueContext = {
    hasFlag: (n) => flags.has(n),
    setFlag: (n, on) => (on ? flags.add(n) : flags.delete(n)),
    level: 24,
    mapId: 'truce_plateau',
    questState: (id) => quests.state(id),
    startQuest: (id) => void quests.start(id),
    completeQuest: (id) => void quests.complete(id),
    reportInteract: (target) => void quests.report({ type: 'interact', target }),
    endChapter: () => {},
    reputation: (f) => rep.get(f),
    addReputation: (f, n) => void rep.add(f, n),
  };
  return { flags, quests, ctx };
}

/** Does what the game does when the player uses a thing: picks the conversation by its rules and plays it. */
function use(w: ReturnType<typeof world>, interactable: string): string {
  const def = INTERACTABLES[interactable]!;
  const graph = pickDialogue(def.dialogue, w.ctx)!;
  const runner = new DialogueRunner(DIALOGUES[graph]!, w.ctx, 'x');
  for (let i = 0; i < 40 && !runner.finished; i++) runner.advance();
  expect(runner.finished, graph).toBe(true);
  if (def.reportOnUse) w.ctx.reportInteract(def.id);
  return graph;
}

describe('the omitted terms of the truce', () => {
  it('every conversation of the event is well-formed', () => {
    for (const id of ['rec_win', 'rec_lose', 'rec_folk', 'stele_look', 'stele_partial', 'stele_collate', 'stele_again', 'gu_truce']) {
      expect(DIALOGUES[id], id).toBeDefined();
      expect(validateDialogue(DIALOGUES[id]!), id).toEqual([]);
    }
  });

  it('reading any record starts the quest, and reading the same one again changes nothing', () => {
    const w = world();
    expect(w.quests.state('q10_truce_records')).not.toBe('active');
    expect(use(w, 'plateau_folk')).toBe('rec_folk');
    expect(w.quests.state('q10_truce_records')).toBe('active');
    expect(w.flags.has('truce_read_folk')).toBe(true);
    use(w, 'plateau_folk');
    expect(w.quests.state('q10_truce_records')).toBe('active');
  });

  it('the stele says what is missing until all three are read, in whatever order, and then it collates them', () => {
    for (const order of [['plateau_win', 'plateau_lose', 'plateau_folk'], ['plateau_folk', 'plateau_win', 'plateau_lose'], ['plateau_lose', 'plateau_folk', 'plateau_win']]) {
      const w = world();
      expect(use(w, 'plateau_stele')).toBe('stele_look');
      expect(w.quests.state('q10_truce_records')).not.toBe('active'); // looking at the stele does not start anything
      for (const [i, id] of order.entries()) {
        use(w, id);
        const graph = use(w, 'plateau_stele');
        expect(graph, `${order.join()} after ${i + 1}`).toBe(i < 2 ? 'stele_partial' : 'stele_collate');
        if (i < 2) expect(w.flags.has('truce_understood')).toBe(false);
      }
      expect(w.flags.has('truce_understood')).toBe(true);
      expect(w.quests.state('q10_truce_records')).toBe('completed');
      expect(use(w, 'plateau_stele')).toBe('stele_again');
    }
  });

  it('pays a rare item and experience, and the wanderer talks about it afterwards', () => {
    const q = QUESTS.q10_truce_records!;
    expect(q.giver).toBeNull();
    expect(q.rewards.items).toEqual([{ rarity: 'rare', count: 1 }]);
    expect(q.rewards.xp).toBeGreaterThan(0);
    const w = world();
    const gu = NPCS.wanderer_guchangfeng!;
    const labels = () => visibleTopics(gu.conversation, w.ctx).map((t) => t.label);
    expect(labels()).not.toContain('停戰碑原上的三份記錄');
    for (const id of ['plateau_win', 'plateau_lose', 'plateau_folk', 'plateau_stele']) use(w, id);
    expect(labels()).toContain('停戰碑原上的三份記錄');
  });

  it('the conclusion is only in the collation, not in any single record', () => {
    const text = (id: string) => Object.values(DIALOGUES[id]!.nodes).map((n) => n.text).join('');
    expect(text('stele_collate')).toContain('三份都是真的');
    for (const id of ['rec_win', 'rec_lose', 'rec_folk']) expect(text(id)).not.toContain('三份都是真的');
  });
});
