"""Generates public/maps/truce_plateau.json: the Truce Plateau (chapter 2, part two), the high plain at the end of the Broken-Sword Pass.

A wind-scoured plain with a stone road along its middle. In the middle stands the truce stele; in three pockets north, north-west and south-west
lie the three records (the winners', the losers' and the people's); two more pockets (north-east and south) wait for the roads of the next maps;
at the east end is the arena of the nameless general. The JSON it writes is the source of truth: hand-edits are fine, but they are lost the
next time this runs.

Usage: python tools/make_plateau.py   (from the repository root)
"""
import json
import math
import random
from collections import deque
from pathlib import Path

W, H = 96, 64
SEED = 20261024
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


def carve_line(points, half, paved=False):
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        steps = max(1, int(math.hypot(bx - ax, by - ay) * 2))
        for i in range(steps + 1):
            t = i / steps
            x = ax + (bx - ax) * t
            y = ay + (by - ay) * t
            for dx in range(-half, half + 1):
                for dy in range(-half, half + 1):
                    tx, ty = int(round(x)) + dx, int(round(y)) + dy
                    if 4 <= tx < W - 4 and 4 <= ty < H - 4:
                        floor[ty][tx] = True
                        if paved and abs(dx) <= 1 and abs(dy) <= 1:
                            road.add((tx, ty))


START = (7, 32)
PLAZA = (46, 32)
ARENA = (82, 32, 9)
BOSS = (83, 32)
RECORDS = {'plateau_win': (22, 11), 'plateau_lose': (22, 53), 'plateau_folk': (46, 11)}
POCKETS = {'north_east': (70, 11), 'south': (46, 53)}

carve_line([(5, 32), (14, 32)], 2, True)
carve_disc(24, 32, 10)
carve_disc(*PLAZA, 10)
carve_disc(64, 32, 8)
carve_line([(24, 32), (46, 32), (64, 32), (76, 32)], 2, True)
carve_disc(ARENA[0], ARENA[1], ARENA[2], 1.2)
for _, (rx, ry) in RECORDS.items():
    carve_disc(rx, ry, 6)
for px, py in POCKETS.values():
    carve_disc(px, py, 6)
carve_line([(22, 24), (22, 15)], 1, True)
carve_line([(22, 40), (22, 49)], 1, True)
carve_line([(46, 24), (46, 15)], 1, True)
carve_line([(66, 26), (70, 16)], 1, True)
carve_line([(46, 40), (46, 48)], 1, True)

grid = [[' '] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if floor[y][x]:
            grid[y][x] = '.'
for y in range(H):
    for x in range(W):
        if grid[y][x] == ' ' and any(0 <= x + dx < W and 0 <= y + dy < H and floor[y + dy][x + dx] for dx in range(-2, 3) for dy in range(-2, 3)):
            grid[y][x] = '#'

# the truce stele, a solid block in the middle of the plaza
STELE = ('truce_stele', 44, 29, 4, 3)
for y in range(STELE[2], STELE[2] + STELE[4]):
    for x in range(STELE[1], STELE[1] + STELE[3]):
        grid[y][x] = '#'
STELE_USE = (45, 34)

# the gate in the west (back to the pass)
for y in (31, 32, 33):
    grid[y][4] = '.'
for y in (30, 34):
    grid[y][4] = '#'
for y in range(30, 35):
    grid[y][3] = '#'
WEST = (4, 31)

KEEP_CLEAR = [START, BOSS, STELE_USE, (76, 32)]
KEEP_NEAR = list(RECORDS.values()) + list(POCKETS.values())  # a smaller clearing: the pockets are small


def far_from(x, y, points, d):
    return all(math.hypot(x - px, y - py) > d for px, py in points)


# stelae standing in the plain: a ring round the plaza and a scatter elsewhere (never on the road)
for k in range(14):
    ang = k * math.tau / 14 + 0.2
    x, y = round(PLAZA[0] + 8.5 * math.cos(ang)), round(PLAZA[1] + 7.5 * math.sin(ang))
    if grid[y][x] == '.' and (x, y) not in road and far_from(x, y, KEEP_CLEAR + KEEP_NEAR, 3):
        grid[y][x] = 'T'
for y in range(5, H - 5):
    for x in range(5, W - 5):
        if grid[y][x] == '.' and (x, y) not in road and rng.random() < 0.045 and far_from(x, y, KEEP_CLEAR + KEEP_NEAR, 3):
            grid[y][x] = 'T'

# spawn points, picked from the open ground of each region
REGIONS = {
    'west': (24, 32, 9), 'plaza': (46, 32, 9), 'east': (64, 32, 7),
    'win': (22, 11, 5), 'lose': (22, 53, 5), 'folk': (46, 11, 5), 'north_east': (70, 11, 5), 'south': (46, 53, 5),
}
PLAN = [  # (region, kind)
    ('west', 'truce_soldier'), ('west', 'oath_hound'), ('west', 'truce_soldier'), ('west', 'banner_wraith'),
    ('plaza', 'truce_soldier'), ('plaza', 'banner_wraith'), ('plaza', 'oath_hound'), ('plaza', 'truce_soldier'), ('plaza', 'banner_wraith'),
    ('east', 'truce_soldier'), ('east', 'oath_hound'), ('east', 'banner_wraith'), ('east', 'truce_soldier'),
    ('win', 'banner_wraith'), ('win', 'truce_soldier'),
    ('lose', 'truce_soldier'), ('lose', 'oath_hound'),
    ('folk', 'oath_hound'), ('folk', 'truce_soldier'),
    ('north_east', 'banner_wraith'), ('north_east', 'truce_soldier'),
    ('south', 'truce_soldier'), ('south', 'oath_hound'),
]
placed = []
spawns = {}
for region, kind in PLAN:
    cx, cy, r = REGIONS[region]
    for _ in range(400):
        x = cx + rng.randint(-r, r)
        y = cy + rng.randint(-r, r)
        if not (0 <= x < W and 0 <= y < H) or grid[y][x] not in '.T' or math.hypot(x - cx, y - cy) > r:
            continue
        if far_from(x, y, KEEP_CLEAR, 5) and far_from(x, y, KEEP_NEAR, 2.5) and far_from(x, y, placed, 4):
            placed.append((x, y))
            spawns.setdefault(kind, []).append((x, y))
            break
    else:
        raise SystemExit(f'no room for a {kind} in {region}')
ELITES = []
for region in ('north_east', 'south'):
    cx, cy, r = REGIONS[region]
    for _ in range(400):
        x, y = cx + rng.randint(-r, r), cy + rng.randint(-r, r)
        if grid[y][x] in '.T' and math.hypot(x - cx, y - cy) <= r and far_from(x, y, KEEP_CLEAR, 5) and far_from(x, y, KEEP_NEAR, 2.5) and far_from(x, y, placed, 3.5):
            placed.append((x, y))
            ELITES.append((x, y))
            break
    else:
        raise SystemExit(f'no room for the elite of {region}')
for p in [pt for pts in spawns.values() for pt in pts] + ELITES + [BOSS, START] + list(RECORDS.values()) + [STELE_USE]:
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if grid[p[1] + dy][p[0] + dx] == 'T':
                grid[p[1] + dy][p[0] + dx] = '.'
    assert grid[p[1]][p[0]] in '.', (p, grid[p[1]][p[0]])

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
must = [p for pts in spawns.values() for p in pts] + ELITES + [BOSS, STELE_USE, (4, 32)] + list(RECORDS.values()) + list(POCKETS.values())
assert all(p in seen for p in must), [p for p in must if p not in seen]

for pts in spawns.values():
    for x, y in pts:
        grid[y][x] = 'm'
for x, y in ELITES:
    grid[y][x] = 'e'
grid[BOSS[1]][BOSS[0]] = 'B'
grid[START[1]][START[0]] = 'P'
rows = [list(''.join(r)) for r in grid]
for x, y in road:
    if rows[y][x] == '.':
        rows[y][x] = ','
layout = [''.join(r) for r in rows]

by_pos = {p: kind for kind, pts in spawns.items() for p in pts}
population = [by_pos[p] for p in sorted(by_pos, key=lambda p: (p[1], p[0]))]

# decoration: planted weapons by the soldiers, a torn flag by every wraith, bones here and there
decor = []
for kind, deco in (('truce_soldier', 'weapons'), ('banner_wraith', 'flagpole')):
    for x, y in spawns[kind]:
        decor.append({'kind': deco, 'x': x + 1.5, 'y': y + 0.5})
for _ in range(14):
    for _ in range(50):
        x, y = rng.randint(6, W - 7), rng.randint(6, H - 7)
        if grid[y][x] == '.' and far_from(x, y, KEEP_CLEAR + KEEP_NEAR + placed, 2.5):
            decor.append({'kind': rng.choice(['bones', 'weapons', 'flagpole', 'bones']), 'x': x + 0.5, 'y': y + 0.5})
            break
for key, kind in (('plateau_win', 'record_win'), ('plateau_lose', 'record_lose'), ('plateau_folk', 'record_folk')):
    rx, ry = RECORDS[key]
    decor.append({'kind': kind, 'x': rx + 0.5, 'y': ry + 0.5})

data = {
    'id': 'truce_plateau',
    'name': '停戰碑原',
    'theme': 'plateau',
    'level': 24,  # the recommended level of the area (docs/design/level-system.md)
    'fog': 0.18,
    'legend': {
        '#': 'cliff (blocks); also under the truce stele',
        'T': 'a weathered stele standing in the plain (blocks)',
        ',': 'old paved road',
        '.': 'windswept ground',
        ' ': 'void (not walkable, not drawn)',
        'P': 'arrival from the pass',
        'm': 'normal monster spawn (the kind follows population.monsters, in reading order)',
        'e': 'elite spawn (a soldier of the truce field)',
        'B': 'boss spawn (the nameless general, in the arena)',
    },
    'layout': layout,
    'entrances': {'from_pass': {'x': START[0], 'y': START[1]}},
    'portals': [{'id': 'to_pass', 'x': WEST[0], 'y': WEST[1], 'w': 1, 'h': 3, 'to': {'map': 'broken_sword_pass', 'entrance': 'from_plateau'}}],
    'buildings': [{'style': STELE[0], 'x': STELE[1], 'y': STELE[2], 'w': STELE[3], 'h': STELE[4]}],
    'decor': decor,
    'population': {'monsters': population, 'elites': ['truce_soldier'], 'boss': 'nameless_general'},
    'interactables': [{'id': k, 'x': x, 'y': y} for k, (x, y) in RECORDS.items()] + [{'id': 'plateau_stele', 'x': STELE_USE[0], 'y': STELE_USE[1]}],
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'truce_plateau.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}, {len(population)} spawn points, {len(decor)} decor')
print('\n'.join(layout))
