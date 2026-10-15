import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GOLD_CONFIG, GoldSystem, goldSpriteKey } from '../src/systems/GoldSystem';
import { SpriteKey } from '../src/game/assetManifest';
import type { AssetLoader } from '../src/game/AssetLoader';
import type { CollisionSystem } from '../src/systems/CollisionSystem';
import { mulberry32 } from '../src/systems/rng';

// the pictures do not matter here: plain three.js objects stand in for the loaded ones
const assets = {
  texture: () => new THREE.Texture(),
  sharedGeometry: () => new THREE.PlaneGeometry(1, 1),
  material: () => new THREE.MeshBasicMaterial(),
} as unknown as AssetLoader;
const open = { collidesCircle: () => false } as unknown as CollisionSystem;
const make = () => new GoldSystem(assets, open, mulberry32(1));

describe('heaps of 墜金 on the floor', () => {
  it('a bigger sum is drawn as a bigger heap', () => {
    expect(goldSpriteKey(3)).toBe(SpriteKey.GOLD_SMALL);
    expect(goldSpriteKey(25)).toBe(SpriteKey.GOLD_MID);
    expect(goldSpriteKey(130)).toBe(SpriteKey.GOLD_BIG);
  });

  it('nothing is dropped for nothing', () => {
    const gold = make();
    expect(gold.spawnNear(0, 5, 5)).toBeNull();
    expect(gold.all).toHaveLength(0);
  });

  it('a heap lies still until it has settled, then is pulled in and collected, once', () => {
    const gold = make();
    gold.spawnNear(12, 10, 10);
    const got: number[] = [];
    const player = { x: 11.5, y: 10 };
    gold.update(0.1, player, true, (n) => got.push(n)); // too soon
    expect(got).toEqual([]);
    for (let i = 0; i < 30; i++) gold.update(0.05, player, true, (n) => got.push(n));
    expect(got).toEqual([12]);
    expect(gold.all).toHaveLength(0);
  });

  it('a heap out of reach stays where it is, and a dead player collects nothing', () => {
    const gold = make();
    const far = gold.spawnNear(5, 30, 30)!;
    const near = gold.spawnNear(5, 10, 10)!;
    const got: number[] = [];
    for (let i = 0; i < 40; i++) gold.update(0.05, { x: 10.4, y: 10 }, false, (n) => got.push(n));
    expect(got).toEqual([]);
    expect(near.pos.x).toBeCloseTo(far.pos.x - 20, -1); // unmoved (the two spawn spots only differ by the scatter)
    expect(far.pos.x).toBeGreaterThan(GOLD_CONFIG.magnetRange + 10.4);
    expect(gold.all).toHaveLength(2);
  });

  it('too many heaps are merged, never dropped: the total stays the same', () => {
    const gold = make();
    let total = 0;
    for (let i = 0; i < GOLD_CONFIG.maxPiles + 15; i++) {
      gold.spawnNear(3 + (i % 4), 5 + i * 0.01, 5);
      total += 3 + (i % 4);
    }
    expect(gold.all.length).toBeLessThanOrEqual(GOLD_CONFIG.maxPiles);
    expect(gold.total).toBe(total);
  });
});
