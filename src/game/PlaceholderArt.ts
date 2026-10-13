/**
 * Procedurally drawn stand-in art, so the game runs with zero downloaded assets.
 * Every function returns a canvas that matches the frame/anchor layout declared in
 * assetManifest.ts. Replace any of these by giving the manifest entry a real `url`.
 */

import { mulberry32 } from '../systems/rng';

export type Pt = readonly [number, number];

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

export function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], fill: string, stroke?: string): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** 64x32 diamond floor tile. variant 0/1 are two stone tones; 2 is the exit rune. */
export function drawFloorTile(variant: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 32);
  const diamond: Pt[] = [
    [0, 16],
    [32, 0],
    [64, 16],
    [32, 32],
  ];
  const base = ['#3a3a44', '#34343e', '#2f3340'][variant] ?? '#3a3a44';
  poly(ctx, diamond, base, '#22222a');
  ctx.save();
  ctx.beginPath();
  diamond.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const rand = mulberry32(1000 + variant);
  for (let i = 0; i < 26; i++) {
    const shade = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillStyle = shade;
    ctx.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 32), 2, 1);
  }
  ctx.restore();
  if (variant === 2) {
    poly(
      ctx,
      [
        [10, 16],
        [32, 5],
        [54, 16],
        [32, 27],
      ],
      'rgba(0,0,0,0)',
      '#e0b84a',
    );
    poly(
      ctx,
      [
        [20, 16],
        [32, 10],
        [44, 16],
        [32, 22],
      ],
      'rgba(224,184,74,0.35)',
      '#f4d98a',
    );
  }
  return c;
}

/** 64x32 grass diamond. variant 0/1 are two greens. */
export function drawGrassTile(variant: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 32);
  const diamond: Pt[] = [
    [0, 16],
    [32, 0],
    [64, 16],
    [32, 32],
  ];
  poly(ctx, diamond, ['#456b3c', '#3f6337'][variant] ?? '#456b3c', '#2c4a28');
  ctx.save();
  ctx.beginPath();
  diamond.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const rand = mulberry32(2000 + variant);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(180,230,120,0.22)' : 'rgba(10,40,10,0.28)';
    ctx.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 32), 1, 2);
  }
  // an occasional pale flower
  if (rand() > 0.55) {
    ctx.fillStyle = '#e8e2b0';
    ctx.fillRect(Math.floor(14 + rand() * 36), Math.floor(8 + rand() * 16), 2, 2);
  }
  ctx.restore();
  return c;
}

/** 64x64 tree: a trunk on the base diamond (bottom 32 rows) with a rounded canopy above. Same footprint as a wall. */
export function drawTreeBlock(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  // shadow on the ground
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(32, 48, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // trunk
  ctx.fillStyle = '#5a3d27';
  ctx.fillRect(28, 36, 8, 16);
  ctx.fillStyle = '#3d2918';
  ctx.fillRect(33, 36, 3, 16);
  // canopy: three overlapping blobs, darker underneath
  const blob = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  blob(32, 28, 17, '#244d2a');
  blob(24, 22, 12, '#2f6a35');
  blob(40, 22, 12, '#2f6a35');
  blob(32, 14, 11, '#3b8040');
  blob(28, 11, 5, '#58a357');
  return c;
}

/** 64x64 wall cube. The base diamond occupies the bottom 32 rows (anchor y = 0.25). */
export function drawWallBlock(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(64, 64);
  const left: Pt[] = [
    [0, 16],
    [32, 32],
    [32, 64],
    [0, 48],
  ];
  const right: Pt[] = [
    [64, 16],
    [32, 32],
    [32, 64],
    [64, 48],
  ];
  const top: Pt[] = [
    [0, 16],
    [32, 0],
    [64, 16],
    [32, 32],
  ];
  poly(ctx, left, '#4b4650', '#1c1a20');
  poly(ctx, right, '#3a363f', '#1c1a20');
  poly(ctx, top, '#6a6470', '#26232a');
  // brick courses on the side faces
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (const off of [10, 21]) {
    ctx.beginPath();
    ctx.moveTo(0, 16 + off);
    ctx.lineTo(32, 32 + off);
    ctx.moveTo(64, 16 + off);
    ctx.lineTo(32, 32 + off);
    ctx.stroke();
  }
  return c;
}

/** 48x48 crate, base diamond centred at (24, 36) (anchor y = 0.25). */
export function drawCrate(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 48);
  const left: Pt[] = [
    [2, 16],
    [24, 27],
    [24, 47],
    [2, 36],
  ];
  const right: Pt[] = [
    [46, 16],
    [24, 27],
    [24, 47],
    [46, 36],
  ];
  const top: Pt[] = [
    [2, 16],
    [24, 5],
    [46, 16],
    [24, 27],
  ];
  poly(ctx, left, '#7a5230', '#2b1b0e');
  poly(ctx, right, '#5e3f24', '#2b1b0e');
  poly(ctx, top, '#97693d', '#2b1b0e');
  // planks + cross brace on the top
  ctx.strokeStyle = 'rgba(30,18,8,0.7)';
  ctx.beginPath();
  ctx.moveTo(13, 10.5);
  ctx.lineTo(35, 21.5);
  ctx.moveTo(35, 10.5);
  ctx.lineTo(13, 21.5);
  ctx.stroke();
  return c;
}

/** 32x16 gold ring shown on the ground where the player was told to walk. */
export function drawMoveMarker(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 16);
  poly(
    ctx,
    [
      [2, 8],
      [16, 1],
      [30, 8],
      [16, 15],
    ],
    'rgba(224,184,74,0.12)',
    '#f4d98a',
  );
  poly(
    ctx,
    [
      [9, 8],
      [16, 4.5],
      [23, 8],
      [16, 11.5],
    ],
    'rgba(244,217,138,0.35)',
  );
  return c;
}

/** 40x20 soft ground shadow, anchored at its centre. */
export function drawShadow(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 20);
  ctx.translate(20, 10);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

