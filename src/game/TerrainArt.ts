import { makeCanvas, poly, type Pt } from './PlaceholderArt';

/**
 * Procedural ground, water and rock art for the beach and cave maps (placeholders drawn by this project).
 * Everything is drawn at SUPERSAMPLE x the tile size and shown scaled down with smoothing, like the buildings.
 */
export const TERRAIN_SUPERSAMPLE = 2;
const S = TERRAIN_SUPERSAMPLE;

/** Deterministic random numbers so a tile always looks the same. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIAMOND: readonly Pt[] = [
  [0, 16],
  [32, 0],
  [64, 16],
  [32, 32],
];

/** A 64x32 diamond (drawn at SxS) filled with `base`, clipped, then `paint` adds texture inside the clip. */
function diamondTile(base: string, edge: string, paint: (ctx: CanvasRenderingContext2D, rand: () => number) => void, seed: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64 * S, 32 * S);
  ctx.scale(S, S);
  poly(ctx, DIAMOND, base, edge);
  ctx.save();
  ctx.beginPath();
  DIAMOND.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  paint(ctx, rng(seed));
  ctx.restore();
  return canvas;
}

/** Warm beach sand with darker grains, pale grains and the odd pebble or shell. */
export function drawSandTile(variant: number): HTMLCanvasElement {
  const base = ['#d3bf8e', '#cdb985'][variant] ?? '#d3bf8e';
  return diamondTile(base, base, (ctx, rand) => {
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,248,215,0.45)' : 'rgba(120,92,48,0.28)';
      ctx.fillRect(rand() * 64, rand() * 32, 1.2, 1);
    }
    // soft ripples
    ctx.strokeStyle = 'rgba(150,120,70,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const x = 8 + rand() * 40;
      const y = 6 + rand() * 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y - 2, x + 16, y);
      ctx.stroke();
    }
    if (rand() > 0.6) {
      ctx.fillStyle = '#efe6cf';
      ctx.fillRect(14 + rand() * 36, 9 + rand() * 14, 2.2, 1.6);
    }
  }, 3000 + variant);
}

/** Damp dark cave floor: blue-grey slate with cracks and faint wet highlights. */
export function drawCaveTile(variant: number): HTMLCanvasElement {
  const base = ['#323a47', '#2c3441'][variant] ?? '#323a47';
  return diamondTile(base, '#1c212b', (ctx, rand) => {
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = rand() > 0.55 ? 'rgba(170,200,230,0.10)' : 'rgba(0,0,0,0.20)';
      ctx.fillRect(rand() * 64, rand() * 32, 2, 1);
    }
    ctx.strokeStyle = 'rgba(8,10,16,0.45)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 2; i++) {
      let x = 10 + rand() * 40;
      let y = 6 + rand() * 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (rand() - 0.5) * 12;
        y += (rand() - 0.2) * 5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (rand() > 0.7) {
      ctx.fillStyle = 'rgba(120,200,215,0.18)'; // a damp patch
      ctx.beginPath();
      ctx.ellipse(32, 16, 8 + rand() * 6, 3 + rand() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 4000 + variant);
}

/** Water: `sea` is a clear blue-green; `murk` is the cloudy brown-green of the fouled spring, with a faint glow. */
export function drawWaterTile(kind: 'sea' | 'murk', variant: number): HTMLCanvasElement {
  const sea = kind === 'sea';
  const base = sea ? ['#2c7b97', '#287290'][variant] ?? '#2c7b97' : ['#2c4a4c', '#274244'][variant] ?? '#2c4a4c';
  return diamondTile(base, sea ? '#215f78' : '#1c3234', (ctx, rand) => {
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const x = rand() * 56;
      const y = 4 + rand() * 24;
      ctx.strokeStyle = sea ? 'rgba(210,245,255,0.35)' : 'rgba(150,215,205,0.30)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 5, y - 2, x + 10, y);
      ctx.stroke();
    }
    if (!sea) {
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(160,245,215,0.55)';
        ctx.fillRect(rand() * 60, 4 + rand() * 24, 1.8, 1.8);
      }
    }
  }, 5000 + variant + (sea ? 0 : 50));
}

/** A cluster of pale blue crystal shards with a glow: the fragment in the spring cave. 64x64, base diamond in the bottom 32 rows. */
export function drawShard(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64 * S, 64 * S);
  ctx.scale(S, S);
  ctx.lineJoin = 'round';
  const glow = ctx.createRadialGradient(32, 40, 0, 32, 40, 30);
  glow.addColorStop(0, 'rgba(150,235,255,0.55)');
  glow.addColorStop(1, 'rgba(150,235,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(32, 50, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const crystal = (x: number, h: number, w: number, tilt: number) => {
    const pts: Pt[] = [[x - w, 50], [x - w * 0.4 + tilt, 50 - h], [x + w * 0.5 + tilt, 50 - h * 0.85], [x + w, 50]];
    poly(ctx, pts, '#9fe6f5', '#3b7f93');
    poly(ctx, [[x - w, 50], [x - w * 0.4 + tilt, 50 - h], [x + tilt * 0.4, 50 - h * 0.6], [x, 50]], '#d8fbff');
  };
  crystal(24, 22, 5, -2);
  crystal(38, 28, 6, 2);
  crystal(31, 36, 5, 0);
  return canvas;
}

/** A round stone seal on a low pedestal, gold lines glowing in it: the first relic. 64x64, base diamond in the bottom 32 rows. */
export function drawRelic(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64 * S, 64 * S);
  ctx.scale(S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(32, 51, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // pedestal
  ctx.fillStyle = '#8f8a80';
  ctx.beginPath();
  ctx.ellipse(32, 48, 15, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(17, 40, 30, 8);
  ctx.fillStyle = '#b5afa3';
  ctx.beginPath();
  ctx.ellipse(32, 40, 15, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // the seal: an upright disc with a ring and a closed-eye mark
  const glow = ctx.createRadialGradient(32, 26, 0, 32, 26, 22);
  glow.addColorStop(0, 'rgba(255,214,120,0.6)');
  glow.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(6, 4, 52, 44);
  ctx.fillStyle = '#6a655c';
  ctx.beginPath();
  ctx.ellipse(32, 26, 13, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f0c75e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(32, 26, 10, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, 26);
  ctx.quadraticCurveTo(32, 20, 40, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(32, 26);
  ctx.lineTo(32, 33);
  ctx.stroke();
  return canvas;
}

/** A boulder (beach) or a rock pillar (cave) standing on a tile: 64x64, base diamond in the bottom 32 rows. */
export function drawRock(kind: 'boulder' | 'pillar', variant: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64 * S, 64 * S);
  ctx.scale(S, S);
  ctx.lineJoin = 'round';
  const rand = rng(6000 + variant + (kind === 'pillar' ? 40 : 0));
  const palette =
    kind === 'boulder'
      ? { light: '#c8bda6', mid: '#9d927c', dark: '#6f6757', line: '#4b4538' }
      : { light: '#59647a', mid: '#3d465a', dark: '#262c3b', line: '#161a24' };

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(34, 49, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // the silhouette: a lumpy dome (boulder) or a tall tapering spire (pillar)
  const height = kind === 'boulder' ? 26 + rand() * 8 : 40 + rand() * 12;
  const half = kind === 'boulder' ? 21 + rand() * 4 : 13 + rand() * 4;
  const baseY = 50;
  const topX = 32 + (rand() - 0.5) * 6;
  const pts: Pt[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 32 - half + 2 * half * t;
    const dome = Math.sin(t * Math.PI);
    const y = baseY - (kind === 'boulder' ? dome * height : Math.pow(dome, 1.6) * height) + (rand() - 0.5) * 3;
    pts.push([i === Math.round(n / 2) && kind === 'pillar' ? topX : x, y]);
  }
  pts.push([32 + half, baseY], [32 - half, baseY]);
  poly(ctx, pts, palette.mid, palette.line);
  // lit left side, shaded right side
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = palette.light;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(30, 0);
  ctx.lineTo(24, 64);
  ctx.lineTo(0, 64);
  ctx.fill();
  ctx.fillStyle = palette.dark;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(64, 0);
  ctx.lineTo(64, 64);
  ctx.lineTo(46, 64);
  ctx.fill();
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 5; i++) {
    const x = 18 + rand() * 28;
    const y = 22 + rand() * 24;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 10, y + 4 + rand() * 6);
    ctx.stroke();
  }
  ctx.restore();
  return canvas;
}
