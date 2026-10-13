import { makeCanvas } from './PlaceholderArt';

/**
 * Procedural isometric buildings (placeholders drawn by this project, no third-party art).
 * A building covers a rectangle of w x h tiles. It is drawn at 2x resolution and shown at half scale with smoothing,
 * so edges stay clean on the 64x32 tile grid.
 */

export type BuildingStyle = 'home' | 'elder' | 'store' | 'boat' | 'shed' | 'tent' | 'campfire' | 'well' | 'ferry';

/** One building sprite: its style and footprint. The manifest registers one asset per entry. */
export interface BuildingVariant {
  style: BuildingStyle;
  w: number;
  h: number;
}

/** Every style / size a map may use (maps are checked against this list). */
export const BUILDING_VARIANTS: readonly BuildingVariant[] = [
  { style: 'home', w: 3, h: 3 },
  { style: 'elder', w: 4, h: 3 },
  { style: 'store', w: 3, h: 3 },
  { style: 'boat', w: 4, h: 3 },
  { style: 'shed', w: 2, h: 2 },
  { style: 'tent', w: 2, h: 2 },
  { style: 'campfire', w: 2, h: 2 },
  { style: 'well', w: 2, h: 2 },
  { style: 'ferry', w: 5, h: 3 },
];

/**
 * Buildings that use third-party art (log cabins by rubberduck, CC0; see ASSETS.md) instead of the procedural drawing.
 * `anchorY` is measured from the bottom of the image up to the middle of the footprint on the ground; the images are
 * 128x64-tile renders shown at half size. These numbers come from tools/prepare_assets.py (a test checks them against the files).
 */
export const CABIN_SPRITES: Partial<Record<BuildingStyle, { url: string; width: number; height: number; anchorY: number }>> = {
  home: { url: 'assets/buildings/cabin_home.png', width: 392, height: 370, anchorY: 0.2973 },
  elder: { url: 'assets/buildings/cabin_elder.png', width: 498, height: 398, anchorY: 0.3166 },
  store: { url: 'assets/buildings/cabin_store.png', width: 405, height: 336, anchorY: 0.3274 },
  boat: { url: 'assets/buildings/cabin_boat.png', width: 549, height: 377, anchorY: 0.3342 },
  shed: { url: 'assets/buildings/cabin_shed.png', width: 288, height: 235, anchorY: 0.3319 },
  tent: { url: 'assets/buildings/prop_tent.png', width: 240, height: 229, anchorY: 0.332 },
  campfire: { url: 'assets/buildings/prop_campfire.png', width: 147, height: 90, anchorY: 0.5 },
};

export function buildingKey(style: string, w: number, h: number): string {
  return `building.${style}_${w}x${h}`;
}

export function isBuildingVariant(style: string, w: number, h: number): boolean {
  return BUILDING_VARIANTS.some((v) => v.style === style && v.w === w && v.h === h);
}

/** Supersampling factor of the drawn canvas. The manifest shows it at 1 / SUPERSAMPLE. */
export const SUPERSAMPLE = 2;
const WALL_HEIGHT = 46;
const ROOF_HEIGHT = 44;
const OVERHANG = 0.32;
const MARGIN = 10;

interface Palette {
  wallLeft: string;
  wallRight: string;
  wallLine: string;
  roofLeft: string;
  roofRight: string;
  roofStroke: string;
  door: string;
  trim: string;
}

const PALETTES: Record<Exclude<BuildingStyle, 'well' | 'ferry' | 'shed' | 'tent' | 'campfire'>, Palette> = {
  home: { wallLeft: '#a8774b', wallRight: '#835a38', wallLine: '#5b3d25', roofLeft: '#d2ad56', roofRight: '#b08b3c', roofStroke: '#7d6026', door: '#4a2f1b', trim: '#5b3d25' },
  elder: { wallLeft: '#c3a57c', wallRight: '#9c8160', wallLine: '#6e583f', roofLeft: '#8fa874', roofRight: '#6f8858', roofStroke: '#46583a', door: '#4a3a28', trim: '#6e583f' },
  store: { wallLeft: '#8a6644', wallRight: '#6b4e33', wallLine: '#43301f', roofLeft: '#a85d42', roofRight: '#864830', roofStroke: '#53291a', door: '#35261a', trim: '#43301f' },
  boat: { wallLeft: '#6f8c9c', wallRight: '#566f7d', wallLine: '#364852', roofLeft: '#5d7783', roofRight: '#485f6a', roofStroke: '#2c3d46', door: '#2f3b40', trim: '#364852' },
};

type P3 = readonly [number, number, number];

/** A deterministic random source so a building always looks the same. */
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

/** Pixel size of the canvas for a w x h footprint, and where the footprint centre sits in it. */
export function buildingCanvasSize(w: number, h: number): { width: number; height: number; centerX: number; centerY: number } {
  const o = OVERHANG;
  const left = h * 32 + o * 64 + MARGIN;
  const right = w * 32 + o * 64 + MARGIN;
  const top = WALL_HEIGHT + ROOF_HEIGHT + MARGIN + 6;
  const bottom = (w + h) * 16 + o * 32 + MARGIN;
  const width = Math.ceil(left + right);
  const height = Math.ceil(top + bottom);
  // The footprint centre in "A-relative" screen space is ((w - h) * 16, (w + h) * 8).
  return { width, height, centerX: left + (w - h) * 16, centerY: top + (w + h) * 8 };
}

export function drawBuilding(style: BuildingStyle, w: number, h: number): HTMLCanvasElement {
  const size = buildingCanvasSize(w, h);
  const [canvas, ctx] = makeCanvas(size.width * SUPERSAMPLE, size.height * SUPERSAMPLE);
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Footprint corner A (x = 0, y = 0, z = 0) in canvas space.
  const ax = size.centerX - (w - h) * 16;
  const ay = size.centerY - (w + h) * 8;
  const pt = (x: number, y: number, z: number): [number, number] => [ax + (x - y) * 32, ay + (x + y) * 16 - z];
  const poly = (pts: readonly P3[], fill: string, stroke?: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [sx, sy] = pt(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  };
  const clipTo = (pts: readonly P3[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [sx, sy] = pt(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.clip();
  };
  const line = (a: P3, b: P3, color: string, width = 1) => {
    const [x0, y0] = pt(...a);
    const [x1, y1] = pt(...b);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // Soft ground shadow, thrown to the lower right.
  const reach = style === 'well' ? 0.35 : 0.9;
  const shadow: P3[] = [[-0.1, -0.1, 0], [w + reach, 0, 0], [w + reach, h + reach, 0], [0, h + reach * 0.6, 0]];
  poly(shadow, 'rgba(0,0,0,0.2)');

  if (style === 'well') {
    drawWell(ctx, pt, w, h);
    return canvas;
  }
  if (style === 'ferry') {
    drawFerry(ctx, pt, w, h);
    return canvas;
  }

  const pal = PALETTES[style === 'shed' || style === 'tent' || style === 'campfire' ? 'home' : style];
  const H = WALL_HEIGHT;
  const R = ROOF_HEIGHT;
  const o = OVERHANG;
  const random = rng(w * 131 + h * 17 + style.charCodeAt(0));

  // ---- walls ---------------------------------------------------------------------------------
  const southWall: P3[] = [[0, h, 0], [w, h, 0], [w, h, H], [0, h, H]];
  const eastWall: P3[] = [[w, h, 0], [w, 0, 0], [w, 0, H], [w, h, H]];
  poly(southWall, pal.wallLeft, pal.wallLine);
  poly(eastWall, pal.wallRight, pal.wallLine);

  // plank lines
  ctx.save();
  clipTo(southWall);
  for (let u = 0.5; u < w; u += 0.5) line([u, h, 0], [u, h, H], 'rgba(0,0,0,0.22)');
  for (let z = 10; z < H; z += 11) line([0, h, z], [w, h, z], 'rgba(0,0,0,0.10)');
  ctx.restore();
  ctx.save();
  clipTo(eastWall);
  for (let v = 0.5; v < h; v += 0.5) line([w, v, 0], [w, v, H], 'rgba(0,0,0,0.26)');
  for (let z = 10; z < H; z += 11) line([w, 0, z], [w, h, z], 'rgba(0,0,0,0.12)');
  ctx.restore();

  // stone foundation
  poly([[0, h, 0], [w, h, 0], [w, h, 7], [0, h, 7]], '#8d8a84', pal.wallLine);
  poly([[w, h, 0], [w, 0, 0], [w, 0, 7], [w, h, 7]], '#6f6c68', pal.wallLine);

  // door (south wall), window (east wall), small window (south wall)
  const doorU = w >= 4 ? 1.15 : 0.95;
  poly([[doorU, h, 0], [doorU + 0.85, h, 0], [doorU + 0.85, h, 30], [doorU, h, 30]], pal.door, pal.trim);
  line([doorU + 0.62, h, 14], [doorU + 0.62, h, 15], '#d8c58a', 2);
  poly([[doorU - 0.12, h, 31], [doorU + 0.97, h, 31], [doorU + 0.97, h, 34], [doorU - 0.12, h, 34]], pal.trim);
  const windowV = h / 2 - 0.4;
  poly([[w, windowV + 0.9, 18], [w, windowV, 18], [w, windowV, 36], [w, windowV + 0.9, 36]], '#2b3a44', pal.trim);
  poly([[w, windowV + 0.9, 18], [w, windowV, 18], [w, windowV, 27], [w, windowV + 0.9, 27]], 'rgba(255,214,120,0.35)');
  line([w, windowV + 0.45, 18], [w, windowV + 0.45, 36], pal.trim, 1.5);
  if (w >= 4) {
    const wu = w - 1.4;
    poly([[wu, h, 18], [wu + 0.8, h, 18], [wu + 0.8, h, 34], [wu, h, 34]], '#2b3a44', pal.trim);
    line([wu + 0.4, h, 18], [wu + 0.4, h, 34], pal.trim, 1.5);
  }

  // doorstep
  poly([[doorU - 0.15, h + 0.35, 0], [doorU + 1.0, h + 0.35, 0], [doorU + 1.0, h, 0], [doorU - 0.15, h, 0]], '#9a968c', pal.wallLine);

  // ---- roof (a hipped pyramid with an overhang) ----------------------------------------------
  const apex: P3 = [w / 2, h / 2, H + R];
  const southRoof: [P3, P3, P3] = [[-o, h + o, H - 2], [w + o, h + o, H - 2], apex];
  const eastRoof: [P3, P3, P3] = [[w + o, h + o, H - 2], [w + o, -o, H - 2], apex];
  poly(southRoof, pal.roofLeft, pal.roofStroke);
  poly(eastRoof, pal.roofRight, pal.roofStroke);

  const thatch = (face: readonly [P3, P3, P3], darkAlpha: number) => {
    ctx.save();
    clipTo(face);
    // courses parallel to the eaves, then short stems for the straw texture
    for (let t = 0.12; t < 1; t += 0.13) {
      const [x0, y0] = pt(face[0][0] + (apex[0] - face[0][0]) * t, face[0][1] + (apex[1] - face[0][1]) * t, face[0][2] + (apex[2] - face[0][2]) * t);
      const [x1, y1] = pt(face[1][0] + (apex[0] - face[1][0]) * t, face[1][1] + (apex[1] - face[1][1]) * t, face[1][2] + (apex[2] - face[1][2]) * t);
      ctx.strokeStyle = `rgba(0,0,0,${darkAlpha})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const t = random();
      const s = random();
      const bx = face[0][0] + (face[1][0] - face[0][0]) * s;
      const by = face[0][1] + (face[1][1] - face[0][1]) * s;
      const bz = face[0][2] + (face[1][2] - face[0][2]) * s;
      const x = bx + (apex[0] - bx) * t;
      const y = by + (apex[1] - by) * t;
      const z = bz + (apex[2] - bz) * t;
      const [sx, sy] = pt(x, y, z);
      ctx.strokeStyle = random() > 0.5 ? 'rgba(255,240,170,0.35)' : 'rgba(40,24,6,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 1, sy + 3);
      ctx.stroke();
    }
    ctx.restore();
  };
  thatch(southRoof, 0.22);
  thatch(eastRoof, 0.3);
  // eave shadow on the wall
  ctx.save();
  clipTo(southWall);
  poly([[0, h, H - 9], [w, h, H - 9], [w, h, H], [0, h, H]], 'rgba(0,0,0,0.22)');
  ctx.restore();

  // a chimney on the home and the elder's house
  if (style === 'home' || style === 'elder') {
    const cx = w * 0.7;
    const cy = h * 0.3;
    poly([[cx, cy + 0.35, H + 8], [cx + 0.35, cy + 0.35, H + 8], [cx + 0.35, cy + 0.35, H + 34], [cx, cy + 0.35, H + 34]], '#8d8a84', '#4d4a46');
    poly([[cx + 0.35, cy + 0.35, H + 8], [cx + 0.35, cy, H + 8], [cx + 0.35, cy, H + 34], [cx + 0.35, cy + 0.35, H + 34]], '#6f6c68', '#4d4a46');
    poly([[cx, cy, H + 34], [cx + 0.35, cy, H + 34], [cx + 0.35, cy + 0.35, H + 34], [cx, cy + 0.35, H + 34]], '#3a3835');
  }
  return canvas;
}

/**
 * The stranded ferry: a hull of grey metal plates over pale bone ribs, a bare mast and a cold blue lantern at the prow.
 * It is deliberately "not made on the island" (see the chapter 1 design).
 */
function drawFerry(
  ctx: CanvasRenderingContext2D,
  pt: (x: number, y: number, z: number) => [number, number],
  w: number,
  h: number,
): void {
  const shape = (pts: readonly (readonly [number, number, number])[], fill: string, stroke = '#2a3036') => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [sx, sy] = pt(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };
  const seg = (a: readonly [number, number, number], b: readonly [number, number, number], color: string, width: number) => {
    const [x0, y0] = pt(a[0], a[1], a[2]);
    const [x1, y1] = pt(b[0], b[1], b[2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const y0 = 0.2;
  const y1 = h - 0.2;
  const bow = w - 0.9;
  const top = 28;

  // hull sides: south face, then the two faces of the prow
  const south: [number, number, number][] = [[0.3, y1, 5], [bow, y1, 5], [bow, y1, top], [0.3, y1, top]];
  shape(south, '#6f7b86');
  shape([[bow, y1, 5], [w, h / 2, 11], [w, h / 2, top + 6], [bow, y1, top]], '#808d98');
  shape([[w, h / 2, 11], [bow, y0, 5], [bow, y0, top], [w, h / 2, top + 6]], '#55616b');

  // bone ribs and riveted bands on the south face
  for (let u = 0.6; u < bow; u += 0.55) seg([u, y1, 6], [u, y1, top - 1], '#e6e0cc', 2.2);
  seg([0.3, y1, 12], [bow, y1, 12], '#3b444c', 1.4);
  seg([0.3, y1, 22], [bow, y1, 22], '#3b444c', 1.4);
  for (let u = 0.45; u < bow; u += 0.55) {
    const [rx, ry] = pt(u, y1, 17);
    ctx.fillStyle = '#c8d0d6';
    ctx.fillRect(rx - 0.8, ry - 0.8, 1.6, 1.6);
  }

  // deck
  shape([[0.3, y0, top], [bow, y0, top], [w, h / 2, top + 6], [bow, y1, top], [0.3, y1, top]], '#8a7656');
  for (let v = 0.55; v < h - 0.3; v += 0.5) seg([0.35, v, top], [bow - 0.05, v, top], 'rgba(0,0,0,0.25)', 1);

  // mast, boom and a lantern
  seg([1.4, h / 2, top], [1.4, h / 2, top + 58], '#4a4036', 3);
  seg([0.7, h / 2, top + 44], [2.4, h / 2, top + 44], '#4a4036', 2);
  const [lx, ly] = pt(w - 0.7, h / 2, top + 10);
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
  glow.addColorStop(0, 'rgba(150,230,255,0.95)');
  glow.addColorStop(1, 'rgba(150,230,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(lx - 12, ly - 12, 24, 24);
  ctx.fillStyle = '#d8f6ff';
  ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);
}

function drawWell(
  ctx: CanvasRenderingContext2D,
  pt: (x: number, y: number, z: number) => [number, number],
  w: number,
  h: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const ellipse = (rx: number, z: number, fill: string, stroke?: string) => {
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const [sx, sy] = pt(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  };
  // stone ring: stacked rings give it a wall
  for (let z = 0; z <= 16; z += 2) ellipse(0.85, z, z % 4 === 0 ? '#8d8a84' : '#7a7772', '#4d4a46');
  ellipse(0.85, 18, '#a29f98', '#4d4a46');
  ellipse(0.62, 18, '#1f3b4a', '#33505f');
  ellipse(0.5, 18, '#2f6277');
  // posts, crossbeam, little roof
  const post = (x: number, y: number) => {
    const [x0, y0] = pt(x, y, 18);
    const [x1, y1] = pt(x, y, 58);
    ctx.strokeStyle = '#5b3d25';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  post(cx - 0.75, cy + 0.2);
  post(cx + 0.75, cy - 0.2);
  const [bx0, by0] = pt(cx - 0.75, cy + 0.2, 56);
  const [bx1, by1] = pt(cx + 0.75, cy - 0.2, 56);
  ctx.strokeStyle = '#4a2f1b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx0, by0);
  ctx.lineTo(bx1, by1);
  ctx.stroke();
  // rope and bucket
  const [rx, ry] = pt(cx, cy, 56);
  const [bx, by] = pt(cx, cy, 34);
  ctx.strokeStyle = '#cdb88a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.fillStyle = '#7a5530';
  ctx.fillRect(bx - 5, by, 10, 8);
  ctx.strokeStyle = '#3a2814';
  ctx.strokeRect(bx - 5, by, 10, 8);
}
