"""Builds the character sheets under public/assets/characters/ from Shade's "Puny Characters" pack (CC0).

Usage:  python tools/prepare_characters.py <dir containing the pack's PNGs, e.g. Puny-Characters>
Needs Pillow. Developer tool only; the game never runs it.

Each source sheet is 24 columns x 8 rows of 32 x 32 frames (the 8 rows are 8 facing directions). The game only uses four of them,
so the output keeps rows S (front), E (right), N (back) and W (left) of every sheet unchanged: 768 x 128 px, one row per direction in
that order. Columns (checked by eye, see src/game/assetManifest.ts CHARACTER_FRAMES): 0-1 idle, 2-3 walk, 4-7 sword attack,
19-20 hurt, 21-23 death.
"""
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'characters'

FRAME = 32
COLUMNS = 24
# Source rows kept, in output order: front (toward the camera), right, back, left.
ROWS = [0, 2, 4, 6]

# output name -> source file
CHARACTERS = {
    'hero': 'Warrior-Blue',
    'elder': 'Mage-Cyan',
    'hunter': 'Archer-Green',
    'waterer': 'Archer-Purple',
    'boatwright': 'Warrior-Red',
}


def build(src: Path, name: str, source: str) -> None:
    sheet = Image.open(src / f'{source}.png').convert('RGBA')
    assert sheet.size == (COLUMNS * FRAME, 8 * FRAME), (source, sheet.size)
    out = Image.new('RGBA', (COLUMNS * FRAME, len(ROWS) * FRAME))
    for i, row in enumerate(ROWS):
        out.paste(sheet.crop((0, row * FRAME, COLUMNS * FRAME, (row + 1) * FRAME)), (0, i * FRAME))
    out.save(OUT / f'{name}.png', optimize=True)
    print(name, '<-', source, out.size)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for name, source in CHARACTERS.items():
        build(src, name, source)


if __name__ == '__main__':
    main()
