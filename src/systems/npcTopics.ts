import { evalCondition, type Condition, type DialogueContext } from './dialogue';

/**
 * What an NPC offers when the player talks to it: a greeting line, then a list of topics to pick from.
 * Plain data plus two small functions, no rendering, so it can be tested without the game.
 *
 * - `quest`   a quest to accept, or a conversation the active quest is waiting for (marked "！")
 * - `turnin`  a quest ready to hand in (marked "？")
 * - `active`  talk about a quest already under way, nothing to do right now (marked "…")
 * - `story`   a conversation that moves the story or reacts to something that happened
 * - `talk`    small talk
 * - `shop`    opens the NPC's shop (buying and selling equipment) instead of playing a conversation
 * Topics are listed in the order given, so put the most important first.
 */
export type TopicKind = 'quest' | 'turnin' | 'active' | 'story' | 'talk' | 'shop';

export interface NpcTopic {
  /** Text of the menu entry. */
  label: string;
  kind: TopicKind;
  /** Id of the conversation (data/dialogues.ts) this entry plays; a shop entry has none. */
  graph?: string;
  /** Id of the shop (data/economy.ts) a `shop` entry opens. */
  shop?: string;
  /** The entry is only offered while this holds. */
  if?: Condition;
}

export interface NpcConversation {
  /** Played by itself the first time the player talks to this NPC; the graph sets `metFlag`. */
  intro: { graph: string; metFlag: string };
  /** Fixed lines said when the menu opens (catchphrases, things about themselves); one is picked per visit. */
  greetings: readonly string[];
  topics: readonly NpcTopic[];
}

/** The mark shown in front of a menu entry (empty for entries that need no attention). */
export const TOPIC_MARK: Record<TopicKind, string> = { quest: '！', turnin: '？', active: '…', story: '', talk: '', shop: '◆' };

type TopicContext = Pick<DialogueContext, 'hasFlag' | 'level' | 'questState' | 'mapId'> & Partial<Pick<DialogueContext, 'reputation'>>;

/** The topics on offer right now, in order. */
export function visibleTopics(conversation: NpcConversation, ctx: TopicContext): NpcTopic[] {
  return conversation.topics.filter((t) => evalCondition(t.if, ctx));
}

/** True until the player has met this NPC (the intro conversation sets the flag). */
export function needsIntro(conversation: NpcConversation, ctx: TopicContext): boolean {
  return !ctx.hasFlag(conversation.intro.metFlag);
}

/** The greeting for the n-th visit (0-based): they take turns, so repeat visits do not feel canned. */
export function greetingFor(conversation: NpcConversation, visit: number): string {
  const lines = conversation.greetings;
  if (lines.length === 0) return '';
  return lines[((visit % lines.length) + lines.length) % lines.length]!;
}
