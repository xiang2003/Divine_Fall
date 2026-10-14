"""Builds the generated map props (the village well, the beach boulders, the stranded ferry) from the pictures in docs/art/props.

Usage:  python tools/prepare_props.py [--preview <dir>]
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

# name -> (source file, output file under public/assets, width in picture pixels (the game shows it at half), anchorY)
PROPS = {
    'well': ('well.webp', 'buildings/well.png', 130, 0.17),
    'ferry': ('ferry.webp', 'buildings/ferry.png', 520, 0.27),
    'boulder_0': ('boulder_0.webp', 'props/boulder_0.png', 170, 0.27),
    'boulder_1': ('boulder_1.webp', 'props/boulder_1.png', 170, 0.27),
    'boulder_2': ('boulder_2.webp', 'props/boulder_2.png', 170, 0.27),
}
KEY_FULL = 0.26  # "magentaness" (min(red, blue) - green, as a fraction of min(red, blue)) at or above this can be background
KEY_NONE = 0.12  # at or below this an edge pixel is fully the object; in between the edge is soft
POCKET_MIN_AREA = 700  # smaller patches of magenta-looking pixels inside the object are kept (they are paint or reflections)
EDGE = 2  # how many pixels in from the background the soft edge reaches


def magenta(px, x, y):
    r, g, b = px[x, y][:3]
    m = min(r, b)
    return (m - g) / max(m, 40)


def cut_out(path: Path) -> Image.Image:
    """The object with a transparent background, cropped to its outline.

    The background is the magenta that can be reached from the picture's border (a flood fill over pixels that are magenta enough, so
    magenta-tinted metal or paint inside the object is never mistaken for it); along that border the edge is made soft and the magenta
    fringe is pulled out of the colour."""
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
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
        if magenta(px, x, y) < KEY_FULL:
            continue
        bg[y * w + x] = 1
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # gaps the border cannot reach (between a roof and its posts): any sizeable patch of magenta
    pocket_seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or pocket_seen[i0] or magenta(px, sx, sy) < KEY_FULL:
                continue
            region = []
            stack = [(sx, sy)]
            pocket_seen[i0] = 1
            while stack:
                x, y = stack.pop()
                region.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and not pocket_seen[ny * w + nx] and magenta(px, nx, ny) >= KEY_FULL:
                        pocket_seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(region) >= POCKET_MIN_AREA:
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
                key = magenta(px, x, y)
                if key > 0:
                    alpha = 255 if key <= KEY_NONE else round(255 * (KEY_FULL - key) / (KEY_FULL - KEY_NONE))
                    spill = (min(r, b) - g) * 0.8
                    if spill > 0:
                        r = int(r - spill)
                        b = int(b - spill)
            op[x, y] = (max(0, r), g, max(0, b), max(0, alpha))
    box = out.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    assert box, path
    return out.crop(box)


def build(name: str, preview: Path | None) -> None:
    source, out, width, anchor = PROPS[name]
    figure = cut_out(SRC / source)
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
    for name in PROPS:
        build(name, preview)


if __name__ == '__main__':
    main()
