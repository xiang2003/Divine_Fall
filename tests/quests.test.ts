import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogues';
import { MONSTERS } from '../src/data/monsters';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { WORLD_MAP_FILES } from '../src/data/worldMaps';
import { DialogueRunner, type DialogueContext } from '../src/systems/dialogue';
import { firstGraph } from './npcHelpers';
import { QuestLog, describeRewards, validateQuests, type QuestDef } from '../src/systems/quests';

const rewards = { xp: 10, items: [] };

const defs: Record<string, QuestDef> = {
  a: {
    id: 'a',
    title: 'A',
    summary: 'first',
    giver: 'giver',
    turnIn: 'boss_npc',
    requires: [],
    objectives: [
      { type: 'talk', label: 'talk', npc: 'other' },
      { type: 'kill', label: 'kill 3 hounds in the forest', count: 3, monster: 'hound', map: 'forest' },
      { type: 'reach', label: 'reach ruins', map: 'ruins' },
      { type: 'interact', label: 'inspect', target: 'shard' },
      { type: 'collect', label: 'collect 2', item: 'sample', count: 2 },
    ],
    rewards,
    startFlags: ['a_started'],
  },
  b: { id: 'b', title: 'B', summary: 'second', giver: 'giver', requires: ['a'], objectives: [{ type: 'kill', label: 'any elite', count: 1, elite: true }], rewards },
  c: { id: 'c', title: 'C', summary: 'boss', giver: 'giver', requires: [], objectives: [{ type: 'kill', label: 'boss', count: 1, boss: true }], rewards },
};

const kill = (monster: string, map = 'forest', elite = false, boss = false) => ({ type: 'kill', monster, map, elite, boss }) as const;

describe('quest states', () => {
  it('a quest is available when it has no prerequisites and locked until they are completed', () => {
    const log = new QuestLog(defs);
    expect(log.state('a')).toBe('available');
    expect(log.state('b')).toBe('locked');
    expect(log.start('b')).toBeNull(); // cannot be accepted while locked
    expect(log.state('b')).toBe('locked');
  });

  it('start() works once, on an available quest only', () => {
    const log = new QuestLog(defs);
    expect(log.start('a')?.id).toBe('a');
    expect(log.state('a')).toBe('active');
    expect(log.start('a')).toBeNull();
    expect(log.progressOf('a')).toEqual([0, 0, 0, 0, 0]);
  });

  it('complete() only works on a ready quest, and only once', () => {
    const log = new QuestLog(defs);
    log.start('c');
    expect(log.complete('c')).toBeNull(); // active, not ready
    log.report(kill('x', 'any', false, true));
    expect(log.state('c')).toBe('ready');
    expect(log.complete('c')?.id).toBe('c');
    expect(log.state('c')).toBe('completed');
    expect(log.complete('c')).toBeNull();
  });

  it('an active prerequisite does not unlock the next quest', () => {
    const log = new QuestLog(defs);
    log.start('c');
    log.report(kill('x', 'any', false, true));
    expect(log.state('b')).toBe('locked');
    log.start('a');
    expect(log.state('b')).toBe('locked'); // active is not enough
  });

  it('unknown quest ids throw', () => {
    expect(() => new QuestLog(defs).state('nope')).toThrow(/Unknown quest/);
  });
});

describe('objectives', () => {
  function fresh() {
    const log = new QuestLog(defs);
    log.start('a');
    return log;
  }

  it('are worked on one after another: later objectives ignore events until their turn', () => {
    const log = fresh();
    expect(log.report(kill('hound'))).toEqual([]); // the talk objective is current, kills do not count yet
    expect(log.progressOf('a')).toEqual([0, 0, 0, 0, 0]);
    const events = log.report({ type: 'talk', npc: 'other' });
    expect(events).toContainEqual({ type: 'objectiveDone', quest: 'a', objective: 0 });
    expect(log.progressOf('a')[0]).toBe(1);
  });

  it('kill objectives count only matching monsters, maps, elites and bosses', () => {
    const log = fresh();
    log.report({ type: 'talk', npc: 'other' });
    log.report(kill('ghoul')); // wrong monster
    log.report(kill('hound', 'ruins')); // wrong map
    expect(log.progressOf('a')[1]).toBe(0);
    log.report(kill('hound'));
    log.report(kill('hound'));
    expect(log.progressOf('a')[1]).toBe(2);
    const events = log.report(kill('hound'));
    expect(events.map((e) => e.type)).toEqual(['progress', 'objectiveDone']);
    expect(log.progressOf('a')[1]).toBe(3);
    log.report(kill('hound')); // extra kills past the target do nothing
    expect(log.progressOf('a')[1]).toBe(3);
  });

  it('elite and boss objectives ignore ordinary kills', () => {
    const log = new QuestLog(defs);
    log.start('c');
    expect(log.report(kill('x'))).toEqual([]);
    expect(log.report(kill('x', 'forest', true))).toEqual([]);
    expect(log.report(kill('x', 'forest', true, true)).map((e) => e.type)).toContain('ready');
  });

  it('reach, interact and collect objectives; the quest becomes ready after the last one', () => {
    const log = fresh();
    log.report({ type: 'talk', npc: 'other' });
    for (let i = 0; i < 3; i++) log.report(kill('hound'));
    log.report({ type: 'reach', map: 'ruins' });
    log.report({ type: 'interact', target: 'something else' });
    expect(log.progressOf('a')[3]).toBe(0);
    log.report({ type: 'interact', target: 'shard' });
    expect(log.state('a')).toBe('active');
    log.report({ type: 'collect', item: 'sample', count: 1 });
    expect(log.progressOf('a')[4]).toBe(1);
    const events = log.report({ type: 'collect', item: 'sample', count: 5 }); // clamped to the target
    expect(log.progressOf('a')[4]).toBe(2);
    expect(events.at(-1)).toEqual({ type: 'ready', quest: 'a' });
    expect(log.state('a')).toBe('ready');
  });

  it('a "reach" objective that is already true when it becomes current completes at once', () => {
    const reachFirst: Record<string, QuestDef> = {
      r: { id: 'r', title: 'R', summary: '', giver: 'g', requires: [], objectives: [{ type: 'reach', label: 'be in the ruins', map: 'ruins' }], rewards },
    };
    const log = new QuestLog(reachFirst);
    log.report({ type: 'reach', map: 'ruins' }); // location known before the quest starts
    log.start('r');
    expect(log.state('r')).toBe('ready');

    const log2 = new QuestLog(reachFirst);
    log2.report({ type: 'reach', map: 'forest' });
    log2.start('r');
    expect(log2.state('r')).toBe('active');
    log2.report({ type: 'reach', map: 'ruins' });
    expect(log2.state('r')).toBe('ready');
  });

  it('events for quests that are not active do nothing', () => {
    const log = new QuestLog(defs);
    expect(log.report({ type: 'talk', npc: 'other' })).toEqual([]);
    expect(log.progressOf('a')).toEqual([]);
  });
});

describe('lookup and views', () => {
  it('availableFrom / readyFor find the right NPC', () => {
    const log = new QuestLog(defs);
    expect(log.availableFrom('giver').map((q) => q.id).sort()).toEqual(['a', 'c']);
    expect(log.availableFrom('nobody')).toEqual([]);
    log.start('c');
    log.report(kill('x', 'any', false, true));
    expect(log.readyFor('giver').map((q) => q.id)).toEqual(['c']);
    log.start('a');
    expect(log.readyFor('boss_npc')).toEqual([]); // a is not ready yet; its turn-in NPC is boss_npc
  });

  it('views list started quests with ready first, objective flags and the turn-in NPC', () => {
    const log = new QuestLog(defs);
    expect(log.views()).toEqual([]);
    log.start('a');
    log.start('c');
    log.report(kill('x', 'any', false, true));
    const views = log.views();
    expect(views.map((v) => [v.id, v.state])).toEqual([['c', 'ready'], ['a', 'active']]);
    const a = views[1]!;
    expect(a.turnInNpc).toBe('boss_npc');
    expect(a.objectives.map((o) => o.active)).toEqual([true, false, false, false, false]);
    expect(a.objectives[1]).toMatchObject({ target: 3, current: 0, done: false });
    expect(views[0]!.turnInNpc).toBe('giver'); // defaults to the giver
  });

  it('describeRewards lists experience and items', () => {
    expect(describeRewards({ xp: 40, items: [{ rarity: 'magic', count: 1 }] })).toBe('經驗 40 · 魔法裝備 ×1');
    expect(describeRewards({ xp: 0, items: [] })).toBe('無');
  });
});

describe('saving and restoring', () => {
  it('round-trips progress and states', () => {
    const log = new QuestLog(defs);
    log.start('a');
    log.report({ type: 'talk', npc: 'other' });
    log.report(kill('hound'));
    const saved = JSON.parse(JSON.stringify(log.getState()));
    const copy = new QuestLog(defs);
    copy.restore(saved);
    expect(copy.getState()).toEqual(log.getState());
    expect(copy.state('a')).toBe('active');
    expect(copy.progressOf('a')).toEqual([1, 1, 0, 0, 0]);
  });

  it('drops unknown quests and malformed records, clamps progress, and keeps state consistent with progress', () => {
    const log = new QuestLog(defs);
    log.restore({
      quests: {
        ghost: { state: 'active', progress: [1] },
        a: { state: 'ready', progress: [1, 99, -4, Number.NaN] }, // not finished: cannot be ready
        c: { state: 'active', progress: [1] }, // finished: becomes ready
        b: { state: 'bogus' as never, progress: [] },
      },
    });
    expect(log.getState().quests.ghost).toBeUndefined();
    expect(log.getState().quests.b).toBeUndefined();
    expect(log.state('a')).toBe('active');
    expect(log.progressOf('a')).toEqual([1, 3, 0, 0, 0]);
    expect(log.state('c')).toBe('ready');
  });

  it('restore(garbage) leaves an empty log', () => {
    const log = new QuestLog(defs);
    log.start('a');
    log.restore(undefined as never);
    expect(log.views()).toEqual([]);
  });
});

describe('validateQuests', () => {
  const known = { npcs: new Set(['giver', 'boss_npc', 'other']), maps: new Set(['forest', 'ruins']), monsters: new Set(['hound']) };

  it('accepts the test data', () => {
    expect(validateQuests(defs, known)).toEqual([]);
  });

  it('reports unknown references, empty objectives, bad counts, self / cyclic prerequisites', () => {
    const bad: Record<string, QuestDef> = {
      x: { id: 'x', title: 'X', summary: '', giver: 'nobody', turnIn: 'nobody2', requires: ['x', 'zzz'], objectives: [], rewards },
      y: { id: 'y', title: 'Y', summary: '', giver: 'giver', requires: ['z'], objectives: [{ type: 'kill', label: 'k', count: 0, map: 'mars', monster: 'dragon' }, { type: 'reach', label: '', map: 'mars' }], rewards },
      z: { id: 'z', title: 'Z', summary: '', giver: 'giver', requires: ['y'], objectives: [{ type: 'talk', label: 't', npc: 'nobody' }], rewards },
    };
    const text = validateQuests(bad, known).join('\n');
    for (const piece of [/unknown giver/, /unknown turn-in/, /requires unknown quest "zzz"/, /requires itself/, /no objectives/, /count >= 1/, /unknown map "mars"/, /unknown monster "dragon"/, /no label/, /unknown NPC "nobody"/, /prerequisite cycle/]) {
      expect(text).toMatch(piece);
    }
  });
});

describe('authored chapter 1 quests', () => {
  it('only refer to NPCs, maps and monsters that exist', () => {
    const known = { npcs: new Set(Object.keys(NPCS)), maps: new Set(Object.keys(WORLD_MAP_FILES)), monsters: new Set(Object.keys(MONSTERS)) };
    expect(validateQuests(QUESTS, known)).toEqual([]);
  });

  it('every quest dialogue effect names a real quest', () => {
    for (const g of Object.values(DIALOGUES)) {
      for (const [id, node] of Object.entries(g.nodes)) {
        for (const q of [node.startQuest, node.completeQuest]) if (q) expect(QUESTS[q], `${g.id}/${id}`).toBeDefined();
      }
    }
  });

  it('the hunter quest plays through from offer to reward with the real dialogue', () => {
    const log = new QuestLog(QUESTS);
    const flags = new Set<string>();
    const ctx: DialogueContext = {
      level: 1,
      mapId: 'pure_village',
      hasFlag: (n) => flags.has(n),
      setFlag: (n, on) => void (on ? flags.add(n) : flags.delete(n)),
      questState: (id) => log.state(id),
      startQuest: (id) => void log.start(id),
      completeQuest: (id) => void log.complete(id),
      reportInteract: () => undefined,
      endChapter: () => undefined,
    };
    const talk = () => {
      log.report({ type: 'talk', npc: 'hunter_yanya' });
      const id = firstGraph(NPCS.hunter_yanya!.conversation, ctx)!;
      const r = new DialogueRunner(DIALOGUES[id]!, ctx, '岩牙');
      const seen: string[] = [id];
      for (let i = 0; i < 30 && !r.finished; i++) {
        if (r.view?.choices) r.choose(0);
        else r.advance();
      }
      expect(r.finished).toBe(true);
      return seen[0];
    };

    expect(log.state('q1_first_hunt')).toBe('available');
    expect(talk()).toBe('hunter_intro'); // first meeting ends by accepting (first choice every time)
    expect(log.state('q1_first_hunt')).toBe('active');
    expect(talk()).toBe('hunter_active');
    log.report({ type: 'reach', map: 'pure_forest' });
    for (let i = 0; i < 4; i++) log.report({ type: 'kill', monster: 'hound', map: 'pure_forest', elite: false, boss: false });
    expect(log.state('q1_first_hunt')).toBe('active');
    log.report({ type: 'kill', monster: 'ghoul', map: 'pure_ruins', elite: false, boss: false }); // wrong map
    expect(log.state('q1_first_hunt')).toBe('active');
    log.report({ type: 'kill', monster: 'shade', map: 'pure_forest', elite: false, boss: false });
    expect(log.state('q1_first_hunt')).toBe('ready');
    expect(talk()).toBe('hunter_turnin');
    expect(log.state('q1_first_hunt')).toBe('completed');
    expect(talk()).toBe('hunter_repeat');
  });

  it('declining the offer leaves the quest available, and the hunter offers it again', () => {
    const log = new QuestLog(QUESTS);
    const flags = new Set<string>();
    const ctx: DialogueContext = {
      level: 1,
      mapId: 'pure_village',
      hasFlag: (n) => flags.has(n),
      setFlag: (n, on) => void (on ? flags.add(n) : flags.delete(n)),
      questState: (id) => log.state(id),
      startQuest: (id) => void log.start(id),
      completeQuest: (id) => void log.complete(id),
      reportInteract: () => undefined,
      endChapter: () => undefined,
    };
    const r = new DialogueRunner(DIALOGUES.hunter_intro!, ctx, '岩牙');
    r.advance(); // a -> b
    r.choose(0); // b -> ok
    r.advance(); // ok -> offer
    r.choose(1); // "not ready"
    expect(log.state('q1_first_hunt')).toBe('available');
    expect(firstGraph(NPCS.hunter_yanya!.conversation, ctx)).toBe('hunter_offer');
  });
});
