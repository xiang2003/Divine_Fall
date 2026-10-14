import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogues';
import { INTERACTABLES } from '../src/data/interactables';
import { MONSTERS } from '../src/data/monsters';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { WORLD_MAP_FILES } from '../src/data/worldMaps';
import { parseMap, type MapData } from '../src/data/mapData';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { DialogueRunner, pickDialogue, validateDialogue, type Condition, type DialogueContext } from '../src/systems/dialogue';
import { firstGraph } from './npcHelpers';
import { interactableVisible } from '../src/systems/InteractableSystem';
import { npcPresent } from '../src/systems/NpcSystem';
import { QuestLog, validateQuests } from '../src/systems/quests';

const maps: MapData[] = Object.values(WORLD_MAP_FILES).map((file) =>
  parseMap(JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as unknown),
);

/** A tiny stand-in for the game: flags, the quest log, the current map, and the same effect handling. */
class World {
  readonly flags = new Set<string>();
  readonly log = new QuestLog(QUESTS);
  mapId = 'pure_village';
  chapterEnded = false;
  level = 1;

  ctx(): DialogueContext {
    return {
      level: this.level,
      mapId: this.mapId,
      hasFlag: (n) => this.flags.has(n),
      setFlag: (n, on) => void (on ? this.flags.add(n) : this.flags.delete(n)),
      questState: (id) => this.log.state(id),
      startQuest: (id) => {
        const def = this.log.start(id);
        for (const f of def?.startFlags ?? []) this.flags.add(f);
      },
      completeQuest: (id) => {
        const def = this.log.complete(id);
        for (const f of def?.rewards.flags ?? []) this.flags.add(f);
      },
      reportInteract: (target) => void this.log.report({ type: 'interact', target }),
      endChapter: () => {
        this.chapterEnded = true;
        this.flags.add('chapter1_complete');
      },
    };
  }

  goTo(mapId: string): void {
    this.mapId = mapId;
    this.log.report({ type: 'reach', map: mapId });
  }

  kill(monster: string, opts: { elite?: boolean; boss?: boolean } = {}): void {
    this.log.report({ type: 'kill', monster, map: this.mapId, elite: opts.elite ?? false, boss: opts.boss ?? false });
    if (opts.boss) this.flags.add(`${this.mapId}_boss_defeated`);
  }

  /** Runs a conversation to its end, taking `choices[i]` at the i-th choice (default: the first). Returns the graph id used. */
  talk(pick: (ctx: DialogueContext) => string | null, name: string, choices: number[] = []): string {
    const ctx = this.ctx();
    const id = pick(ctx);
    if (!id) throw new Error('no dialogue');
    const runner = new DialogueRunner(DIALOGUES[id]!, ctx, name);
    let picked = 0;
    for (let i = 0; i < 60 && !runner.finished; i++) {
      if (runner.view?.choices) runner.choose(choices[picked++] ?? 0);
      else runner.advance();
    }
    expect(runner.finished, `${id} never ended`).toBe(true);
    return id;
  }

  npc(id: string, choices: number[] = []): string {
    this.log.report({ type: 'talk', npc: id });
    return this.talk((ctx) => firstGraph(NPCS[id]!.conversation, ctx), NPCS[id]!.name, choices);
  }

  /** Examines a thing. Returns the graph id, or null if it is not there. */
  use(id: string, choices: number[] = []): string | null {
    const def = INTERACTABLES[id]!;
    if (!interactableVisible(def, (f) => this.flags.has(f))) return null;
    if (def.reportOnUse) this.log.report({ type: 'interact', target: def.id });
    return this.talk((ctx) => pickDialogue(def.dialogue, ctx), def.name, choices);
  }
}

describe('chapter 1 data', () => {
  it('quests only name things that exist, including interaction targets', () => {
    const known = {
      npcs: new Set(Object.keys(NPCS)),
      maps: new Set(maps.map((m) => m.id)),
      monsters: new Set(Object.keys(MONSTERS)),
      interactables: new Set(Object.keys(INTERACTABLES)),
    };
    expect(validateQuests(QUESTS, known)).toEqual([]);
  });

  it('all four main quests exist in order', () => {
    expect(Object.keys(QUESTS)).toEqual(['q1_first_hunt', 'q2_muddy_water', 'q3_resonance', 'q4_stranded_boat']);
    expect(QUESTS.q2_muddy_water!.requires).toEqual(['q1_first_hunt']);
    expect(QUESTS.q3_resonance!.requires).toEqual(['q2_muddy_water']);
    expect(QUESTS.q4_stranded_boat!.requires).toEqual(['q3_resonance']);
  });

  it('every dialogue graph is sound and every dialogue / interactable rule points at a real graph', () => {
    for (const g of Object.values(DIALOGUES)) expect(validateDialogue(g), g.id).toEqual([]);
    for (const npc of Object.values(NPCS)) for (const t of npc.conversation.topics) expect(DIALOGUES[t.graph], `${npc.id}->${t.graph}`).toBeDefined();
    for (const it of Object.values(INTERACTABLES)) for (const r of it.dialogue) expect(DIALOGUES[r.graph], `${it.id}->${r.graph}`).toBeDefined();
  });

  it('every dialogue conditional names real quests, and every quest the dialogue starts or completes exists', () => {
    const questIds = new Set(Object.keys(QUESTS));
    const check = (rules: readonly { if?: Condition }[], where: string) => {
      const walk = (c: unknown): void => {
        if (!c || typeof c !== 'object') return;
        const o = c as Record<string, unknown>;
        if (typeof o.quest === 'string') expect(questIds.has(o.quest), `${where}: ${o.quest}`).toBe(true);
        if (Array.isArray(o.all)) o.all.forEach(walk);
      };
      for (const r of rules) walk(r.if);
    };
    for (const npc of Object.values(NPCS)) check(npc.conversation.topics, npc.id);
    for (const it of Object.values(INTERACTABLES)) check(it.dialogue, it.id);
  });

  it('interactables on the maps are defined, placed once, on walkable ground, reachable and clear of buildings', () => {
    const seen = new Set<string>();
    for (const map of maps) {
      const collision = new CollisionSystem(map);
      for (const it of map.interactables) {
        expect(INTERACTABLES[it.id], `${map.id}: ${it.id}`).toBeDefined();
        expect(seen.has(it.id), `${it.id} placed twice`).toBe(false);
        seen.add(it.id);
        expect(collision.isTileBlocked(Math.floor(it.pos.x), Math.floor(it.pos.y))).toBe(false);
        for (const b of map.buildings) {
          const inside = it.pos.x >= b.x && it.pos.x < b.x + b.w && it.pos.y >= b.y && it.pos.y < b.y + b.h;
          expect(inside, `${it.id} inside a building`).toBe(false);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(INTERACTABLES).sort());
  });

  it('the seal only shows after the guardian of ITS map falls, and that map has a boss to defeat', () => {
    const relic = INTERACTABLES.ruins_relic!;
    expect(relic.requiresFlag).toBe('pure_ruins_boss_defeated');
    expect(maps.find((m) => m.id === 'pure_ruins')!.spawns.boss).not.toBeNull();
  });

  it('a character may stand on two maps only when one placement is hidden by the flag that shows the other', () => {
    const placements = new Map<string, { map: string; requiresFlag?: string; hiddenByFlag?: string }[]>();
    for (const map of maps) for (const n of map.npcs) placements.set(n.id, [...(placements.get(n.id) ?? []), { map: map.id, requiresFlag: n.requiresFlag, hiddenByFlag: n.hiddenByFlag }]);
    for (const [id, list] of placements) {
      if (list.length === 1) continue;
      expect(list, id).toHaveLength(2);
      const shown = list.find((p) => p.requiresFlag);
      const hidden = list.find((p) => p.hiddenByFlag);
      expect(shown && hidden && shown.requiresFlag === hidden.hiddenByFlag, `${id} appears twice at the same time`).toBe(true);
    }
    expect(placements.get('boatwright_laodu')).toHaveLength(2);
  });

  it('npcPresent follows the flags', () => {
    const has = (flags: string[]) => (f: string) => flags.includes(f);
    expect(npcPresent({}, has([]))).toBe(true);
    expect(npcPresent({ requiresFlag: 'a' }, has([]))).toBe(false);
    expect(npcPresent({ requiresFlag: 'a' }, has(['a']))).toBe(true);
    expect(npcPresent({ hiddenByFlag: 'a' }, has(['a']))).toBe(false);
    expect(npcPresent({ hiddenByFlag: 'a' }, has([]))).toBe(true);
  });
});

describe('playing chapter 1 from the first word to the ferry', () => {
  it('works through all four quests with the real data', () => {
    const w = new World();
    w.goTo('pure_village');

    // -- quest 1: the hunter
    expect(w.npc('hunter_yanya')).toBe('hunter_intro'); // first choices: accept
    expect(w.log.state('q1_first_hunt')).toBe('active');
    w.goTo('pure_forest');
    for (let i = 0; i < 5; i++) w.kill('forest_wolf');
    expect(w.log.state('q1_first_hunt')).toBe('ready');
    w.goTo('pure_village');
    expect(w.npc('hunter_yanya')).toBe('hunter_turnin');
    expect(w.log.state('q1_first_hunt')).toBe('completed');

    // -- quest 2: Xi (first meeting, then the offer)
    expect(w.log.state('q2_muddy_water')).toBe('available');
    expect(w.npc('waterer_xi')).toBe('waterer_intro');
    expect(w.npc('waterer_xi')).toBe('xi_q2_offer');
    expect(w.log.state('q2_muddy_water')).toBe('active');
    w.goTo('pure_forest');
    w.goTo('pure_spring_cave');
    w.kill('warped'); // an ordinary kill does not count
    expect(w.log.state('q2_muddy_water')).toBe('active');
    w.kill('warped', { elite: true });
    expect(w.use('spring_shard')).toBe('shard_find');
    expect(w.flags.has('has_shard')).toBe(true);
    expect(w.log.state('q2_muddy_water')).toBe('ready');
    expect(w.use('spring_shard')).toBeNull(); // picked up: gone
    w.goTo('pure_forest');
    w.goTo('pure_village');
    expect(w.npc('waterer_xi')).toBe('xi_q2_turnin');
    expect(w.log.state('q2_muddy_water')).toBe('completed');

    // -- quest 3: the elder, the ruins, the seal
    expect(w.log.state('q3_resonance')).toBe('available');
    expect(w.flags.has('ruins_open')).toBe(false);
    expect(w.npc('elder_qiyi')).toBe('elder_intro'); // the first meeting plays by itself
    expect(w.npc('elder_qiyi')).toBe('elder_q3_offer');
    expect(w.log.state('q3_resonance')).toBe('active');
    expect(w.flags.has('ruins_open')).toBe(true);
    w.goTo('pure_forest');
    w.goTo('pure_ruins');
    expect(w.use('ruins_relic')).toBeNull(); // not before the guardian is down
    w.kill('ruins_guardian', { boss: true });
    expect(w.use('ruins_relic')).toBe('relic_take');
    expect(w.log.state('q3_resonance')).toBe('ready');
    w.goTo('pure_forest');
    w.goTo('pure_village');
    expect(w.npc('elder_qiyi')).toBe('elder_q3_turnin');
    expect(w.log.state('q3_resonance')).toBe('completed');

    // -- quest 4: the ferry
    expect(w.flags.has('coast_open')).toBe(false);
    expect(w.npc('elder_qiyi')).toBe('elder_q4_offer');
    expect(w.log.state('q4_stranded_boat')).toBe('active');
    expect(w.flags.has('coast_open')).toBe(true);
    // Laodu still stands in the village until the map is re-entered; the coast conversation must not play here
    expect(w.npc('boatwright_laodu')).not.toBe('laodu_coast_q4');
    w.goTo('pure_coast');
    expect(w.use('ferry_board')).toBe('ferry_need_laodu'); // ask Laodu first
    expect(w.chapterEnded).toBe(false);
    expect(w.npc('boatwright_laodu')).toBe('laodu_coast_q4');
    expect(w.flags.has('laodu_ferry_checked')).toBe(true);
    expect(w.use('ferry_board')).toBe('ferry_board'); // first choice: board
    expect(w.log.state('q4_stranded_boat')).toBe('completed');
    expect(w.chapterEnded).toBe(true);
    expect(w.flags.has('chapter1_complete')).toBe(true);
  });

  it('declining to board leaves the quest open and the chapter running', () => {
    const w = new World();
    // fast-forward the earlier quests
    for (const id of ['q1_first_hunt', 'q2_muddy_water', 'q3_resonance'] as const) {
      w.log.start(id);
      const def = QUESTS[id]!;
      for (const o of def.objectives) {
        if (o.type === 'kill') for (let i = 0; i < o.count; i++) w.log.report({ type: 'kill', monster: o.monster ?? 'x', map: o.map ?? w.mapId, elite: !!o.elite, boss: !!o.boss });
        if (o.type === 'reach') w.log.report({ type: 'reach', map: o.map });
        if (o.type === 'interact') w.log.report({ type: 'interact', target: o.target });
      }
      expect(w.log.complete(id)).not.toBeNull();
    }
    w.npc('elder_qiyi'); // first meeting: the intro
    w.npc('elder_qiyi'); // offer q4, accept
    w.goTo('pure_coast');
    w.npc('boatwright_laodu'); // first meeting: the intro
    w.npc('boatwright_laodu'); // the ferry question
    expect(w.use('ferry_board', [1])).toBe('ferry_board'); // second choice: wait
    expect(w.log.state('q4_stranded_boat')).toBe('active');
    expect(w.chapterEnded).toBe(false);
    expect(w.use('ferry_board', [0])).toBe('ferry_board');
    expect(w.chapterEnded).toBe(true);
  });
});
