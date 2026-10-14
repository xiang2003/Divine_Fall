"""Builds the in-game pixel-art character sheets (public/assets/characters/<name>.png) from the turnaround figures in docs/art/turnarounds.

Usage:  python tools/prepare_sprites.py [--preview <dir>]
Needs Pillow. Developer tool only; the game never runs it.

The characters on the map are pixel art, separate from the large concept pictures. Each character has three source pictures
(front, left, back: the same figure drawn from three sides, see docs/art/turnaround-prompts.json); the right-facing picture is the
left one mirrored. For each character:

  1. every picture is cut out of its flat grey background and its ground shadow is removed;
  2. all three are shrunk by ONE factor (so turning around never changes the size) to a few dozen pixels tall;
  3. colours are boosted a little and reduced to one small palette shared by the three views (no dithering), edges are made hard
     (no half-transparent pixels) and a dark one-pixel outline is drawn around the figure, so it stays readable on grass;
  4. the figure is stood on the baseline of a 64 x 64 frame. The idle animation is the classic breathing bob: the upper body
     sinks one pixel for two of the four frames while the legs stay put.

Sheet layout: 4 rows (front, right, back, left) x IDLE_FRAMES columns of 64 x 64 px frames. The game draws it without smoothing.
"""
import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'art' / 'turnarounds'
OUT = ROOT / 'public' / 'assets' / 'characters'

FRAME = 64
BASELINE = 62  # row of the soles inside the frame (the outline takes the row below)
IDLE_FRAMES = 4
# idle: how many pixels the upper body sinks in each frame, and where "upper body" ends (fraction of the figure's height from the top)
BOB = [0, 0, 1, 1]
BOB_SPLIT = 0.52
# how tall each character is, in pixels (the dwarf boatwright and the small water-carrier are shorter;
# the hunter's bow tip rises above his head, so he is listed taller)
HEIGHT_PX = {
    'hero': 50,
    'elder_qiyi': 45,
    'hunter_yanya': 54,
    'waterer_xi': 41,
    'boatwright_laodu': 38,
}
SOURCE_HEIGHT = 660  # the source figures were drawn about this tall
PALETTE_COLORS = 28
SATURATION = 1.18
CONTRAST = 1.12
OUTLINE_DARKNESS = 0.32
ALPHA_CUTOFF = 110  # a pixel is either figure or empty: partly transparent edge pixels are decided here

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


def shrink(figure: Image.Image, factor: float) -> Image.Image:
    """Area-averaged shrink (premultiplied, so the grey background never bleeds into the edge); colours are lifted to survive the palette."""
    size = (max(1, round(figure.width * factor)), max(1, round(figure.height * factor)))
    small = figure.convert('RGBa').resize(size, Image.BOX).convert('RGBA')
    rgb = small.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(SATURATION)
    rgb = ImageEnhance.Contrast(rgb).enhance(CONTRAST)
    out = rgb.convert('RGBA')
    out.putalpha(small.getchannel('A').point(lambda v: 255 if v >= ALPHA_CUTOFF else 0))
    return out


def shared_palette(views: list[Image.Image]) -> Image.Image:
    """One palette (as a 'P' image) from every opaque pixel of all the views."""
    colors = []
    for v in views:
        px = v.load()
        for y in range(v.height):
            for x in range(v.width):
                r, g, b, a = px[x, y]
                if a:
                    colors.append((r, g, b))
    strip = Image.new('RGB', (len(colors), 1))
    strip.putdata(colors)
    return strip.quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def apply_palette(view: Image.Image, palette: Image.Image) -> Image.Image:
    rgb = view.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(view.getchannel('A'))
    return out


def outline(view: Image.Image) -> Image.Image:
    """A dark one-pixel outline around the figure (outside it), in a darkened version of the colour it touches."""
    w, h = view.size
    out = Image.new('RGBA', (w + 2, h + 2))
    out.paste(view, (1, 1))
    src = out.copy()
    sp = src.load()
    op = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if sp[x, y][3]:
                continue
            near = [sp[nx, ny] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= nx < w + 2 and 0 <= ny < h + 2 and sp[nx, ny][3]]
            if near:
                r = sum(c[0] for c in near) / len(near)
                g = sum(c[1] for c in near) / len(near)
                b = sum(c[2] for c in near) / len(near)
                op[x, y] = (int(r * OUTLINE_DARKNESS), int(g * OUTLINE_DARKNESS), int(b * OUTLINE_DARKNESS), 255)
    return out


def bob(figure: Image.Image, dy: int) -> Image.Image:
    """The figure with its upper body `dy` pixels lower (the legs stay where they are)."""
    if dy == 0:
        return figure
    w, h = figure.size
    split = int(h * BOB_SPLIT)
    out = Image.new('RGBA', (w, h))
    out.alpha_composite(figure.crop((0, split, w, h)), (0, split))
    out.alpha_composite(figure.crop((0, 0, w, split)), (0, dy))
    return out


def place(figure: Image.Image, sheet: Image.Image, col: int, row: int) -> None:
    x = col * FRAME + (FRAME - figure.width) // 2
    y = row * FRAME + BASELINE - figure.height + 1
    sheet.alpha_composite(figure, (x, y))


def build(name: str, preview: Path | None) -> None:
    factor = HEIGHT_PX[name] / SOURCE_HEIGHT
    views = {v: shrink(cut_out(SRC / f'{name}_{v}.webp'), factor) for v in ('front', 'left', 'back')}
    palette = shared_palette(list(views.values()))
    done = {v: outline(apply_palette(img, palette)) for v, img in views.items()}
    left = done['left']
    rows = [done['front'], left.transpose(Image.FLIP_LEFT_RIGHT), done['back'], left]  # front, right, back, left
    sheet = Image.new('RGBA', (FRAME * IDLE_FRAMES, FRAME * len(rows)))
    for row, figure in enumerate(rows):
        for col in range(IDLE_FRAMES):
            place(bob(figure, BOB[col]), sheet, col, row)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{name}.png', optimize=True)
    print(name, sheet.size, {v: img.size for v, img in done.items()})
    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        big = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
        backdrop = Image.new('RGBA', big.size, (58, 92, 52, 255))
        backdrop.alpha_composite(big)
        backdrop.convert('RGB').save(preview / f'{name}.png')


def main() -> None:
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    for name in HEIGHT_PX:
        build(name, preview)


if __name__ == '__main__':
    main()
