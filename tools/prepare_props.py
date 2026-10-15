"""Builds the generated map props (the village well, the beach boulders, the stranded ferry, the cave's crystals, moss and vines) from the pictures in docs/art/props.

Usage:  python tools/prepare_props.py [<name> ...] [--preview <dir>]   (no names: every prop)
Needs Pillow. Developer tool only; the game never runs it.

The pictures were made with Z-Image-Turbo (see docs/art/prop-prompts.json) in the same look as the third-party 3D-rendered cabins and
trees: an isometric object on a flat magenta background. Each is cut out with a colour key (see cut_out): the magenta reachable from the
picture's border is removed, cast shadow included, and the magenta fringe on the edge is pulled out; the picture is cropped to
its outline, scaled to the size it has in the game (the game shows them at half size, like the cabins) and written to public/assets/.
The printed `anchorY` is the fraction of the picture's height from its bottom up to the middle of the object's footprint on the ground
(a guess from the picture; see ANCHOR below), and goes into src/game/BuildingArt.ts for the well and the ferry.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'art' / 'props'
OUT = ROOT / 'public' / 'assets'

# name -> (source file, output file under public/assets, width in picture pixels (the game shows it at half), anchorY, optional colour key: 'orange' instead of magenta, optional smallest gap in pixels that counts as background)
PROPS = {
    'well': ('well.webp', 'buildings/well.png', 130, 0.17),
    'ferry': ('ferry.webp', 'buildings/ferry.png', 520, 0.27),
    'boulder_0': ('boulder_0.webp', 'props/boulder_0.png', 170, 0.27),
    'boulder_1': ('boulder_1.webp', 'props/boulder_1.png', 170, 0.27),
    'boulder_2': ('boulder_2.webp', 'props/boulder_2.png', 170, 0.27),
    # the spring cave and the ruins (the crystals stand in the place of the cave's rock pillars)
    'crystal_0': ('crystal_0.webp', 'props/crystal_0.png', 170, 0.2, 'orange'),
    'crystal_1': ('crystal_1.webp', 'props/crystal_1.png', 170, 0.2, 'orange'),
    'crystal_2': ('crystal_2.webp', 'props/crystal_2.png', 170, 0.2, 'orange'),
    # the Primordial Core: giant pillars (the "T" tiles), floating shards (drawn on orange), root tangles and the core itself
    'core_pillar_0': ('core_pillar_0.webp', 'props/core_pillar_0.png', 130, 0.14),
    'core_pillar_1': ('core_pillar_1.webp', 'props/core_pillar_1.png', 130, 0.14),
    'shard_a': ('shard_a.webp', 'props/decor_shard_a.png', 90, 0.5, 'orange'),
    'shard_b': ('shard_b.webp', 'props/decor_shard_b.png', 90, 0.5, 'orange'),
    'roots_a': ('roots_a.webp', 'props/decor_roots_a.png', 220, 0.3),
    'roots_b': ('roots_b.webp', 'props/decor_roots_b.png', 220, 0.3),
    'core': ('core.webp', 'props/decor_core.png', 240, 0.15),
    # chapter 2: the forest (glowing mushrooms, the stele, the corrupted altar), the pass (the broken sword, the watch-post) and the town (stall, bounty board)
    'tablet_a': ('tablet_a.webp', 'props/decor_tablet_a.png', 120, 0.14, 'auto'),
    'altar_a': ('altar_a.webp', 'props/decor_altar_a.png', 200, 0.22, 'auto'),
    'sword': ('sword.webp', 'buildings/sword.png', 330, 0.2, 'auto'),
    'outpost': ('outpost.webp', 'buildings/outpost.png', 380, 0.2, 'auto'),
    'stall': ('stall.webp', 'buildings/stall.png', 190, 0.2, 'auto'),
    'noticeboard': ('noticeboard.webp', 'buildings/noticeboard.png', 190, 0.2, 'auto'),
    # the xianxia look of chapter 2 (docs/art/chapter2-art-direction.md): the buildings of Qinglan Town
    'town_inn': ('town_inn.webp', 'buildings/town_inn.png', 470, 0.2, 'auto'),
    'town_herbal': ('town_herbal.webp', 'buildings/town_herbal.png', 340, 0.2, 'auto'),
    'town_smithy': ('town_smithy.webp', 'buildings/town_smithy.png', 340, 0.2, 'auto'),
    'town_office': ('town_office.webp', 'buildings/town_office.png', 500, 0.2, 'auto'),
    'town_house_a': ('town_house_a.webp', 'buildings/town_house_a.png', 330, 0.2, 'auto'),
    'town_house_b': ('town_house_b.webp', 'buildings/town_house_b.png', 400, 0.2, 'auto'),
    'town_gate': ('town_gate.webp', 'buildings/town_gate.png', 380, 0.2, 'auto'),
    'town_stall': ('town_stall.webp', 'buildings/town_stall.png', 210, 0.2, 'auto'),
    'town_board': ('town_board.webp', 'buildings/town_board.png', 190, 0.2, 'auto'),
    # obstacles and decor of the dark xianxia look: dead trees (forest, town), sword cairns and pillars (pass), sea rocks (coast)
    'tree_dead_a': ('tree_dead_a.webp', 'props/tree_dead_a.png', 240, 0.1, 'auto'),
    'tree_dead_c': ('tree_dead_c.webp', 'props/tree_dead_c.png', 240, 0.1, 'auto'),
    'tree_dead_e': ('tree_dead_e.webp', 'props/tree_dead_e.png', 240, 0.1, 'auto'),
    'tree_dead_f': ('tree_dead_f.webp', 'props/tree_dead_f.png', 240, 0.1, 'auto'),
    'tree_dead_g': ('tree_dead_g.webp', 'props/tree_dead_g.png', 240, 0.1, 'auto'),
    'spire_a': ('spire_a.webp', 'props/spire_a.png', 230, 0.12, 'auto'),
    'spire_b': ('spire_b.webp', 'props/spire_b.png', 170, 0.1, 'auto'),
    'spire_c': ('spire_c.webp', 'props/spire_c.png', 170, 0.1, 'auto'),
    'rock_sea_a': ('rock_sea_a.webp', 'props/rock_sea_a.png', 210, 0.2, 'auto'),
    'rock_sea_b': ('rock_sea_b.webp', 'props/rock_sea_b.png', 210, 0.2, 'auto'),
    # the solid props of Qinglan Town (they stand on "c" tiles in place of crates and barrels)
    'jar_a': ('jar_a.webp', 'props/prop_jar_a.png', 120, 0.15, 'auto'),
    'jar_b': ('jar_b.webp', 'props/prop_jar_b.png', 130, 0.15, 'auto'),
    'jar_c': ('jar_c.webp', 'props/prop_jar_c.png', 110, 0.15, 'auto'),
    'lantern_stone': ('lantern_stone.webp', 'props/decor_lantern.png', 130, 0.1, 'auto'),
    'censer': ('censer.webp', 'props/decor_censer.png', 170, 0.15, 'auto'),
    'banner_torn': ('banner_torn.webp', 'props/decor_banner.png', 130, 0.08, 'auto'),
    'bones': ('bones.webp', 'props/decor_bones.png', 170, 0.3, 'auto'),
    'grave': ('grave.webp', 'props/decor_grave.png', 150, 0.15, 'auto'),
    'lion_stone': ('lion_stone.webp', 'props/decor_lion.png', 140, 0.1, 'auto'),
    'fungus_c': ('fungus_c.webp', 'props/decor_fungus_c.png', 170, 0.25, 'auto'),
    'fungus_d': ('fungus_d.webp', 'props/decor_fungus_d.png', 170, 0.25, 'auto'),
    # 墜金, the money that monsters drop: three sizes of heap
    'gold_small': ('gold_small.webp', 'props/gold_small.png', 90, 0.3, 'auto'),
    'gold_mid': ('gold_mid.webp', 'props/gold_mid.png', 120, 0.3, 'auto'),
    'gold_big': ('gold_big.webp', 'props/gold_big.png', 160, 0.3, 'auto'),
    # the Mist Coast
    'wreck': ('wreck.webp', 'buildings/wreck.png', 520, 0.3, 'magenta', 60),  # small gaps between the sails and the rigging count as background
    'driftwood_a': ('driftwood_a.webp', 'props/decor_driftwood_a.png', 140, 0.25, 'auto'),
    'driftwood_b': ('driftwood_b.webp', 'props/decor_driftwood_b.png', 140, 0.25, 'auto'),
    'anchor': ('anchor.webp', 'props/decor_anchor.png', 140, 0.2),
    'moss_a': ('moss_a.webp', 'props/decor_moss_a.png', 230, 0.4),
    'moss_b': ('moss_b.webp', 'props/decor_moss_b.png', 230, 0.4),
    'vines_a': ('vines_a.webp', 'props/decor_vines_a.png', 160, 0.25),
    'vines_b': ('vines_b.webp', 'props/decor_vines_b.png', 160, 0.25),
    'vines_c': ('vines_c.webp', 'props/decor_vines_c.png', 160, 0.25),
}
KEY_FULL = 0.26  # "magentaness" (min(red, blue) - green, as a fraction of min(red, blue)) at or above this can be background
KEY_NONE = 0.12  # at or below this an edge pixel is fully the object; in between the edge is soft
POCKET_MIN_AREA = 700  # smaller patches of magenta-looking pixels inside the object are kept (they are paint or reflections)
EDGE = 3  # how many pixels in from the background the soft edge reaches


REF = {}  # the background colour of the picture being cut ('auto' mode), set by cut_out


def magenta(px, x, y, mode='magenta'):
    """How much like the background colour key a pixel is (0 = not at all, about 0.3 or more = background): magenta by default;
    'orange' is for objects that are themselves violet, pink or green (the crystals), drawn on flat orange: its cast shadow is a darker
    orange, which is keyed out together with the background."""
    r, g, b = px[x, y][:3]
    if mode == 'auto':
        # the background's own colour, whatever it is: same balance between the channels as the border, and not brighter than it (a cast shadow is darker)
        br, bg_, bb = REF['rgb']
        s, bs = max(r + g + b, 1), max(br + bg_ + bb, 1)
        brightness = s / bs
        if brightness > 1.12 or brightness < 0.2:
            return 0.0
        # a cast shadow is the background seen darker and bluer: any clearly darker pixel with a violet cast and little green is shadow
        if brightness < 0.82 and g < 0.62 * min(r, b) + 12 and b >= 0.8 * r:
            return 1.0
        d = abs(r / s - br / bs) + abs(g / s - bg_ / bs) + abs(b / s - bb / bs)
        tolerance = 0.16 + 0.22 * max(0.0, 1.0 - brightness)
        return max(0.0, 1.0 - d / tolerance)
    if mode == 'orange':
        return (r - b) / max(r, 40) if r > g else 0.0
    m = min(r, b)
    return (m - g) / max(m, 40)


def cut_out(path: Path, mode: str = 'magenta', pocket_min: int = POCKET_MIN_AREA) -> Image.Image:
    """The object with a transparent background, cropped to its outline.

    The background is the magenta that can be reached from the picture's border (a flood fill over pixels that are magenta enough, so
    magenta-tinted metal or paint inside the object is never mistaken for it); along that border the edge is made soft and the magenta
    fringe is pulled out of the colour."""
    key_full, key_none = (KEY_FULL, KEY_NONE) if mode == 'magenta' else (0.55, 0.3) if mode == 'auto' else (0.3, 0.15)
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    if mode == 'auto':
        border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
        REF['rgb'] = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    bg = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or bg[y * w + x]:
            continue
        if magenta(px, x, y, mode) < key_full:
            continue
        bg[y * w + x] = 1
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # gaps the border cannot reach (between a roof and its posts): any sizeable patch of magenta
    pocket_seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or pocket_seen[i0] or magenta(px, sx, sy, mode) < key_full:
                continue
            region = []
            stack = [(sx, sy)]
            pocket_seen[i0] = 1
            while stack:
                x, y = stack.pop()
                region.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and not pocket_seen[ny * w + nx] and magenta(px, nx, ny, mode) >= key_full:
                        pocket_seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(region) >= pocket_min:
                for x, y in region:
                    bg[y * w + x] = 1

    # distance (in steps) of each object pixel from the background, up to EDGE
    near = bytearray(w * h)  # 1 = within EDGE pixels of the background
    frontier = [(x, y) for y in range(h) for x in range(w) if bg[y * w + x] and any(0 <= x + dx < w and 0 <= y + dy < h and not bg[(y + dy) * w + x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    seen = set(frontier)
    for _ in range(EDGE):
        nxt = []
        for x, y in frontier:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and not bg[ny * w + nx]:
                    seen.add((nx, ny))
                    near[ny * w + nx] = 1
                    nxt.append((nx, ny))
        frontier = nxt

    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if bg[i]:
                continue
            r, g, b = px[x, y]
            alpha = 255
            if near[i]:
                key = magenta(px, x, y, mode)
                if mode == 'auto':
                    # a green background: pull the green out of the soft edge (spill), as the magenta is pulled out below
                    br, bg_, bb = REF['rgb']
                    if bg_ > 1.3 * max(br, bb) and g > max(r, b):
                        g = int(max(r, b) + (g - max(r, b)) * 0.2)
                if key > 0:
                    alpha = 255 if key <= key_none else round(255 * (key_full - key) / (key_full - key_none))
                    if mode == 'auto':
                        pass
                    elif mode == 'orange':
                        spill = (r - b) * 0.5
                        if spill > 0 and r > g:
                            r = int(r - spill)
                    else:
                        spill = (min(r, b) - g) * 0.8
                        if spill > 0:
                            r = int(r - spill)
                            b = int(b - spill)
            op[x, y] = (max(0, r), g, max(0, b), max(0, alpha))
    box = out.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    assert box, path
    return out.crop(box)


def build(name: str, preview: Path | None) -> None:
    source, out, width, anchor, *rest = PROPS[name]
    figure = cut_out(SRC / source, rest[0] if rest else 'magenta', rest[1] if len(rest) > 1 else POCKET_MIN_AREA)
    size = (width, max(1, round(figure.height * width / figure.width)))
    figure = figure.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    target = OUT / out
    target.parent.mkdir(parents=True, exist_ok=True)
    figure.save(target, optimize=True)
    print(f"{name}: {figure.width}x{figure.height} -> {out}  anchorY {anchor}")
    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        backdrop = Image.new('RGBA', (figure.width + 40, figure.height + 40), (86, 130, 70, 255))
        backdrop.alpha_composite(figure, (20, 20))
        backdrop.convert('RGB').save(preview / f'{name}.png')


def main() -> None:
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    chosen = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--preview']
    for name in chosen or PROPS:
        build(name, preview)


if __name__ == '__main__':
    main()
