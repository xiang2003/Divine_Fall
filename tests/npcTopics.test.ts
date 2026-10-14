import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { QuestLog } from '../src/systems/quests';
import { QUESTS } from '../src/data/quests';
import type { DialogueContext } from '../src/systems/dialogue';
import { TOPIC_MARK, greetingFor, needsIntro, visibleTopics, type NpcConversation } from '../src/systems/npcTopics';

function ctx(flags: string[] = [], mapId = 'pure_village', log = new QuestLog(QUESTS)): DialogueContext {
  const set = new Set(flags);
  return {
    hasFlag: (n) => set.has(n),
    setFlag: (n, on) => void (on ? set.add(n) : set.delete(n)),
    level: 1,
    mapId,
    questState: (id) => log.state(id),
    startQuest: (id) => void log.start(id),
    completeQuest: (id) => void log.complete(id),
    reportInteract: () => undefined,
    endChapter: () => undefined,
  };
}

const conv: NpcConversation = {
  intro: { graph: 'intro', metFlag: 'met' },
  greetings: ['a', 'b', 'c'],
  topics: [
    { kind: 'quest', label: 'Q', graph: 'q', if: { flag: 'offer' } },
    { kind: 'talk', label: 'T', graph: 't' },
  ],
};

describe('npc topics', () => {
  it('lists only the topics whose condition holds, in order', () => {
    expect(visibleTopics(conv, ctx()).map((t) => t.label)).toEqual(['T']);
    expect(visibleTopics(conv, ctx(['offer'])).map((t) => t.label)).toEqual(['Q', 'T']);
  });

  it('needs the intro until the met flag is set', () => {
    expect(needsIntro(conv, ctx())).toBe(true);
    expect(needsIntro(conv, ctx(['met']))).toBe(false);
  });

  it('rotates greetings and wraps around', () => {
    expect([0, 1, 2, 3, 4].map((v) => greetingFor(conv, v))).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(greetingFor({ ...conv, greetings: [] }, 0)).toBe('');
  });

  it('marks quest entries and leaves chat entries plain', () => {
    expect(TOPIC_MARK.quest).toBe('！');
    expect(TOPIC_MARK.turnin).toBe('？');
    expect(TOPIC_MARK.talk).toBe('');
  });
});

describe('chapter 1 NPC menus', () => {
  it('have a portrait file for every NPC', () => {
    for (const npc of Object.values(NPCS)) expect(existsSync(join(__dirname, '..', 'public', npc.portrait)), npc.id).toBe(true);
  });

  it('offer the quest on the menu once the intro is done, and swap it for a turn-in later', () => {
    const log = new QuestLog(QUESTS);
    const c = ctx(['met_yanya'], 'pure_village', log);
    const hunter = NPCS.hunter_yanya!.conversation;
    const kinds = () => visibleTopics(hunter, c).map((t) => t.kind);
    expect(kinds()).toEqual(['quest', 'talk']);
    log.start('q1_first_hunt');
    expect(kinds()).toEqual(['active', 'talk']);
  });

  it('only shows the ferry question to the boatwright on the coast', () => {
    const laodu = NPCS.boatwright_laodu!.conversation;
    expect(visibleTopics(laodu, ctx(['met_laodu'], 'pure_village')).map((t) => t.graph)).toEqual(['boatwright_repeat']);
  });
});
