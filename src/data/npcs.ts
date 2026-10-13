import { SpriteKey } from '../game/assetManifest';
import type { DialogueRule } from '../systems/dialogue';

export interface NpcDef {
  id: string;
  name: string;
  /** Short role shown under the name. */
  title: string;
  spriteKey: string;
  /** Visual scale (the dwarf and the small waterer are shorter than the player). */
  scale: number;
  /** Conversations in priority order: the first rule whose condition holds is used. Always end with an unconditional one. */
  dialogue: readonly DialogueRule[];
}

export const NPCS: Record<string, NpcDef> = {
  elder_qiyi: {
    id: 'elder_qiyi',
    name: '祈漪',
    title: '村長',
    spriteKey: SpriteKey.NPC_ELDER,
    scale: 0.95,
    dialogue: [{ if: { flag: 'met_elder' }, graph: 'elder_repeat' }, { graph: 'elder_intro' }],
  },
  hunter_yanya: {
    id: 'hunter_yanya',
    name: '岩牙',
    title: '獵人',
    spriteKey: SpriteKey.NPC_HUNTER,
    scale: 1.1,
    dialogue: [{ if: { flag: 'met_yanya' }, graph: 'hunter_repeat' }, { graph: 'hunter_intro' }],
  },
  waterer_xi: {
    id: 'waterer_xi',
    name: '汐',
    title: '汲水人',
    spriteKey: SpriteKey.NPC_WATERER,
    scale: 0.8,
    dialogue: [{ if: { flag: 'met_xi' }, graph: 'waterer_repeat' }, { graph: 'waterer_intro' }],
  },
  boatwright_laodu: {
    id: 'boatwright_laodu',
    name: '老舵',
    title: '船匠',
    spriteKey: SpriteKey.NPC_BOATWRIGHT,
    scale: 0.78,
    dialogue: [{ if: { flag: 'met_laodu' }, graph: 'boatwright_repeat' }, { graph: 'boatwright_intro' }],
  },
};

export function getNpc(id: string): NpcDef {
  const def = NPCS[id];
  if (!def) throw new Error(`Unknown NPC "${id}"`);
  return def;
}
