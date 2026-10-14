"""Builds the in-game character sheets (public/assets/characters/<name>.png) from the turnaround figures in docs/art/turnarounds.

Usage:  python tools/prepare_sprites.py
Needs Pillow. Developer tool only; the game never runs it.

Each character has three source pictures (front, left, back; the same figure drawn from three sides, see docs/art/turnaround-prompts.json).
The right-facing picture is the left one mirrored. Every picture is cut out of its flat grey background, scaled by ONE factor per
character (so turning around never changes the size), and stood on the baseline of a 128 x 128 frame. The idle animation is a slow
breathing cycle made from the single cut-out: the figure is stretched a little taller and back, anchored at the feet.

Sheet layout: 4 rows (front, right, back, left) x IDLE_FRAMES columns of 128 x 128 px frames.
"""
import importlib.util
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'art' / 'turnarounds'
OUT = ROOT / 'public' / 'assets' / 'characters'

FRAME = 128
BASELINE = 124  # row of the soles inside the frame
IDLE_FRAMES = 4
# vertical stretch of each idle frame (1.0 = as drawn); a slow in-and-out breath
BREATH = [1.0, 1.012, 1.022, 1.012]
# the source figures were drawn about 660 px tall; this is how many frame pixels each character's 660 become
# (the dwarf boatwright and the small water-carrier are shorter; the hunter's bow tip rises above his head)
HEIGHT_PX = {
    'hero': 108,
    'elder_qiyi': 98,
    'hunter_yanya': 114,
    'waterer_xi': 90,
    'boatwright_laodu': 84,
}
SOURCE_HEIGHT = 660
# ground shadow removal (see drop_ground_shadow)
SHADOW_ZONE = 0.86  # only below this fraction of the figure's height
SHADOW_CHROMA = 16  # max spread between the colour channels for a pixel to count as neutral grey
SHADOW_DARK = 95
SHADOW_LIGHT = 225

_spec = importlib.util.spec_from_file_location('prepare_portraits', ROOT / 'tools' / 'prepare_portraits.py')
_portraits = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_portraits)


def cut_out(path: Path) -> Image.Image:
    """The figure with a transparent background, cropped to its outline."""
    im = Image.open(path).convert('RGB')
    background = _portraits.background_mask(im)
    background = background.filter(_portraits.ImageFilter.MaxFilter(3)).filter(_portraits.ImageFilter.GaussianBlur(0.8))
    alpha = background.point(lambda v: 255 - v)
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    assert box, path
    rgba = rgba.crop(box)
    drop_ground_shadow(rgba)
    return rgba


def drop_ground_shadow(im: Image.Image) -> None:
    """The drawings stand in their own soft grey shadow; the game draws a shadow of its own, so remove it from the feet.

    In the lowest part of the figure, pixels that are neutral grey (no colour) and not dark are shadow: skin, leather, cloth and
    boots all have some colour or are nearly black."""
    w, h = im.size
    px = im.load()
    for y in range(int(h * SHADOW_ZONE), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) - min(r, g, b) < SHADOW_CHROMA and SHADOW_DARK < (r + g + b) / 3 < SHADOW_LIGHT:
                px[x, y] = (r, g, b, 0)


def scaled(figure: Image.Image, factor: float) -> Image.Image:
    size = (max(1, round(figure.width * factor)), max(1, round(figure.height * factor)))
    # resize with premultiplied alpha so the edge does not pick up the grey background
    return figure.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def breathe(figure: Image.Image, stretch: float) -> Image.Image:
    """Stretched taller by `stretch` (and a touch narrower), keeping the feet where they were."""
    if stretch == 1.0:
        return figure
    w = max(1, round(figure.width * (1 - (stretch - 1) * 0.5)))
    h = max(1, round(figure.height * stretch))
    return figure.convert('RGBa').resize((w, h), Image.BICUBIC).convert('RGBA')


def place(figure: Image.Image, frame: Image.Image, col: int, row: int) -> None:
    x = col * FRAME + (FRAME - figure.width) // 2
    y = row * FRAME + BASELINE - figure.height
    frame.alpha_composite(figure, (x, y)) if y >= row * FRAME else frame.alpha_composite(figure.crop((0, row * FRAME - y, figure.width, figure.height)), (x, row * FRAME))


def build(name: str) -> None:
    factor = HEIGHT_PX[name] / SOURCE_HEIGHT
    front = scaled(cut_out(SRC / f'{name}_front.webp'), factor)
    left = scaled(cut_out(SRC / f'{name}_left.webp'), factor)
    back = scaled(cut_out(SRC / f'{name}_back.webp'), factor)
    rows = [front, left.transpose(Image.FLIP_LEFT_RIGHT), back, left]  # front, right, back, left
    sheet = Image.new('RGBA', (FRAME * IDLE_FRAMES, FRAME * len(rows)))
    for row, figure in enumerate(rows):
        for col in range(IDLE_FRAMES):
            place(breathe(figure, BREATH[col]), sheet, col, row)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{name}.png', optimize=True)
    print(name, sheet.size, [f.size for f in (front, left, back)])


def main() -> None:
    for name in HEIGHT_PX:
        build(name)


if __name__ == '__main__':
    main()
