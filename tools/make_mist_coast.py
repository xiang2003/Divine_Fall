"""Generates public/maps/canglan_coast.json: the Mist Coast, where the ferry of chapter 1 lands (chapter 2).

A beach with a sea on its west, rocks along the shore, a wrecked ship, and wet woods inland (the "grass" mask of the file). The monsters are placed by
kind and place: spirits wait at the water's edge, wolves and boars stay in the woods, the revenants stand around the wreck. The seed is tried
until every spawn can be walked to. The JSON it writes is the source of truth: hand-edits are fine, but they are lost the next time this runs.

Usage: python tools/make_mist_coast.py   (from the repository root)
"""
import json
import math
import random
from collections import deque
from pathlib import Path

W, H = 60, 46
START = (9, 37)
EAST_GATE = (W - 5, 22)  # the middle tile of the 1 x 3 portal into the forest
WRECK = (21, 25, 5, 3)  # x, y, w, h of the wreck's footprint
TRACE = (19, 23)


def shore(y):
    """The x of the last water tile on row y."""
    return max(5, 15 + round(2.5 * math.sin(y * 0.45)) - max(0, y - 22) * 0.9 // 1)


def woods_edge(y):
    """The x where the wet woods begin on row y."""
    return 36 + round(3 * math.sin(y * 0.3))


def build(seed):
    rng = random.Random(seed)
    grid = [[' '] * W for _ in range(H)]
    grass = [[' '] * W for _ in range(H)]
    for y in range(2, H - 2):
        for x in range(2, W - 2):
            if x <= shore(y):
                grid[y][x] = 'W'
            elif x >= woods_edge(y):
                grid[y][x] = '.'
                grass[y][x] = 'g'
            else:
                grid[y][x] = '.'
    # an outer ring that nothing can cross: rocks on the beach, trees in the woods
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if grid[y][x] == ' ' and any(grid[y + dy][x + dx] in '.W' for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                grid[y][x] = 'T'
                if x >= woods_edge(y):
                    grass[y][x] = 'g'
    for x in range(2, W - 2):  # the ring along the top and bottom of the beach and woods
        for y in (2, H - 3):
            if grid[y][x] == '.':
                grid[y][x] = 'T'
    for y in range(2, H - 2):
        for x in (W - 3,):
            if grid[y][x] == '.':
                grid[y][x] = 'T'

    def free(x, y):
        return 0 <= x < W and 0 <= y < H and grid[y][x] == '.'

    # the wreck
    wx, wy, ww, wh = WRECK
    for y in range(wy, wy + wh):
        for x in range(wx, wx + ww):
            grid[y][x] = '#'
    # rocks along the shore, rocks and trees here and there
    for y in range(3, H - 3):
        for x in range(3, W - 4):
            if not free(x, y):
                continue
            near_water = any(0 <= x + dx < W and 0 <= y + dy < H and grid[y + dy][x + dx] == 'W' for dx in range(-3, 4) for dy in range(-3, 4))
            in_woods = grass[y][x] == 'g'
            p = 0.2 if in_woods else (0.07 if near_water else 0.012)
            if rng.random() < p and abs(x - START[0]) + abs(y - START[1]) > 5:
                grid[y][x] = 'T'
    # spirits: floor tiles right beside the water, spread out along the northern beach
    shoreline = [(x, y) for y in range(6, 32) for x in range(3, W - 4) if free(x, y) and any(grid[y + dy][x + dx] == 'W' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    rng.shuffle(shoreline)
    spirits = []
    for p in shoreline:
        if len(spirits) < 5 and all(abs(p[0] - q[0]) + abs(p[1] - q[1]) > 9 for q in spirits):
            spirits.append(p)
    wolves = [(44, 9), (49, 23), (41, 36)]
    boars = [(40, 16), (46, 30), (53, 13)]
    revenants = [(19, 29), (28, 23), (25, 31)]
    elites = [(29, 28)]
    spawns = {'wild_wolf': wolves, 'cleft_boar': boars, 'drowned_spirit': spirits, 'wreck_revenant': revenants}
    for pts in list(spawns.values()) + [elites]:
        for x, y in pts:
            if grid[y][x] != '.':
                grid[y][x] = '.'  # clear a rock or tree that happens to be on the spot
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):  # and a little room around it
                    if grid[y + dy][x + dx] == 'T':
                        grid[y + dy][x + dx] = '.'
    # the landing: clear the shore around the start
    for y in range(START[1] - 3, START[1] + 4):
        for x in range(6, START[0] + 5):
            if grid[y][x] == 'T':
                grid[y][x] = '.'
    grid[TRACE[1]][TRACE[0]] = '.'
    # the way inland: an opening in the trees at the east edge, to the green-vine forest
    for y in range(EAST_GATE[1] - 2, EAST_GATE[1] + 3):
        for x in range(W - 9, W - 3):
            if grid[y][x] in 'T':
                grid[y][x] = '.'
            if grid[y][x] == '.':
                grass[y][x] = 'g'
    return grid, grass, spawns, elites


def reachable_all(grid, points):
    seen = {START}
    queue = deque([START])
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and 0 <= n[0] < W and 0 <= n[1] < H and grid[n[1]][n[0]] == '.':
                seen.add(n)
                queue.append(n)
    return all(p in seen for p in points)


seed = 1
while True:
    grid, grass, spawns, elites = build(seed)
    all_points = [p for pts in spawns.values() for p in pts] + elites + [TRACE, (START[0] - 1, START[1]), EAST_GATE, (EAST_GATE[0] - 2, EAST_GATE[1])]
    if reachable_all(grid, all_points):
        break
    seed += 1

# markers: P, m (every monster spawn), e
for pts in spawns.values():
    for x, y in pts:
        grid[y][x] = 'm'
for x, y in elites:
    grid[y][x] = 'e'
grid[START[1]][START[0]] = 'P'

# the population list follows the order the spawns are read in (row by row, left to right)
by_pos = {p: kind for kind, pts in spawns.items() for p in pts}
order = sorted(by_pos, key=lambda p: (p[1], p[0]))
population = [by_pos[p] for p in order]

layout = [''.join(row) for row in grid]
data = {
    'id': 'canglan_coast',
    'name': '迷霧海岸',
    'theme': 'mist',
    'fog': 0.85,
    'legend': {
        '#': 'solid tile under a building (the wreck)',
        'T': 'rock on the beach, tree in the woods (the "grass" mask says which)',
        'W': 'sea (blocks walking, not sight)',
        '.': 'sand or grass (the "grass" mask says which)',
        'P': 'arrival from the ferry',
        'm': 'normal monster spawn (the kind follows population.monsters, in reading order)',
        'e': 'elite spawn',
    },
    'layout': layout,
    'grass': [''.join(row) for row in grass],
    'entrances': {'from_island': {'x': START[0] - 1, 'y': START[1]}, 'from_forest': {'x': EAST_GATE[0] - 2, 'y': EAST_GATE[1]}},
    'portals': [
        {'id': 'to_island', 'x': 6, 'y': START[1] - 1, 'w': 1, 'h': 3, 'to': {'map': 'pure_coast', 'entrance': 'ferry_side'}},
        {'id': 'to_forest', 'x': EAST_GATE[0], 'y': EAST_GATE[1] - 1, 'w': 1, 'h': 3, 'to': {'map': 'canglan_forest', 'entrance': 'from_coast'}},
    ],
    'buildings': [{'style': 'wreck', 'x': WRECK[0], 'y': WRECK[1], 'w': WRECK[2], 'h': WRECK[3]}],
    'population': {'monsters': population, 'elites': ['wreck_revenant']},
    'decor': [{'kind': 'anchor', 'x': 27.5, 'y': 26.5}],
    'interactables': [{'id': 'mist_trace', 'x': TRACE[0], 'y': TRACE[1]}],
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'canglan_coast.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}, seed {seed}, spawns {dict((k, len(v)) for k, v in spawns.items())}')
print('\n'.join(layout))
