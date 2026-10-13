import type { QuestState } from './quests';

/**
 * Branching dialogue as plain data plus a tiny state machine. No rendering, no game objects:
 * the game gives the runner a `DialogueContext` (flags, level) and shows what `view` returns.
 *
 * Text is literal Traditional Chinese (the game has a single language for now); the node ids and the
 * `text` fields are the only places that would need a string table if localisation is ever added.
 */

/** A test over the world state. Kept structured (no expression language) so it can be validated and saved. */
export type Condition =
  | { flag: string }
  | { notFlag: string }
  | { minLevel: number }
  /** A quest is in one of these states. */
  | { quest: string; state: QuestState | readonly QuestState[] }
  | { all: readonly Condition[] };

export interface DialogueChoice {
  text: string;
  /** Node to go to. */
  to: string;
  /** The choice is only offered while this holds. */
  if?: Condition;
}

/** One screen of a conversation. Exactly one of `choices`, `next` or `end` says where it goes from here. */
export interface DialogueNode {
  /** Who is talking; defaults to the NPC the conversation is with. Use "你" for the player. */
  speaker?: string;
  text: string;
  /** World flags switched on / off when this node is shown. */
  set?: readonly string[];
  clear?: readonly string[];
  /** Accepts this quest when the node is shown (only if it is available). */
  startQuest?: string;
  /** Turns this quest in when the node is shown (only if it is ready); rewards are paid by the game. */
  completeQuest?: string;
  choices?: readonly DialogueChoice[];
  next?: string;
  end?: boolean;
}

export interface DialogueGraph {
  id: string;
  start: string;
  nodes: Readonly<Record<string, DialogueNode>>;
}

/** Which conversation an NPC has right now: the first rule whose condition holds wins. */
export interface DialogueRule {
  if?: Condition;
  graph: string;
}

/** What the dialogue reads and writes. The game implements it on top of its flags and character level. */
export interface DialogueContext {
  hasFlag(name: string): boolean;
  setFlag(name: string, on: boolean): void;
  readonly level: number;
  questState(id: string): QuestState;
  startQuest(id: string): void;
  completeQuest(id: string): void;
}

type ConditionContext = Pick<DialogueContext, 'hasFlag' | 'level' | 'questState'>;

export function evalCondition(cond: Condition | undefined, ctx: ConditionContext): boolean {
  if (!cond) return true;
  if ('flag' in cond) return ctx.hasFlag(cond.flag);
  if ('notFlag' in cond) return !ctx.hasFlag(cond.notFlag);
  if ('minLevel' in cond) return ctx.level >= cond.minLevel;
  if ('quest' in cond) {
    const states: readonly QuestState[] = Array.isArray(cond.state) ? cond.state : [cond.state as QuestState];
    return states.includes(ctx.questState(cond.quest));
  }
  return cond.all.every((c) => evalCondition(c, ctx));
}

/** The conversation id an NPC offers right now, or null if no rule matches. */
export function pickDialogue(rules: readonly DialogueRule[], ctx: ConditionContext): string | null {
  for (const rule of rules) if (evalCondition(rule.if, ctx)) return rule.graph;
  return null;
}

/** What the UI shows for the current node. */
export interface DialogueView {
  speaker: string;
  text: string;
  /** Texts of the choices on offer, or null when the line just continues. */
  choices: readonly string[] | null;
  /** True when pressing "continue" will close the conversation. */
  last: boolean;
}

/** Walks one conversation. Create it, show `view`, then call `advance()` or `choose(i)` until `finished`. */
export class DialogueRunner {
  private nodeId: string | null;
  private offered: readonly DialogueChoice[] | null = null;

  constructor(
    private readonly graph: DialogueGraph,
    private readonly ctx: DialogueContext,
    private readonly defaultSpeaker: string,
  ) {
    this.nodeId = null;
    this.enter(graph.start);
  }

  get finished(): boolean {
    return this.nodeId === null;
  }

  get view(): DialogueView | null {
    const node = this.node;
    if (!node) return null;
    return {
      speaker: node.speaker ?? this.defaultSpeaker,
      text: node.text,
      choices: this.offered ? this.offered.map((c) => c.text) : null,
      last: !this.offered && node.end === true,
    };
  }

  /** Continues a line that has no choices (a node with choices waits for `choose`). */
  advance(): void {
    const node = this.node;
    if (!node || this.offered) return;
    if (node.next !== undefined) this.enter(node.next);
    else this.nodeId = null;
  }

  /** Picks one of the choices currently on offer (by its index in `view.choices`). Out-of-range does nothing. */
  choose(index: number): void {
    if (!this.offered) return;
    const choice = this.offered[index];
    if (choice) this.enter(choice.to);
  }

  /** Ends the conversation immediately (the player walked away or pressed Esc). */
  close(): void {
    this.nodeId = null;
  }

  private get node(): DialogueNode | null {
    return this.nodeId === null ? null : (this.graph.nodes[this.nodeId] ?? null);
  }

  private enter(id: string): void {
    const node = this.graph.nodes[id];
    if (!node) {
      this.nodeId = null; // a broken link ends the conversation instead of hanging (validateDialogue catches these in tests)
      this.offered = null;
      return;
    }
    this.nodeId = id;
    for (const f of node.set ?? []) this.ctx.setFlag(f, true);
    for (const f of node.clear ?? []) this.ctx.setFlag(f, false);
    if (node.startQuest) this.ctx.startQuest(node.startQuest);
    if (node.completeQuest) this.ctx.completeQuest(node.completeQuest);
    const visible = (node.choices ?? []).filter((c) => evalCondition(c.if, this.ctx));
    // A node whose choices are all gated off falls back to its `next` / `end` so the player is never stuck.
    this.offered = visible.length > 0 ? visible : null;
  }
}

/** Structural problems in a graph (an empty list means it is sound). Used by tests over all authored dialogue. */
export function validateDialogue(graph: DialogueGraph): string[] {
  const problems: string[] = [];
  const nodes = graph.nodes;
  if (!nodes[graph.start]) problems.push(`${graph.id}: start node "${graph.start}" does not exist`);

  for (const [id, node] of Object.entries(nodes)) {
    const where = `${graph.id}/${id}`;
    if (node.text.trim() === '') problems.push(`${where}: empty text`);
    const exits = [node.choices ? 'choices' : null, node.next !== undefined ? 'next' : null, node.end ? 'end' : null].filter(Boolean);
    if (exits.length !== 1) problems.push(`${where}: needs exactly one of choices / next / end (has ${exits.length})`);
    if (node.next !== undefined && !nodes[node.next]) problems.push(`${where}: next "${node.next}" does not exist`);
    if (node.choices) {
      if (node.choices.length === 0) problems.push(`${where}: empty choices`);
      for (const c of node.choices) {
        if (!nodes[c.to]) problems.push(`${where}: choice "${c.text}" goes to missing node "${c.to}"`);
        if (c.text.trim() === '') problems.push(`${where}: a choice has empty text`);
      }
    }
  }

  // Reachability from the start, and that every reachable path can finish.
  const reachable = new Set<string>();
  const stack = nodes[graph.start] ? [graph.start] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = nodes[id]!;
    const targets = [...(node.choices?.map((c) => c.to) ?? []), ...(node.next !== undefined ? [node.next] : [])];
    for (const t of targets) if (nodes[t]) stack.push(t);
  }
  for (const id of Object.keys(nodes)) if (!reachable.has(id)) problems.push(`${graph.id}/${id}: unreachable`);

  const canEnd = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reachable) {
      if (canEnd.has(id)) continue;
      const node = nodes[id]!;
      const ends = node.end === true || (node.next !== undefined && canEnd.has(node.next)) || (node.choices?.some((c) => canEnd.has(c.to)) ?? false);
      if (ends) {
        canEnd.add(id);
        changed = true;
      }
    }
  }
  for (const id of reachable) if (!canEnd.has(id)) problems.push(`${graph.id}/${id}: no path from here ever ends`);
  return problems;
}
