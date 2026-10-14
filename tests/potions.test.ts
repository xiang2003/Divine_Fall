import { describe, expect, it } from 'vitest';
import { KEYBINDINGS, POTION_ACTIONS } from '../src/config/gameConfig';
import { POTIONS, RECHARGE_BOSS_MULT, RECHARGE_ELITE_MULT, RECHARGE_PER_KILL } from '../src/data/potions';
import { isTown } from '../src/data/worldMaps';
import { POTION_SLOTS, PotionBelt } from '../src/systems/potions';

describe('potion belt', () => {
  it('starts with a full health potion, a full mana potion and an empty third slot', () => {
    const belt = new PotionBelt();
    expect(POTION_SLOTS).toBe(3);
    expect(belt.peek(0)).toEqual({ def: POTIONS.health, charges: POTIONS.health.maxCharges, fraction: 0 });
    expect(belt.peek(1)).toEqual({ def: POTIONS.mana, charges: POTIONS.mana.maxCharges, fraction: 0 });
    expect(belt.peek(2)).toBeNull();
    expect(belt.isFull).toBe(true);
  });

  it('take spends one charge and keeps the potion, until no whole charge is left', () => {
    const belt = new PotionBelt();
    const max = POTIONS.health.maxCharges;
    for (let i = 1; i <= max; i++) {
      expect(belt.take(0)).toBe(POTIONS.health);
      expect(belt.peek(0)?.charges).toBe(max - i);
    }
    expect(belt.peek(0)).not.toBeNull(); // the bottle stays, empty
    expect(belt.take(0)).toBeNull();
    expect(belt.take(2)).toBeNull();
    expect(belt.isFull).toBe(false);
  });

  it('kills give back part of a charge: four normal kills are one charge', () => {
    const belt = new PotionBelt();
    while (belt.take(0)) {
      // drain it
    }
    for (let i = 0; i < 3; i++) belt.recharge(RECHARGE_PER_KILL);
    expect(belt.peek(0)).toMatchObject({ charges: 0 });
    expect(belt.peek(0)!.fraction).toBeCloseTo(0.75);
    expect(belt.take(0)).toBeNull(); // three quarters is not enough
    belt.recharge(RECHARGE_PER_KILL);
    expect(belt.peek(0)).toMatchObject({ charges: 1, fraction: 0 });
    expect(belt.take(0)).toBe(POTIONS.health);
  });

  it('recharge never goes over full, and an elite or boss kill gives far more', () => {
    const belt = new PotionBelt();
    belt.recharge(100);
    expect(belt.peek(0)?.charges).toBe(POTIONS.health.maxCharges);
    expect(belt.peek(0)?.fraction).toBe(0);
    belt.take(0);
    belt.take(0);
    expect(RECHARGE_PER_KILL * RECHARGE_ELITE_MULT).toBe(1);
    expect(RECHARGE_PER_KILL * RECHARGE_BOSS_MULT).toBeGreaterThanOrEqual(POTIONS.health.maxCharges);
  });

  it('refill (coming back to town, restarting) puts every charge back', () => {
    const belt = new PotionBelt();
    belt.take(0);
    belt.take(1);
    belt.take(1);
    belt.refill();
    expect(belt.peek(0)?.charges).toBe(POTIONS.health.maxCharges);
    expect(belt.peek(1)?.charges).toBe(POTIONS.mana.maxCharges);
    expect(belt.isFull).toBe(true);
  });

  it('is bound to the keys 1, 2 and 3', () => {
    expect(POTION_ACTIONS.map((a) => KEYBINDINGS[a])).toEqual([['Digit1'], ['Digit2'], ['Digit3']]);
  });

  it('health restores hp and mana restores mana', () => {
    expect(POTIONS.health.restores).toBe('hp');
    expect(POTIONS.mana.restores).toBe('mana');
  });
});

describe('town', () => {
  it('only the village counts as a town', () => {
    expect(isTown('pure_village')).toBe(true);
    for (const id of ['pure_forest', 'pure_ruins', 'pure_spring_cave', 'pure_coast', 'nowhere']) expect(isTown(id)).toBe(false);
  });
});
