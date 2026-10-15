import { describe, expect, it } from 'vitest';
import { SHOPS } from '../src/data/economy';
import { DIALOGUES } from '../src/data/dialogues';
import { INTERACTABLES } from '../src/data/interactables';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { FACTION_IDS, FACTIONS, REPUTATION_MAX, REPUTATION_MIN, reputationRank, type FactionId } from '../src/data/reputation';
import { DialogueRunner, evalCondition, pickDialogue, type DialogueContext } from '../src/systems/dialogue';
import { buyEquipment } from '../src/systems/economy';
import { visibleTopics } from '../src/systems/npcTopics';
import { QuestLog } from '../src/systems/quests';
import { Reputation } from '../src/systems/reputation';
import { mulberry32 } from '../src/systems/rng';

describe('reputation', () => {
  it('starts at nothing for every group, and adds up inside its limits', () => {
    const r = new Reputation();
    for (const id of FACTION_IDS) expect(r.get(id)).toBe(0);
    expect(r.add('patrol', 2)).toBe(2);
    expect(r.add('patrol', 9)).toBe(REPUTATION_MAX - 2); // only as far as the top
    expect(r.get('patrol')).toBe(REPUTATION_MAX);
    expect(r.add('guild', -9)).toBe(REPUTATION_MIN);
    expect(r.get('guild')).toBe(REPUTATION_MIN);
    expect(r.add('locals', 0.4)).toBe(0); // whole points only
  });

  it('has a word for every value, and a page line for every group', () => {
    const words = new Set<string>();
    for (let v = REPUTATION_MIN; v <= REPUTATION_MAX; v++) words.add(reputationRank(v));
    expect(words.size).toBe(REPUTATION_MAX - REPUTATION_MIN + 1);
    expect(reputationRank(99)).toBe(reputationRank(REPUTATION_MAX));
    const r = new Reputation();
    r.add('merchants', 1);
    const views = r.views();
    expect(views.map((v) => v.id)).toEqual([...FACTION_IDS]);
    expect(views.find((v) => v.id === 'merchants')).toMatchObject({ value: 1, rank: '友善', name: FACTIONS.merchants.name });
  });

  it('the merchants set the price: 3% for every point, at most 12% either way', () => {
    const r = new Reputation();
    expect(r.priceMultiplier).toBe(1);
    r.add('merchants', 2);
    expect(r.priceMultiplier).toBeCloseTo(0.94, 9);
    r.add('merchants', 2);
    expect(r.priceMultiplier).toBeCloseTo(0.88, 9);
    const bad = new Reputation();
    bad.add('merchants', -2);
    expect(bad.priceMultiplier).toBeCloseTo(1.06, 9);
    // the other groups do not touch prices
    const other = new Reputation();
    other.add('guild', 4);
    expect(other.priceMultiplier).toBe(1);
  });

  it('survives being saved and loaded, and throws away nonsense', () => {
    const r = new Reputation();
    r.add('locals', 3);
    r.add('patrol', -1);
    const copy = new Reputation();
    copy.setState(r.getState());
    expect(copy.getState()).toEqual(r.getState());
    copy.setState({ patrol: Number.NaN, guild: 99 });
    expect(copy.get('patrol')).toBe(0);
    expect(copy.get('guild')).toBe(REPUTATION_MAX);
    expect(copy.get('locals')).toBe(0);
  });

  it('is what the shop of the blacksmith charges: the better the standing, the lower the price', () => {
    const shop = SHOPS.blacksmith!;
    const weapon = shop.categories.find((c) => c.slot === 'weapon')!.price;
    expect(buyEquipment(shop, 'weapon', weapon - 1, 5, mulberry32(1))).toEqual({ ok: false, reason: 'gold' });
    expect(buyEquipment(shop, 'weapon', weapon - 1, 5, mulberry32(1), 0.88).ok).toBe(true);
    const bought = buyEquipment(shop, 'weapon', 1000, 5, mulberry32(1), 0.88);
    expect(bought.ok && bought.price).toBe(Math.round(weapon * 0.88));
    const dear = buyEquipment(shop, 'weapon', 1000, 5, mulberry32(1), 1.12);
    expect(dear.ok && dear.price).toBe(Math.round(weapon * 1.12));
  });
});

/** A world for the dialogue to run in: flags, reputation, and a real quest log. */
function world() {
  const flags = new Set<string>();
  const rep = new Reputation();
  const quests = new QuestLog(QUESTS);
  const ctx: DialogueContext = {
    hasFlag: (n) => flags.has(n),
    setFlag: (n, on) => (on ? flags.add(n) : flags.delete(n)),
    level: 24,
    mapId: 'broken_sword_pass',
    questState: (id) => quests.state(id),
    startQuest: (id) => void quests.start(id),
    completeQuest: (id) => void quests.complete(id),
    reportInteract: (target) => void quests.report({ type: 'interact', target }),
    endChapter: () => {},
    reputation: (f) => rep.get(f),
    addReputation: (f, n) => void rep.add(f, n),
  };
  return { flags, rep, quests, ctx };
}

/** Plays a conversation to its end, always taking the choice at `pick` where there are any. */
function play(ctx: DialogueContext, id: string, pick = 0): void {
  const runner = new DialogueRunner(DIALOGUES[id]!, ctx, 'x');
  for (let i = 0; i < 40 && !runner.finished; i++) {
    if (runner.view?.choices) runner.choose(pick);
    else runner.advance();
  }
  expect(runner.finished, id).toBe(true);
}

describe('dialogue can read and change reputation', () => {
  it('a condition on standing holds at least / at most, and counts as 0 where there is no reputation', () => {
    const { ctx, rep } = world();
    const atLeast1 = { rep: 'guild' as FactionId, atLeast: 1 };
    const atMostMinus1 = { rep: 'guild' as FactionId, atMost: -1 };
    expect(evalCondition(atLeast1, ctx)).toBe(false);
    expect(evalCondition({ rep: 'guild', atMost: 0 }, ctx)).toBe(true);
    rep.add('guild', 1);
    expect(evalCondition(atLeast1, ctx)).toBe(true);
    rep.add('guild', -2);
    expect(evalCondition(atMostMinus1, ctx)).toBe(true);
    const bare = { hasFlag: () => false, level: 1, questState: () => 'locked' as const, mapId: 'x' };
    expect(evalCondition({ rep: 'patrol', atLeast: 1 }, bare)).toBe(false);
    expect(evalCondition({ rep: 'patrol', atMost: 0 }, bare)).toBe(true);
  });
});

describe('the record at the end of the pass', () => {
  it('the wall shows the map once, hands over the record and starts the quest; later it only reminds', () => {
    const w = world();
    const rule = () => pickDialogue(INTERACTABLES.pass_end!.dialogue, w.ctx);
    expect(INTERACTABLES.pass_end!.requiresFlag).toBe('broken_sword_pass_boss_defeated');
    expect(rule()).toBe('pass_end_look');
    play(w.ctx, 'pass_end_look');
    expect(w.flags.has('part2_started')).toBe(true);
    expect(w.flags.has('has_ruin_record')).toBe(true);
    expect(w.quests.state('q9_ruin_record')).toBe('active');
    expect(rule()).toBe('pass_end_again');
    play(w.ctx, 'pass_end_again');
    expect(w.quests.state('q9_ruin_record')).toBe('active'); // nothing is given twice
  });

  it('the quest is nobody\'s offer, is taken in by the wanderer, and pays a rare item and a flag', () => {
    const q = QUESTS.q9_ruin_record!;
    expect(q.giver).toBeNull();
    expect(q.turnIn).toBe('wanderer_guchangfeng');
    expect(NPCS[q.turnIn!]).toBeDefined();
    expect(q.rewards.items).toEqual([{ rarity: 'rare', count: 1 }]);
    expect(q.rewards.flags).toContain('part2_open');
    // no marker over anybody's head before the player has found the record
    expect(new QuestLog(QUESTS).availableFrom('wanderer_guchangfeng').map((d) => d.id)).not.toContain('q9_ruin_record');
  });

  it('talking to the wanderer makes it ready, and his menu then offers the record', () => {
    const w = world();
    play(w.ctx, 'pass_end_look');
    const gu = NPCS.wanderer_guchangfeng!;
    const labels = () => visibleTopics(gu.conversation, w.ctx).map((t) => t.label);
    expect(labels()).not.toContain('殘缺的記錄');
    w.quests.report({ type: 'talk', npc: 'wanderer_guchangfeng' });
    expect(w.quests.state('q9_ruin_record')).toBe('ready');
    expect(labels()).toContain('殘缺的記錄');
  });
});

describe('the choice of who gets the record', () => {
  const choose = (pick: number) => {
    const w = world();
    play(w.ctx, 'pass_end_look');
    w.quests.report({ type: 'talk', npc: 'wanderer_guchangfeng' });
    play(w.ctx, 'gu_q9_turnin', pick);
    return w;
  };
  const standing = (w: ReturnType<typeof world>) => Object.fromEntries(FACTION_IDS.map((f) => [f, w.rep.get(f)]));

  it('every choice completes the quest, and none of them closes the way on', () => {
    for (let pick = 0; pick < 4; pick++) {
      const w = choose(pick);
      expect(w.quests.state('q9_ruin_record'), `choice ${pick}`).toBe('completed');
      expect(w.flags.has('part2_started')).toBe(true);
    }
  });

  it('keeping it with the wanderer changes nothing but a flag', () => {
    const w = choose(0);
    expect(w.flags.has('record_gu')).toBe(true);
    expect(standing(w)).toEqual({ patrol: 0, guild: 0, merchants: 0, locals: 0 });
  });

  it('giving it to the patrol: they trust you, the guild less so, the locals like it', () => {
    const w = choose(1);
    expect(w.flags.has('record_patrol')).toBe(true);
    expect(standing(w)).toEqual({ patrol: 2, guild: -1, merchants: 0, locals: 1 });
  });

  it('trading with the guild: they trust you, the patrol less so, the merchants like it, and the first page of a recipe is yours', () => {
    const w = choose(2);
    expect(w.flags.has('record_guild')).toBe(true);
    expect(w.flags.has('recipe_guild_1')).toBe(true);
    expect(standing(w)).toEqual({ patrol: -1, guild: 2, merchants: 1, locals: 0 });
  });

  it('keeping it secret costs a little with the merchants and nothing else', () => {
    const w = choose(3);
    expect(w.flags.has('record_hidden')).toBe(true);
    expect(standing(w)).toEqual({ patrol: 0, guild: 0, merchants: -1, locals: 0 });
  });

  it('the people of the town react to what was chosen, and only to that', () => {
    const labels = (npc: keyof typeof NPCS, w: ReturnType<typeof world>) => visibleTopics(NPCS[npc]!.conversation, w.ctx).map((t) => t.label);
    const patrol = choose(1);
    expect(labels('patrol_linruotang', patrol)).toContain('登記的記錄');
    expect(labels('blacksmith_tieshan', patrol)).not.toContain('配方的頭一頁');
    const guild = choose(2);
    expect(labels('blacksmith_tieshan', guild)).toContain('配方的頭一頁');
    expect(labels('patrol_linruotang', guild)).not.toContain('登記的記錄');
    const hidden = choose(3);
    expect(labels('innkeeper_zhoubo', hidden)).toContain('關於你的名聲');
    // before the choice each of the three has something to say about the record
    const pending = world();
    play(pending.ctx, 'pass_end_look');
    expect(labels('patrol_linruotang', pending)).toContain('關於遺跡的記錄');
    expect(labels('blacksmith_tieshan', pending)).toContain('聯盟的託付');
    expect(labels('innkeeper_zhoubo', pending)).toContain('山道盡頭的傳聞');
    // and the wanderer points at the three marks once it is settled
    expect(labels('wanderer_guchangfeng', guild)).toContain('地圖上的三個記號');
  });

  it('every faction has someone who speaks for it', () => {
    for (const id of FACTION_IDS) expect(FACTIONS[id].npc.length).toBeGreaterThan(0);
  });
});
