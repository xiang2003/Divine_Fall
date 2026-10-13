import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogues';
import { MapParseError, parseMap } from '../src/data/mapData';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { QuestLog } from '../src/systems/quests';
import { WORLD_MAP_FILES } from '../src/data/worldMaps';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import {
  DialogueRunner,
  evalCondition,
  pickDialogue,
  validateDialogue,
  type DialogueContext,
  type DialogueGraph,
} from '../src/systems/dialogue';
import { NPC_CLICK_RADIUS, NPC_TALK_RANGE, npcBounds } from '../src/systems/NpcSystem';

function makeCtx(flags: string[] = [], level = 1): DialogueContext & { flags: Set<string> } {
  const set = new Set(flags);
  const log = new QuestLog(QUESTS);
  return {
    flags: set,
    level,
    hasFlag: (n) => set.has(n),
    setFlag: (n, on) => void (on ? set.add(n) : set.delete(n)),
    questState: (id) => log.state(id),
    startQuest: (id) => void log.start(id),
    completeQuest: (id) => void log.complete(id),
  };
}

const graph: DialogueGraph = {
  id: 't',
  start: 'a',
  nodes: {
    a: { text: 'hello', set: ['seen_a'], next: 'b' },
    b: {
      speaker: '你',
      text: 'pick',
      choices: [
        { text: 'x', to: 'x' },
        { text: 'secret', to: 'y', if: { flag: 'knows' } },
        { text: 'lvl', to: 'x', if: { minLevel: 5 } },
      ],
    },
    x: { text: 'went x', set: ['took_x'], clear: ['seen_a'], end: true },
    y: { text: 'went y', end: true },
  },
};

describe('conditions', () => {
  const ctx = makeCtx(['a'], 3);
  it('evaluates flag, notFlag, minLevel and all; no condition is true', () => {
    expect(evalCondition(undefined, ctx)).toBe(true);
    expect(evalCondition({ flag: 'a' }, ctx)).toBe(true);
    expect(evalCondition({ flag: 'b' }, ctx)).toBe(false);
    expect(evalCondition({ notFlag: 'b' }, ctx)).toBe(true);
    expect(evalCondition({ notFlag: 'a' }, ctx)).toBe(false);
    expect(evalCondition({ minLevel: 3 }, ctx)).toBe(true);
    expect(evalCondition({ minLevel: 4 }, ctx)).toBe(false);
    expect(evalCondition({ all: [{ flag: 'a' }, { minLevel: 3 }] }, ctx)).toBe(true);
    expect(evalCondition({ all: [{ flag: 'a' }, { minLevel: 9 }] }, ctx)).toBe(false);
  });

  it('pickDialogue takes the first rule that holds', () => {
    const rules = [{ if: { flag: 'met' }, graph: 'again' }, { graph: 'first' }];
    expect(pickDialogue(rules, makeCtx())).toBe('first');
    expect(pickDialogue(rules, makeCtx(['met']))).toBe('again');
    expect(pickDialogue([{ if: { flag: 'zzz' }, graph: 'g' }], makeCtx())).toBeNull();
  });
});

describe('DialogueRunner', () => {
  it('shows the start node with the default speaker and applies its flags on entry', () => {
    const ctx = makeCtx();
    const r = new DialogueRunner(graph, ctx, '村長');
    expect(r.view).toEqual({ speaker: '村長', text: 'hello', choices: null, last: false });
    expect(ctx.flags.has('seen_a')).toBe(true);
  });

  it('advances to a node with choices and offers only those whose condition holds', () => {
    const r = new DialogueRunner(graph, makeCtx(), 'N');
    r.advance();
    expect(r.view).toEqual({ speaker: '你', text: 'pick', choices: ['x'], last: false });
    const r2 = new DialogueRunner(graph, makeCtx(['knows'], 5), 'N');
    r2.advance();
    expect(r2.view?.choices).toEqual(['x', 'secret', 'lvl']);
  });

  it('advance() does nothing on a node that is waiting for a choice', () => {
    const r = new DialogueRunner(graph, makeCtx(), 'N');
    r.advance();
    r.advance();
    expect(r.view?.text).toBe('pick');
  });

  it('choose() follows the visible choice index, applies set / clear, and ends on an end node', () => {
    const ctx = makeCtx(['knows']);
    const r = new DialogueRunner(graph, ctx, 'N');
    r.advance();
    r.choose(1); // "secret" is the second visible choice
    expect(r.view?.text).toBe('went y');
    expect(r.view?.last).toBe(true);
    r.advance();
    expect(r.finished).toBe(true);
    expect(r.view).toBeNull();

    const ctx2 = makeCtx();
    const r2 = new DialogueRunner(graph, ctx2, 'N');
    r2.advance();
    r2.choose(0);
    expect(ctx2.flags.has('took_x')).toBe(true);
    expect(ctx2.flags.has('seen_a')).toBe(false); // cleared on entering x
  });

  it('ignores out-of-range choices and does nothing after it finished', () => {
    const r = new DialogueRunner(graph, makeCtx(), 'N');
    r.advance();
    r.choose(7);
    expect(r.view?.text).toBe('pick');
    r.choose(0);
    r.advance();
    expect(r.finished).toBe(true);
    r.advance();
    r.choose(0);
    expect(r.finished).toBe(true);
  });

  it('a node whose choices are all gated off falls back to its end instead of hanging', () => {
    const g: DialogueGraph = {
      id: 'g',
      start: 'a',
      nodes: { a: { text: 'only gated', choices: [{ text: 'no', to: 'b', if: { flag: 'never' } }] }, b: { text: 'b', end: true } },
    };
    const r = new DialogueRunner(g, makeCtx(), 'N');
    expect(r.view?.choices).toBeNull();
    r.advance();
    expect(r.finished).toBe(true);
  });

  it('close() ends the conversation at once', () => {
    const r = new DialogueRunner(graph, makeCtx(), 'N');
    r.close();
    expect(r.finished).toBe(true);
  });

  it('a link to a missing node ends the conversation rather than crashing', () => {
    const g: DialogueGraph = { id: 'g', start: 'a', nodes: { a: { text: 'a', next: 'nowhere' } } };
    const r = new DialogueRunner(g, makeCtx(), 'N');
    r.advance();
    expect(r.finished).toBe(true);
  });
});

describe('validateDialogue', () => {
  it('accepts a sound graph', () => {
    expect(validateDialogue(graph)).toEqual([]);
  });

  it('reports missing start, missing targets, empty text, no exit, unreachable nodes and endless loops', () => {
    const bad: DialogueGraph = {
      id: 'bad',
      start: 'nope',
      nodes: { a: { text: '', next: 'zzz' }, b: { text: 'two exits', next: 'a', end: true }, c: { text: 'no exit' } },
    };
    const text = validateDialogue(bad).join('\n');
    expect(text).toMatch(/start node "nope"/);
    expect(text).toMatch(/empty text/);
    expect(text).toMatch(/next "zzz" does not exist/);
    expect(text).toMatch(/exactly one of choices \/ next \/ end/);
    expect(text).toMatch(/unreachable/);

    const loop: DialogueGraph = { id: 'loop', start: 'a', nodes: { a: { text: 'a', next: 'b' }, b: { text: 'b', next: 'a' } } };
    expect(validateDialogue(loop).join('\n')).toMatch(/no path from here ever ends/);
  });
});

describe('authored chapter 1 content', () => {
  it('every dialogue graph is sound', () => {
    for (const g of Object.values(DIALOGUES)) expect(validateDialogue(g), g.id).toEqual([]);
  });

  it('every graph is keyed by its own id', () => {
    for (const [key, g] of Object.entries(DIALOGUES)) expect(g.id).toBe(key);
  });

  it('every NPC rule points at a real graph and the last rule is unconditional', () => {
    for (const npc of Object.values(NPCS)) {
      for (const rule of npc.dialogue) expect(DIALOGUES[rule.graph], `${npc.id} -> ${rule.graph}`).toBeDefined();
      expect(npc.dialogue.at(-1)?.if, `${npc.id} needs a fallback rule`).toBeUndefined();
    }
  });

  it('a first conversation switches the NPC to its repeat conversation', () => {
    for (const npc of Object.values(NPCS)) {
      const ctx = makeCtx();
      const first = pickDialogue(npc.dialogue, ctx)!;
      let r = new DialogueRunner(DIALOGUES[first]!, ctx, npc.name);
      // Walk through every line, always taking the first choice.
      for (let i = 0; i < 50 && !r.finished; i++) {
        if (r.view?.choices) r.choose(0);
        else r.advance();
      }
      expect(r.finished, `${npc.id} first conversation never ends`).toBe(true);
      const second = pickDialogue(npc.dialogue, ctx)!;
      expect(second, `${npc.id} should have a different conversation afterwards`).not.toBe(first);
      r = new DialogueRunner(DIALOGUES[second]!, ctx, npc.name);
      expect(r.finished).toBe(false);
    }
  });

  it('the elder only offers the "ask about Xi" choice after meeting Xi', () => {
    const ctx = makeCtx(['met_elder']);
    const r = new DialogueRunner(DIALOGUES.elder_repeat!, ctx, '祈漪');
    expect(r.view?.choices).toHaveLength(2);
    ctx.setFlag('met_xi', true);
    const r2 = new DialogueRunner(DIALOGUES.elder_repeat!, ctx, '祈漪');
    expect(r2.view?.choices).toHaveLength(3);
  });
});

describe('NPC placement', () => {
  it('parseMap reads NPCs, and rejects walls, crates and duplicates', () => {
    const layout = ['#####', '#P.c#', '#...#', '#####'];
    const map = parseMap({ id: 'a', name: 'A', layout, npcs: [{ id: 'elder_qiyi', x: 2, y: 2 }] });
    expect(map.npcs).toEqual([{ id: 'elder_qiyi', pos: { x: 2.5, y: 2.5 } }]);
    expect(parseMap({ id: 'a', name: 'A', layout }).npcs).toEqual([]);
    expect(() => parseMap({ id: 'a', name: 'A', layout, npcs: [{ id: 'n', x: 0, y: 0 }] })).toThrow(/not on a floor tile/);
    expect(() => parseMap({ id: 'a', name: 'A', layout, npcs: [{ id: 'n', x: 3, y: 1 }] })).toThrow(/crate/);
    expect(() =>
      parseMap({ id: 'a', name: 'A', layout, npcs: [{ id: 'n', x: 2, y: 2 }, { id: 'n', x: 3, y: 2 }] }),
    ).toThrow(/twice/);
    expect(() => parseMap({ id: 'a', name: 'A', layout, npcs: [{ x: 2, y: 2 }] })).toThrow(MapParseError);
  });

  it('an NPC blocks movement through the collision system', () => {
    const map = parseMap({ id: 'a', name: 'A', layout: ['#####', '#P..#', '#####'] });
    const open = new CollisionSystem(map);
    const blocked = new CollisionSystem(map, [npcBounds({ x: 2.5, y: 1.5 })]);
    expect(open.collidesCircle(2.5, 1.5, 0.28)).toBe(false);
    expect(blocked.collidesCircle(2.5, 1.5, 0.28)).toBe(true);
    const pos = { x: 1.5, y: 1.5 };
    blocked.moveCircle(pos, 0.28, 2, 0);
    expect(pos.x).toBeLessThan(2.5 - 0.3);
  });

  it('talk range is larger than the click radius and than the blocked square, so a player standing next to an NPC can always talk', () => {
    expect(NPC_TALK_RANGE).toBeGreaterThan(0.3 + 0.28 + 0.3);
    expect(NPC_CLICK_RADIUS).toBeGreaterThan(0.3);
  });

  it('every NPC on every real map is defined, placed once in the whole world, reachable and clear of portals', () => {
    const seen = new Set<string>();
    for (const file of Object.values(WORLD_MAP_FILES)) {
      const map = parseMap(JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as unknown);
      const solids = new CollisionSystem(map, map.npcs.map((o) => npcBounds(o.pos)));
      for (const n of map.npcs) {
        expect(NPCS[n.id], `${map.id}: unknown NPC ${n.id}`).toBeDefined();
        expect(seen.has(n.id), `${n.id} appears on two maps`).toBe(false);
        seen.add(n.id);
        for (const p of map.portals) {
          const inside = n.pos.x >= p.rect.minX - 1 && n.pos.x <= p.rect.maxX + 1 && n.pos.y >= p.rect.minY - 1 && n.pos.y <= p.rect.maxY + 1;
          expect(inside, `${map.id}: ${n.id} is next to portal ${p.id}`).toBe(false);
        }
        // The player can stand within talking range on at least one free spot.
        let free = false;
        for (let a = 0; a < 16 && !free; a++) {
          const x = n.pos.x + Math.cos((a / 16) * Math.PI * 2) * 1.2;
          const y = n.pos.y + Math.sin((a / 16) * Math.PI * 2) * 1.2;
          free = !solids.collidesCircle(x, y, 0.28);
        }
        expect(free, `${n.id} is boxed in`).toBe(true);
      }
    }
  });
});
