"""Builds the in-game pixel-art sheets of the characters (public/assets/characters/<name>.png) and of the monsters
(public/assets/monsters/<name>.png) from the turnaround figures in docs/art/turnarounds.

Usage:  python tools/prepare_sprites.py [--preview <dir>]
Needs Pillow. Developer tool only; the game never runs it.

The characters on the map are pixel art, separate from the large concept pictures. Each one has three source pictures (front, a side
view, back: the same figure drawn from three sides, see docs/art/turnaround-prompts.json); the missing side is the given one mirrored
(characters were drawn facing left, the monsters facing right). For each one:

  1. every picture is cut out of its flat grey background and its ground shadow is removed;
  2. all three are shrunk by ONE factor (so turning around never changes the size) to a few dozen pixels tall;
  3. colours are boosted a little and reduced to one small palette shared by the three views (no dithering), edges are made hard
     (no half-transparent pixels) and a dark one-pixel outline is drawn around the figure, so it stays readable on grass;
  4. the figure is stood on the baseline of a 64 x 64 frame. The idle animation is the classic breathing bob: the upper body
     sinks one pixel for two of the four frames while the legs stay put;
  5. the dodge roll is baked too: the figure is tucked into a ball (squashed, a little wider) and turned by 45 degrees per frame
     with nearest-neighbour sampling, so every frame stays on the pixel grid. Right and front facings roll clockwise, left and back
     counter-clockwise.

Sheet layout: 4 rows (front, right, back, left) x (IDLE_FRAMES + ROLL_FRAMES) columns of 64 x 64 px frames: the idle frames first,
then the roll frames. The game draws it without smoothing.
"""
import importlib.util
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'art' / 'turnarounds'

FRAME = 64
BASELINE = 62  # row of the soles inside the frame (the outline takes the row below)
IDLE_FRAMES = 4
ROLL_FRAMES = 8
# the first roll frame is the crouch before the tumble; later frames are the tucked ball (height as a fraction of the standing figure)
ROLL_CROUCH = 0.82
ROLL_BALL_HEIGHT = 0.55
ROLL_BALL_WIDTH = 1.25
# the turning ball is lowered this many pixels into the ground line so it looks like it rolls on it
ROLL_SINK = 3
# idle: how many pixels the upper body sinks in each frame, and where "upper body" ends (fraction of the figure's height from the top)
BOB = [0, 0, 1, 1]
BOB_SPLIT = 0.52
# How big each one is, in pixels, and where its sheet goes.
#   size   ('height', n): the figure stands n px tall (characters: the source figures were drawn about SOURCE_HEIGHT tall);
#          ('width', n): the side view is n px long (animals, which are wider than tall)
#   side   which way the side picture faces; the other side is its mirror
#   colors / saturation / contrast (optional)  palette size and colour boost when the defaults wash a creature out (the viper's green)
#   brightness (optional)  lifts a creature that came out too dark
#   roll   True: the sheet also carries the dodge-roll frames (only the hero rolls, but all characters have them)
# The dwarf boatwright and the small water-carrier are shorter; the hunter's bow tip rises above his head, so he is listed taller.
SPRITES = {
    'hero': {'size': ('height', 50), 'side': 'left', 'roll': True, 'out': 'characters'},
    'elder_qiyi': {'size': ('height', 45), 'side': 'left', 'roll': True, 'out': 'characters'},
    'hunter_yanya': {'size': ('height', 54), 'side': 'left', 'roll': True, 'out': 'characters'},
    'waterer_xi': {'size': ('height', 41), 'side': 'left', 'roll': True, 'out': 'characters'},
    'boatwright_laodu': {'size': ('height', 38), 'side': 'left', 'roll': True, 'out': 'characters'},
    'forest_wolf': {'size': ('width', 46), 'side': 'right', 'roll': False, 'out': 'monsters'},
    'forest_viper': {'size': ('width', 34), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 44, 'saturation': 1.2, 'contrast': 1.25},
    # the spring cave and the ruins; the big ones stand in a 96 px frame
    'spring_gel': {'size': ('width', 38), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 40},
    'crystal_bat': {'size': ('width', 46), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 40},
    'corroded_deer': {'size': ('height', 92), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 40, 'frame': 96},
    'rock_golem': {'size': ('height', 72), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 36, 'frame': 96},
    # the Primordial Core
    'stone_attendant': {'size': ('height', 70), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 36, 'frame': 80},
    'mask_spirit': {'size': ('width', 34), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 36},
    # the Mist Coast (chapter 2)
    'cleft_boar': {'size': ('width', 48), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 40, 'brightness': 1.12},
    'wreck_revenant': {'size': ('height', 58), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 40, 'frame': 80, 'brightness': 1.3, 'saturation': 1.25},
    'drowned_spirit': {'size': ('height', 54), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 44, 'frame': 80, 'saturation': 1.3},
    'core_watcher': {'size': ('height', 112), 'side': 'right', 'roll': False, 'out': 'monsters', 'colors': 40, 'frame': 128},
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


def shrink(figure: Image.Image, factor: float, saturation: float = SATURATION, contrast: float = CONTRAST, brightness: float = 1.0) -> Image.Image:
    """Area-averaged shrink (premultiplied, so the grey background never bleeds into the edge); colours are lifted to survive the palette."""
    size = (max(1, round(figure.width * factor)), max(1, round(figure.height * factor)))
    small = figure.convert('RGBa').resize(size, Image.BOX).convert('RGBA')
    rgb = small.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(saturation)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    if brightness != 1.0:
        rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    out = rgb.convert('RGBA')
    out.putalpha(small.getchannel('A').point(lambda v: 255 if v >= ALPHA_CUTOFF else 0))
    return out


def shared_palette(views: list[Image.Image], palette_size: int = PALETTE_COLORS) -> Image.Image:
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
    return strip.quantize(colors=palette_size, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


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


def roll_frame(figure: Image.Image, step: int, clockwise: bool) -> Image.Image:
    """One frame of the dodge roll as a FRAME x FRAME picture: step 0 is the crouch, the others are the tucked figure turned 45 degrees more each."""
    height = ROLL_CROUCH if step == 0 else ROLL_BALL_HEIGHT
    width = 1.0 if step == 0 else ROLL_BALL_WIDTH
    w = max(1, round(figure.width * width))
    h = max(1, round(figure.height * height))
    ball = figure.resize((w, h), Image.NEAREST)
    # the ball turns about its own middle, inside a square big enough for any angle
    side = int((w * w + h * h) ** 0.5) + 2
    square = Image.new('RGBA', (side, side))
    square.alpha_composite(ball, ((side - w) // 2, (side - h) // 2))
    angle = step * (360 / ROLL_FRAMES) * (-1 if clockwise else 1)  # PIL turns counter-clockwise for positive angles
    if step:
        square = square.rotate(angle, resample=Image.NEAREST)
    frame = Image.new('RGBA', (FRAME, FRAME))
    if step == 0:
        # crouch: feet on the baseline like the standing figure
        frame.alpha_composite(square, ((FRAME - side) // 2, BASELINE + 1 - (side + h) // 2))
    else:
        # the ball rests on the ground line: its lowest point is the radius below its middle
        radius = side / 2
        centre_y = BASELINE + 1 + ROLL_SINK - radius
        frame.alpha_composite(square, (round((FRAME - side) / 2), round(centre_y - radius)))
    return frame


def place(figure: Image.Image, sheet: Image.Image, col: int, row: int, frame: int = FRAME) -> None:
    x = col * frame + (frame - figure.width) // 2
    y = row * frame + (frame - 2) - figure.height + 1  # the soles are on the row two above the frame's bottom (BASELINE for a 64 px frame)
    sheet.alpha_composite(figure, (x, y))


def build(name: str, preview: Path | None) -> None:
    spec = SPRITES[name]
    side = spec['side']
    cuts = {v: cut_out(SRC / f'{name}_{v}.webp') for v in ('front', side, 'back')}
    mode, px = spec['size']
    factor = px / SOURCE_HEIGHT if mode == 'height' else px / cuts[side].width
    views = {v: shrink(img, factor, spec.get('saturation', SATURATION), spec.get('contrast', CONTRAST), spec.get('brightness', 1.0)) for v, img in cuts.items()}
    palette = shared_palette(list(views.values()), spec.get('colors', PALETTE_COLORS))
    done = {v: outline(apply_palette(img, palette)) for v, img in views.items()}
    mirrored = done[side].transpose(Image.FLIP_LEFT_RIGHT)
    right, left = (done[side], mirrored) if side == 'right' else (mirrored, done[side])
    rows = [done['front'], right, done['back'], left]  # front, right, back, left
    columns = IDLE_FRAMES + (ROLL_FRAMES if spec['roll'] else 0)
    frame = spec.get('frame', FRAME)
    sheet = Image.new('RGBA', (frame * columns, frame * len(rows)))
    clockwise = [True, True, False, False]  # front, right, back, left
    for row, figure in enumerate(rows):
        for col in range(IDLE_FRAMES):
            place(bob(figure, BOB[col]), sheet, col, row, frame)
        if spec['roll']:
            for step in range(ROLL_FRAMES):
                sheet.alpha_composite(roll_frame(figure, step, clockwise[row]), ((IDLE_FRAMES + step) * FRAME, row * FRAME))
    out_dir = ROOT / 'public' / 'assets' / spec['out']
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet.save(out_dir / f'{name}.png', optimize=True)
    print(name, sheet.size, {v: img.size for v, img in done.items()})
    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        big = sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
        backdrop = Image.new('RGBA', big.size, (58, 92, 52, 255))
        backdrop.alpha_composite(big)
        backdrop.convert('RGB').save(preview / f'{name}.png')


def main() -> None:
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    for name in SPRITES:
        build(name, preview)


if __name__ == '__main__':
    main()
