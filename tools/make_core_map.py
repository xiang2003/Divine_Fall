"""Generates public/maps/pure_core.json: the Primordial Core, the deepest place under the ruins.

The map is drawn from rooms and corridors (see ROOMS and CORRIDORS), walls are put around every floor tile, then the monsters, the pillars
that stand in the rooms, the torches and the portal back to the ruins are placed. The JSON it writes is the source of truth: hand-edits are
fine, but they are lost the next time this runs.

Usage: python tools/make_core_map.py   (from the repository root)
"""
import json
import random
from pathlib import Path

W, H = 52, 52
SEED = 20261016

grid = [[' '] * W for _ in range(H)]


def carve_rect(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = '.'


def carve_octagon(x0, y0, x1, y1, chamfer):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if abs(x - cx) + abs(y - cy) <= (x1 - x0) / 2 + (y1 - y0) / 2 - chamfer:
                grid[y][x] = '.'


def carve_circle(cx, cy, r):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1:
                grid[y][x] = '.'


# the entrance room (the way back to the ruins is a portal in its west edge), a corridor, the first gallery
carve_rect(3, 3, 12, 10)
carve_rect(13, 5, 22, 7)
carve_rect(23, 2, 40, 13)
# down to the ring chamber
carve_rect(30, 14, 32, 17)
carve_octagon(25, 18, 37, 30, 3)
# west: a corridor to the western gallery, and from it a long way round to the boss chamber
carve_rect(14, 23, 24, 25)
carve_rect(3, 17, 13, 33)
carve_rect(6, 34, 8, 40)
carve_rect(9, 38, 20, 40)
# the boss chamber with the core in the middle, and the short way to it from the ring chamber
carve_circle(26, 43, 7)
carve_rect(25, 31, 27, 36)

# the pillars (the giant stone columns) that stand in the rooms
PILLARS = [(27, 5), (27, 10), (33, 5), (33, 10), (39, 5), (39, 10), (28, 21), (34, 21), (28, 27), (34, 27), (22, 40), (30, 40), (22, 46), (30, 46), (6, 24), (10, 24), (6, 28), (10, 28)]
for x, y in PILLARS:
    assert grid[y][x] == '.', (x, y)
    grid[y][x] = 'T'

START = (6, 6)
BOSS = (26, 39)
CORE = (26, 44)
MONSTERS = [(31, 3), (26, 7), (36, 8), (38, 11), (6, 20), (31, 27), (11, 31), (6, 31), (31, 21), (22, 24)]
ELITES = [(8, 26)]
grid[START[1]][START[0]] = 'P'
grid[BOSS[1]][BOSS[0]] = 'B'
for x, y in MONSTERS:
    assert grid[y][x] == '.', (x, y)
    grid[y][x] = 'm'
for x, y in ELITES:
    assert grid[y][x] == '.', (x, y)
    grid[y][x] = 'e'

# walls around every floor tile
floor_like = '.TPmeB'
for y in range(H):
    for x in range(W):
        if grid[y][x] != ' ':
            continue
        if any(0 <= x + dx < W and 0 <= y + dy < H and grid[y + dy][x + dx] in floor_like for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            grid[y][x] = '#'

# torches on walls that have floor to their east or south
rng = random.Random(SEED)
candidates = []
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if grid[y][x] != '#':
            continue
        for d, (dx, dy) in (('e', (1, 0)), ('s', (0, 1))):
            if grid[y + dy][x + dx] == '.':
                candidates.append((x, y, d))
rng.shuffle(candidates)
torches = []
for x, y, d in candidates:
    if len(torches) >= 24:
        break
    if all(abs(x - t['x']) + abs(y - t['y']) >= 9 for t in torches):
        torches.append({'x': x, 'y': y, 'dir': d})

layout = [''.join(row) for row in grid]
data = {
    'id': 'pure_core',
    'name': '初胎核心',
    'theme': 'core',
    'legend': {
        '#': 'wall (blocks movement)',
        '.': 'floor',
        ' ': 'void (not walkable, not drawn)',
        'T': 'giant stone pillar (blocks)',
        'P': 'player spawn (floor)',
        'm': 'normal monster spawn (floor)',
        'e': 'elite monster spawn (floor)',
        'B': 'boss spawn (floor): the core watcher, in front of the core',
    },
    'layout': layout,
    'entrances': {'from_ruins': {'x': 7, 'y': 6}},
    'portals': [{'id': 'to_ruins', 'x': 3, 'y': 5, 'w': 1, 'h': 3, 'to': {'map': 'pure_ruins', 'entrance': 'from_core'}}],
    'population': {'monsters': ['stone_attendant', 'mask_spirit'], 'elites': ['stone_attendant'], 'boss': 'core_watcher'},
    'decor': [{'kind': 'core', 'x': CORE[0] + 0.5, 'y': CORE[1] + 0.5}],
    'interactables': [{'id': 'primordial_core', 'x': CORE[0], 'y': CORE[1] + 2}],
    'torches': torches,
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'pure_core.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}, {len(MONSTERS)} monsters, {len(ELITES)} elite, {len(torches)} torches')
print('\n'.join(layout))
