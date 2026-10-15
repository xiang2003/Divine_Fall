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
  /** Only present while this world flag is set (the seal appears once the guardian is down, the shard once the deer is). */
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
    requiresFlag: 'pure_spring_cave_boss_defeated',
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
  forest_tablet: {
    id: 'forest_tablet',
    name: '古老的石碑',
    prompt: '查看',
    spriteKey: null,
    reportOnUse: false,
    dialogue: [{ graph: 'tablet_read' }],
  },
  forest_altar: {
    id: 'forest_altar',
    name: '被侵蝕的祭壇',
    prompt: '調查',
    spriteKey: null,
    reportOnUse: true,
    dialogue: [{ graph: 'altar_look' }],
  },
  pass_outpost: {
    id: 'pass_outpost',
    name: '廢棄的哨站',
    prompt: '查看',
    spriteKey: null,
    reportOnUse: false,
    dialogue: [{ graph: 'outpost_look' }],
  },
  pass_sword: {
    id: 'pass_sword',
    name: '斷裂的巨劍',
    prompt: '查看',
    spriteKey: null,
    reportOnUse: false,
    dialogue: [{ graph: 'sword_look' }],
  },
  pass_end: {
    id: 'pass_end',
    name: '山道盡頭',
    prompt: '眺望',
    spriteKey: null,
    requiresFlag: 'broken_sword_pass_boss_defeated',
    reportOnUse: false,
    dialogue: [{ graph: 'pass_end_look' }],
  },
  mist_trace: {
    id: 'mist_trace',
    name: '殘留的靈氣痕跡',
    prompt: '查看',
    spriteKey: null,
    reportOnUse: false,
    dialogue: [{ graph: 'mist_trace' }],
  },
  primordial_core: {
    id: 'primordial_core',
    name: '初胎核心',
    prompt: '靠近',
    spriteKey: null,
    requiresFlag: 'pure_core_boss_defeated',
    reportOnUse: false,
    dialogue: [{ graph: 'core_look' }],
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
