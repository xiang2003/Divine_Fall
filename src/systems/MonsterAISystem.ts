import * as THREE from 'three';
import type { MapSpawns } from '../data/mapData';
import { Monster, type MonsterHooks, type MonsterTarget } from '../entities/Monster';
import { MonsterView } from '../entities/MonsterView';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import type { EffectAssets } from '../game/effects';
import type { CollisionSystem } from './CollisionSystem';
import type { Rng } from './rng';
import { planSpawns } from './spawnPlan';

/** Owns every live monster and its view: spawning, per-tick AI, crowd separation and corpse cleanup. */
export class MonsterAISystem {
  readonly group = new THREE.Group();
  private readonly monsters: Monster[] = [];
  private readonly views = new Map<Monster, MonsterView>();
  private spawnedTotal = 0;

  constructor(
    private readonly assets: AssetLoader,
    private readonly effects: EffectAssets,
    private readonly collision: CollisionSystem,
    private readonly hooks: MonsterHooks,
    private readonly camera: CameraController,
    /** Container for elite / boss name plates. */
    private readonly nameplateLayer: HTMLElement,
  ) {}

  get all(): readonly Monster[] {
    return this.monsters;
  }
  get aliveCount(): number {
    return this.monsters.reduce((n, m) => n + (m.isDead ? 0 : 1), 0);
  }
  /** How many monsters the current round started with. */
  get total(): number {
    return this.spawnedTotal;
  }
  /** The boss, if it exists and is alive. */
  get boss(): Monster | null {
    return this.monsters.find((m) => m.isBoss && !m.isDead) ?? null;
  }

  /**
   * Removes everything and spawns the whole map population: normal monsters, elites (with freshly rolled
   * affixes) and the boss. `rng` drives affix rolls and boss attack choices.
   */
  spawnAll(spawns: MapSpawns, rng: Rng): void {
    this.clear();
    const plan = planSpawns(spawns, rng);
    for (const entry of plan) this.spawn(new Monster(entry.def, entry.pos, { affixes: entry.affixes, rng }));
    this.spawnedTotal = plan.length;
  }

  clear(): void {
    for (const view of this.views.values()) {
      this.group.remove(view.group);
      view.dispose();
    }
    this.views.clear();
    this.monsters.length = 0;
    this.spawnedTotal = 0;
  }

  update(dt: number, target: MonsterTarget): void {
    for (const m of this.monsters) m.update(dt, target, this.collision, this.hooks);
    this.separate(target);

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i]!;
      if (!m.removable) continue;
      const view = this.views.get(m);
      if (view) {
        this.group.remove(view.group);
        view.dispose();
        this.views.delete(m);
      }
      this.monsters.splice(i, 1);
    }
  }

  /** Updates sprites; call once per frame after update(). */
  syncViews(dt: number): void {
    for (const view of this.views.values()) view.update(dt, this.camera);
  }

  dispose(): void {
    this.clear();
  }

  private spawn(monster: Monster): void {
    const view = new MonsterView(monster, this.assets, this.effects, this.nameplateLayer, this.camera);
    this.monsters.push(monster);
    this.views.set(monster, view);
    this.group.add(view.group);
  }

  /** Keeps living monsters from stacking on each other or standing inside the player. */
  private separate(target: MonsterTarget): void {
    const list = this.monsters;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      if (a.isDead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (b.isDead) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const min = a.def.radius + b.def.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const push = (min - d) / 2;
        const nx = d2 > 1e-8 ? dx / d : 1;
        const ny = d2 > 1e-8 ? dy / d : 0;
        a.pos.x -= nx * push;
        a.pos.y -= ny * push;
        b.pos.x += nx * push;
        b.pos.y += ny * push;
        this.collision.pushOut(a.pos, a.def.radius);
        this.collision.pushOut(b.pos, b.def.radius);
      }
      if (!target.isDead) {
        const dx = a.pos.x - target.pos.x;
        const dy = a.pos.y - target.pos.y;
        const min = a.def.radius + target.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min) {
          // Exactly on top of the player: pick any direction rather than not moving at all.
          const coincident = d2 < 1e-8;
          const d = coincident ? 1 : Math.sqrt(d2);
          const nx = coincident ? 1 : dx / d;
          const ny = coincident ? 0 : dy / d;
          const dist = coincident ? 0 : d;
          a.pos.x += nx * (min - dist);
          a.pos.y += ny * (min - dist);
          this.collision.pushOut(a.pos, a.def.radius);
        }
      }
    }
  }
}
