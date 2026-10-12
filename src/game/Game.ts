import * as THREE from 'three';
import { LOOT_CONFIG, MAX_FRAME_DT, PLAYER_CONFIG, SKILL_ACTIONS } from '../config/gameConfig';
import { EQUIP_SLOTS, LEGENDARIES, SLOT_LABEL, type EquipSlot, type ItemInstance } from '../data/items';
import { LOOT_TABLES } from '../data/lootTables';
import { MapParseError, parseMap, type MapData } from '../data/mapData';
import type { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { GroundLootSystem, type LootDrop } from '../systems/GroundLootSystem';
import { Inventory } from '../systems/InventorySystem';
import { createPlainItem, generateItem, generateLegendary, rollLoot } from '../systems/LootSystem';
import { MonsterAISystem } from '../systems/MonsterAISystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { defaultRng } from '../systems/rng';
import { activeEffects, computeStats, type Equipment, type PlayerStats } from '../systems/stats';
import { AssetLoader, assetUrl } from './AssetLoader';
import { ASSET_MANIFEST, SpriteKey } from './assetManifest';
import { CameraController } from './CameraController';
import { DamageNumbers } from './DamageNumbers';
import type { DebugOverlay } from './DebugOverlay';
import { EffectAssets, LightningEffect, SlashEffect } from './effects';
import { Input } from './Input';
import { Layer, placeAt, worldToSceneX, worldToSceneY, type Vec2 } from './iso';
import { SceneManager } from './SceneManager';

const MAP_URL = 'maps/dungeon.json';
const STATS_INTERVAL = 0.25;
const STARTER_WEAPON = 'sword_rusty';

export type GamePhase = 'loading' | 'ready' | 'error';

/** Immutable copy of the backpack, equipment and derived stats for the React UI. Replaced on every change. */
export interface InventoryView {
  slots: readonly (ItemInstance | null)[];
  equipment: Readonly<Equipment>;
  stats: Readonly<PlayerStats>;
}

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
  inventoryOpen: boolean;
  inventory: InventoryView;
  /** Timed buffs from legendary effects, for the HUD badges. */
  buffs: { haste: boolean; frenzy: boolean };
}

const EMPTY_INVENTORY: InventoryView = {
  slots: [],
  equipment: { weapon: null, helmet: null, chest: null, boots: null, ring: null },
  stats: {
    maxHp: 0,
    damage: 0,
    attackSpeed: 0,
    attackRange: 0,
    armor: 0,
    critChance: 0,
    critDamage: 0,
    moveSpeed: 0,
  },
};

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
  inventoryOpen: false,
  inventory: EMPTY_INVENTORY,
  buffs: { haste: false, frenzy: false },
};

/** Everything that exists once a map has loaded. */
interface World {
  map: MapData;
  collision: CollisionSystem;
  player: Player;
  inventory: Inventory;
  monsters: MonsterAISystem;
  projectiles: ProjectileSystem;
  combat: CombatSystem;
  groundLoot: GroundLootSystem;
  effects: EffectAssets;
  slash: SlashEffect;
  lightning: LightningEffect;
  numbers: DamageNumbers;
  debug: DebugOverlay;
  moveMarker: THREE.Mesh;
}

/** Top-level game object: wires renderer, input, map, collision, combat, loot and the player together. */
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
  private inventoryOpen = false;
  /** The ground item the player was told to walk to and pick up. */
  private pickupTarget: LootDrop | null = null;

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
      this.syncEquipment();
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

  /**
   * Respawns the player at the start with full health and repopulates the dungeon.
   * The character keeps its inventory and equipment; items still on the floor are cleared.
   */
  restart = (): void => {
    const w = this.world;
    if (!w) return;
    w.player.respawn(w.map.spawns.player);
    w.monsters.spawnAll(w.map.spawns.monsters);
    w.projectiles.clear();
    w.numbers.clear();
    w.slash.hide();
    w.lightning.clear();
    w.groundLoot.clear();
    this.pickupTarget = null;
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
      w.groundLoot.dispose();
      w.player.dispose();
      w.slash.dispose();
      w.lightning.dispose();
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

  // --- UI actions (called from React) --------------------------------------------------------

  setInventoryOpen = (open: boolean): void => {
    this.inventoryOpen = open;
    this.publish({ inventoryOpen: open });
  };

  toggleInventory = (): void => this.setInventoryOpen(!this.inventoryOpen);

  /** Equips the backpack item at `index` (swapping with what is worn in that slot). */
  equipFromInventory = (index: number): void => {
    const w = this.world;
    if (!w || w.player.isDead) return;
    w.inventory.equip(index);
  };

  /** Moves an equipped item back to the backpack; refuses (item stays equipped) if the backpack is full. */
  unequip = (slot: EquipSlot): void => {
    const w = this.world;
    if (!w || w.player.isDead) return;
    const result = w.inventory.unequip(slot);
    if (!result.ok && result.reason === 'full') this.notify('背包已滿，無法卸下裝備');
  };

  /** Drops a backpack item on the floor next to the player (it can be picked up again). */
  dropFromInventory = (index: number): void => {
    const w = this.world;
    if (!w || w.player.isDead) return;
    const item = w.inventory.take(index);
    if (!item) return;
    w.groundLoot.spawnNear(item, w.player.pos.x, w.player.pos.y);
    this.notify(`丟棄：${item.name}`);
  };

  // --- setup -------------------------------------------------------------------------------

  private buildWorld(map: MapData, assets: AssetLoader): World {
    const collision = new CollisionSystem(map);
    const debug = this.scene.loadMap(map, assets);
    const effects = new EffectAssets();

    const inventory = new Inventory(() => this.syncEquipment());
    inventory.add(createPlainItem(STARTER_WEAPON, defaultRng));
    inventory.equip(0);

    const player = new Player(assets, collision, map.spawns.player, computeStats(inventory.equipment));
    const projectiles = new ProjectileSystem(assets);
    const slash = new SlashEffect();
    const lightning = new LightningEffect();
    const numbers = new DamageNumbers(this.container);
    const groundLoot = new GroundLootSystem(assets, this.container, collision, defaultRng, (drop) =>
      this.requestPickup(drop),
    );

    // Combat and the monster system reference each other (combat reads the monster list,
    // monsters call combat hooks), so the list is passed lazily.
    let monsters: MonsterAISystem;
    const combat = new CombatSystem(player, () => monsters.all, projectiles, collision, defaultRng, {
      damageDealt: (x, y, amount, crit) => numbers.spawn(x, y, String(amount), crit ? 'crit' : 'dealt'),
      damageTaken: (x, y, amount) => {
        numbers.spawn(x, y, `-${amount}`, 'taken');
        this.hitSeq++;
        this.publishVitals();
      },
      healed: (x, y, amount) => {
        numbers.spawn(x, y, `+${amount}`, 'heal');
        this.publishVitals();
      },
      lightningArc: (ax, ay, bx, by) => lightning.strike(ax, ay, bx, by),
      monsterKilled: (m: Monster) => {
        this.kills++;
        for (const item of rollLoot(LOOT_TABLES[m.def.lootTable], defaultRng)) {
          groundLoot.spawnNear(item, m.pos.x, m.pos.y);
        }
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

    this.scene.scene.add(
      groundLoot.group,
      monsters.group,
      projectiles.group,
      player.group,
      slash.mesh,
      lightning.group,
      moveMarker,
    );
    return {
      map,
      collision,
      player,
      inventory,
      monsters,
      projectiles,
      combat,
      groundLoot,
      effects,
      slash,
      lightning,
      numbers,
      debug,
      moveMarker,
    };
  }

  // --- equipment, pickup -------------------------------------------------------------------

  /** Recomputes the player's stats and legendary effects from what is worn, and tells the UI. */
  private syncEquipment(): void {
    const w = this.world;
    if (!w) return; // fires once while the world is still being built; start() syncs afterwards
    const stats = computeStats(w.inventory.equipment);
    Object.assign(w.player.stats, stats);
    w.player.hp = Math.min(w.player.hp, stats.maxHp);
    w.player.setEffects(activeEffects(w.inventory.equipment));
    this.publish({
      inventory: { slots: [...w.inventory.slots], equipment: { ...w.inventory.equipment }, stats: { ...stats } },
    });
    this.publishVitals();
  }

  /** Called when a ground label is clicked: walk there and pick the item up. */
  private requestPickup(drop: LootDrop): void {
    const w = this.world;
    if (!w || w.player.isDead || drop.picked) return;
    this.pickupTarget = drop;
  }

  private tryPickup(drop: LootDrop): void {
    const w = this.world;
    if (!w || drop.picked) return;
    const result = w.inventory.add(drop.item);
    if (result.ok) {
      w.groundLoot.remove(drop);
      this.notify(`拾取：${drop.item.name}`);
    } else if (result.reason === 'duplicate') {
      w.groundLoot.remove(drop); // the same item is already owned; never create a second copy
    } else {
      this.notify('背包已滿！');
    }
  }

  /** Debug (F3 mode + F4): drops every legendary and a few rares next to the player. */
  private debugDropLoot(): void {
    const w = this.world;
    if (!w) return;
    const { x, y } = w.player.pos;
    for (const def of LEGENDARIES) w.groundLoot.spawnNear(generateLegendary(def.id, defaultRng), x, y);
    for (let i = 0; i < 3; i++) w.groundLoot.spawnNear(generateItem('rare', defaultRng), x, y);
    this.notify('除錯：已掉落測試裝備');
  }

  /** Debug (F3 mode + F6): puts all four legendaries straight onto the character. */
  private debugEquipLegendaries(): void {
    const w = this.world;
    if (!w || w.player.isDead) return;
    for (const def of LEGENDARIES) {
      const added = w.inventory.add(generateLegendary(def.id, defaultRng));
      if (added.ok) w.inventory.equip(added.index);
    }
    this.notify('除錯：已穿上全部傳奇');
  }

  /** Debug (F3 mode + F7): full health and a fresh set of monsters; gear and floor items are kept. */
  private debugResetBattlefield(): void {
    const w = this.world;
    if (!w || w.player.isDead) return;
    w.player.hp = w.player.stats.maxHp;
    w.monsters.spawnAll(w.map.spawns.monsters);
    w.projectiles.clear();
    this.kills = 0;
    this.publishVitals();
    this.notify('除錯：已回滿血並重生怪物');
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
    const { player, debug, monsters, combat, slash, lightning, numbers, groundLoot, moveMarker } = w;
    const input = this.input;

    if (input.wasPressed('debug')) {
      debug.toggle();
      this.publish({ debug: debug.visible });
    }
    if (debug.visible && input.wasPressed('debugLoot')) this.debugDropLoot();
    if (debug.visible && input.wasPressed('debugEquip')) this.debugEquipLegendaries();
    if (debug.visible && input.wasPressed('debugReset')) this.debugResetBattlefield();

    if (input.wasPressed('inventory')) this.toggleInventory();
    if (input.wasPressed('pause') && this.inventoryOpen) this.setInventoryOpen(false);

    const aim = input.pointerInside
      ? this.cameraCtl.pointerToWorld(input.pointer.x, input.pointer.y, this.aimWorld)
      : null;

    if (!player.isDead) {
      // wasMousePressed also covers a click whose press and release land within one frame.
      const attackHeld = input.isMouseDown('attack') || input.wasMousePressed('attack');
      const moveHeld = input.isMouseDown('move') || input.wasMousePressed('move');
      // Any fresh gameplay input cancels a pending walk-to-pickup.
      if (attackHeld || moveHeld || input.wasPressed('dodge')) this.pickupTarget = null;

      if (input.wasPressed('dodge')) player.startDodge(aim?.x ?? player.pos.x, aim?.y ?? player.pos.y);

      // Right button: swing toward the cursor (hold to keep swinging). It stops the player in place
      // and takes priority over walking, so holding both never drags the player mid-swing.
      if (attackHeld && aim) player.startAttack(aim.x, aim.y);
      else if (moveHeld && aim) player.moveTo(aim.x, aim.y);

      // F: pick up the nearest item within reach.
      if (input.wasPressed('pickup')) {
        const near = groundLoot.nearest(player.pos, LOOT_CONFIG.keyPickupRange);
        if (near) this.tryPickup(near);
      }

      // Walking toward a clicked ground item.
      const target = this.pickupTarget;
      if (target) {
        if (target.picked) this.pickupTarget = null;
        else if (Math.hypot(target.pos.x - player.pos.x, target.pos.y - player.pos.y) <= LOOT_CONFIG.pickupRange) {
          this.pickupTarget = null;
          this.tryPickup(target);
        } else if (!player.isSwinging && !player.mover.hasTarget) {
          player.moveTo(target.pos.x, target.pos.y);
        }
      }

      // Skill keys are bound, but their effects land in Phase 4.
      for (const action of SKILL_ACTIONS) {
        if (input.wasPressed(action)) this.notify(`${action.slice(5)}：技能（尚未實作）`);
      }
    } else {
      this.pickupTarget = null;
    }

    player.update(dt);
    monsters.update(dt, player);
    combat.update(dt);
    monsters.syncViews(dt);
    slash.update(dt);
    lightning.update(dt);
    groundLoot.update(dt, this.cameraCtl);
    numbers.update(dt, this.cameraCtl);
    debug.setPlayerCircle(player.pos.x, player.pos.y, player.radius);

    const haste = player.buffs.moveActive;
    const frenzy = player.buffs.attackActive;
    if (haste !== this.snapshot.buffs.haste || frenzy !== this.snapshot.buffs.frenzy) {
      this.publish({ buffs: { haste, frenzy } });
    }

    const moveTarget = player.mover.currentTarget;
    moveMarker.visible = moveTarget !== null && this.pickupTarget === null;
    if (moveTarget) placeAt(moveMarker, Layer.GROUND_DECAL, moveTarget.x, moveTarget.y);

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

  /** Read-only views for tests and debugging. */
  get monsterList(): readonly Monster[] {
    return this.world?.monsters.all ?? [];
  }
  get playerEntity(): Player | null {
    return this.world?.player ?? null;
  }
  get inventoryEntity(): Inventory | null {
    return this.world?.inventory ?? null;
  }
  get lootDrops(): readonly LootDrop[] {
    return this.world?.groundLoot.all ?? [];
  }
}

function describeError(err: unknown): string {
  if (err instanceof MapParseError) return `地圖資料有誤：${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

// Re-exported for the UI.
export { EQUIP_SLOTS, SLOT_LABEL };
