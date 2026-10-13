"""Builds the third-party art under public/assets/ from the original downloads (see ASSETS.md for sources and licences).

Usage:  python tools/prepare_assets.py <dir with the extracted downloads>
Needs Pillow (pip install pillow). Developer tool only; the game never runs it.

Expected layout of <dir> (the zips from OpenGameArt, extracted):
  grass/ground_grasses.png                 from "stylized grassland tileset" (rubberduck, CC0)
  plants/isometric tiles/<name>.png        from "Free isometric plants-pack" (rubberduck / yughues, CC0)
"""
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets'

# (row, column) of the plain 128x64 diamonds in ground_grasses.png (the flowered ones in rows 0-1 are too bright and show their edges).
GRASS_TILES = [(6, 0), (6, 3), (6, 6), (7, 1), (7, 4), (7, 6)]
TREES = ['bigtree01', 'bigtree02', 'bigtree03', 'pine-none01', 'pine-none02', 'pine-none03', 'pine-none04']


def brighten(im: Image.Image, light: float, color: float) -> Image.Image:
    """The tree renders are almost black; lift them so they read on a dark background."""
    rgb = im.convert('RGB')
    rgb = ImageEnhance.Brightness(rgb).enhance(light)
    rgb = ImageEnhance.Color(rgb).enhance(color)
    out = rgb.convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out


def main(src: Path) -> None:
    (OUT / 'tiles').mkdir(parents=True, exist_ok=True)
    (OUT / 'trees').mkdir(parents=True, exist_ok=True)

    sheet = Image.open(src / 'grass' / 'ground_grasses.png').convert('RGBA')
    for i, (row, col) in enumerate(GRASS_TILES):
        tile = sheet.crop((col * 128, row * 64, col * 128 + 128, row * 64 + 64))
        tile.save(OUT / 'tiles' / f'grass_{i}.png', optimize=True)

    for i, name in enumerate(TREES):
        im = Image.open(src / 'plants' / 'isometric tiles' / f'{name}.png').convert('RGBA')
        brighten(im, 1.9, 1.05).save(OUT / 'trees' / f'tree_{i}.png', optimize=True)
    print('wrote', len(GRASS_TILES), 'grass tiles and', len(TREES), 'trees to', OUT)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
