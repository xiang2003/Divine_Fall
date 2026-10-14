import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MapParseError, TileType, parseMap, tileAt } from '../src/data/mapData';
import {
  ARROW_AIM_TIME,
  ARROW_COOLDOWN,
  ARROW_RANGE,
  ArrowTrap,
  SPIKE_CYCLE,
  SPIKE_TIMES,
  SpikeTrap,
  inArrowLane,
  spikeStateAt,
} from '../src/systems/hazards';
import { TORCH_DIM, TORCH_FAR, TORCH_NEAR, torchTarget } from '../src/systems/TorchSystem';

const DT = 1 / 60;

describe('spike cycle', () => {
  it('goes hidden, warn, up and loops', () => {
    expect(spikeStateAt(0)).toBe('hidden');
    expect(spikeStateAt(SPIKE_TIMES.hidden - 0.01)).toBe('hidden');
    expect(spikeStateAt(SPIKE_TIMES.hidden + 0.01)).toBe('warn');
    expect(spikeStateAt(SPIKE_TIMES.hidden + SPIKE_TIMES.warn + 0.01)).toBe('up');
    expect(spikeStateAt(SPIKE_CYCLE + 0.01)).toBe('hidden');
    expect(spikeStateAt(-0.01)).toBe('up'); // a negative clock still lands in the cycle
  });
});

describe('SpikeTrap', () => {
  const stand = (x: number, y: number) => ({ pos: { x, y }, isDead: false });

  it('stabs someone standing on it once when it rises, not while it is only warning', () => {
    const trap = new SpikeTrap({ x: 5.5, y: 5.5 });
    const player = stand(5.5, 5.5);
    let stabs = 0;
    let firstStab = -1;
    for (let t = 0; t < SPIKE_CYCLE; t += DT) {
      if (trap.update(DT, player)) {
        stabs++;
        if (firstStab < 0) firstStab = t;
      }
    }
    expect(stabs).toBe(1);
    expect(firstStab).toBeGreaterThanOrEqual(SPIKE_TIMES.hidden + SPIKE_TIMES.warn - 0.05);
  });

  it('stabs again on the next rise', () => {
    const trap = new SpikeTrap({ x: 5.5, y: 5.5 });
    const player = stand(5.5, 5.5);
    let stabs = 0;
    for (let t = 0; t < SPIKE_CYCLE * 2.2; t += DT) if (trap.update(DT, player)) stabs++;
    expect(stabs).toBe(2);
  });

  it('misses someone who is next to it, and stabs someone who steps on while it is up', () => {
    const trap = new SpikeTrap({ x: 5.5, y: 5.5 });
    const player = stand(7, 5.5);
    let stabs = 0;
    let t = 0;
    for (; t < SPIKE_TIMES.hidden + SPIKE_TIMES.warn + 0.2; t += DT) stabs += trap.update(DT, player) ? 1 : 0;
    expect(trap.state).toBe('up');
    expect(stabs).toBe(0);
    player.pos.x = 5.5; // walks onto the raised spikes
    expect(trap.update(DT, player)).toBe(true);
    expect(trap.update(DT, player)).toBe(false);
  });

  it('does not stab the dead, and its phase shifts the timer', () => {
    const early = new SpikeTrap({ x: 1.5, y: 1.5 }, SPIKE_TIMES.hidden + SPIKE_TIMES.warn + 0.05);
    expect(early.state).toBe('up');
    const dead = { pos: { x: 1.5, y: 1.5 }, isDead: true };
    let stabs = 0;
    for (let t = 0; t < SPIKE_CYCLE; t += DT) stabs += early.update(DT, dead) ? 1 : 0;
    expect(stabs).toBe(0);
  });
});

describe('arrow trap', () => {
  const slit = { x: 2.5, y: 5.5 };
  const east = { x: 1, y: 0 };

  it('sees only the lane in front of the slit, within range', () => {
    expect(inArrowLane(slit, east, { x: 6.5, y: 5.5 })).toBe(true);
    expect(inArrowLane(slit, east, { x: 6.5, y: 6.0 })).toBe(true); // half a tile off is still in it
    expect(inArrowLane(slit, east, { x: 6.5, y: 7.5 })).toBe(false); // in the next corridor
    expect(inArrowLane(slit, east, { x: 0.5, y: 5.5 })).toBe(false); // behind the wall
    expect(inArrowLane(slit, east, { x: slit.x + ARROW_RANGE + 1, y: 5.5 })).toBe(false);
  });

  it('notices, glows for the aim time, shoots once, then rests', () => {
    const trap = new ArrowTrap(slit, east);
    const player = { pos: { x: 7, y: 5.5 }, isDead: false };
    expect(trap.update(DT, player, true)).toBe(false);
    expect(trap.state).toBe('aim');
    let shots = 0;
    let t = 0;
    for (; t < ARROW_AIM_TIME + 0.2; t += DT) shots += trap.update(DT, player, true) ? 1 : 0;
    expect(shots).toBe(1);
    expect(trap.state).toBe('rest');
    for (t = 0; t < ARROW_COOLDOWN - 0.3; t += DT) shots += trap.update(DT, player, true) ? 1 : 0;
    expect(shots).toBe(1);
    for (t = 0; t < 0.2; t += DT) trap.update(DT, player, true);
    expect(trap.state).toBe('aim'); // ready again, and the player is still there
  });

  it('shoots even if the player left the lane during the warning, and ignores a player it cannot see', () => {
    const trap = new ArrowTrap(slit, east);
    const player = { pos: { x: 7, y: 5.5 }, isDead: false };
    expect(trap.update(DT, { ...player, pos: { x: 7, y: 5.5 } }, false)).toBe(false);
    expect(trap.state).toBe('idle'); // a wall between them
    trap.update(DT, player, true);
    player.pos.y = 9;
    let shot = false;
    for (let t = 0; t < ARROW_AIM_TIME + 0.1; t += DT) shot ||= trap.update(DT, player, true);
    expect(shot).toBe(true);
  });
});

describe('torches', () => {
  it('burn low far away and bright close by', () => {
    expect(torchTarget(TORCH_FAR + 5)).toBeCloseTo(TORCH_DIM);
    expect(torchTarget(0)).toBe(1);
    expect(torchTarget(TORCH_NEAR)).toBe(1);
    expect(torchTarget((TORCH_NEAR + TORCH_FAR) / 2)).toBeGreaterThan(TORCH_DIM);
    expect(torchTarget((TORCH_NEAR + TORCH_FAR) / 2)).toBeLessThan(1);
  });
});

describe('parseMap: traps and torches', () => {
  const layout = ['#######', '#P....#', '#.....#', '#######'];
  const base = { id: 't', name: 'T', layout };

  it('reads spikes, arrow slits and torches (tile centres, unit directions)', () => {
    const map = parseMap({
      ...base,
      traps: [
        { kind: 'spikes', x: 3, y: 1, phase: 1.5 },
        { kind: 'arrow', x: 0, y: 1, dir: 'e' },
      ],
      torches: [{ x: 3, y: 0, dir: 's' }],
    });
    expect(map.traps).toEqual([
      { kind: 'spikes', pos: { x: 3.5, y: 1.5 }, phase: 1.5 },
      { kind: 'arrow', pos: { x: 0.5, y: 1.5 }, dir: { x: 1, y: 0 } },
    ]);
    expect(map.torches).toEqual([{ pos: { x: 3.5, y: 0.5 }, dir: { x: 0, y: 1 } }]);
  });

  it('maps without hazards have none', () => {
    const map = parseMap(base);
    expect(map.traps).toEqual([]);
    expect(map.torches).toEqual([]);
  });

  it.each([
    ['spikes in a wall', { traps: [{ kind: 'spikes', x: 0, y: 0 }] }, /not on a floor tile/],
    ['an unknown trap', { traps: [{ kind: 'fire', x: 1, y: 1 }] }, /Unknown trap kind/],
    ['an arrow slit on the floor', { traps: [{ kind: 'arrow', x: 2, y: 1, dir: 'e' }] }, /not on a wall tile/],
    ['an arrow slit that faces a wall', { traps: [{ kind: 'arrow', x: 0, y: 0, dir: 's' }] }, /not a floor tile/],
    ['a slit on a side the camera cannot see', { traps: [{ kind: 'arrow', x: 6, y: 1, dir: 'w' }] }, /"e" or "s"/],
    ['a torch without a side', { torches: [{ x: 2, y: 0 }] }, /"e" or "s"/],
    ['a torch on the floor', { torches: [{ x: 2, y: 1, dir: 'e' }] }, /not on a wall tile/],
  ])('rejects %s', (_name, extra, message) => {
    expect(() => parseMap({ ...base, ...extra })).toThrow(MapParseError);
    expect(() => parseMap({ ...base, ...extra })).toThrow(message);
  });
});

describe('public/maps/pure_ruins.json (the maze)', () => {
  const map = parseMap(JSON.parse(readFileSync(new URL('../public/maps/pure_ruins.json', import.meta.url), 'utf8')) as unknown);
  const key = (x: number, y: number) => y * map.width + x;
  const walkable = (x: number, y: number) => tileAt(map, x, y) === TileType.FLOOR && !map.props.some((p) => p.tileX === x && p.tileY === y);

  /** Tiles reachable from the player's start on foot (crates block). */
  const reachable = (() => {
    const seen = new Set<number>();
    const queue = [{ x: Math.floor(map.spawns.player.x), y: Math.floor(map.spawns.player.y) }];
    seen.add(key(queue[0]!.x, queue[0]!.y));
    while (queue.length) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (walkable(nx, ny) && !seen.has(key(nx, ny))) {
          seen.add(key(nx, ny));
          queue.push({ x: nx, y: ny });
        }
      }
    }
    return seen;
  })();

  it('is a mossy maze with an exit, a boss and the golems', () => {
    expect(map.theme).toBe('ruins');
    expect(map.spawns.exit).not.toBeNull();
    expect(map.spawns.boss).not.toBeNull();
    expect(map.population).toEqual({ monsters: ['rock_golem'], elites: ['rock_golem'], boss: 'ruins_guardian' });
    expect(map.traps.filter((t) => t.kind === 'spikes').length).toBeGreaterThanOrEqual(8);
    expect(map.traps.filter((t) => t.kind === 'arrow').length).toBeGreaterThanOrEqual(4);
    expect(map.torches.length).toBeGreaterThanOrEqual(10);
  });

  it('can be walked from the start to the exit, the boss, the relic and every spawn and spike', () => {
    const at = (p: { x: number; y: number }) => reachable.has(key(Math.floor(p.x), Math.floor(p.y)));
    expect(at(map.spawns.exit!)).toBe(true);
    expect(at(map.spawns.boss!)).toBe(true);
    for (const i of map.interactables) expect(at(i.pos), i.id).toBe(true);
    for (const p of [...map.spawns.monsters, ...map.spawns.elites]) expect(at(p)).toBe(true);
    for (const t of map.traps) if (t.kind === 'spikes') expect(at(t.pos)).toBe(true);
  });

  it('keeps hazards away from where the player arrives and from the monsters\' spawn points', () => {
    const spawns = [map.spawns.player, ...map.spawns.monsters, ...map.spawns.elites, map.spawns.boss!, ...Object.values(map.entrances)];
    for (const t of map.traps) {
      if (t.kind !== 'spikes') continue;
      for (const s of spawns) expect(Math.hypot(s.x - t.pos.x, s.y - t.pos.y), `spikes at ${t.pos.x},${t.pos.y}`).toBeGreaterThan(3);
    }
  });

  it('every arrow slit has a clear corridor in front of it to shoot along', () => {
    for (const t of map.traps) {
      if (t.kind !== 'arrow') continue;
      let run = 0;
      while (walkable(Math.floor(t.pos.x + t.dir.x * (run + 1)), Math.floor(t.pos.y + t.dir.y * (run + 1)))) run++;
      expect(run, `slit at ${t.pos.x},${t.pos.y}`).toBeGreaterThanOrEqual(7);
    }
  });
});
