import { needsIntro, visibleTopics, type NpcConversation } from '../src/systems/npcTopics';
import type { DialogueContext } from '../src/systems/dialogue';

/**
 * The conversation a player gets by talking to an NPC and taking the first thing on offer: the intro on the first meeting,
 * afterwards the first entry of the topic menu (entries are listed most important first).
 */
export function firstGraph(conversation: NpcConversation, ctx: Pick<DialogueContext, 'hasFlag' | 'level' | 'questState' | 'mapId'>): string | null {
  if (needsIntro(conversation, ctx)) return conversation.intro.graph;
  return visibleTopics(conversation, ctx).find((t) => t.graph)?.graph ?? null; // a shop entry plays no conversation
}
