"""Turns the two ComfyUI character images into game-ready files under public/assets/art/.

Usage:  python tools/prepare_character_art.py <full_body.png> <pixel_figure.png>
Needs Pillow. Developer tool only.

 - full body: kept as painted art, shrunk to a size that is light enough for the web, saved as WebP.
 - pixel figure: the generator drew it on a flat magenta-ish background with a ground shadow. This removes both,
   crops to the figure, shrinks it by the size of one drawn "pixel" (detected) with nearest-neighbour so it becomes
   real low-resolution pixel art, and cleans stray colours with a small palette.
"""
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'art'


def colour_distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a[:3], b[:3])) ** 0.5


def full_body(src: Path) -> None:
    im = Image.open(src).convert('RGB')
    im.thumbnail((640, 936), Image.LANCZOS)
    im.save(OUT / 'hero_full.webp', quality=88, method=6)
    print('hero_full.webp', im.size)


def pixel_figure(src: Path, cells: int = 64) -> None:
    """The generator drew a `cells` x `cells` grid of big square pixels; sample one pixel per cell."""
    im = Image.open(src).convert('RGB')
    small = im.resize((cells, cells), Image.NEAREST)  # NEAREST samples the middle of each block
    bg = small.getpixel((2, 2))
    px = small.load()
    rgba = Image.new('RGBA', small.size)
    out = rgba.load()
    for y in range(cells):
        for x in range(cells):
            c = px[x, y]
            # the background and its darker ground shadow both stay close to the background hue
            d = colour_distance(c, bg)
            shadow = colour_distance(c, tuple(v * 0.82 for v in bg)) < 28
            out[x, y] = (0, 0, 0, 0) if d < 40 or shadow else (*c, 255)
    box = rgba.getbbox()
    rgba = rgba.crop(box)
    # a small palette removes the stray in-between colours the generator leaves
    rgb = rgba.convert('RGB').quantize(colors=22, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    rgb.putalpha(rgba.getchannel('A'))
    rgb.save(OUT / 'hero_pixel.png', optimize=True)
    rgb.resize((rgb.width * 10, rgb.height * 10), Image.NEAREST).save(OUT.parent.parent.parent / 'tools' / '_hero_pixel_preview_x10.png')
    print('hero_pixel.png', rgb.size)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    full_body(Path(sys.argv[1]))
    pixel_figure(Path(sys.argv[2]))
