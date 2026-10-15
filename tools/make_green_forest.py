"""Generates public/maps/canglan_forest.json: the Green-Vine Ancient Forest (chapter 2), between the Mist Coast and the town of Qinglan.

Clearings (with a little roughness) joined by winding paths of 3 tiles; everything within two tiles of them is forest, further out is not drawn.
Each clearing has a character: the wolves' den, the glade with the old tablet, the corrupted altar, the apes' grove, the flowers' hollows, and the
boss's arena in the east. The JSON it writes is the source of truth: hand-edits are fine, but they are lost the next time this runs.

Usage: python tools/make_green_forest.py   (from the repository root)
"""
import json
import math
import random
from collections import deque
from pathlib import Path

W, H = 72, 56
SEED = 20261017
rng = random.Random(SEED)

# name: (centre x, centre y, radius)
CLEARINGS = {
    'start': (7, 28, 5),
    'tablet': (23, 28, 5),
    'den': (22, 11, 6),
    'altar': (40, 28, 6),
    'grove': (32, 45, 7),
    'hollow': (46, 11, 5),
    'marsh': (53, 45, 5),
    'arena': (62, 28, 8),
}
LINKS = [('start', 'tablet'), ('tablet', 'altar'), ('tablet', 'den'), ('den', 'hollow'), ('hollow', 'arena'), ('altar', 'arena'), ('altar', 'grove'), ('grove', 'marsh'), ('marsh', 'arena')]

floor = [[False] * W for _ in range(H)]


def carve_disc(cx, cy, r, rough):
    phase = rng.random() * 6.28
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r - 2, cx + r + 3):
            if not (2 <= x < W - 2 and 2 <= y < H - 2):
                continue
            ang = math.atan2(y - cy, x - cx)
            limit = r + rough * math.sin(ang * 3 + phase) + rough * 0.5 * math.sin(ang * 5 + phase * 1.7)
            if math.hypot(x - cx, y - cy) <= limit:
                floor[y][x] = True


for cx, cy, r in CLEARINGS.values():
    carve_disc(cx, cy, r, 1.1)

path_tiles = set()
for a, b in LINKS:
    ax, ay, _ = CLEARINGS[a]
    bx, by, _ = CLEARINGS[b]
    steps = int(math.hypot(bx - ax, by - ay) * 2)
    wob = rng.random() * 6.28
    for i in range(steps + 1):
        t = i / steps
        x = ax + (bx - ax) * t
        y = ay + (by - ay) * t
        # a gentle sideways wander that is zero at both ends
        off = math.sin(t * math.pi * 2 + wob) * 3.0 * math.sin(t * math.pi)
        nx, ny = -(by - ay), bx - ax
        n = math.hypot(nx, ny) or 1
        x += nx / n * off
        y += ny / n * off
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                tx, ty = int(round(x)) + dx, int(round(y)) + dy
                if 2 <= tx < W - 2 and 2 <= ty < H - 2:
                    floor[ty][tx] = True
                    path_tiles.add((tx, ty))

# forest around the floor: within two tiles, trees; the rest stays empty (not drawn)
grid = [[' '] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if floor[y][x]:
            grid[y][x] = '.'
for y in range(H):
    for x in range(W):
        if grid[y][x] == ' ' and any(0 <= x + dx < W and 0 <= y + dy < H and floor[y + dy][x + dx] for dx in range(-2, 3) for dy in range(-2, 3)):
            grid[y][x] = 'T'

# isolated floor specks (from the roughness) would be unreachable: keep only what the start clearing reaches
sx, sy, _ = CLEARINGS['start']
seen = {(sx, sy)}
queue = deque([(sx, sy)])
while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if n not in seen and 0 <= n[0] < W and 0 <= n[1] < H and grid[n[1]][n[0]] == '.':
            seen.add(n)
            queue.append(n)
for y in range(H):
    for x in range(W):
        if grid[y][x] == '.' and (x, y) not in seen:
            grid[y][x] = 'T'


def is_floor(x, y):
    return 0 <= x < W and 0 <= y < H and grid[y][x] == '.'


def clear_around(x, y, r=1):
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            if grid[y + dy][x + dx] == 'T':
                grid[y + dy][x + dx] = '.'


# a few trees standing inside the clearings, away from the paths and the places that matter
keep = [(cx, cy) for cx, cy, _ in CLEARINGS.values()]
for y in range(3, H - 3):
    for x in range(3, W - 3):
        if is_floor(x, y) and (x, y) not in path_tiles and rng.random() < 0.05 and all(math.hypot(x - kx, y - ky) > 2.6 for kx, ky in keep):
            grid[y][x] = 'T'

# ---- what lives where (positions are tiles; a pack is one spawn point) --------------------------------------------------------------
SPAWNS = {
    'green_fang_wolf': [(18, 9), (26, 12), (44, 30), (30, 24), (36, 41)],
    'vine_ape': [(28, 45), (36, 47), (40, 25), (56, 44)],
    'rot_flower': [(20, 28), (43, 10), (49, 12), (48, 45), (33, 42), (58, 26), (36, 30), (24, 8)],
}
ELITE = (31, 43)
BOSS = (66, 28)
START = (7, 28)
for pts in SPAWNS.values():
    for x, y in pts:
        if not is_floor(x, y):
            grid[y][x] = '.'
        clear_around(x, y)
for x, y in [ELITE, BOSS, START]:
    clear_around(x, y, 2)
    grid[y][x] = '.'
TABLET = (23, 29)
ALTAR = (40, 29)
for x, y in (TABLET, ALTAR):
    clear_around(x, y, 1)
    grid[y][x] = '.'
# the doors: an opening in the west and in the east, each 3 tiles tall
for y in (27, 28, 29):
    for x in (3, 4, 5):
        grid[y][x] = '.'
for y in (27, 28, 29):
    for x in (66, 67, 68, 69):
        grid[y][x] = '.'
WEST_PORTAL = (3, 27)
EAST_PORTAL = (69, 27)
# all of those need to be reachable
seen = {START}
queue = deque([START])
while queue:
    x, y = queue.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (x + dx, y + dy)
        if n not in seen and 0 <= n[0] < W and 0 <= n[1] < H and grid[n[1]][n[0]] == '.':
            seen.add(n)
            queue.append(n)
points = [p for pts in SPAWNS.values() for p in pts] + [ELITE, BOSS, TABLET, ALTAR, (WEST_PORTAL[0], WEST_PORTAL[1] + 1), (EAST_PORTAL[0], EAST_PORTAL[1] + 1)]
missing = [p for p in points if p not in seen]
assert not missing, f'unreachable: {missing}'
# the doors need trees behind them so the map stays closed
for y in (26, 30):
    for x in range(1, 7):
        if grid[y][x] == ' ':
            grid[y][x] = 'T'
for y in range(26, 31):
    grid[y][2] = grid[y][2] if grid[y][2] == '.' else 'T'
    grid[y][W - 2] = 'T'
for x in range(65, 71):
    for y in (26, 30):
        if grid[y][x] == ' ':
            grid[y][x] = 'T'

for kind_pts in SPAWNS.values():
    for x, y in kind_pts:
        grid[y][x] = 'm'
grid[ELITE[1]][ELITE[0]] = 'e'
grid[BOSS[1]][BOSS[0]] = 'B'
grid[START[1]][START[0]] = 'P'

# the population list follows the order the spawn points are read in (row by row, left to right)
by_pos = {p: kind for kind, pts in SPAWNS.items() for p in pts}
population = [by_pos[p] for p in sorted(by_pos, key=lambda p: (p[1], p[0]))]

# glowing fungus along the edges of the clearings and paths
decor = []
edge = [(x, y) for y in range(3, H - 3) for x in range(3, W - 3) if is_floor(x, y) and any(grid[y + dy][x + dx] == 'T' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
rng.shuffle(edge)
taken = [START, ELITE, BOSS, TABLET, ALTAR] + [p for pts in SPAWNS.values() for p in pts]
for x, y in edge:
    if len(decor) >= 46:
        break
    if all(math.hypot(x - tx, y - ty) > 2.5 for tx, ty in taken) and all(math.hypot(x - d['x'], y - d['y']) > 3.2 for d in decor):
        decor.append({'kind': 'fungus', 'x': x + 0.5, 'y': y + 0.5})
decor.append({'kind': 'tablet', 'x': TABLET[0] + 0.5, 'y': TABLET[1] - 0.6})
decor.append({'kind': 'altar', 'x': ALTAR[0] + 0.5, 'y': ALTAR[1] - 0.6})

layout = [''.join(row) for row in grid]
data = {
    'id': 'canglan_forest',
    'name': '青藤古林',
    'theme': 'blight',
    'fog': 0.18,
    'legend': {
        'T': 'ancient tree (blocks)',
        '.': 'forest floor',
        ' ': 'void (not walkable, not drawn)',
        'P': 'arrival from the coast',
        'm': 'normal monster spawn (the kind follows population.monsters, in reading order)',
        'e': 'elite spawn (a vine ape)',
        'B': 'boss spawn (the old wood warden, in the arena)',
    },
    'layout': layout,
    'entrances': {'from_coast': {'x': 5, 'y': 28}, 'from_town': {'x': 67, 'y': 28}},
    'portals': [
        {'id': 'to_coast', 'x': WEST_PORTAL[0], 'y': WEST_PORTAL[1], 'w': 1, 'h': 3, 'to': {'map': 'canglan_coast', 'entrance': 'from_forest'}},
        {'id': 'to_town', 'x': EAST_PORTAL[0], 'y': EAST_PORTAL[1], 'w': 1, 'h': 3, 'to': {'map': 'qinglan_town', 'entrance': 'from_forest'},
         'requiresFlag': 'canglan_forest_boss_defeated', 'blockedText': '林子深處的路被古老的樹根封死了，過不去。（擊敗古木巡守者之後才會通。）'},
    ],
    'population': {'monsters': population, 'elites': ['vine_ape'], 'boss': 'old_wood_warden'},
    'decor': decor,
    'interactables': [{'id': 'forest_tablet', 'x': TABLET[0], 'y': TABLET[1]}, {'id': 'forest_altar', 'x': ALTAR[0], 'y': ALTAR[1]}],
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'canglan_forest.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}, {len(population)} monsters, {len(decor)} decor')
print('\n'.join(layout))
