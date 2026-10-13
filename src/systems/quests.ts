import { RARITY_INFO, type Rarity } from '../data/rarity';

/**
 * Quest rules, with no rendering and no game objects. Quests are plain data (data/quests.ts); this module keeps
 * the progress and applies game events to it. The game feeds it events (kills, talking, entering a map...) and
 * shows what it reports.
 */

export type QuestState = 'locked' | 'available' | 'active' | 'ready' | 'completed';

export type ObjectiveDef =
  /** Talk to an NPC (counts when a conversation with it starts). */
  | { type: 'talk'; label: string; npc: string }
  /** Kill `count` monsters, optionally only of one kind, on one map, elites, or the boss. */
  | { type: 'kill'; label: string; count: number; monster?: string; map?: string; elite?: boolean; boss?: boolean }
  /** Enter a map. */
  | { type: 'reach'; label: string; map: string }
  /** Examine a place or object (the game reports it by id). */
  | { type: 'interact'; label: string; target: string }
  /** Obtain `count` of a quest item. */
  | { type: 'collect'; label: string; item: string; count: number };

export interface QuestRewards {
  xp: number;
  /** Generated items, each of exactly this rarity. */
  items: readonly { rarity: Rarity; count: number }[];
  /** World flags switched on when the quest is turned in. */
  flags?: readonly string[];
}

export interface QuestDef {
  id: string;
  title: string;
  /** One line shown in the quest log. */
  summary: string;
  /** NPC who offers the quest. */
  giver: string;
  /** NPC who takes the quest in; defaults to the giver. */
  turnIn?: string;
  /** Quests that must be completed before this one is offered. */
  requires: readonly string[];
  /** Done one after another: only the first unfinished objective counts events. */
  objectives: readonly ObjectiveDef[];
  rewards: QuestRewards;
  /** World flags switched on the moment the quest is accepted. */
  startFlags?: readonly string[];
}

/** Something happened in the world that a quest might care about. */
export type QuestHappening =
  | { type: 'kill'; monster: string; map: string; elite: boolean; boss: boolean }
  | { type: 'talk'; npc: string }
  | { type: 'reach'; map: string }
  | { type: 'interact'; target: string }
  | { type: 'collect'; item: string; count: number };

/** What the log tells the game after an event, so it can show a notice and refresh markers. */
export type QuestEvent =
  | { type: 'progress'; quest: string; objective: number; current: number; target: number }
  | { type: 'objectiveDone'; quest: string; objective: number }
  | { type: 'ready'; quest: string };

export interface QuestObjectiveView {
  label: string;
  current: number;
  target: number;
  done: boolean;
  /** The one objective currently being worked on. */
  active: boolean;
}

export interface QuestView {
  id: string;
  title: string;
  summary: string;
  state: QuestState;
  objectives: readonly QuestObjectiveView[];
  /** NPC to go back to once it is ready. */
  turnInNpc: string;
  /** Reward line for the log, e.g. "經驗 40 · 魔法裝備 ×1". */
  rewards: string;
}

/** What goes into a save file. Only quests that were started appear. */
export interface QuestSave {
  quests: Record<string, { state: 'active' | 'ready' | 'completed'; progress: number[] }>;
}

/** A short reward line for the log. */
export function describeRewards(r: QuestRewards): string {
  const parts: string[] = [];
  if (r.xp > 0) parts.push(`經驗 ${r.xp}`);
  for (const item of r.items) parts.push(`${RARITY_INFO[item.rarity].label}裝備 ×${item.count}`);
  return parts.join(' · ') || '無';
}

function targetOf(o: ObjectiveDef): number {
  return o.type === 'kill' || o.type === 'collect' ? o.count : 1;
}

export class QuestLog {
  private readonly records = new Map<string, { state: 'active' | 'ready' | 'completed'; progress: number[] }>();
  private location = '';

  constructor(private readonly defs: Readonly<Record<string, QuestDef>>) {}

  def(id: string): QuestDef {
    const d = this.defs[id];
    if (!d) throw new Error(`Unknown quest "${id}"`);
    return d;
  }

  state(id: string): QuestState {
    const rec = this.records.get(id);
    if (rec) return rec.state;
    const d = this.def(id);
    return d.requires.every((r) => this.records.get(r)?.state === 'completed') ? 'available' : 'locked';
  }

  progressOf(id: string): readonly number[] {
    return this.records.get(id)?.progress ?? [];
  }

  /** Accepts a quest. Only works while it is "available". Returns the definition so the game can apply its start flags. */
  start(id: string): QuestDef | null {
    if (this.state(id) !== 'available') return null;
    const d = this.def(id);
    this.records.set(id, { state: 'active', progress: d.objectives.map(() => 0) });
    // An objective like "reach this map" may already hold the moment it becomes current.
    this.settle(id, []);
    return d;
  }

  /** Turns in a quest that is "ready". Returns the definition (for its rewards) or null if it was not ready. */
  complete(id: string): QuestDef | null {
    const rec = this.records.get(id);
    if (!rec || rec.state !== 'ready') return null;
    rec.state = 'completed';
    return this.def(id);
  }

  /** Quests the player can currently be offered by this NPC. */
  availableFrom(npc: string): QuestDef[] {
    return Object.values(this.defs).filter((q) => q.giver === npc && this.state(q.id) === 'available');
  }

  /** Quests this NPC can take in now. */
  readyFor(npc: string): QuestDef[] {
    return Object.values(this.defs).filter((q) => (q.turnIn ?? q.giver) === npc && this.state(q.id) === 'ready');
  }

  /** Applies a world happening to every active quest. Returns what changed. */
  report(happening: QuestHappening): QuestEvent[] {
    if (happening.type === 'reach') this.location = happening.map;
    const events: QuestEvent[] = [];
    for (const [id, rec] of this.records) {
      if (rec.state !== 'active') continue;
      const def = this.def(id);
      const index = rec.progress.findIndex((p, i) => p < targetOf(def.objectives[i]!));
      if (index < 0) continue;
      const amount = matches(def.objectives[index]!, happening);
      if (amount <= 0) continue;
      const target = targetOf(def.objectives[index]!);
      rec.progress[index] = Math.min(target, rec.progress[index]! + amount);
      events.push({ type: 'progress', quest: id, objective: index, current: rec.progress[index]!, target });
      if (rec.progress[index]! >= target) events.push({ type: 'objectiveDone', quest: id, objective: index });
      this.settle(id, events);
    }
    return events;
  }

  /** After progress: skips objectives that already hold (reach), and marks the quest ready when everything is done. */
  private settle(id: string, events: QuestEvent[]): void {
    const rec = this.records.get(id)!;
    const def = this.def(id);
    for (;;) {
      const index = rec.progress.findIndex((p, i) => p < targetOf(def.objectives[i]!));
      if (index < 0) {
        if (rec.state === 'active') {
          rec.state = 'ready';
          events.push({ type: 'ready', quest: id });
        }
        return;
      }
      const o = def.objectives[index]!;
      if (o.type === 'reach' && o.map === this.location) {
        rec.progress[index] = 1;
        events.push({ type: 'objectiveDone', quest: id, objective: index });
        continue;
      }
      return;
    }
  }

  /** Active and ready quests (for the log and the tracker), then completed ones. */
  views(): QuestView[] {
    const order: Record<QuestState, number> = { ready: 0, active: 1, completed: 2, available: 3, locked: 4 };
    return [...this.records.keys()]
      .map((id) => this.viewOf(id))
      .sort((a, b) => order[a.state] - order[b.state]);
  }

  private viewOf(id: string): QuestView {
    const def = this.def(id);
    const rec = this.records.get(id)!;
    const current = rec.progress.findIndex((p, i) => p < targetOf(def.objectives[i]!));
    return {
      id,
      title: def.title,
      summary: def.summary,
      state: rec.state,
      turnInNpc: def.turnIn ?? def.giver,
      rewards: describeRewards(def.rewards),
      objectives: def.objectives.map((o, i) => ({
        label: o.label,
        current: rec.progress[i]!,
        target: targetOf(o),
        done: rec.progress[i]! >= targetOf(o),
        active: rec.state === 'active' && i === current,
      })),
    };
  }

  getState(): QuestSave {
    const quests: QuestSave['quests'] = {};
    for (const [id, rec] of this.records) quests[id] = { state: rec.state, progress: [...rec.progress] };
    return { quests };
  }

  /** Restores a saved log. Unknown quests and malformed records are dropped; progress is clamped to the objectives. */
  restore(save: QuestSave): void {
    this.records.clear();
    for (const [id, rec] of Object.entries(save?.quests ?? {})) {
      const def = this.defs[id];
      if (!def || !rec || !['active', 'ready', 'completed'].includes(rec.state)) continue;
      const progress = def.objectives.map((o, i) => {
        const p = Number(rec.progress?.[i]);
        return Number.isFinite(p) ? Math.max(0, Math.min(targetOf(o), Math.floor(p))) : 0;
      });
      const allDone = progress.every((p, i) => p >= targetOf(def.objectives[i]!));
      // The state follows the progress: a finished quest cannot be "active", an unfinished one cannot be "ready".
      const state = rec.state === 'completed' ? 'completed' : allDone ? 'ready' : 'active';
      this.records.set(id, { state, progress });
    }
  }
}

/** How much a happening advances an objective (0 = not relevant). */
function matches(o: ObjectiveDef, h: QuestHappening): number {
  switch (o.type) {
    case 'talk':
      return h.type === 'talk' && h.npc === o.npc ? 1 : 0;
    case 'kill':
      if (h.type !== 'kill') return 0;
      if (o.monster && o.monster !== h.monster) return 0;
      if (o.map && o.map !== h.map) return 0;
      if (o.elite && !h.elite) return 0;
      if (o.boss && !h.boss) return 0;
      return 1;
    case 'reach':
      return h.type === 'reach' && h.map === o.map ? 1 : 0;
    case 'interact':
      return h.type === 'interact' && h.target === o.target ? 1 : 0;
    case 'collect':
      return h.type === 'collect' && h.item === o.item ? h.count : 0;
  }
}

/** Structural problems in the quest data (an empty list means it is sound). References are checked against the given id sets. */
export function validateQuests(
  defs: Readonly<Record<string, QuestDef>>,
  known: { npcs: ReadonlySet<string>; maps: ReadonlySet<string>; monsters: ReadonlySet<string>; interactables?: ReadonlySet<string> },
): string[] {
  const problems: string[] = [];
  for (const [key, q] of Object.entries(defs)) {
    const where = `quest ${q.id}`;
    if (key !== q.id) problems.push(`${where}: keyed as "${key}"`);
    if (q.objectives.length === 0) problems.push(`${where}: no objectives`);
    if (!known.npcs.has(q.giver)) problems.push(`${where}: unknown giver "${q.giver}"`);
    if (q.turnIn && !known.npcs.has(q.turnIn)) problems.push(`${where}: unknown turn-in NPC "${q.turnIn}"`);
    for (const r of q.requires) {
      if (!defs[r]) problems.push(`${where}: requires unknown quest "${r}"`);
      if (r === q.id) problems.push(`${where}: requires itself`);
    }
    for (const o of q.objectives) {
      if (o.label.trim() === '') problems.push(`${where}: an objective has no label`);
      if (o.type === 'talk' && !known.npcs.has(o.npc)) problems.push(`${where}: talk objective names unknown NPC "${o.npc}"`);
      if (o.type === 'reach' && !known.maps.has(o.map)) problems.push(`${where}: reach objective names unknown map "${o.map}"`);
      if (o.type === 'kill') {
        if (!(o.count >= 1)) problems.push(`${where}: kill objective needs count >= 1`);
        if (o.map && !known.maps.has(o.map)) problems.push(`${where}: kill objective names unknown map "${o.map}"`);
        if (o.monster && !known.monsters.has(o.monster)) problems.push(`${where}: kill objective names unknown monster "${o.monster}"`);
      }
      if (o.type === 'interact' && known.interactables && !known.interactables.has(o.target)) {
        problems.push(`${where}: interact objective names unknown target "${o.target}"`);
      }
      if (o.type === 'collect' && !(o.count >= 1)) problems.push(`${where}: collect objective needs count >= 1`);
    }
  }
  // Prerequisite cycles would leave quests permanently locked.
  for (const id of Object.keys(defs)) {
    const seen = new Set<string>();
    const stack = [...(defs[id]!.requires)];
    while (stack.length) {
      const r = stack.pop()!;
      if (r === id) {
        problems.push(`quest ${id}: prerequisite cycle`);
        break;
      }
      if (seen.has(r) || !defs[r]) continue;
      seen.add(r);
      stack.push(...defs[r]!.requires);
    }
  }
  return problems;
}
