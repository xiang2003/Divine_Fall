"""Builds the third-party art under public/assets/ from the original downloads (see ASSETS.md for sources and licences).

Usage:  python tools/prepare_assets.py <dir with the extracted downloads>
Needs Pillow (pip install pillow). Developer tool only; the game never runs it.

Expected layout of <dir> (the zips from OpenGameArt, extracted; all by rubberduck, CC0):
  terrain/dirt_tiles.png, sand_tiles.png, water_v01.png   from "updated grassland tileset (stylized)"
  props/props_1x1.png, props_2x2.png                      from "isometric props and tents"
  plants/isometric tiles/<name>.png (also used for decor) from "Free isometric plants-pack"
  grass/ground_grasses.png                 from "stylized grassland tileset" (rubberduck, CC0)
  plants/isometric tiles/<name>.png        from "Free isometric plants-pack" (rubberduck / yughues, CC0)
  cabins/wooden_buildings_01.png           from "isometric log cabins" (rubberduck, CC0)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

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


# Which cabin of the 4x4 sheet (row, column) is used for each building style, and its footprint in tiles (w, h).
# Row 0: sheds; row 1: thatched cabins; row 2: shingled cabins with porches; row 3: big houses. The columns are the four views.
CABINS = {
    'home': ((1, 1), (3, 3)),
    'elder': ((3, 1), (4, 3)),
    'store': ((2, 3), (3, 3)),
    'boat': ((3, 2), (4, 3)),
    'shed': ((0, 0), (2, 2)),
}
CABIN_CELL = 768  # the sheet is 3072 x 3072: 4 x 4 cells
# Pixels from the lowest point of the sprite up to the front corner of its footprint (the soft ground shadow hangs below it).
CABIN_SHADOW_PAD = 8


def cabins(src: Path) -> None:
    (OUT / 'buildings').mkdir(parents=True, exist_ok=True)
    sheet = Image.open(src / 'cabins' / 'wooden_buildings_01.png').convert('RGBA')
    for style, ((row, col), (w, h)) in CABINS.items():
        cell = sheet.crop((col * CABIN_CELL, row * CABIN_CELL, (col + 1) * CABIN_CELL, (row + 1) * CABIN_CELL))
        box = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
        margin = 6
        box = (max(0, box[0] - margin), max(0, box[1] - margin), min(CABIN_CELL, box[2] + margin), min(CABIN_CELL, box[3] + margin))
        sprite = cell.crop(box)
        sprite.save(OUT / 'buildings' / f'cabin_{style}.png', optimize=True)
        # The source tile is 128 x 64 px; the front corner of a w x h footprint is (w + h) / 2 half-tiles (32 px each) below its centre.
        anchor_y = (margin + CABIN_SHADOW_PAD + (w + h) / 2 * 32) / sprite.height
        print(f"  '{style}': width {sprite.width}, height {sprite.height}, anchorY {anchor_y:.4f}")


# ---- terrain: dirt path, beach sand, sea ---------------------------------------------------------------------------------
DIAMOND = Image.new('L', (128, 64), 0)
ImageDraw.Draw(DIAMOND).polygon([(0, 32), (64, 0), (128, 32), (64, 64)], fill=255)


def terrain(src: Path) -> None:
    (OUT / 'tiles').mkdir(parents=True, exist_ok=True)
    t = src / 'terrain'

    def cell(sheet: Image.Image, col: int, row: int) -> Image.Image:
        return sheet.crop((col * 128, row * 64, (col + 1) * 128, (row + 1) * 64))

    dirt = Image.open(t / 'dirt_tiles.png').convert('RGBA')
    # rows 0-1: full diamonds; rows 2 and 4: soft-edged patches that blend into the grass around a dirt path
    for i, (c, r) in enumerate([(0, 0), (3, 0), (5, 1), (7, 1)]):
        cell(dirt, c, r).save(OUT / 'tiles' / f'dirt_{i}.png', optimize=True)
    for i, (c, r) in enumerate([(0, 2), (2, 2), (4, 2), (1, 4), (3, 4), (6, 4)]):
        cell(dirt, c, r).save(OUT / 'tiles' / f'dirt_edge_{i}.png', optimize=True)
    sand = Image.open(t / 'sand_tiles.png').convert('RGBA')
    for i, (c, r) in enumerate([(0, 0), (3, 0), (5, 1), (7, 1)]):
        cell(sand, c, r).save(OUT / 'tiles' / f'sand_{i}.png', optimize=True)
    # a cave floor: the dark dirt tiles, cooled towards slate blue
    for i, (c, r) in enumerate([(1, 6), (4, 7), (6, 6)]):
        base = cell(Image.open(t / 'dirt_tiles.png').convert('RGBA'), c, r)
        rgb = ImageEnhance.Color(base.convert('RGB')).enhance(0.35)
        r_, g_, b_ = rgb.split()
        cool = Image.merge('RGB', (r_.point(lambda v: int(v * 0.8)), g_.point(lambda v: int(v * 0.92)), b_.point(lambda v: min(255, int(v * 1.25 + 10)))))
        out = cool.convert('RGBA')
        out.putalpha(base.getchannel('A'))
        out.save(OUT / 'tiles' / f'cave_{i}.png', optimize=True)
    # the sea: diamonds cut from the middle of the big water render (the surface is an even ripple, so any piece will do)
    water = Image.open(t / 'water_v01.png').convert('RGBA')
    for i, (cx, cy) in enumerate([(384, 192), (250, 170), (520, 215), (400, 130)]):
        piece = water.crop((cx - 64, cy - 32, cx + 64, cy + 32))
        piece.putalpha(DIAMOND)
        piece.save(OUT / 'tiles' / f'sea_{i}.png', optimize=True)
    print('terrain: dirt 4 + edge 6, sand 4, cave 3, sea 4')


# ---- props and decorations ---------------------------------------------------------------------------------------------
PROP_CELL = 128
# solid props that replace the plain crate ("c" in a layout): (row, column) of props_1x1.png
CRATE_PROPS = {'crate_a': (9, 10), 'crate_b': (9, 14), 'barrel': (11, 0), 'barrel_crate': (11, 2), 'barrel_crate_b': (11, 4), 'barrels': (11, 8), 'crates_pair': (13, 0), 'crates_stack': (13, 8)}
# non-solid decorations
DECOR_PROPS = {'stump_a': (7, 0), 'stump_b': (7, 5), 'stump_c': (7, 8), 'stump_d': (7, 2), 'firewood_a': (9, 0), 'firewood_b': (9, 2), 'firewood_c': (7, 12), 'cauldron': (9, 4)}
# buildings from props_2x2.png (256-px cells): a tent and a fire pit; both stand on a 2 x 2 footprint
BIG_PROPS = {'tent': ((0, 3), (2, 2)), 'campfire': ((3, 2), (2, 2))}
# plants used as scattered decoration: file stem in plants/isometric tiles
PLANT_DECOR = ['bush01', 'bush03', 'bush05', 'shrub1-01', 'shrub1-03', 'shrub2-01', 'grasses01', 'grasses03', 'grasses05', 'weed01', 'weed03', 'palm01', 'palm03', 'palm05', 'tropical01']


def trim(cell: Image.Image, margin: int = 4) -> Image.Image:
    box = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    return cell.crop((max(0, box[0] - margin), max(0, box[1] - margin), min(cell.width, box[2] + margin), min(cell.height, box[3] + margin)))


def props(src: Path) -> None:
    (OUT / 'props').mkdir(parents=True, exist_ok=True)
    one = Image.open(src / 'props' / 'props_1x1.png').convert('RGBA')
    for table, prefix in ((CRATE_PROPS, 'prop'), (DECOR_PROPS, 'decor')):
        for name, (row, col) in table.items():
            cell = one.crop((col * PROP_CELL, row * PROP_CELL, (col + 1) * PROP_CELL, (row + 1) * PROP_CELL))
            lit = brighten(trim(cell), 1.35, 1.1) if prefix == 'prop' else trim(cell)
            lit.save(OUT / 'props' / f'{prefix}_{name}.png', optimize=True)
    big = Image.open(src / 'props' / 'props_2x2.png').convert('RGBA')
    (OUT / 'buildings').mkdir(parents=True, exist_ok=True)
    for name, ((row, col), (w, h)) in BIG_PROPS.items():
        cell = big.crop((col * 256, row * 256, (col + 1) * 256, (row + 1) * 256))
        sprite = brighten(trim(cell), 1.3, 1.1)
        sprite.save(OUT / 'buildings' / f'prop_{name}.png', optimize=True)
        print(f"  '{name}': width {sprite.width}, height {sprite.height}")
    for stem in PLANT_DECOR:
        im = Image.open(src / 'plants' / 'isometric tiles' / f'{stem}.png').convert('RGBA')
        brighten(trim(im), 1.9, 1.2).save(OUT / 'props' / f'plant_{stem}.png', optimize=True)
    print('props:', len(CRATE_PROPS), 'solid,', len(DECOR_PROPS), 'decor,', len(BIG_PROPS), 'big,', len(PLANT_DECOR), 'plants')


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
    cabins(src)
    terrain(src)
    props(src)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
