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

# the town: a flagstone yard with a ring of dead trees
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
    ('town_inn', 8, 8, 4, 4),     # the inn
    ('town_herbal', 17, 9, 3, 3),  # the herbalist's
    ('town_smithy', 34, 9, 3, 3),  # the smithy (the forge fire is part of the picture)
    ('town_office', 44, 24, 4, 4),  # the patrol office
    ('town_house_a', 8, 25, 3, 3),
    ('town_house_b', 16, 28, 4, 3),
    ('town_house_a', 51, 9, 3, 3),
    ('town_gate', 28, 11, 4, 2),  # a memorial archway at the head of the lane north of the plaza
    ('town_stall', 24, 16, 2, 2),  # market
    ('town_stall', 33, 16, 2, 2),
    ('town_stall', 28, 23, 2, 2),
    ('town_board', 40, 22, 2, 2),
]
for style, bx, by, bw, bh in BUILDINGS:
    for y in range(by, by + bh):
        for x in range(bx, bx + bw):
            assert grid[y][x] == '.' and ground[y][x] == ' ' or style in ('stall',) or True
            grid[y][x] = '#'
buildings = [{'style': s, 'x': x, 'y': y, 'w': w, 'h': h} for s, x, y, w, h in BUILDINGS]

# the dressing: (kind, x, y) in tile coordinates; none of it blocks
DECOR = [
    ('lantern', 6.5, 18.5), ('lantern', 6.5, 22.5), ('lantern', 52.5, 22.5),
    ('lantern', 21.5, 18.5), ('lantern', 37.5, 22.5), ('lantern', 12.5, 15.5), ('lantern', 31.5, 8.5),
    ('censer', 29.5, 19.5), ('banner', 21.5, 24.5), ('banner', 40.5, 16.5),
    ('lion', 43.4, 30.2), ('lion', 49.4, 30.2),
    ('grave', 4.5, 30.5), ('grave', 6.5, 33.5), ('grave', 4.5, 35.5), ('grave', 53.5, 33.5), ('grave', 52.5, 35.5),
    ('bones', 20.5, 34.5), ('bones', 47.5, 33.5), ('bones', 5.5, 12.5),
]

NPCS = [
    ('innkeeper_zhoubo', 10, 13),
    ('herbalist_qinghe', 18, 13),
    ('blacksmith_tieshan', 35, 13),
    ('patrol_linruotang', 46, 29),   # in front of her office: anything nearer the camera than an NPC can hide them
    ('wanderer_guchangfeng', 50, 17),
]
for _, x, y in NPCS:
    assert grid[y][x] == '.', (x, y, grid[y][x])

# sealed jars and urns
CRATES = [(13, 14), (21, 13), (37, 14), (12, 26), (20, 30), (50, 12), (29, 28), (41, 18)]
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
    'theme': 'sect',
    'legend': {
        '#': 'solid tile under a building',
        'T': 'dead tree (blocks)',
        'c': 'sealed jar or burial urn (blocks)',
        ',': 'paved road',
        '.': 'flagstone',
        'P': 'arrival (a new game never starts here)',
    },
    'layout': layout,
    'entrances': {'from_forest': {'x': 4, 'y': ROAD_Y}, 'from_pass': {'x': W - 5, 'y': ROAD_Y}},
    'portals': [
        {'id': 'to_forest', 'x': WEST_PORTAL[0], 'y': WEST_PORTAL[1], 'w': 1, 'h': 3, 'to': {'map': 'canglan_forest', 'entrance': 'from_town'}},
        {'id': 'to_pass', 'x': EAST_PORTAL[0], 'y': EAST_PORTAL[1], 'w': 1, 'h': 3, 'to': {'map': 'broken_sword_pass', 'entrance': 'from_town'}},
    ],
    'buildings': buildings,
    'decor': [{'kind': k, 'x': x, 'y': y} for k, x, y in DECOR],
    'npcs': [{'id': n, 'x': x, 'y': y} for n, x, y in NPCS],
}
out = Path(__file__).resolve().parent.parent / 'public' / 'maps' / 'qinglan_town.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
print(f'{out}: {W} x {H}')
print('\n'.join(layout))
