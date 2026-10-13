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
    dialogue: [
      { if: { quest: 'q3_resonance', state: 'ready' }, graph: 'elder_q3_turnin' },
      { if: { quest: 'q4_stranded_boat', state: 'active' }, graph: 'elder_q4_active' },
      { if: { quest: 'q4_stranded_boat', state: 'available' }, graph: 'elder_q4_offer' },
      { if: { quest: 'q4_stranded_boat', state: 'completed' }, graph: 'elder_after' },
      { if: { quest: 'q3_resonance', state: 'active' }, graph: 'elder_q3_active' },
      { if: { all: [{ flag: 'has_shard' }, { quest: 'q3_resonance', state: 'available' }] }, graph: 'elder_q3_offer' },
      { if: { flag: 'met_elder' }, graph: 'elder_repeat' },
      { graph: 'elder_intro' },
    ],
  },
  hunter_yanya: {
    id: 'hunter_yanya',
    name: '岩牙',
    title: '獵人',
    spriteKey: SpriteKey.NPC_HUNTER,
    scale: 1.1,
    dialogue: [
      { if: { quest: 'q1_first_hunt', state: 'ready' }, graph: 'hunter_turnin' },
      { if: { quest: 'q1_first_hunt', state: 'active' }, graph: 'hunter_active' },
      { if: { all: [{ flag: 'met_yanya' }, { quest: 'q1_first_hunt', state: 'available' }] }, graph: 'hunter_offer' },
      { if: { flag: 'met_yanya' }, graph: 'hunter_repeat' },
      { graph: 'hunter_intro' },
    ],
  },
  waterer_xi: {
    id: 'waterer_xi',
    name: '汐',
    title: '汲水人',
    spriteKey: SpriteKey.NPC_WATERER,
    scale: 0.8,
    dialogue: [
      { if: { quest: 'q2_muddy_water', state: 'ready' }, graph: 'xi_q2_turnin' },
      { if: { quest: 'q2_muddy_water', state: 'active' }, graph: 'xi_q2_active' },
      { if: { all: [{ flag: 'met_xi' }, { quest: 'q2_muddy_water', state: 'available' }] }, graph: 'xi_q2_offer' },
      { if: { quest: 'q2_muddy_water', state: 'completed' }, graph: 'xi_after' },
      { if: { flag: 'met_xi' }, graph: 'waterer_repeat' },
      { graph: 'waterer_intro' },
    ],
  },
  boatwright_laodu: {
    id: 'boatwright_laodu',
    name: '老舵',
    title: '船匠',
    spriteKey: SpriteKey.NPC_BOATWRIGHT,
    scale: 0.78,
    dialogue: [
      { if: { all: [{ map: 'pure_coast' }, { quest: 'q4_stranded_boat', state: 'active' }, { notFlag: 'laodu_ferry_checked' }] }, graph: 'laodu_coast_q4' },
      { if: { all: [{ map: 'pure_coast' }, { flag: 'laodu_ferry_checked' }] }, graph: 'laodu_coast_after' },
      { if: { flag: 'met_laodu' }, graph: 'boatwright_repeat' },
      { graph: 'boatwright_intro' },
    ],
  },
};

export function getNpc(id: string): NpcDef {
  const def = NPCS[id];
  if (!def) throw new Error(`Unknown NPC "${id}"`);
  return def;
}
