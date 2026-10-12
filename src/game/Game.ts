import * as THREE from 'three';
import { MAX_FRAME_DT, PLAYER_CONFIG, SKILL_ACTIONS } from '../config/gameConfig';
import { MapParseError, parseMap, type MapData } from '../data/mapData';
import type { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { MonsterAISystem } from '../systems/MonsterAISystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { defaultRng } from '../systems/rng';
import { computePlayerStats } from '../systems/stats';
import { AssetLoader, assetUrl } from './AssetLoader';
import { ASSET_MANIFEST, SpriteKey } from './assetManifest';
import { CameraController } from './CameraController';
import { DamageNumbers } from './DamageNumbers';
import type { DebugOverlay } from './DebugOverlay';
import { EffectAssets, SlashEffect } from './effects';
import { Input } from './Input';
import { Layer, placeAt, worldToSceneX, worldToSceneY, type Vec2 } from './iso';
import { SceneManager } from './SceneManager';

const MAP_URL = 'maps/dungeon.json';
const STATS_INTERVAL = 0.25;

export type GamePhase = 'loading' | 'ready' | 'error';

/** Immutable snapshot published to the React HUD (replaced, never mutated). */
export interface GameSnapshot {
  phase: GamePhase;
  /** Fatal error message when phase is "error". */
  error: string | null;
  /** Non-fatal problems, e.g. an asset that fell back to its placeholder. */
  warnings: readonly string[];
  mapName: string;
  fps: number;
  playerX: number;
  playerY: number;
  debug: boolean;
  /** Latest input feedback; `seq` increments on every new notice so the HUD can restart its timer. */
  notice: { seq: number; text: string } | null;
  playerHp: number;
  playerMaxHp: number;
  playerDead: boolean;
  /** Increments every time the player takes damage (restarts the screen flash). */
  hitSeq: number;
  monstersAlive: number;
  monstersTotal: number;
  kills: number;
}

const INITIAL: GameSnapshot = {
  phase: 'loading',
  error: null,
  warnings: [],
  mapName: '',
  fps: 0,
  playerX: 0,
  playerY: 0,
  debug: false,
  notice: null,
  playerHp: 0,
  playerMaxHp: 0,
  playerDead: false,
  hitSeq: 0,
  monstersAlive: 0,
  monstersTotal: 0,
  kills: 0,
};

/** Everything that exists once a map has loaded. */
interface World {
  map: MapData;
  collision: CollisionSystem;
  player: Player;
  monsters: MonsterAISystem;
  projectiles: ProjectileSystem;
  combat: CombatSystem;
  effects: EffectAssets;
  slash: SlashEffect;
  numbers: DamageNumbers;
  debug: DebugOverlay;
  moveMarker: THREE.Mesh;
}

/** Top-level game object: wires renderer, input, map, collision, combat and the player together. */
export class Game {
  private snapshot: GameSnapshot = INITIAL;
  private readonly listeners = new Set<() => void>();

  private readonly scene: SceneManager;
  private readonly cameraCtl = new CameraController();
  private readonly input: Input;
  private readonly resizeObserver: ResizeObserver;

  private assets: AssetLoader | null = null;
  private world: World | null = null;
  private noticeSeq = 0;
  private hitSeq = 0;
  private kills = 0;

  private disposed = false;
  private rafId = 0;
  private lastTime = 0;
  private statsTimer = 0;
  private statsFrames = 0;
  private readonly aimWorld: Vec2 = { x: 0, y: 0 };

  constructor(private readonly container: HTMLElement) {
    this.scene = new SceneManager(container);
    this.input = new Input(this.scene.canvas);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.handleResize();
  }

  // --- external-store API for React's useSyncExternalStore -------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameSnapshot => this.snapshot;

  private publish(patch: Partial<GameSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  // --- lifecycle ---------------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      const assets = new AssetLoader(ASSET_MANIFEST);
      this.assets = assets;
      const [, map] = await Promise.all([assets.loadAll(), this.fetchMap()]);
      if (this.disposed) return;

      this.world = this.buildWorld(map, assets);
      const { player } = this.world;
      this.cameraCtl.snapTo(worldToSceneX(player.pos.x, player.pos.y), worldToSceneY(player.pos.x, player.pos.y));
      this.publish({ phase: 'ready', mapName: map.name, warnings: [...assets.errors] });
      this.publishVitals();
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);

      // Dev-only handle for debugging and scripted tests; not exposed in production builds.
      if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = this;
    } catch (err) {
      if (this.disposed) return;
      console.error(err);
      this.publish({ phase: 'error', error: describeError(err) });
    }
  }

  /** Respawns the player at the start with full health and repopulates the dungeon. */
  restart = (): void => {
    const w = this.world;
    if (!w) return;
    w.player.respawn(w.map.spawns.player);
    w.monsters.spawnAll(w.map.spawns.monsters);
    w.projectiles.clear();
    w.numbers.clear();
    w.slash.hide();
    this.kills = 0;
    this.cameraCtl.snapTo(worldToSceneX(w.player.pos.x, w.player.pos.y), worldToSceneY(w.player.pos.x, w.player.pos.y));
    this.publishVitals();
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.input.dispose();
    const w = this.world;
    if (w) {
      w.monsters.dispose();
      w.projectiles.dispose();
      w.player.dispose();
      w.slash.dispose();
      w.numbers.dispose();
      w.effects.dispose();
    }
    this.scene.dispose();
    this.assets?.dispose();
    this.listeners.clear();
    if (import.meta.env.DEV) {
      const holder = window as unknown as { __game?: Game };
      if (holder.__game === this) delete holder.__game;
    }
  }

  // --- setup -------------------------------------------------------------------------------

  private buildWorld(map: MapData, assets: AssetLoader): World {
    const collision = new CollisionSystem(map);
    const debug = this.scene.loadMap(map, assets);
    const effects = new EffectAssets();
    const player = new Player(assets, collision, map.spawns.player, computePlayerStats());
    const projectiles = new ProjectileSystem(assets);
    const slash = new SlashEffect();
    const numbers = new DamageNumbers(this.container);

    // Combat and the monster system reference each other (combat reads the monster list,
    // monsters call combat hooks), so the list is passed lazily.
    // eslint-disable-next-line prefer-const -- assigned below once both exist
    let monsters: MonsterAISystem;
    const combat = new CombatSystem(player, () => monsters.all, projectiles, collision, defaultRng, {
      damageDealt: (x, y, amount, crit) => numbers.spawn(x, y, String(amount), crit ? 'crit' : 'dealt'),
      damageTaken: (x, y, amount) => {
        numbers.spawn(x, y, `-${amount}`, 'taken');
        this.hitSeq++;
        this.publishVitals();
      },
      monsterKilled: () => {
        this.kills++;
        this.publishVitals();
        if (monsters.aliveCount === 0) this.notify('區域已清空！');
      },
      playerDied: () => this.publishVitals(),
    });
    monsters = new MonsterAISystem(assets, effects, collision, combat);
    monsters.spawnAll(map.spawns.monsters);

    player.hooks = {
      swingStarted: (dx, dy, duration) =>
        slash.trigger(player.pos.x, player.pos.y, dx, dy, player.stats.attackRange, PLAYER_CONFIG.attackArcHalfAngle, duration),
      swingHit: (dx, dy) => combat.playerSwingHit(dx, dy),
    };

    const moveMarker = new THREE.Mesh(
      assets.sharedGeometry(SpriteKey.MOVE_MARKER),
      assets.material(SpriteKey.MOVE_MARKER),
    );
    moveMarker.visible = false;

    this.scene.scene.add(monsters.group, projectiles.group, player.group, slash.mesh, moveMarker);
    return { map, collision, player, monsters, projectiles, combat, effects, slash, numbers, debug, moveMarker };
  }

  // --- internals -------------------------------------------------------------------------

  private async fetchMap(): Promise<MapData> {
    const url = assetUrl(MAP_URL);
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new Error(`無法載入地圖檔：${url}`);
    }
    if (!res.ok) throw new Error(`無法載入地圖檔：${url}（HTTP ${res.status}）`);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`地圖檔不是有效的 JSON：${url}`);
    }
    return parseMap(json);
  }

  private notify(text: string): void {
    this.publish({ notice: { seq: ++this.noticeSeq, text } });
  }

  private publishVitals(): void {
    const w = this.world;
    if (!w) return;
    this.publish({
      playerHp: Math.ceil(w.player.hp),
      playerMaxHp: w.player.stats.maxHp,
      playerDead: w.player.isDead,
      hitSeq: this.hitSeq,
      monstersAlive: w.monsters.aliveCount,
      monstersTotal: w.monsters.total,
      kills: this.kills,
    });
  }

  private handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.scene.resize(w, h);
    this.cameraCtl.resize(w, h);
  }

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DT);
    this.lastTime = now;
    this.tick(dt);
    this.scene.render(this.cameraCtl.camera);
    this.input.endFrame();
  };

  private tick(dt: number): void {
    const w = this.world;
    if (!w) return;
    const { player, debug, monsters, combat, slash, numbers, moveMarker } = w;
    const input = this.input;

    if (input.wasPressed('debug')) {
      debug.toggle();
      this.publish({ debug: debug.visible });
    }

    const aim = input.pointerInside
      ? this.cameraCtl.pointerToWorld(input.pointer.x, input.pointer.y, this.aimWorld)
      : null;

    if (!player.isDead) {
      // wasMousePressed also covers a click whose press and release land within one frame.
      const attackHeld = input.isMouseDown('attack') || input.wasMousePressed('attack');
      const moveHeld = input.isMouseDown('move') || input.wasMousePressed('move');
      // Right button: swing toward the cursor (hold to keep swinging). It stops the player in place
      // and takes priority over walking, so holding both never drags the player mid-swing.
      if (attackHeld && aim) player.startAttack(aim.x, aim.y);
      else if (moveHeld && aim) player.moveTo(aim.x, aim.y);

      // Skill keys are bound, but their effects land in Phase 4.
      for (const action of SKILL_ACTIONS) {
        if (input.wasPressed(action)) this.notify(`${action.slice(5)}：技能（尚未實作）`);
      }
    }

    player.update(dt);
    monsters.update(dt, player);
    combat.update(dt);
    monsters.syncViews(dt);
    slash.update(dt);
    numbers.update(dt, this.cameraCtl);
    debug.setPlayerCircle(player.pos.x, player.pos.y, player.radius);

    const target = player.mover.currentTarget;
    moveMarker.visible = target !== null;
    if (target) placeAt(moveMarker, Layer.GROUND_DECAL, target.x, target.y);

    this.cameraCtl.follow(worldToSceneX(player.pos.x, player.pos.y), worldToSceneY(player.pos.x, player.pos.y), dt);

    this.statsFrames++;
    this.statsTimer += dt;
    if (this.statsTimer >= STATS_INTERVAL) {
      this.publish({
        fps: Math.round(this.statsFrames / this.statsTimer),
        playerX: player.pos.x,
        playerY: player.pos.y,
      });
      this.publishVitals();
      this.statsFrames = 0;
      this.statsTimer = 0;
    }
  }

  /** Read-only view of live monsters, for tests and debugging. */
  get monsterList(): readonly Monster[] {
    return this.world?.monsters.all ?? [];
  }
  get playerEntity(): Player | null {
    return this.world?.player ?? null;
  }
}

function describeError(err: unknown): string {
  if (err instanceof MapParseError) return `地圖資料有誤：${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
