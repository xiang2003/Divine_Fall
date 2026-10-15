"""Builds the isometric ground tiles of chapter 2 (public/assets/tiles/) from the top-down textures generated into docs/art/props (tex_*.webp).

Usage:  python tools/prepare_tiles.py [--preview <dir>]
Needs Pillow and numpy. Developer tool only; the game never runs it.

A square patch of a texture is turned 45 degrees and squashed to a 128 x 64 diamond (the game shows it at half size, 64 x 32, like the other
tiles). Each set has a few full tiles cut from different places of the texture, flipped or turned, with their brightness pulled towards the
texture's mean so neighbours do not make a chequerboard. Path sets also get soft-edged patches ("_edge_"), laid over the floor tile of
the same cell along the sides of a path, as the dirt path of chapter 1 does.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'art' / 'props'
OUT = ROOT / 'public' / 'assets' / 'tiles'
SS = 4  # supersampling of the diamond
W, H = 128, 64

# set name -> (texture, size of the square patch in texture pixels, number of full tiles, number of soft-edged patches, brightness factor)
SETS = {
    'flag': ('tex_flag', 150, 8, 0, 1.0),
    'flagroad': ('tex_flagroad', 220, 8, 6, 0.68),
    'soil': ('tex_soil', 380, 8, 0, 1.0),
    'trail': ('tex_trail', 380, 8, 6, 0.9),
    'rock': ('tex_rock', 360, 8, 0, 1.0),
    'rockroad': ('tex_rockroad', 170, 8, 6, 0.9),
    'ash': ('tex_ash', 400, 8, 0, 0.5),
    'ashtrail': ('tex_ashtrail', 400, 8, 6, 0.6),
}
# how much of the texture's own contrast a set keeps (1 = all of it); the stone textures are busy once they are shrunk to half size
CONTRAST = {'ash': 1.6, 'ashtrail': 1.3, 'flag': 0.55, 'flagroad': 0.7, 'soil': 0.8, 'rock': 0.7, 'rockroad': 0.75}
# where the patches come from: (x, y of the top-left corner as a fraction of the room left in the texture, turns of 90 degrees, mirrored)
PLACES = [(0.05, 0.05, 0, False), (0.9, 0.1, 1, False), (0.2, 0.85, 2, True), (0.8, 0.8, 3, False), (0.5, 0.45, 0, True), (0.1, 0.5, 1, True),
          (0.6, 0.05, 2, False), (0.35, 0.7, 3, True), (0.95, 0.5, 0, False), (0.45, 0.2, 1, False)]


def diamond(texture: Image.Image, size: int, place: tuple[float, float, int, bool]) -> Image.Image:
    """One 128 x 64 RGBA diamond cut from a patch of `size` px."""
    fx, fy, turns, mirror = place
    tex = texture
    if mirror:
        tex = tex.transpose(Image.FLIP_LEFT_RIGHT)
    for _ in range(turns):
        tex = tex.transpose(Image.ROTATE_90)
    room = tex.width - size
    ox, oy = fx * room, fy * room
    k = SS
    # output pixel (X, Y) of the supersampled diamond -> position in the texture: u = X/(W*k) + Y/(H*k) - 1/2 and v = Y/(H*k) - X/(W*k) + 1/2
    # run from 0 to 1 over the diamond, and the texture is sampled at (ox + u * size, oy + v * size)
    coeffs = (size / (W * k), size / (H * k), ox - size / 2, -size / (W * k), size / (H * k), oy + size / 2)
    return tex.transform((W * k, H * k), Image.AFFINE, coeffs, Image.BICUBIC).convert('RGB')


def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def mask(feather: float, seed: int) -> np.ndarray:
    """Alpha of the diamond at the supersampled size: slightly too big (a full tile) or fading out towards the rim (a soft edge)."""
    ys, xs = np.mgrid[0:H * SS, 0:W * SS].astype(np.float64)
    ys = (ys + 0.5) / SS
    xs = (xs + 0.5) / SS
    inside = 1.0 - (np.abs(xs - W / 2) / (W / 2) + np.abs(ys - H / 2) / (H / 2))  # 1 in the middle, 0 on the rim
    if feather <= 0:
        return (inside > -0.03).astype(np.float64)
    rng = np.random.default_rng(seed)
    noise = rng.random((6, 12))
    noise = np.array(Image.fromarray((noise * 255).astype(np.uint8)).resize((W * SS, H * SS), Image.BICUBIC), dtype=np.float64) / 255.0
    return smoothstep(0.02 + 0.25 * noise, 0.02 + feather + 0.25 * noise, inside)


def build(name: str, preview: Path | None) -> None:
    texture_name, size, n_full, n_edge, gain = SETS[name]
    texture = Image.open(SRC / f'{texture_name}.webp').convert('RGB')
    target_mean = np.asarray(texture, dtype=np.float64).mean(axis=(0, 1))
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for kind, count, feather in (('', n_full, 0.0), ('edge_', n_edge, 0.45)):
        for i in range(count):
            rgb = np.asarray(diamond(texture, size, PLACES[(i + (4 if kind else 0)) % len(PLACES)]), dtype=np.float64)
            alpha = mask(feather, 100 + i)
            weight = alpha[..., None]
            mean = (rgb * weight).sum(axis=(0, 1)) / max(weight.sum(), 1.0)
            # bring the brightness of this patch to the texture's mean and tone down its contrast
            rgb = rgb * (target_mean.mean() / max(mean.mean(), 1.0))
            rgb = target_mean.mean() + (rgb - target_mean.mean()) * CONTRAST.get(name, 0.85)
            rgb = np.clip(rgb * gain, 0, 255)
            rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
            tile = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((W, H), Image.LANCZOS).convert('RGBA')
            file = OUT / f'{name}_{kind}{i}.png'
            tile.save(file, optimize=True)
            made.append(tile)
    print(f'{name}: {len(made)} tiles from {texture_name} ({size}px patches)')
    if preview:
        preview.mkdir(parents=True, exist_ok=True)
        # a small iso floor: the full tiles scattered over 10 x 10 cells, so the seams between variants are visible
        sheet = Image.new('RGBA', (W * 10, H * 10 + H), (20, 24, 28, 255))
        for gy in range(10):
            for gx in range(10):
                tile = made[(gx * 7 + gy * 3) % n_full]
                sheet.alpha_composite(tile, ((gx - gy) * W // 2 + W * 5 - W // 2, (gx + gy) * H // 2))
        sheet.convert('RGB').save(preview / f'{name}.png')


def main() -> None:
    preview = Path(sys.argv[sys.argv.index('--preview') + 1]) if '--preview' in sys.argv else None
    chosen = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--preview']
    for name in chosen or SETS:
        build(name, preview)


if __name__ == '__main__':
    main()
