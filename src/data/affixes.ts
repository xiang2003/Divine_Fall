import type { EquipSlot, StatKey } from './items';

export interface AffixDef {
  id: string;
  /** Short adjective used to name magic items: "鋒利的鋼鐵長劍". */
  name: string;
  stat: StatKey;
  /** Which equipment slots this affix may roll on (the "spawn condition"). */
  slots: readonly EquipSlot[];
  min: number;
  max: number;
  /** Relative chance of being picked among the affixes valid for the slot. */
  weight: number;
  /** Tooltip text; `{value}` is replaced by the rolled number. */
  text: string;
}

export const AFFIXES: readonly AffixDef[] = [
  { id: 'flatDamage', name: '鋒利的', stat: 'damage', slots: ['weapon', 'ring', 'helmet', 'chest'], min: 3, max: 8, weight: 14, text: '攻擊力 +{value}' },
  { id: 'maxLife', name: '堅韌的', stat: 'maxHp', slots: ['helmet', 'chest', 'boots', 'ring'], min: 8, max: 25, weight: 10, text: '最大生命 +{value}' },
  { id: 'armor', name: '厚重的', stat: 'armor', slots: ['helmet', 'chest', 'boots'], min: 5, max: 18, weight: 10, text: '護甲 +{value}' },
  { id: 'attackSpeed', name: '迅捷的', stat: 'attackSpeedPct', slots: ['weapon', 'ring', 'boots'], min: 4, max: 12, weight: 7, text: '攻擊速度 +{value}%' },
  { id: 'critChance', name: '精準的', stat: 'critChancePct', slots: ['weapon', 'ring', 'helmet', 'chest'], min: 2, max: 6, weight: 6, text: '暴擊機率 +{value}%' },
  { id: 'critDamage', name: '兇狠的', stat: 'critDamagePct', slots: ['weapon', 'ring'], min: 10, max: 30, weight: 5, text: '暴擊傷害 +{value}%' },
  { id: 'moveSpeed', name: '輕盈的', stat: 'moveSpeedPct', slots: ['boots', 'ring'], min: 6, max: 15, weight: 6, text: '移動速度 +{value}%' },
  // Increased damage of a type, only for the types the character can deal so far (physical attacks, the divine bolt, lightning). Fire, cold and
  // corruption damage get their affixes when something in the game gives the player a way to deal them.
  { id: 'physicalDamage', name: '蠻橫的', stat: 'physicalDamagePct', slots: ['weapon', 'ring', 'chest'], min: 6, max: 16, weight: 6, text: '增加物理傷害 {value}%' },
  { id: 'lightningDamage', name: '雷鳴的', stat: 'lightningDamagePct', slots: ['weapon', 'ring'], min: 6, max: 16, weight: 4, text: '增加雷電傷害 {value}%' },
  { id: 'divineDamage', name: '聖輝的', stat: 'divineDamagePct', slots: ['weapon', 'ring'], min: 6, max: 16, weight: 5, text: '增加神聖傷害 {value}%' },
  // Burning is fire damage over time and corrosion is corruption damage over time, so increased damage of those types has something to work on now.
  { id: 'fireDamage', name: '炎熾的', stat: 'fireDamagePct', slots: ['weapon', 'ring'], min: 6, max: 16, weight: 4, text: '增加火焰傷害 {value}%' },
  { id: 'corruptionDamage', name: '蝕骨的', stat: 'corruptionDamagePct', slots: ['weapon', 'ring'], min: 6, max: 16, weight: 4, text: '增加腐化傷害 {value}%' },
  // Status effects (docs/design/status-effects.md): the chance that an attack puts one on its target
  { id: 'bleedChance', name: '嗜血的', stat: 'bleedChancePct', slots: ['weapon', 'ring'], min: 8, max: 18, weight: 4, text: '攻擊有 {value}% 機率使敵人流血' },
  { id: 'burnChance', name: '灼燒的', stat: 'burnChancePct', slots: ['weapon', 'ring'], min: 8, max: 18, weight: 4, text: '攻擊有 {value}% 機率點燃敵人' },
  { id: 'corruptionChance', name: '蝕心的', stat: 'corruptionChancePct', slots: ['weapon', 'ring'], min: 6, max: 14, weight: 3, text: '攻擊有 {value}% 機率使敵人受腐化侵蝕' },
  { id: 'shockChance', name: '雷擊的', stat: 'shockChancePct', slots: ['weapon', 'ring'], min: 8, max: 18, weight: 4, text: '攻擊有 {value}% 機率使敵人感電' },
  { id: 'armorBreakChance', name: '碎甲的', stat: 'armorBreakChancePct', slots: ['weapon'], min: 8, max: 16, weight: 3, text: '攻擊有 {value}% 機率破壞敵人的護甲' },
  { id: 'weakenChance', name: '衰弱的', stat: 'weakenChancePct', slots: ['ring', 'helmet'], min: 8, max: 16, weight: 3, text: '攻擊有 {value}% 機率使敵人虛弱' },
  { id: 'slowChance', name: '凝滯的', stat: 'slowChancePct', slots: ['weapon', 'boots', 'ring'], min: 10, max: 22, weight: 4, text: '攻擊有 {value}% 機率使敵人緩速' },
  { id: 'freezeBuildup', name: '寒霜的', stat: 'freezeBuildup', slots: ['weapon', 'ring'], min: 4, max: 10, weight: 3, text: '每次攻擊累積 {value} 點凍結值' },
  { id: 'dotDamage', name: '綿長的', stat: 'dotDamagePct', slots: ['weapon', 'ring', 'helmet', 'chest'], min: 8, max: 20, weight: 4, text: '持續傷害增加 {value}%' },
  { id: 'statusDuration', name: '持久的', stat: 'statusDurationPct', slots: ['ring', 'helmet'], min: 10, max: 25, weight: 3, text: '異常狀態持續時間 +{value}%' },
  // Resistances against the kinds of damage that monsters deal (there is nothing that burns yet, so no fire resistance affix).
  { id: 'coldRes', name: '禦寒的', stat: 'coldResPct', slots: ['helmet', 'chest', 'boots', 'ring'], min: 5, max: 14, weight: 6, text: '冰霜抗性 +{value}%' },
  { id: 'lightningRes', name: '絕緣的', stat: 'lightningResPct', slots: ['helmet', 'chest', 'boots', 'ring'], min: 5, max: 14, weight: 6, text: '雷電抗性 +{value}%' },
  { id: 'corruptionRes', name: '淨穢的', stat: 'corruptionResPct', slots: ['helmet', 'chest', 'boots', 'ring'], min: 5, max: 14, weight: 6, text: '腐化抗性 +{value}%' },
  { id: 'divineRes', name: '護佑的', stat: 'divineResPct', slots: ['helmet', 'chest', 'boots', 'ring'], min: 5, max: 14, weight: 5, text: '神聖抗性 +{value}%' },
];

const BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));

export function getAffix(id: string): AffixDef {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`Unknown affix "${id}"`);
  return a;
}

export function affixesForSlot(slot: EquipSlot): AffixDef[] {
  return AFFIXES.filter((a) => a.slots.includes(slot));
}
