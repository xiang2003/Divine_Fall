import { drawWallBlock, makeCanvas } from './PlaceholderArt';

/** Wall blocks of the ruins: the plain stone block with moss on top, along the edges and at the foot, and vines hanging down the two faces. */

/** Small deterministic random numbers, so every variant is the same each time the game starts. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

const MOSS = ['#3f6a2c', '#4f7a38', '#6b9a46'];
const VINE = '#2a4a26';
const LEAF = ['#4d8a34', '#6fae45'];

/** One 64 x 64 wall block (the foot diamond is centred at (32, 48), like the plain wall). */
export function drawMossyWall(variant: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.drawImage(drawWallBlock(), 0, 0);
  const r = rng(variant * 7919 + 13);
  // everything below is drawn only where the block already has pixels
  ctx.globalCompositeOperation = 'source-atop';
  const dab = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = MOSS[Math.floor(r() * MOSS.length)]!;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  // the top: moss in patches
  for (let i = 0; i < 9 + variant * 2; i++) dab(14 + r() * 36, 6 + r() * 20, 2 + Math.floor(r() * 5), 1 + Math.floor(r() * 2));
  // along the top edges of the two faces and at their feet
  for (let i = 0; i < 12; i++) {
    const t = r();
    dab(t * 31, 16 + t * 16 + 1 + r() * 3, 2 + Math.floor(r() * 3), 2); // left face, under its top edge
    dab(32 + t * 31, 32 - t * 16 + 1 + r() * 3, 2 + Math.floor(r() * 3), 2); // right face
  }
  for (let i = 0; i < 8; i++) {
    const t = r();
    dab(t * 31, 48 + t * 16 - 5 + r() * 3, 2 + Math.floor(r() * 4), 2);
    dab(32 + t * 31, 64 - t * 16 - 5 + r() * 3, 2 + Math.floor(r() * 4), 2);
  }
  // vines: from the top edge of a face straight down, wavering a little, with a leaf every few pixels
  const vines = 3 + (variant % 3);
  for (let v = 0; v < vines; v++) {
    const left = r() < 0.5;
    const t = 0.1 + r() * 0.8;
    const x0 = left ? t * 31 : 32 + t * 31;
    const y0 = left ? 16 + t * 16 : 32 - t * 16;
    const length = 10 + r() * 22;
    let x = x0;
    for (let y = 0; y < length; y++) {
      if (y % 5 === 0) x += r() < 0.5 ? -1 : 1;
      ctx.fillStyle = VINE;
      ctx.fillRect(Math.round(x), Math.round(y0 + y), 1, 1);
      if (y % 4 === 3) {
        ctx.fillStyle = LEAF[Math.floor(r() * LEAF.length)]!;
        const side = r() < 0.5 ? -2 : 1;
        ctx.fillRect(Math.round(x) + side, Math.round(y0 + y), 2, 1);
        ctx.fillRect(Math.round(x) + side, Math.round(y0 + y) - 1, 1, 1);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}
