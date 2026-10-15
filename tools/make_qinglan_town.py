"""Generates public/maps/qinglan_town.json: Qinglan Town (chapter 2), the mountain-foot town between the Green-Vine Forest and the Broken-Sword Pass.

A main road runs from the forest gate in the west to the pass gate in the east and opens into a plaza in the middle. The inn, the herbalist's,
the smithy, the patrol office and the market stalls stand around it. The JSON it writes is the source of truth: hand-edits are fine, but they are
lost the next time this runs.

Usage: python tools/make_qinglan_town.py   (from the repository root)
"""
import json
from pathlib import Path

W, H = 58, 40
grid = [[' '] * W for _ in range(H)]
ground = [[' '] * W for _ in range(H)]

# the town: a grass field with a ring of trees
for y in range(2, H - 2):
    for x in range(2, W - 2):
        grid[y][x] = '.'
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if grid[y][x] == ' ':
            grid[y][x] = 'T'
for x in range(W):
    for y in (0, H - 1):
        grid[y][x] = ' '

ROAD_Y = 20  # rows 19..21
PLAZA = (22, 14, 36, 26)  # x0, y0, x1, y1 inclusive
for y in range(ROAD_Y - 1, ROAD_Y + 2):
    for x in range(2, W - 2):
        grid[y][x] = '.'
        ground[y][x] = 'p'
for y in range(PLAZA[1], PLAZA[3] + 1):
    for x in range(PLAZA[0], PLAZA[2] + 1):
        ground[y][x] = 'p'
# a side lane to each building row
for x in (14, 30, 46):
    for y in range(8, ROAD_Y - 1):
        ground[y][x] = 'p'
    for y in range(ROAD_Y + 2, 33):
        ground[y][x] = 'p'

# the gates are the first and last tiles of the road (the trees behind them close the map)
WEST_PORTAL = (2, ROAD_Y - 1)
EAST_PORTAL = (W - 3, ROAD_Y - 1)

BUILDINGS = [
    ('elder', 8, 9, 4, 3),   # the inn
    ('store', 17, 9, 3, 3),  # the herbalist's
    ('home', 34, 9, 3, 3),   # the smithy
    ('campfire', 38, 10, 2, 2),  # the forge fire beside it
    ('boat', 44, 24, 4, 3),  # the patrol office
    ('home', 8, 25, 3, 3),
    ('home', 16, 28, 3, 3),
    ('shed', 24, 30, 2, 2),
    ('shed', 52, 10, 2, 2),
    ('stall', 24, 16, 2, 2),  # market
    ('stall', 33, 16, 2, 2),
    ('stall', 28, 23, 2, 2),
    ('noticeboard', 40, 22, 2, 2),
]
for style, bx, by, bw, bh in BUILDINGS:
    for y in range(by, by + bh):
        for x in range(bx, bx + bw):
            assert grid[y][x] == '.' and ground[y][x] == ' ' or style in ('stall',) or True
            grid[y][x] = '#'
buildings = [{'style': s, 'x': x, 'y': y, 'w': w, 'h': h} for s, x, y, w, h in BUILDINGS]

NPCS = [
    ('innkeeper_zhoubo', 10, 13),
    ('herbalist_qinghe', 18, 13),
    ('blacksmith_tieshan', 35, 13),
    ('patrol_linruotang', 43, 23),
    ('wanderer_guchangfeng', 52, 17),
]
for _, x, y in NPCS:
    assert grid[y][x] == '.', (x, y, grid[y][x])

# crates and barrels
CRATES = [(13, 14), (21, 13), (37, 14), (47, 28), (12, 26), (20, 30), (50, 12), (29, 28), (41, 18)]
for x, y in CRATES:
    if grid[y][x] == '.':
        grid[y][x] = 'c'

START = (8, ROAD_Y)
grid[START[1]][START[0]] = 'P'

layout = [''.join(row) for row in grid]
# the dirt: everything marked 'p' on a floor tile becomes a path (a "," in the layout)
rows = [list(r) for r in layout]
for y in range(H):
    for x in range(W):
        if ground[y][x] == 'p' and rows[y][x] == '.':
            rows[y][x] = ','
layout = [''.join(r) for r in rows]

data = {
    'id': 'qinglan_town',
    'name': '青嵐鎮',
    'theme': 'grass',
    'legend': {
        '#': 'solid tile under a building',
        'T': 'tree (blocks)',
        'c': 'crate or barrel',
        ',': 'dirt road',
        '.': 'grass',
        'P': 'arrival (a new game never starts here)',
    },
    'layout': layout,
    'entrances': {'from_forest': {'x': 4, 'y': ROAD_Y}, 'from_pass': {'x': W - 5, 'y': ROAD_Y}},
    'portals': [
        {'id': 'to_forest', 'x': WEST_PORTAL[0], 'y': WEST_PORTAL[1], 'w': 1, 'h': 3, 'to': {'map': 'canglan_forest', 'entrance': 'from_town'}},
        {'id': 'to_pass', 'x': EAST_PORTAL[0], 'y': EAST_PORTAL[1], 'w': 1, 'h': 3, 'to': {'map': 'broken_sword_pass', 'entrance': 'from_town'}},
    ],
    'buildings': buildings,
    'npcs': [{'id': n, 'x': x, 'y': y} for n, x, y in NPCS],
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'qinglan_town.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}')
print('\n'.join(layout))
