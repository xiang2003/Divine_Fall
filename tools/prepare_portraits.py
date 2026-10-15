"""Cuts the dialogue portraits (upper body, transparent background) out of the full-body concept art.

Usage:  python tools/prepare_portraits.py
Reads public/assets/art/characters/<name>.webp, writes public/assets/art/portraits/<name>.webp.
Needs Pillow. Developer tool only; the game never runs it.

The concept art stands on a flat light grey background, so the background is whatever can be reached from the image border
through pixels close to the border colour (a flood fill), then the edge is softened. Anything inside the figure is kept even
if it is light. The crop runs from the top of the figure down to BUST_FRACTION of its height.
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'art'
SRC = ROOT / 'characters'
OUT = ROOT / 'portraits'

NAMES = ['hero', 'elder_qiyi', 'hunter_yanya', 'waterer_xi', 'boatwright_laodu', 'innkeeper_zhoubo', 'herbalist_qinghe', 'blacksmith_tieshan', 'wanderer_guchangfeng', 'patrol_linruotang']
TOLERANCE = 26  # max colour distance from the border colour that still counts as background
POCKET_TOLERANCE = 16  # tighter than TOLERANCE: only pixels that really match the background
POCKET_MIN_AREA = 900  # smaller patches are kept: they are part of a textured light cloth, not background
BUST_FRACTION = 0.5  # how much of the figure's height is kept, from the top (head to waist)
MARGIN = 0.08  # extra room around the crop, as a fraction of its size
MAX_HEIGHT = 720


def distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))


def background_mask(im: Image.Image) -> Image.Image:
    """White where the pixel is background (reachable from the border through near-border colours)."""
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h // 2], px[w - 1, h // 2]]
    ref = tuple(sum(c[i] for c in corners) // len(corners) for i in range(3))
    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    seen = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if distance(px[x, y], ref) > TOLERANCE:
            continue
        mp[x, y] = 255
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # Pockets the border cannot reach (between an arm and the body, inside a bow): any big flat patch of background colour.
    pocket_seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if pocket_seen[sy * w + sx] or mp[sx, sy] or distance(px[sx, sy], ref) > POCKET_TOLERANCE:
                continue
            region = []
            stack = [(sx, sy)]
            pocket_seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop()
                region.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not pocket_seen[ny * w + nx] and not mp[nx, ny] and distance(px[nx, ny], ref) <= POCKET_TOLERANCE:
                        pocket_seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(region) >= POCKET_MIN_AREA:
                for x, y in region:
                    mp[x, y] = 255
    return mask


def cut(name: str) -> None:
    im = Image.open(SRC / f'{name}.webp').convert('RGB')
    background = background_mask(im)
    # grow the background a little so the grey fringe goes too, then soften the edge
    background = background.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = background.point(lambda v: 255 - v)
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    assert box, name
    left, top, right, bottom = box
    cut_bottom = top + int((bottom - top) * BUST_FRACTION)
    pad_x = int((right - left) * MARGIN)
    pad_y = int((cut_bottom - top) * MARGIN)
    crop = rgba.crop((max(0, left - pad_x), max(0, top - pad_y), min(im.width, right + pad_x), cut_bottom))
    if crop.height > MAX_HEIGHT:
        crop = crop.resize((round(crop.width * MAX_HEIGHT / crop.height), MAX_HEIGHT), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    crop.save(OUT / f'{name}.webp', 'WEBP', quality=92, method=6)
    print(name, crop.size)


def main() -> None:
    for name in NAMES:
        cut(name)


if __name__ == '__main__':
    main()
