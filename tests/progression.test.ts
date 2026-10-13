import { describe, expect, it } from 'vitest';
import { PLAYER_CONFIG } from '../src/config/gameConfig';
import { ELITE_XP_MULT, LEVEL_BONUS, MAX_LEVEL, xpToNextLevel } from '../src/data/progression';
import { MONSTERS } from '../src/data/monsters';
import { Monster } from '../src/entities/Monster';
import { Progression, levelBonus } from '../src/systems/progression';
import { computeStats, emptyEquipment } from '../src/systems/stats';

describe('experience curve', () => {
  it('grows with every level and is 0 at the cap', () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) expect(xpToNextLevel(l + 1)).toBeGreaterThan(xpToNextLevel(l));
    expect(xpToNextLevel(1)).toBeGreaterThan(0);
    expect(xpToNextLevel(MAX_LEVEL)).toBe(0);
  });
});

describe('Progression', () => {
  it('starts at level 1 with no experience', () => {
    const p = new Progression();
    expect(p.getState()).toEqual({ level: 1, xp: 0 });
  });

  it('accumulates experience below the threshold without levelling', () => {
    const p = new Progression();
    expect(p.addXp(xpToNextLevel(1) - 1)).toBe(0);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(xpToNextLevel(1) - 1);
  });

  it('levels up exactly at the threshold and keeps the remainder', () => {
    const p = new Progression();
    expect(p.addXp(xpToNextLevel(1) + 5)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(5);
  });

  it('can gain several levels from one large reward', () => {
    const p = new Progression();
    const need = xpToNextLevel(1) + xpToNextLevel(2) + xpToNextLevel(3);
    expect(p.addXp(need + 1)).toBe(3);
    expect(p.level).toBe(4);
    expect(p.xp).toBe(1);
  });

  it('stops at the level cap and discards extra experience', () => {
    const p = new Progression();
    p.addXp(1e9);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.xp).toBe(0);
    expect(p.xpToNext).toBe(0);
    expect(p.addXp(500)).toBe(0);
    expect(p.level).toBe(MAX_LEVEL);
  });

  it('ignores zero, negative and NaN rewards', () => {
    const p = new Progression();
    expect(p.addXp(0)).toBe(0);
    expect(p.addXp(-10)).toBe(0);
    expect(p.addXp(Number.NaN)).toBe(0);
    expect(p.getState()).toEqual({ level: 1, xp: 0 });
  });

  it('setState clamps out-of-range saved values', () => {
    const p = new Progression();
    p.setState({ level: 999, xp: 50 });
    expect(p.getState()).toEqual({ level: MAX_LEVEL, xp: 0 });
    p.setState({ level: -3, xp: 1e9 });
    expect(p.level).toBe(1);
    expect(p.xp).toBe(xpToNextLevel(1) - 1);
    p.setState({ level: Number.NaN, xp: Number.NaN });
    expect(p.getState()).toEqual({ level: 1, xp: 0 });
  });
});

describe('level stat bonuses', () => {
  it('level 1 gives no bonus', () => {
    expect(levelBonus(1)).toEqual({ maxHp: 0, damage: 0, armor: 0 });
    expect(computeStats(emptyEquipment(), 1)).toEqual(computeStats(emptyEquipment()));
  });

  it('each level above 1 adds the configured amount to computeStats', () => {
    const base = computeStats(emptyEquipment(), 1);
    const lv5 = computeStats(emptyEquipment(), 5);
    expect(lv5.maxHp).toBe(base.maxHp + 4 * LEVEL_BONUS.maxHp);
    expect(lv5.damage).toBe(base.damage + 4 * LEVEL_BONUS.damage);
    expect(lv5.armor).toBe(base.armor + 4 * LEVEL_BONUS.armor);
    expect(lv5.attackSpeed).toBe(base.attackSpeed);
    expect(base.maxHp).toBe(PLAYER_CONFIG.baseStats.maxHp);
  });

  it('never exceeds the bonus of the maximum level', () => {
    expect(levelBonus(MAX_LEVEL + 10)).toEqual(levelBonus(MAX_LEVEL));
  });
});

describe('monster experience rewards', () => {
  it('a normal monster gives its definition value and an elite gives more', () => {
    const normal = new Monster(MONSTERS.ghoul, { x: 5, y: 5 });
    expect(normal.xpReward).toBe(MONSTERS.ghoul.xp);
    const elite = new Monster(MONSTERS.ghoul, { x: 5, y: 5 }, { affixes: ['empowered'] });
    expect(elite.xpReward).toBe(Math.round(MONSTERS.ghoul.xp * ELITE_XP_MULT));
  });

  it('clearing the whole dungeon is worth several levels but not the cap', () => {
    // 9 normal + 2 elite + 1 boss, using the cheapest/most expensive normal as bounds.
    const min = 9 * MONSTERS.hound.xp + 2 * MONSTERS.ghoul.xp * ELITE_XP_MULT + MONSTERS.archon.xp;
    const p = new Progression();
    p.addXp(min);
    expect(p.level).toBeGreaterThan(2);
    expect(p.level).toBeLessThan(MAX_LEVEL);
  });
});
