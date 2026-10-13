"""Builds the character sheets under public/assets/characters/ from Kenney's "Isometric Miniature Dungeon" pack (CC0).

Usage:  python tools/prepare_characters.py <dir containing the pack's "Characters/Male" folder>
Needs Pillow. Developer tool only; the game never runs it.

The pack has one male body rendered in 8 directions (idle: 1 frame, run: 10 frames per direction). Its outfit is all brown,
so each character here is the same body with the clothes (everything below the head that is not skin) re-coloured, and the
hair re-coloured separately. Output per character:
  <name>_idle.png   8 frames side by side, one per direction (index order: see DIRECTION_NOTE)
  <name>_run.png    8 rows (one per direction) of 10 frames   [only for characters with a run cycle]
All frames of one character share one crop window, so the feet stay at the same place in every frame.
"""
import colorsys
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'characters'

# Direction index in the pack: 0 back-right, 1 right, 2 front-right, 3 front, 4 front-left, 5 left, 6 back-left, 7 back
# (screen directions, seen from the isometric camera).
DIRECTIONS = 8
SKIN_VALUE = 0.55  # brighter than this, orange-ish and not strongly saturated: skin, left alone (shaded skin included)
SKIN_SATURATION = 0.54
HEAD_FRACTION = 0.25  # the top part of the figure is the head and beard: hair is treated separately there

# name: (clothes hue, clothes saturation x, clothes brightness x, hair (hue or None to keep, saturation x, brightness x), run cycle?)
CHARACTERS = {
    'elder': ((60, 0.12, 2.3), (None, 0.0, 3.4), False),
    'hunter': ((95, 0.9, 1.0), (None, 1.0, 1.0), False),
    'waterer': ((185, 0.95, 1.25), (None, 1.0, 1.0), False),
    'boatwright': ((12, 1.5, 1.4), (22, 1.3, 1.9), False),
    'hero': ((178, 1.0, 1.35), (None, 1.0, 0.9), True),
}


def tint(im: Image.Image, clothes, hair, head_bottom: int) -> Image.Image:
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if vv > SKIN_VALUE and ss < SKIN_SATURATION and 0.03 < hh < 0.12:
                continue  # skin
            hue, sat, val = hair if y < head_bottom else clothes
            nh = hh if hue is None else hue / 360
            r2, g2, b2 = colorsys.hsv_to_rgb(nh, min(1, ss * sat), min(1, vv * val))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im


def main(pack: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    folder = pack / 'Characters' / 'Male'
    frames = {
        'idle': [Image.open(folder / f'Male_{d}_Idle0.png').convert('RGBA') for d in range(DIRECTIONS)],
        'run': [[Image.open(folder / f'Male_{d}_Run{i}.png').convert('RGBA') for i in range(10)] for d in range(DIRECTIONS)],
    }
    # one crop window for every frame of every direction
    boxes = [im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for im in frames['idle']]
    for row in frames['run']:
        boxes += [im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for im in row]
    margin = 4
    left = min(b[0] for b in boxes) - margin
    top = min(b[1] for b in boxes) - margin
    right = max(b[2] for b in boxes) + margin
    bottom = max(b[3] for b in boxes) + margin
    cw, ch = right - left, bottom - top
    head_bottom = int(ch * HEAD_FRACTION) + margin
    print(f'frame {cw}x{ch}  (crop window {left},{top},{right},{bottom})')

    for name, (clothes, hair, run) in CHARACTERS.items():
        idle = Image.new('RGBA', (cw * DIRECTIONS, ch), (0, 0, 0, 0))
        for d, im in enumerate(frames['idle']):
            idle.alpha_composite(tint(im.crop((left, top, right, bottom)), clothes, hair, head_bottom), (d * cw, 0))
        idle.save(OUT / f'{name}_idle.png', optimize=True)
        if run:
            sheet = Image.new('RGBA', (cw * 10, ch * DIRECTIONS), (0, 0, 0, 0))
            for d, row in enumerate(frames['run']):
                for i, im in enumerate(row):
                    sheet.alpha_composite(tint(im.crop((left, top, right, bottom)), clothes, hair, head_bottom), (i * cw, d * ch))
            sheet.save(OUT / f'{name}_run.png', optimize=True)
        print('wrote', name, 'idle' + (' + run' if run else ''))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
