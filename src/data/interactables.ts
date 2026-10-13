import { SpriteKey } from '../game/assetManifest';
import type { DialogueRule } from '../systems/dialogue';

/**
 * Things the player can examine: the glowing shard in the cave, the seal on the ruin's pedestal, the stranded ferry.
 * They use the same conversation machinery as NPCs; quests hear about them as "interact" events.
 */
export interface InteractableDef {
  id: string;
  /** Name shown on the tag and as the speaker of its text. */
  name: string;
  /** Small word on the tag, e.g. "調查". */
  prompt: string;
  /** Sprite drawn on the map, or null for a spot that only has a tag (the ferry is already a building). */
  spriteKey: string | null;
  /** Only present while this world flag is set (the seal appears once the guardian is down). */
  requiresFlag?: string;
  /** Disappears once this flag is set (picked up). */
  hideFlag?: string;
  /** Tell the quest log as soon as the player examines it. False when only a confirmed choice in the text should count. */
  reportOnUse: boolean;
  dialogue: readonly DialogueRule[];
}

export const INTERACTABLES: Record<string, InteractableDef> = {
  spring_shard: {
    id: 'spring_shard',
    name: '發光的碎片',
    prompt: '調查',
    spriteKey: SpriteKey.SHARD,
    hideFlag: 'has_shard',
    reportOnUse: true,
    dialogue: [{ graph: 'shard_find' }],
  },
  ruins_relic: {
    id: 'ruins_relic',
    name: '初胎之印',
    prompt: '取得',
    spriteKey: SpriteKey.RELIC,
    requiresFlag: 'pure_ruins_boss_defeated',
    hideFlag: 'has_relic',
    reportOnUse: true,
    dialogue: [{ graph: 'relic_take' }],
  },
  ferry_board: {
    id: 'ferry_board',
    name: '擱淺的渡船',
    prompt: '登船',
    spriteKey: null,
    reportOnUse: false,
    dialogue: [
      { if: { all: [{ quest: 'q4_stranded_boat', state: 'active' }, { flag: 'laodu_ferry_checked' }] }, graph: 'ferry_board' },
      { if: { quest: 'q4_stranded_boat', state: 'active' }, graph: 'ferry_need_laodu' },
      { graph: 'ferry_look' },
    ],
  },
};

export function getInteractable(id: string): InteractableDef {
  const def = INTERACTABLES[id];
  if (!def) throw new Error(`Unknown interactable "${id}"`);
  return def;
}
