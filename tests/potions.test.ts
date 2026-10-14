import { describe, expect, it } from 'vitest';
import { KEYBINDINGS, POTION_ACTIONS } from '../src/config/gameConfig';
import { POTIONS } from '../src/data/potions';
import { POTION_SLOTS, PotionBelt } from '../src/systems/potions';

describe('potion belt', () => {
  it('starts with one health potion, one mana potion and an empty third slot', () => {
    const belt = new PotionBelt();
    expect(POTION_SLOTS).toBe(3);
    expect(belt.peek(0)).toEqual({ def: POTIONS.health, count: 1 });
    expect(belt.peek(1)).toEqual({ def: POTIONS.mana, count: 1 });
    expect(belt.peek(2)).toBeNull();
  });

  it('take uses one up and empties the slot at zero', () => {
    const belt = new PotionBelt();
    expect(belt.take(0)).toBe(POTIONS.health);
    expect(belt.peek(0)).toBeNull();
    expect(belt.take(0)).toBeNull();
    expect(belt.take(2)).toBeNull();
  });

  it('restock puts the starting potions back', () => {
    const belt = new PotionBelt();
    belt.take(0);
    belt.take(1);
    belt.restock();
    expect(belt.peek(0)?.count).toBe(1);
    expect(belt.peek(1)?.count).toBe(1);
  });

  it('is bound to the keys 1, 2 and 3', () => {
    expect(POTION_ACTIONS.map((a) => KEYBINDINGS[a])).toEqual([['Digit1'], ['Digit2'], ['Digit3']]);
  });

  it('health restores hp and mana restores mana', () => {
    expect(POTIONS.health.restores).toBe('hp');
    expect(POTIONS.mana.restores).toBe('mana');
  });
});
