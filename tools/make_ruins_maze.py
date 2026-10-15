"""Generates public/maps/pure_ruins.json: the ruins as a maze with a few open rooms, floor spikes, wall arrow slits and torches.

The maze is a randomised depth-first spanning tree over a grid of cells (so every cell can be reached), with a few extra openings knocked
through the walls to make loops. Each cell is 2 x 2 floor tiles and the walls between cells are 1 tile thick. The start room, the hall in the
middle, the exit room and the boss room are carved out of it afterwards. Run it again with the same seed and you get the same map; change SEED
for another one. The JSON it writes is the source of truth: hand-edits are fine, but they are lost the next time this runs.

Usage: python tools/make_ruins_maze.py   (from the repository root)
"""
import json
import random
from collections import deque
from pathlib import Path

SEED = 20261015
CELLS_X, CELLS_Y = 15, 11
PITCH = 3  # two floor tiles and one wall tile
W, H = CELLS_X * PITCH + 1, CELLS_Y * PITCH + 1
EXTRA_OPENINGS = 14  # walls knocked through for loops

# rooms in cells (x0, y0, x1, y1) inclusive
START_ROOM = (0, 0, 1, 1)
HALL = (6, 4, 8, 5)
EXIT_ROOM = (13, 0, 14, 1)
BOSS_ROOM = (12, 8, 14, 10)

rng = random.Random(SEED)
grid = [['#'] * W for _ in range(H)]


def cell_tiles(cx, cy):
    x, y = cx * PITCH + 1, cy * PITCH + 1
    return [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]


def carve(x, y):
    grid[y][x] = '.'


for cy in range(CELLS_Y):
    for cx in range(CELLS_X):
        for x, y in cell_tiles(cx, cy):
            carve(x, y)


def open_between(a, b):
    """Knocks the wall between two neighbouring cells down (two tiles wide)."""
    (ax, ay), (bx, by) = a, b
    if ax != bx:
        x = max(ax, bx) * PITCH
        for y in (ay * PITCH + 1, ay * PITCH + 2):
            carve(x, y)
    else:
        y = max(ay, by) * PITCH
        for x in (ax * PITCH + 1, ax * PITCH + 2):
            carve(x, y)


# the maze: depth-first spanning tree
visited = {(0, 0)}
stack = [(0, 0)]
passages = set()
while stack:
    cx, cy = stack[-1]
    options = [(cx + dx, cy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= cx + dx < CELLS_X and 0 <= cy + dy < CELLS_Y and (cx + dx, cy + dy) not in visited]
    if not options:
        stack.pop()
        continue
    nxt = rng.choice(options)
    open_between((cx, cy), nxt)
    passages.add(frozenset(((cx, cy), nxt)))
    visited.add(nxt)
    stack.append(nxt)

# loops
walls = [((cx, cy), (cx + dx, cy + dy)) for cy in range(CELLS_Y) for cx in range(CELLS_X) for dx, dy in ((1, 0), (0, 1)) if cx + dx < CELLS_X and cy + dy < CELLS_Y]
rng.shuffle(walls)
for a, b in walls:
    if EXTRA_OPENINGS == 0:
        break
    if frozenset((a, b)) in passages:
        continue
    open_between(a, b)
    passages.add(frozenset((a, b)))
    EXTRA_OPENINGS -= 1


def carve_room(room):
    x0, y0, x1, y1 = room
    for y in range(y0 * PITCH + 1, y1 * PITCH + 3):
        for x in range(x0 * PITCH + 1, x1 * PITCH + 3):
            carve(x, y)


for room in (START_ROOM, HALL, EXIT_ROOM, BOSS_ROOM):
    carve_room(room)


def room_box(room):
    x0, y0, x1, y1 = room
    return x0 * PITCH + 1, y0 * PITCH + 1, x1 * PITCH + 2, y1 * PITCH + 2


def in_room(x, y, room):
    bx0, by0, bx1, by1 = room_box(room)
    return bx0 <= x <= bx1 and by0 <= y <= by1


def floor(x, y):
    return 0 <= x < W and 0 <= y < H and grid[y][x] != '#'


# distances from the start, to place things sensibly
sx, sy = 3, 3
dist = {(sx, sy): 0}
queue = deque([(sx, sy)])
while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if floor(*n) and n not in dist:
            dist[n] = dist[(x, y)] + 1
            queue.append(n)
assert all(floor(x, y) == ((x, y) in dist) for y in range(H) for x in range(W)), 'every floor tile must be reachable'

special = [START_ROOM, EXIT_ROOM, BOSS_ROOM]


def free(x, y):
    return grid[y][x] == '.' and not any(in_room(x, y, r) for r in special)


# entrance room: the way back to the forest is a 1 x 3 portal in its west edge
START = (4, 3)
grid[START[1]][START[0]] = 'P'

# crates in the start room, away from the door and the player
for x, y in ((5, 5), (5, 4)):
    grid[y][x] = 'c'

# the exit room: three floor tiles that lead on to the Primordial Core (see the portal below)
EXIT = (42, 3)

# the boss and what it guards
bx0, by0, bx1, by1 = room_box(BOSS_ROOM)
BOSS = (bx0 + 4, by0 + 3)
RELIC = (bx1, by1)
grid[BOSS[1]][BOSS[0]] = 'B'
for x, y in ((bx0 + 1, by0 + 1), (bx0 + 1, by1 - 1), (bx1 - 2, by0 + 1)):
    grid[y][x] = 'c'

# monsters: spread out over the maze, never near the start, never in the special rooms
candidates = [(x, y) for (x, y), d in dist.items() if d > 14 and free(x, y) and all(grid[y + dy][x + dx] != 'c' for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
rng.shuffle(candidates)


def pick(count, min_gap, taken):
    out = []
    for c in candidates:
        if len(out) == count:
            break
        if all(abs(c[0] - o[0]) + abs(c[1] - o[1]) >= min_gap for o in out + taken):
            out.append(c)
    return out


# an elite in the middle of the hall, one more far from the start
hall_x0, hall_y0, hall_x1, hall_y1 = room_box(HALL)
elites = [((hall_x0 + hall_x1) // 2, (hall_y0 + hall_y1) // 2)]
far = [c for c in candidates if dist[c] > 60 and not in_room(c[0], c[1], HALL)]
elites.append(far[0] if far else candidates[0])
monsters = pick(9, 9, list(elites))
for x, y in monsters:
    grid[y][x] = 'm'
for x, y in elites:
    grid[y][x] = 'e'

# crates in the hall
for x, y in ((hall_x0 + 1, hall_y0), (hall_x1 - 1, hall_y1)):
    if grid[y][x] == '.':
        grid[y][x] = 'c'


def blocked(x, y):
    return grid[y][x] in 'cmeBPX' or not floor(x, y)


# ---- traps ---------------------------------------------------------------------------------------------------------
traps = []
spike_tiles = set()


spawn_points = monsters + elites + [START, BOSS]


def add_spikes(x, y, phase):
    # never right beside a monster's spawn point or where the player arrives
    if any(abs(x - sx_) + abs(y - sy_) <= 4 for sx_, sy_ in spawn_points):
        return False
    if grid[y][x] == '.' and (x, y) not in spike_tiles and dist.get((x, y), 0) > 12 and not any(in_room(x, y, r) for r in special):
        spike_tiles.add((x, y))
        traps.append({'kind': 'spikes', 'x': x, 'y': y, 'phase': round(phase, 2)})
        return True
    return False


# gates: both tiles of a doorway between two cells (cannot be walked around, only timed)
doorways = []
for p in passages:
    a, b = tuple(p)
    if a[0] != b[0]:
        x = max(a[0], b[0]) * PITCH
        doorways.append([(x, a[1] * PITCH + 1), (x, a[1] * PITCH + 2)])
    else:
        y = max(a[1], b[1]) * PITCH
        doorways.append([(a[0] * PITCH + 1, y), (a[0] * PITCH + 2, y)])
rng.shuffle(doorways)
gates = 0
for tiles in doorways:
    if gates >= 5:
        break
    if all(grid[y][x] == '.' and dist.get((x, y), 0) > 18 and not any(in_room(x, y, r) for r in special + [HALL]) for x, y in tiles):
        phase = rng.uniform(0, 3.4)
        for x, y in tiles:
            add_spikes(x, y, phase)
        gates += 1
# loose single tiles in corridors
loose = [c for c in dist if grid[c[1]][c[0]] == '.' and dist[c] > 12 and not any(in_room(c[0], c[1], r) for r in special + [HALL])]
rng.shuffle(loose)
singles = 0
for x, y in loose:
    if singles >= 12:
        break
    if all(abs(x - sx_) + abs(y - sy_) > 5 for sx_, sy_ in spike_tiles) and add_spikes(x, y, rng.uniform(0, 3.4)):
        singles += 1

# arrow slits: where a straight corridor of at least 7 tiles ends in a wall, the wall shoots down it (west ends shoot east, north ends shoot south)
used_walls = set()
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if grid[y][x] != '#':
            continue
        for dir_, (dx, dy) in (('e', (1, 0)), ('s', (0, 1))):
            run = 0
            while floor(x + dx * (run + 1), y + dy * (run + 1)) and grid[y + dy * (run + 1)][x + dx * (run + 1)] in '.':
                run += 1
            # the wall behind the slit must be a real end of the corridor
            if run >= 7 and (x, y) not in used_walls and not any(abs(x - ux) + abs(y - uy) < 8 for ux, uy in used_walls):
                if any(in_room(x + dx, y + dy, r) for r in special + [HALL]) or dist.get((x + dx, y + dy), 0) < 14:
                    continue
                if any((x + dx * k, y + dy * k) in spike_tiles for k in range(1, run + 1)):
                    continue
                traps.append({'kind': 'arrow', 'x': x, 'y': y, 'dir': dir_})
                used_walls.add((x, y))
                break

# ---- torches -------------------------------------------------------------------------------------------------------
torches = []
wall_candidates = []
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if grid[y][x] != '#' or (x, y) in used_walls:
            continue
        for dir_, (dx, dy) in (('e', (1, 0)), ('s', (0, 1))):
            if floor(x + dx, y + dy) and grid[y + dy][x + dx] == '.':
                wall_candidates.append((x, y, dir_))
rng.shuffle(wall_candidates)
for x, y, dir_ in wall_candidates:
    if len(torches) >= 26:
        break
    if all(abs(x - t['x']) + abs(y - t['y']) >= 9 for t in torches) and all(abs(x - ux) + abs(y - uy) >= 3 for ux, uy in used_walls):
        torches.append({'x': x, 'y': y, 'dir': dir_})
# always one in the entrance room, one in the boss room and one at the exit
for x, y, d in ((3, 0, 's'), (bx0 + 3, by0 - 1, 's'), (41, 0, 's')):
    if grid[y][x] == '#' and floor(x, y + 1):
        torches.append({'x': x, 'y': y, 'dir': d})

layout = [''.join(row) for row in grid]
data = {
    'id': 'pure_ruins',
    'name': '初胎遺跡',
    'theme': 'ruins',
    'level': 7,  # the recommended level of the area (docs/design/level-system.md)
    'legend': {
        '#': 'wall (blocks movement)',
        '.': 'floor',
        ' ': 'void (not walkable, not drawn)',
        'P': 'player spawn (floor)',
        'm': 'normal monster spawn (floor)',
        'e': 'elite monster spawn (floor)',
        'B': 'boss spawn (floor)',
        'c': 'crate obstacle on floor (blocks movement)',
        'traps': 'spikes: floor tiles that rise on a timer; arrow: a slit in a wall that shoots poisoned arrows along the corridor (see data/mapData.ts)',
    },
    'layout': layout,
    'entrances': {'from_forest': {'x': 3, 'y': 3}, 'from_core': {'x': 42, 'y': 5}},
    'portals': [
        {'id': 'to_forest', 'x': 1, 'y': 2, 'w': 1, 'h': 3, 'to': {'map': 'pure_forest', 'entrance': 'from_ruins'}},
        {'id': 'to_core', 'x': EXIT[0] - 1, 'y': EXIT[1], 'w': 3, 'h': 1, 'to': {'map': 'pure_core', 'entrance': 'from_ruins'},
         'requiresFlag': 'pure_ruins_boss_defeated', 'blockedText': '出口的石門紋絲不動。守衛還在這座遺跡裡。'},
    ],
    'population': {'monsters': ['rock_golem'], 'elites': ['rock_golem'], 'boss': 'ruins_guardian'},
    'interactables': [{'id': 'ruins_relic', 'x': RELIC[0], 'y': RELIC[1]}],
    'traps': traps,
    'torches': torches,
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'pure_ruins.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}, {len(monsters)} monsters, {len(elites)} elites, {sum(t["kind"] == "spikes" for t in traps)} spikes, {sum(t["kind"] == "arrow" for t in traps)} arrow slits, {len(torches)} torches')
print('\n'.join(layout))
