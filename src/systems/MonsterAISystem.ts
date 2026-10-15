import * as THREE from 'three';
import type { MapSpawns, Population } from '../data/mapData';
import { MONSTERS, type MonsterDef } from '../data/monsters';
import { Monster, type MonsterHooks, type MonsterTarget } from '../entities/Monster';
import { MonsterView } from '../entities/MonsterView';
import type { AssetLoader } from '../game/AssetLoader';
import type { CameraController } from '../game/CameraController';
import type { EffectAssets } from '../game/effects';
import type { CollisionSystem } from './CollisionSystem';
import type { Rng } from './rng';
import { helpersAllowed } from './summons';
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
    return this.monsters.reduce((n, m) => n + (m.isDead || m.def.phantom ? 0 : 1), 0);
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
  spawnAll(spawns: MapSpawns, rng: Rng, population: Population | null = null, areaLevel = 1): void {
    this.clear();
    const plan = planSpawns(spawns, rng, population, areaLevel);
    for (const entry of plan) this.spawn(new Monster(entry.def, entry.pos, { affixes: entry.affixes, rng, level: entry.level }));
    this.spawnedTotal = plan.length;
  }

  /** Puts `count` copies of the monster `defId` in a ring around `owner` (a mask splitting into phantoms). They are not part of the map's population. */
  spawnMinions(owner: Monster, defId: string, count: number, rng: Rng): void {
    const def = (MONSTERS as Record<string, MonsterDef>)[defId];
    if (!def) throw new Error(`Unknown monster "${defId}"`);
    const alive = this.monsters.filter((m) => m.summoner === owner && m.def.id === defId && m.state !== 'dead').length;
    count = helpersAllowed(owner.def.summons, defId, count, alive);
    const start = rng() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = start + (i / count) * Math.PI * 2;
      const monster = new Monster(def, { x: owner.pos.x + Math.cos(angle) * 0.9, y: owner.pos.y + Math.sin(angle) * 0.9 }, { rng, summoned: true, level: owner.level, summoner: owner });
      this.collision.pushOut(monster.pos, def.radius);
      this.spawn(monster);
      if (!def.phantom) this.spawnedTotal++; // real reinforcements are part of the count of monsters on the map
      monster.engage(); // it was born in the middle of a fight
    }
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
      if (a.isDead || a.hidden) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (b.isDead || b.hidden) continue;
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
