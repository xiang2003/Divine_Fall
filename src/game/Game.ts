import * as THREE from 'three';
import {
  LOCKED_SKILL_ACTIONS,
  LOOT_CONFIG,
  MAX_FRAME_DT,
  PLAYER_CONFIG,
  SKILL_INPUT_BUFFER,
} from '../config/gameConfig';
import { EQUIP_SLOTS, LEGENDARIES, SLOT_LABEL, type EquipSlot, type ItemInstance } from '../data/items';
import { LOOT_TABLES } from '../data/lootTables';
import { SKILLS, type SkillDef } from '../data/skills';
import { MAX_LEVEL } from '../data/progression';
import { START_MAP_ID, WORLD_MAP_FILES, WORLD_MAP_LAYOUT, isWorldMapId } from '../data/worldMaps';
import { buildWorldGraph, type WorldGraphView } from '../systems/worldGraph';
import { MapParseError, parseMap, type MapData } from '../data/mapData';
import type { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { CollisionSystem } from '../systems/CollisionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { GroundLootSystem, type LootDrop } from '../systems/GroundLootSystem';
import { Inventory } from '../systems/InventorySystem';
import { createPlainItem, generateItem, generateLegendary, rollLoot } from '../systems/LootSystem';
import { MonsterAISystem } from '../systems/MonsterAISystem';
import { getDialogue } from '../data/dialogues';
import { getNpc } from '../data/npcs';
import { INTERACT_RANGE, InteractableSystem, type Interactable } from '../systems/InteractableSystem';
import { QUESTS } from '../data/quests';
import { QuestLog, type QuestEvent, type QuestHappening, type QuestView } from '../systems/quests';
import { DialogueRunner, pickDialogue, type DialogueContext } from '../systems/dialogue';
import { TOPIC_MARK, greetingFor, needsIntro, visibleTopics, type NpcTopic, type TopicKind } from '../systems/npcTopics';
import type { NpcDef } from '../data/npcs';
import type { MinimapView } from '../ui/minimapDraw';
import { NPC_CLICK_RADIUS, NPC_TALK_RANGE, NpcSystem, npcBounds, npcPresent, type Npc } from '../systems/NpcSystem';
import { findPortalAt, portalBlockedReason, resolveEntrance } from '../systems/portals';
import { Progression } from '../systems/progression';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SkillProjectileSystem } from '../systems/SkillProjectileSystem';
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

/** Seconds for each half of the black fade when changing maps. */
const FADE_SECONDS = 0.25;
/** A closed portal repeats its message at most this often (seconds). */
const PORTAL_NOTICE_INTERVAL = 2;
const STATS_INTERVAL = 0.25;
const STARTER_WEAPON = 'sword_rusty';

export type GamePhase = 'loading' | 'ready' | 'error';

/** Immutable copy of the backpack, equipment and derived stats for the React UI. Replaced on every change. */
export interface InventoryView {
  slots: readonly (ItemInstance | null)[];
  equipment: Readonly<Equipment>;
  stats: Readonly<PlayerStats>;
  /** Character level (the stats above already include its bonus). */
  level: number;
}

/** What the skill bar needs to draw one skill slot. */
export interface SkillView {
  id: string;
  keyLabel: string;
  name: string;
  description: string;
  /** Seconds of cooldown left (0 when ready). */
  remaining: number;
  /** Length of the cooldown that is running (for the sweep animation). */
  total: number;
  ready: boolean;
}

/** The boss health bar, shown once the boss has noticed the player. */
export interface BossView {
  name: string;
  hp: number;
  maxHp: number;
  /** 0-based current phase. */
  phase: number;
  phaseCount: number;
}

/** One entry of an NPC's topic menu. */
export interface TopicView {
  label: string;
  kind: TopicKind;
  /** "！" / "？" / "…" in front of quest entries, empty otherwise. */
  mark: string;
}

/** The conversation on screen. */
export interface DialogueSnapshot {
  npcName: string;
  /** The NPC's role (shown under the name), or null for a thing being examined. */
  title: string | null;
  /** Upper-body picture of the NPC, or null when there is none (a thing being examined). */
  portrait: string | null;
  speaker: string;
  text: string;
  /** Choices on offer, or null when the line simply continues. */
  choices: readonly string[] | null;
  /** True when continuing closes the conversation. */
  last: boolean;
  /** The NPC's topic menu while it is showing (then `text` is the greeting and there are no choices), otherwise null. */
  topics: readonly TopicView[] | null;
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
  /** Character level, experience toward the next level, and what the next level costs (0 at the cap). */
  level: number;
  xp: number;
  xpToNext: number;
  inventoryOpen: boolean;
  inventory: InventoryView;
  /** Timed buffs from legendary effects, for the HUD badges. */
  buffs: { haste: boolean; frenzy: boolean; poison: boolean };
  skills: readonly SkillView[];
  boss: BossView | null;
  /** True from the moment the boss dies until the next restart. */
  bossDefeated: boolean;
  /** Black overlay opacity (0-1) while moving between maps. */
  fade: number;
  dialogue: DialogueSnapshot | null;
  /** Quests that were accepted: ready ones first, then active, then completed. */
  quests: readonly QuestView[];
  questLogOpen: boolean;
  /** The world map (M) is open; `worldMap` is null while the map data is still loading. */
  worldMapOpen: boolean;
  worldMap: WorldGraphView | null;
  /** The chapter-complete screen is showing. */
  chapterEnd: boolean;
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
  level: 1,
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
  level: 1,
  xp: 0,
  xpToNext: 0,
  inventoryOpen: false,
  inventory: EMPTY_INVENTORY,
  buffs: { haste: false, frenzy: false, poison: false },
  skills: [],
  boss: null,
  bossDefeated: false,
  fade: 0,
  dialogue: null,
  quests: [],
  questLogOpen: false,
  worldMapOpen: false,
  worldMap: null,
  chapterEnd: false,
};

/** What survives a map change: the character itself. */
interface Carry {
  player: Player;
  inventory: Inventory;
}

/** A map change in progress: fade to black, swap the world once the next map is loaded, fade back in. */
interface Transition {
  phase: 'out' | 'in';
  t: number;
  mapId: string;
  entrance: string;
  map: MapData | null;
  failed: boolean;
}

/** Everything that exists once a map has loaded. */
interface World {
  map: MapData;
  collision: CollisionSystem;
  player: Player;
  inventory: Inventory;
  monsters: MonsterAISystem;
  projectiles: ProjectileSystem;
  skillBolts: SkillProjectileSystem;
  combat: CombatSystem;
  groundLoot: GroundLootSystem;
  effects: EffectAssets;
  slash: SlashEffect;
  spinFx: SlashEffect;
  slamFx: SlashEffect;
  /** Ground warning shown while a boss blast winds up, and the flash when it goes off. */
  telegraphFx: SlashEffect;
  novaFx: SlashEffect;
  nameplateLayer: HTMLDivElement;
  npcs: NpcSystem;
  interactables: InteractableSystem;
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
  private mapId: string = START_MAP_ID;
  private readonly mapCache = new Map<string, MapData>();
  /** World progress switches (e.g. "ruins_open"); portals can require one. Quests will own these later. */
  private readonly flags = new Set<string>();
  private transition: Transition | null = null;
  private portalNoticeTimer = 0;
  /** Level and experience; kept across restarts like the inventory. */
  private readonly progression = new Progression();
  private bossDefeated = false;
  /** The boss currently winding up a blast (so its warning can be removed if it is interrupted). */
  private telegraphOwner: Monster | null = null;
  private teleportIndex = 0;
  private inventoryOpen = false;
  private questLogOpen = false;
  private worldMapOpen = false;
  /** Maps the player has entered (the world map dims the others). */
  private readonly visitedMaps = new Set<string>([START_MAP_ID]);
  private readonly quests = new QuestLog(QUESTS);
  /** The conversation in progress (the world keeps running behind it, but the player's input is ignored). */
  private dialogue: {
    /** The conversation being played; null while an NPC's topic menu is showing. */
    runner: DialogueRunner | null;
    /** The NPC being talked to (null for a thing being examined, which has no menu). */
    npc: NpcDef | null;
    name: string;
    pos: Vec2;
  } | null = null;
  /** How many times the player has talked to each NPC this session (picks the greeting line). */
  private readonly talkVisits = new Map<string, number>();
  /** The NPC the player was told to walk to and talk to. */
  private talkTarget: Npc | null = null;
  /** The thing the player was told to walk to and examine. */
  private interactTarget: Interactable | null = null;
  /** The ground item the player was told to walk to and pick up. */
  private pickupTarget: LootDrop | null = null;
  /** A skill key pressed while busy, cast as soon as the player is free (see SKILL_INPUT_BUFFER). */
  private pendingSkill: { def: SkillDef; timeLeft: number } | null = null;
  private skillTimer = 0;
  private skillsWereActive = false;

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

  /** What the minimap draws (live positions; read every frame by the minimap, not published through the snapshot). */
  getMinimapView = (): MinimapView | null => {
    const w = this.world;
    if (!w) return null;
    const alive = w.monsters.all.filter((m) => !m.isDead);
    return {
      map: w.map,
      player: w.player.pos,
      npcs: w.npcs.all.map((n) => n.pos),
      monsters: alive.filter((m) => !m.isElite && !m.isBoss).map((m) => m.pos),
      bosses: alive.filter((m) => m.isElite || m.isBoss).map((m) => m.pos),
      things: w.interactables.all.filter((i) => i.visible).map((i) => i.pos),
      portals: w.map.portals
        .filter((p) => !p.requiresFlag || this.flags.has(p.requiresFlag))
        .map((p) => ({ x: (p.rect.minX + p.rect.maxX) / 2, y: (p.rect.minY + p.rect.maxY) / 2 })),
    };
  };

  private publish(patch: Partial<GameSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  // --- lifecycle ---------------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      const assets = new AssetLoader(ASSET_MANIFEST);
      this.assets = assets;
      const [, map] = await Promise.all([assets.loadAll(), this.loadMapData(START_MAP_ID)]);
      if (this.disposed) return;

      this.mapId = map.id;
      this.world = this.buildWorld(map, assets, null);
      const { player } = this.world;
      this.syncEquipment();
      this.publishSkills();
      this.questHappened({ type: 'reach', map: map.id });
      this.refreshQuests();
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
    w.monsters.spawnAll(w.map.spawns, defaultRng, w.map.population);
    w.telegraphFx.hide();
    w.novaFx.hide();
    this.telegraphOwner = null;
    this.bossDefeated = false;
    w.projectiles.clear();
    w.skillBolts.clear();
    w.numbers.clear();
    w.slash.hide();
    w.spinFx.hide();
    w.slamFx.hide();
    this.pendingSkill = null;
    this.publishSkills();
    w.lightning.clear();
    w.groundLoot.clear();
    this.pickupTarget = null;
    this.endDialogue();
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
    if (this.world) this.releaseWorld(this.world, false);
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
    if (open && this.questLogOpen) this.setQuestLogOpen(false);
    if (open && this.worldMapOpen) this.setWorldMapOpen(false);
    this.publish({ inventoryOpen: open });
  };

  setQuestLogOpen = (open: boolean): void => {
    this.questLogOpen = open;
    if (open && this.inventoryOpen) this.setInventoryOpen(false);
    if (open && this.worldMapOpen) this.setWorldMapOpen(false);
    this.publish({ questLogOpen: open });
  };

  setWorldMapOpen = (open: boolean): void => {
    this.worldMapOpen = open;
    if (!open) {
      this.publish({ worldMapOpen: false, worldMap: null });
      return;
    }
    if (this.inventoryOpen) this.setInventoryOpen(false);
    if (this.questLogOpen) this.setQuestLogOpen(false);
    this.publish({ worldMapOpen: true, worldMap: null });
    void this.refreshWorldMap();
  };

  toggleWorldMap = (): void => this.setWorldMapOpen(!this.worldMapOpen);

  /** Loads every map (they are small and cached) and publishes the graph of how they connect. */
  private async refreshWorldMap(): Promise<void> {
    try {
      const maps = await Promise.all(Object.keys(WORLD_MAP_FILES).map((id) => this.loadMapData(id)));
      if (!this.worldMapOpen || this.disposed) return;
      this.publish({ worldMap: buildWorldGraph(maps, WORLD_MAP_LAYOUT, this.flags, this.visitedMaps, this.mapId) });
    } catch (err) {
      console.error(err);
      this.worldMapOpen = false;
      this.publish({ worldMapOpen: false, worldMap: null });
      this.notify('無法載入地圖資料。');
    }
  }

  toggleQuestLog = (): void => this.setQuestLogOpen(!this.questLogOpen);

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

  /** Disposes everything that belongs to one map. The player survives a map change (keepPlayer). */
  private releaseWorld(w: World, keepPlayer: boolean): void {
    w.monsters.dispose();
    w.projectiles.dispose();
    w.skillBolts.dispose();
    w.groundLoot.dispose();
    w.slash.dispose();
    w.spinFx.dispose();
    w.slamFx.dispose();
    w.telegraphFx.dispose();
    w.novaFx.dispose();
    w.nameplateLayer.remove();
    w.npcs.dispose();
    w.interactables.dispose();
    w.lightning.dispose();
    w.numbers.dispose();
    w.effects.dispose();
    if (keepPlayer) {
      this.scene.scene.remove(
        w.groundLoot.group,
        w.npcs.group,
        w.interactables.group,
        w.monsters.group,
        w.projectiles.group,
        w.skillBolts.group,
        w.slash.mesh,
        w.spinFx.mesh,
        w.slamFx.mesh,
        w.telegraphFx.mesh,
        w.novaFx.mesh,
        w.lightning.group,
        w.moveMarker,
      );
    } else {
      w.player.dispose();
    }
  }

  private buildWorld(map: MapData, assets: AssetLoader, carry: Carry | null): World {
    const presentNpcs = map.npcs.filter((n) => npcPresent(n, (f) => this.flags.has(f)));
    const collision = new CollisionSystem(map, presentNpcs.map((n) => npcBounds(n.pos)));
    const debug = this.scene.loadMap(map, assets);
    const effects = new EffectAssets();

    let inventory: Inventory;
    let player: Player;
    if (carry) {
      inventory = carry.inventory;
      player = carry.player;
    } else {
      inventory = new Inventory(() => this.syncEquipment());
      inventory.add(createPlainItem(STARTER_WEAPON, defaultRng));
      inventory.equip(0);
      player = new Player(assets, collision, map.spawns.player, computeStats(inventory.equipment, this.progression.level));
    }
    const projectiles = new ProjectileSystem(assets);
    const skillBolts = new SkillProjectileSystem(assets);
    const slash = new SlashEffect();
    const spinFx = new SlashEffect({ color: '#ffe08a', inner: 0.7 });
    const slamFx = new SlashEffect({ color: '#ff7a45', inner: 0 });
    const telegraphFx = new SlashEffect({ color: '#ff3b30', inner: 0 });
    const novaFx = new SlashEffect({ color: '#ffb070', inner: 0 });
    const npcs = new NpcSystem(presentNpcs, assets, this.container, this.cameraCtl, (npc) => this.requestTalk(npc));
    const interactables = new InteractableSystem(
      map.interactables,
      assets,
      this.container,
      this.cameraCtl,
      (it) => this.requestInteract(it),
      (f) => this.flags.has(f),
    );
    const nameplateLayer = document.createElement('div');
    nameplateLayer.className = 'nameplate-layer';
    this.container.appendChild(nameplateLayer);
    const lightning = new LightningEffect();
    const numbers = new DamageNumbers(this.container);
    const groundLoot = new GroundLootSystem(assets, this.container, collision, defaultRng, (drop) =>
      this.requestPickup(drop),
    );

    // Combat and the monster system reference each other (combat reads the monster list,
    // monsters call combat hooks), so the list is passed lazily.
    let monsters: MonsterAISystem;
    const combat = new CombatSystem(player, () => monsters.all, projectiles, skillBolts, collision, defaultRng, {
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
      skillFx: (kind, x, y, radius) =>
        (kind === 'spin' ? spinFx : slamFx).trigger(x, y, 1, 0, radius, Math.PI, kind === 'spin' ? 0.35 : 0.45),
      telegraph: (owner, x, y, radius, duration) => {
        telegraphFx.telegraph(x, y, radius, duration);
        this.telegraphOwner = owner;
      },
      novaFlash: (x, y, radius) => {
        telegraphFx.hide();
        this.telegraphOwner = null;
        novaFx.trigger(x, y, 1, 0, radius, Math.PI, 0.35);
      },
      phaseChanged: (boss, phase) => this.notify(`${boss.def.name} 進入第 ${phase + 1} 階段！`),
      monsterKilled: (m: Monster) => {
        this.kills++;
        if (m.isBoss) this.setFlag(`${this.mapId}_boss_defeated`, true);
        this.questHappened({ type: 'kill', monster: m.def.id, map: this.mapId, elite: m.isElite, boss: m.isBoss });
        this.gainXp(m.xpReward);
        for (const item of rollLoot(LOOT_TABLES[m.lootTable], defaultRng)) {
          groundLoot.spawnNear(item, m.pos.x, m.pos.y);
        }
        if (m.isBoss) {
          this.bossDefeated = true;
          this.notify(`擊敗了${m.def.name}！`);
        } else if (monsters.aliveCount === 0) {
          this.notify('區域已清空！');
        }
        this.publishVitals();
      },
      playerDied: () => this.publishVitals(),
    });
    monsters = new MonsterAISystem(assets, effects, collision, combat, this.cameraCtl, nameplateLayer);
    monsters.spawnAll(map.spawns, defaultRng, map.population);

    player.hooks = {
      swingStarted: (dx, dy, duration) =>
        slash.trigger(player.pos.x, player.pos.y, dx, dy, player.stats.attackRange, PLAYER_CONFIG.attackArcHalfAngle, duration),
      swingHit: (dx, dy) => combat.playerSwingHit(dx, dy),
      skillCast: (def, stats, dx, dy, ax, ay) => combat.castSkill(def, stats, dx, dy, ax, ay),
    };

    const moveMarker = new THREE.Mesh(
      assets.sharedGeometry(SpriteKey.MOVE_MARKER),
      assets.material(SpriteKey.MOVE_MARKER),
    );
    moveMarker.visible = false;

    this.scene.scene.add(
      groundLoot.group,
      npcs.group,
      interactables.group,
      monsters.group,
      projectiles.group,
      skillBolts.group,
      player.group,
      slash.mesh,
      spinFx.mesh,
      slamFx.mesh,
      telegraphFx.mesh,
      novaFx.mesh,
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
      skillBolts,
      combat,
      groundLoot,
      effects,
      slash,
      spinFx,
      slamFx,
      telegraphFx,
      novaFx,
      nameplateLayer,
      npcs,
      interactables,
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
    const stats = computeStats(w.inventory.equipment, this.progression.level);
    Object.assign(w.player.stats, stats);
    w.player.hp = Math.min(w.player.hp, stats.maxHp);
    w.player.setEffects(activeEffects(w.inventory.equipment));
    this.publish({
      inventory: { slots: [...w.inventory.slots], equipment: { ...w.inventory.equipment }, stats: { ...stats }, level: this.progression.level },
    });
    this.publishVitals();
  }

  /** Adds experience; each level gained refreshes the stats, fully heals the player and announces itself. */
  private gainXp(amount: number): void {
    const w = this.world;
    if (!w) return;
    const gained = this.progression.addXp(amount);
    if (gained > 0) {
      this.syncEquipment();
      if (!w.player.isDead) w.player.hp = w.player.stats.maxHp;
      const { x, y } = w.player.pos;
      w.numbers.spawn(x, y, 'LEVEL UP', 'levelup');
      w.spinFx.trigger(x, y, 1, 0, 2, Math.PI, 0.5);
      this.notify(`升級！等級 ${this.progression.level}${this.progression.atMaxLevel ? '（已達上限）' : ''}`);
    }
    this.publishVitals();
  }

  /** Debug (F3 mode + F10): opens / closes the sealed stone to the ruins and the village road to the coast. */
  private debugToggleRuinsFlag(): void {
    const open = !this.hasFlag('ruins_open');
    this.setFlag('ruins_open', open);
    this.setFlag('coast_open', open);
    this.notify(open ? '除錯：封石與海岸路已開啟' : '除錯：封石與海岸路已封閉');
  }

  /** Debug (F3 mode + F9): grants exactly the experience needed for the next level. */
  private debugLevelUp(): void {
    const w = this.world;
    if (!w || w.player.isDead) return;
    if (this.progression.atMaxLevel) {
      this.notify(`除錯：已達等級上限 ${MAX_LEVEL}`);
      return;
    }
    this.gainXp(this.progression.xpToNext - this.progression.xp);
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
    w.monsters.spawnAll(w.map.spawns, defaultRng, w.map.population);
    w.projectiles.clear();
    w.telegraphFx.hide();
    this.telegraphOwner = null;
    this.bossDefeated = false;
    this.kills = 0;
    this.publishVitals();
    this.notify('除錯：已回滿血並重生怪物');
  }

  /** Debug (F3 mode + F8): jumps to the elite area, then the boss room, then back again. */
  private debugTeleport(): void {
    const w = this.world;
    if (!w || w.player.isDead) return;
    const { elites, boss } = w.map.spawns;
    const targets = [elites[0], boss].filter((p): p is Vec2 => p !== null && p !== undefined);
    const target = targets[this.teleportIndex++ % targets.length];
    if (!target) return;
    // Stand a few tiles to the west of the target, on the first free spot (crates may be in the way).
    const y = target.y;
    const x =
      [3.5, 4.5, 2.5, 5.5, 6.5].map((d) => target.x - d).find((cx) => !w.collision.collidesCircle(cx, y, w.player.radius)) ??
      target.x - 3.5;
    w.player.pos.x = x;
    w.player.pos.y = y;
    w.player.mover.stop();
    this.cameraCtl.snapTo(worldToSceneX(x, y), worldToSceneY(x, y));
    this.notify(target === boss ? '除錯：傳送到 Boss 房' : '除錯：傳送到菁英區');
  }

  // --- internals -------------------------------------------------------------------------

  private async loadMapData(id: string): Promise<MapData> {
    const cached = this.mapCache.get(id);
    if (cached) return cached;
    if (!isWorldMapId(id)) throw new Error(`未知的地圖：${id}`);
    const url = assetUrl(WORLD_MAP_FILES[id]);
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
    const map = parseMap(json);
    if (map.id !== id) throw new Error(`地圖檔 ${url} 的 id 是 "${map.id}"，應為 "${id}"`);
    this.mapCache.set(id, map);
    return map;
  }

  // --- quests ----------------------------------------------------------------------------------

  /** Feeds a world happening to the quest log and shows what it changed. */
  private questHappened(happening: QuestHappening): void {
    this.handleQuestEvents(this.quests.report(happening));
  }

  private handleQuestEvents(events: readonly QuestEvent[]): void {
    if (events.length === 0) return;
    let text: string | null = null;
    for (const e of events) {
      const def = QUESTS[e.quest]!;
      if (e.type === 'progress' && e.target > 1) {
        text = `${def.title}：${def.objectives[e.objective]!.label}（${e.current}/${e.target}）`;
      } else if (e.type === 'objectiveDone') {
        text = `${def.title}：${def.objectives[e.objective]!.label} ✓`;
      } else if (e.type === 'ready') {
        text = `任務可交付：${def.title}（回報${getNpc(def.turnIn ?? def.giver).name}）`;
      }
    }
    if (text) this.notify(text);
    this.refreshQuests();
  }

  private startQuest(id: string): void {
    const def = this.quests.start(id);
    if (!def) return;
    for (const f of def.startFlags ?? []) this.setFlag(f, true);
    this.notify(`任務開始：${def.title}`);
    this.refreshQuests();
  }

  private completeQuest(id: string): void {
    const def = this.quests.complete(id);
    const w = this.world;
    if (!def || !w) return;
    for (const f of def.rewards.flags ?? []) this.setFlag(f, true);
    for (const reward of def.rewards.items) {
      for (let i = 0; i < reward.count; i++) {
        const item = generateItem(reward.rarity, defaultRng);
        // A full backpack must never lose a reward: it drops at the player's feet instead.
        if (!w.inventory.add(item).ok) w.groundLoot.spawnNear(item, w.player.pos.x, w.player.pos.y);
      }
    }
    this.notify(`任務完成：${def.title}`);
    if (def.rewards.xp > 0) this.gainXp(def.rewards.xp);
    this.refreshQuests();
  }

  /** Publishes the quest list and puts "!" / "?" over the NPCs who have something to offer or take in. */
  private refreshQuests(): void {
    this.publish({ quests: this.quests.views() });
    this.world?.npcs.setMarkers((npcId) => {
      if (this.quests.readyFor(npcId).length > 0) return '?';
      if (this.quests.availableFrom(npcId).length > 0) return '!';
      return null;
    });
  }

  // --- NPCs and dialogue ---------------------------------------------------------------------

  /** A name tag was clicked: walk over and talk. */
  private requestTalk(npc: Npc): void {
    const w = this.world;
    if (!w || w.player.isDead || this.dialogue || this.transition) return;
    this.talkTarget = npc;
    this.pickupTarget = null;
  }

  private startTalk(npc: Npc): void {
    const w = this.world;
    if (!w || w.player.isDead || this.dialogue) return;
    this.talkTarget = null;
    this.questHappened({ type: 'talk', npc: npc.def.id });
    w.player.mover.stop();
    this.setInventoryOpen(false);
    this.setQuestLogOpen(false);
    this.setWorldMapOpen(false);
    const ctx = this.currentDialogueContext();
    const conversation = npc.def.conversation;
    // The first meeting plays the intro by itself; after that the topic menu opens.
    const intro = needsIntro(conversation, ctx) ? new DialogueRunner(getDialogue(conversation.intro.graph), ctx, npc.def.name) : null;
    this.dialogue = { runner: intro, npc: npc.def, name: npc.def.name, pos: npc.pos };
    this.publishDialogue();
  }

  /** A tag on a thing to examine was clicked: walk over and examine it. */
  private requestInteract(it: Interactable): void {
    const w = this.world;
    if (!w || w.player.isDead || this.dialogue || this.transition) return;
    this.interactTarget = it;
    this.talkTarget = null;
    this.pickupTarget = null;
  }

  private startInteract(it: Interactable): void {
    const w = this.world;
    if (!w || w.player.isDead || this.dialogue || !it.visible) return;
    this.interactTarget = null;
    if (it.def.reportOnUse) this.questHappened({ type: 'interact', target: it.def.id });
    const graphId = pickDialogue(it.def.dialogue, this.currentDialogueContext());
    if (!graphId) return;
    w.player.mover.stop();
    this.setInventoryOpen(false);
    this.setQuestLogOpen(false);
    this.setWorldMapOpen(false);
    this.dialogue = {
      runner: new DialogueRunner(getDialogue(graphId), this.currentDialogueContext(), it.def.name),
      npc: null,
      name: it.def.name,
      pos: it.pos,
    };
    this.publishDialogue();
  }

  /** Ends the chapter: the end screen opens (the player can dismiss it and keep exploring). */
  private endChapter(): void {
    this.setFlag('chapter1_complete', true);
    this.publish({ chapterEnd: true });
  }

  dismissChapterEnd = (): void => {
    this.publish({ chapterEnd: false });
  };

  /** The dialogue context with the live character level. */
  private currentDialogueContext(): DialogueContext {
    return {
      hasFlag: (name) => this.flags.has(name),
      setFlag: (name, on) => this.setFlag(name, on),
      level: this.progression.level,
      mapId: this.mapId,
      questState: (id) => this.quests.state(id),
      startQuest: (id) => this.startQuest(id),
      completeQuest: (id) => this.completeQuest(id),
      reportInteract: (target) => this.questHappened({ type: 'interact', target }),
      endChapter: () => this.endChapter(),
    };
  }

  advanceDialogue = (): void => {
    const d = this.dialogue;
    if (!d?.runner) return;
    d.runner.advance();
    this.afterDialogueStep();
  };

  chooseDialogueOption = (index: number): void => {
    const d = this.dialogue;
    if (!d?.runner) return;
    d.runner.choose(index);
    this.afterDialogueStep();
  };

  /** Picks an entry of the NPC's topic menu (by its index in the snapshot's `topics`). */
  chooseDialogueTopic = (index: number): void => {
    const d = this.dialogue;
    if (!d || d.runner || !d.npc) return;
    const ctx = this.currentDialogueContext();
    const topic = visibleTopics(d.npc.conversation, ctx)[index];
    if (!topic) return;
    d.runner = new DialogueRunner(getDialogue(topic.graph), ctx, d.npc.name);
    this.afterDialogueStep();
  };

  closeDialogue = (): void => this.endDialogue();

  private afterDialogueStep(): void {
    const d = this.dialogue;
    if (!d) return;
    if (d.runner?.finished) {
      // an NPC goes back to its menu (it now reflects whatever the conversation changed); anything else just ends
      if (!d.npc) {
        this.endDialogue();
        return;
      }
      d.runner = null;
    }
    this.publishDialogue();
  }

  private endDialogue(): void {
    this.talkTarget = null;
    this.interactTarget = null;
    if (!this.dialogue) return;
    this.dialogue.runner?.close();
    if (this.dialogue.npc) this.talkVisits.set(this.dialogue.npc.id, (this.talkVisits.get(this.dialogue.npc.id) ?? 0) + 1);
    this.dialogue = null;
    this.publish({ dialogue: null });
  }

  private publishDialogue(): void {
    const d = this.dialogue;
    if (!d) {
      this.publish({ dialogue: null });
      return;
    }
    const npc = d.npc;
    const base = { npcName: d.name, title: npc?.title ?? null, portrait: npc?.portrait ?? null };
    if (!d.runner) {
      // the topic menu
      if (!npc) {
        this.publish({ dialogue: null });
        return;
      }
      const topics = visibleTopics(npc.conversation, this.currentDialogueContext());
      this.publish({
        dialogue: {
          ...base,
          speaker: npc.name,
          text: greetingFor(npc.conversation, this.talkVisits.get(npc.id) ?? 0),
          choices: null,
          last: false,
          topics: topics.map((t: NpcTopic) => ({ label: t.label, kind: t.kind, mark: TOPIC_MARK[t.kind] })),
        },
      });
      return;
    }
    const view = d.runner.view;
    if (!view) {
      this.afterDialogueStep();
      return;
    }
    this.publish({ dialogue: { ...base, ...view, topics: null } });
  }

  // --- changing maps ---------------------------------------------------------------------------

  /** Flags are plain on/off switches for world progress. */
  hasFlag(name: string): boolean {
    return this.flags.has(name);
  }
  setFlag(name: string, on = true): void {
    if (on) this.flags.add(name);
    else this.flags.delete(name);
  }

  /** Starts moving the player to an entrance of another map (fade out, swap, fade in). Returns false if it cannot start. */
  travelTo = (mapId: string, entrance: string): boolean => {
    if (this.transition || !this.world || this.world.player.isDead) return false;
    const tr: Transition = { phase: 'out', t: 0, mapId, entrance, map: null, failed: false };
    this.transition = tr;
    this.loadMapData(mapId).then(
      (map) => {
        tr.map = map;
      },
      (err) => {
        console.error(err);
        tr.failed = true;
      },
    );
    return true;
  };

  private tickTransition(dt: number): void {
    const tr = this.transition;
    if (!tr) return;
    tr.t += dt;
    if (tr.phase === 'out') {
      this.publish({ fade: Math.min(1, tr.t / FADE_SECONDS) });
      if (tr.t < FADE_SECONDS) return;
      if (tr.failed) {
        this.notify('無法載入地圖。');
      } else if (tr.map) {
        this.swapMap(tr.map, tr.entrance);
      } else {
        return; // still loading: stay black
      }
      tr.phase = 'in';
      tr.t = 0;
    } else {
      this.publish({ fade: Math.max(0, 1 - tr.t / FADE_SECONDS) });
      if (tr.t >= FADE_SECONDS) this.transition = null;
    }
  }

  /** Replaces the current world with the one for map, carrying the character (inventory, health, level) over. */
  private swapMap(map: MapData, entrance: string): void {
    const old = this.world;
    const assets = this.assets;
    if (!old || !assets) return;
    const debugWasOn = old.debug.visible;
    const at = resolveEntrance(map, entrance);
    if (!at) console.warn(`Map "${map.id}" has no entrance "${entrance}"; using its start.`);

    this.releaseWorld(old, true);
    const world = this.buildWorld(map, assets, { player: old.player, inventory: old.inventory });
    this.world = world;
    this.mapId = map.id;
    this.visitedMaps.add(map.id);
    if (this.worldMapOpen) void this.refreshWorldMap();
    world.player.enterMap(world.collision, at ?? map.spawns.player);
    if (debugWasOn) world.debug.toggle();

    this.pickupTarget = null;
    this.endDialogue();
    this.pendingSkill = null;
    this.telegraphOwner = null;
    this.bossDefeated = false;
    this.syncEquipment();
    this.publishSkills();
    this.cameraCtl.snapTo(worldToSceneX(world.player.pos.x, world.player.pos.y), worldToSceneY(world.player.pos.x, world.player.pos.y));
    this.publish({ mapName: map.name, debug: world.debug.visible });
    this.questHappened({ type: 'reach', map: map.id });
    this.refreshQuests();
    this.publishVitals();
  }

  /** Walking into a portal rectangle changes map, unless a world flag it needs is missing. */
  private checkPortals(w: World, dt: number): void {
    this.portalNoticeTimer = Math.max(0, this.portalNoticeTimer - dt);
    const portal = findPortalAt(w.map, w.player.pos.x, w.player.pos.y);
    if (!portal) return;
    const reason = portalBlockedReason(portal, this.flags);
    if (reason) {
      if (this.portalNoticeTimer === 0) {
        this.notify(reason);
        this.portalNoticeTimer = PORTAL_NOTICE_INTERVAL;
      }
      return;
    }
    this.travelTo(portal.to.map, portal.to.entrance);
  }

  private publishSkills(): void {
    const w = this.world;
    if (!w) return;
    const views: SkillView[] = SKILLS.map((def) => ({
      id: def.id,
      keyLabel: def.keyLabel,
      name: def.name,
      description: def.description,
      remaining: w.player.cooldowns.remainingOf(def.id),
      total: w.player.cooldowns.totalOf(def.id),
      ready: w.player.cooldowns.ready(def.id),
    }));
    this.publish({ skills: views });
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
      level: this.progression.level,
      xp: this.progression.xp,
      xpToNext: this.progression.xpToNext,
      bossDefeated: this.bossDefeated,
      boss: this.bossView(),
    });
  }

  private bossView(): BossView | null {
    const boss = this.world?.monsters.boss;
    if (!boss || !boss.engaged) return null;
    return {
      name: boss.def.name,
      hp: Math.ceil(boss.hp),
      maxHp: boss.maxHp,
      phase: boss.phase,
      phaseCount: (boss.def.phaseThresholds?.length ?? 0) + 1,
    };
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
    const { player, debug, monsters, npcs, interactables, combat, slash, spinFx, slamFx, telegraphFx, novaFx, lightning, numbers, groundLoot, moveMarker } = w;
    const input = this.input;

    if (this.transition) {
      // The world stands still behind the black fade.
      this.tickTransition(dt);
      this.cameraCtl.follow(worldToSceneX(player.pos.x, player.pos.y), worldToSceneY(player.pos.x, player.pos.y), dt);
      return;
    }

    if (input.wasPressed('debug')) {
      debug.toggle();
      this.publish({ debug: debug.visible });
    }
    if (debug.visible && input.wasPressed('debugLoot')) this.debugDropLoot();
    if (debug.visible && input.wasPressed('debugEquip')) this.debugEquipLegendaries();
    if (debug.visible && input.wasPressed('debugReset')) this.debugResetBattlefield();
    if (debug.visible && input.wasPressed('debugTeleport')) this.debugTeleport();
    if (debug.visible && input.wasPressed('debugLevel')) this.debugLevelUp();
    if (debug.visible && input.wasPressed('debugFlag')) this.debugToggleRuinsFlag();

    const talking = this.dialogue !== null;
    if (input.wasPressed('inventory') && !talking) this.toggleInventory();
    if (input.wasPressed('quests') && !talking) this.toggleQuestLog();
    if (input.wasPressed('map') && !talking) this.toggleWorldMap();
    if (input.wasPressed('pause')) {
      if (talking) this.endDialogue();
      else if (this.worldMapOpen) this.setWorldMapOpen(false);
      else if (this.questLogOpen) this.setQuestLogOpen(false);
      else if (this.inventoryOpen) this.setInventoryOpen(false);
    }

    const aim = input.pointerInside
      ? this.cameraCtl.pointerToWorld(input.pointer.x, input.pointer.y, this.aimWorld)
      : null;

    if (!player.isDead && !talking) {
      // wasMousePressed also covers a click whose press and release land within one frame.
      const attackHeld = input.isMouseDown('attack') || input.wasMousePressed('attack');
      const moveHeld = input.isMouseDown('move') || input.wasMousePressed('move');
      // Any fresh gameplay input cancels a pending walk-to-pickup.
      if (attackHeld || moveHeld || input.wasPressed('dodge')) this.pickupTarget = null;

      // Clicking an NPC (rather than the empty ground next to it) means "go and talk".
      const pressedMove = input.wasMousePressed('move');
      const npcAtAim = pressedMove && aim ? npcs.nearest(aim, NPC_CLICK_RADIUS) : null;
      if (attackHeld || input.wasPressed('dodge') || (pressedMove && !npcAtAim)) this.talkTarget = null;
      if (attackHeld || moveHeld || input.wasPressed('dodge')) this.interactTarget = null;
      if (npcAtAim) {
        this.talkTarget = npcAtAim;
        this.pickupTarget = null;
      }

      if (input.wasPressed('dodge')) player.startDodge(aim?.x ?? player.pos.x, aim?.y ?? player.pos.y);

      // Right button: swing toward the cursor (hold to keep swinging). It stops the player in place
      // and takes priority over walking, so holding both never drags the player mid-swing.
      if (attackHeld && aim) player.startAttack(aim.x, aim.y);
      else if (moveHeld && aim && !this.talkTarget && !this.interactTarget) player.moveTo(aim.x, aim.y);

      // F: pick up the nearest item within reach, otherwise talk to the nearest NPC.
      if (input.wasPressed('pickup')) {
        const near = groundLoot.nearest(player.pos, LOOT_CONFIG.keyPickupRange);
        const npcNear = npcs.nearest(player.pos, NPC_TALK_RANGE);
        const thingNear = interactables.nearest(player.pos, INTERACT_RANGE);
        if (near) this.tryPickup(near);
        else if (npcNear) this.startTalk(npcNear);
        else if (thingNear) this.startInteract(thingNear);
      }

      // Walking toward a clicked thing to examine.
      const interactTarget = this.interactTarget;
      if (interactTarget) {
        if (!interactTarget.visible) this.interactTarget = null;
        else if (Math.hypot(interactTarget.pos.x - player.pos.x, interactTarget.pos.y - player.pos.y) <= INTERACT_RANGE) {
          this.startInteract(interactTarget);
        } else if (!player.isSwinging && !player.mover.hasTarget) {
          player.moveTo(interactTarget.pos.x, interactTarget.pos.y);
        }
      }

      // Walking toward a clicked NPC.
      const talkTarget = this.talkTarget;
      if (talkTarget) {
        if (Math.hypot(talkTarget.pos.x - player.pos.x, talkTarget.pos.y - player.pos.y) <= NPC_TALK_RANGE) {
          this.startTalk(talkTarget);
        } else if (!player.isSwinging && !player.mover.hasTarget) {
          player.moveTo(talkTarget.pos.x, talkTarget.pos.y);
        }
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

      // Skills: a key press is remembered briefly so it is not lost while another swing finishes.
      for (const def of SKILLS) {
        if (input.wasPressed(def.action)) this.pendingSkill = { def, timeLeft: SKILL_INPUT_BUFFER };
      }
      const pending = this.pendingSkill;
      if (pending) {
        pending.timeLeft -= dt;
        if (!player.cooldowns.ready(pending.def.id) || pending.timeLeft <= 0) {
          this.pendingSkill = null; // cooling down (the skill bar shows it) or the press expired
        } else if (player.startSkill(pending.def, aim?.x ?? player.pos.x, aim?.y ?? player.pos.y)) {
          this.pendingSkill = null;
          this.pickupTarget = null;
        }
      }
      for (const action of LOCKED_SKILL_ACTIONS) {
        if (input.wasPressed(action)) this.notify(`${action.slice(5)}：技能尚未解鎖`);
      }
    } else {
      this.pickupTarget = null;
      this.pendingSkill = null;
      if (player.isDead) {
        this.talkTarget = null;
        this.interactTarget = null;
      }
    }
    if (talking) {
      // A conversation ends if the player dies or somehow ends up far from the speaker.
      const d = this.dialogue;
      if (player.isDead) this.endDialogue();
      else if (d && Math.hypot(d.pos.x - player.pos.x, d.pos.y - player.pos.y) > NPC_TALK_RANGE + 1.5) this.endDialogue();
    }

    player.update(dt);
    if (!player.isDead) this.checkPortals(w, dt);
    monsters.update(dt, player);
    combat.update(dt);
    monsters.syncViews(dt);
    npcs.update(dt, player.pos);
    interactables.update(dt, (f) => this.flags.has(f));
    slash.update(dt);
    spinFx.update(dt);
    slamFx.update(dt);
    telegraphFx.update(dt);
    novaFx.update(dt);
    // A blast warning disappears if the boss was interrupted or died before it went off.
    if (this.telegraphOwner && this.telegraphOwner.state !== 'attack') {
      telegraphFx.hide();
      this.telegraphOwner = null;
    }
    lightning.update(dt);
    groundLoot.update(dt, this.cameraCtl);
    numbers.update(dt, this.cameraCtl);
    debug.setPlayerCircle(player.pos.x, player.pos.y, player.radius);

    // Cooldown sweeps repaint ~10 times per second while any skill is cooling down (and once more when idle).
    const skillsActive = player.cooldowns.anyActive;
    if (skillsActive || this.skillsWereActive) {
      this.skillTimer += dt;
      if (this.skillTimer >= 0.1 || !skillsActive) {
        this.skillTimer = 0;
        this.publishSkills();
      }
    }
    this.skillsWereActive = skillsActive;

    const haste = player.buffs.moveActive;
    const frenzy = player.buffs.attackActive;
    const poison = player.isPoisoned;
    if (haste !== this.snapshot.buffs.haste || frenzy !== this.snapshot.buffs.frenzy || poison !== this.snapshot.buffs.poison) {
      this.publish({ buffs: { haste, frenzy, poison } });
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
  get currentMapId(): string {
    return this.mapId;
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
