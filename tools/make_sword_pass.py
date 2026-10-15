"""Generates public/maps/broken_sword_pass.json: the Broken-Sword Mountain Pass (chapter 2), the cliff road from Qinglan Town to the inland.

A winding canyon road with two side pockets (a ruined watch-post and the old battlefield with the broken giant sword) and, at its east end,
the arena of the colossus. Cliffs ("#") line the road; boulders and loose rubble stand in it. The JSON it writes is the source of truth:
hand-edits are fine, but they are lost the next time this runs.

Usage: python tools/make_sword_pass.py   (from the repository root)
"""
import json
import math
import random
from collections import deque
from pathlib import Path

W, H = 80, 46
SEED = 20261018
rng = random.Random(SEED)
floor = [[False] * W for _ in range(H)]
road = set()


def carve_disc(cx, cy, r, rough=1.0):
    phase = rng.random() * 6.28
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            if not (4 <= x < W - 4 and 4 <= y < H - 4):
                continue
            ang = math.atan2(y - cy, x - cx)
            if math.hypot(x - cx, y - cy) <= r + rough * math.sin(ang * 3 + phase):
                floor[y][x] = True


def carve_line(points, half):
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        steps = int(math.hypot(bx - ax, by - ay) * 2)
        for i in range(steps + 1):
            t = i / steps
            x = ax + (bx - ax) * t
            y = ay + (by - ay) * t
            for dx in range(-half, half + 1):
                for dy in range(-half, half + 1):
                    tx, ty = int(round(x)) + dx, int(round(y)) + dy
                    if 4 <= tx < W - 4 and 4 <= ty < H - 4:
                        floor[ty][tx] = True
                        if abs(dx) <= 1 and abs(dy) <= 1:
                            road.add((tx, ty))


MAIN = [(5, 32), (18, 32), (28, 22), (44, 22), (54, 31), (62, 27)]
carve_line(MAIN, 3)
ARENA = (66, 25, 9)
carve_disc(*ARENA, 1.2)
OUTPOST_POCKET = (26, 10, 6)
BATTLEFIELD = (46, 10, 7)
carve_disc(*OUTPOST_POCKET)
carve_disc(*BATTLEFIELD)
carve_line([(27, 22), (26, 12)], 2)
carve_line([(44, 22), (46, 12)], 2)

grid = [[' '] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if floor[y][x]:
            grid[y][x] = '.'
for y in range(H):
    for x in range(W):
        if grid[y][x] == ' ' and any(0 <= x + dx < W and 0 <= y + dy < H and floor[y + dy][x + dx] for dx in range(-2, 3) for dy in range(-2, 3)):
            grid[y][x] = '#'

START = (6, 32)
BOSS = (67, 25)
END = (73, 25)
# the buildings: the watch-post and the sword, as solid blocks
OUTPOST = ('outpost', 23, 7, 4, 3)
SWORD = ('sword', 44, 6, 4, 3)
for _, bx, by, bw, bh in (OUTPOST, SWORD):
    for y in range(by, by + bh):
        for x in range(bx, bx + bw):
            grid[y][x] = '#'

# boulders standing in the road and the pockets
for y in range(5, H - 5):
    for x in range(5, W - 5):
        if grid[y][x] == '.' and rng.random() < 0.06 and all(math.hypot(x - px, y - py) > 4 for px, py in [START, BOSS, END]):
            grid[y][x] = 'T'

SPAWNS = {
    'mountain_blade_wolf': [(14, 32), (36, 22), (50, 26), (24, 15), (57, 31)],
    'exiled_swordsman': [(22, 30), (32, 21), (40, 22), (47, 14), (55, 30), (66, 29)],
    'fallen_cultivator': [(20, 32), (30, 20), (45, 15), (42, 21), (60, 27)],
}
ELITE = (47, 13)
for pts in SPAWNS.values():
    for x, y in pts:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if grid[y + dy][x + dx] == 'T':
                    grid[y + dy][x + dx] = '.'
        assert grid[y][x] in '.T', (x, y, grid[y][x])
        grid[y][x] = '.'
for p in [ELITE, BOSS, END, START, (24, 12), (47, 11)]:
    for dx in (-2, -1, 0, 1, 2):
        for dy in (-2, -1, 0, 1, 2):
            if grid[p[1] + dy][p[0] + dx] == 'T':
                grid[p[1] + dy][p[0] + dx] = '.'
    assert grid[p[1]][p[0]] == '.', p
# the gate in the west
WEST = (4, 31)
for y in (31, 32, 33):
    grid[y][4] = '.'
for y in (30, 34):
    grid[y][4] = '#'
for y in (30, 31, 32, 33, 34):
    grid[y][3] = '#'
# the gate in the east (on to the truce plateau; it opens when the colossus is down)
EAST = (75, 25)
for y in (25, 26, 27):
    assert grid[y][74] == '.', (74, y, grid[y][74])
    grid[y][75] = '.'
for y in (24, 28):
    grid[y][75] = '#'
for y in range(24, 29):
    grid[y][76] = '#'
# reachability
seen = {START}
queue = deque([START])
while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if n not in seen and 0 <= n[0] < W and 0 <= n[1] < H and grid[n[1]][n[0]] == '.':
            seen.add(n)
            queue.append(n)
must = [p for pts in SPAWNS.values() for p in pts] + [ELITE, BOSS, END, (24, 12), (47, 11), (4, 32)]
assert all(p in seen for p in must), [p for p in must if p not in seen]

for pts in SPAWNS.values():
    for x, y in pts:
        grid[y][x] = 'm'
grid[ELITE[1]][ELITE[0]] = 'e'
grid[BOSS[1]][BOSS[0]] = 'B'
grid[START[1]][START[0]] = 'P'
layout = [''.join(r) for r in grid]
rows = [list(r) for r in layout]
for x, y in road:
    if rows[y][x] == '.':
        rows[y][x] = ','
layout = [''.join(r) for r in rows]

by_pos = {p: kind for kind, pts in SPAWNS.items() for p in pts}
population = [by_pos[p] for p in sorted(by_pos, key=lambda p: (p[1], p[0]))]
data = {
    'id': 'broken_sword_pass',
    'name': '斷劍山道',
    'theme': 'mountain',
    'level': 20,  # the recommended level of the area (docs/design/level-system.md)
    'fog': 0.3,
    'legend': {
        '#': 'cliff (blocks); also under the watch-post and the broken sword',
        'T': 'boulder (blocks)',
        ',': 'road',
        '.': 'rock floor',
        ' ': 'void (not walkable, not drawn)',
        'P': 'arrival from the town',
        'm': 'normal monster spawn (the kind follows population.monsters, in reading order)',
        'e': 'elite spawn (an exiled swordsman)',
        'B': 'boss spawn (the broken sword colossus, in the arena)',
    },
    'layout': layout,
    'entrances': {'from_town': {'x': 6, 'y': 32}, 'from_plateau': {'x': 72, 'y': 26}},
    'portals': [
        {'id': 'to_town', 'x': WEST[0], 'y': WEST[1], 'w': 1, 'h': 3, 'to': {'map': 'qinglan_town', 'entrance': 'from_pass'}},
        {
            'id': 'to_plateau', 'x': EAST[0], 'y': EAST[1], 'w': 1, 'h': 3, 'to': {'map': 'truce_plateau', 'entrance': 'from_pass'},
            'requiresFlag': 'broken_sword_pass_boss_defeated', 'blockedText': '巨像還擋在路上。',
        },
    ],
    'buildings': [{'style': s, 'x': x, 'y': y, 'w': w, 'h': h} for s, x, y, w, h in (OUTPOST, SWORD)],
    'population': {'monsters': population, 'elites': ['exiled_swordsman'], 'boss': 'broken_sword_colossus'},
    'interactables': [
        {'id': 'pass_outpost', 'x': 24, 'y': 12},
        {'id': 'pass_sword', 'x': 47, 'y': 11},
        {'id': 'pass_end', 'x': END[0], 'y': END[1]},
    ],
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'broken_sword_pass.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}, {len(population)} monsters')
print('\n'.join(layout))
