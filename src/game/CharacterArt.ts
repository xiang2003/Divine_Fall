import { makeCanvas } from './PlaceholderArt';
import type { AnimationSet } from './AnimationClock';

/**
 * Procedural character spritesheets (placeholders). All share one layout so the manifest can
 * describe them with the same animation table:
 *   row 0 idle (4)  row 1 walk (6)  row 2 attack (4, strike on frame 2)
 *   row 3 hurt (2)  row 4 die (5, non-looping)
 * Frames are 64x64, the character faces right (mirrored in code) and the feet touch y = 60.
 */
export const FRAME = 64;
const COLS = 6;
const ROWS = 5;

export function characterAnimations(attackFps: number): AnimationSet {
  return {
    idle: { row: 0, frames: 4, fps: 3, loop: true },
    walk: { row: 1, frames: 6, fps: 10, loop: true },
    attack: { row: 2, frames: 4, fps: attackFps, loop: false },
    hurt: { row: 3, frames: 2, fps: 8, loop: false },
    die: { row: 4, frames: 5, fps: 8, loop: false },
  };
}

interface Pose {
  /** Vertical breathing offset in px. */
  bob: number;
  /** -1..1 stride phase for legs / arms. */
  stride: number;
  /** Attack frame 0..3, or -1 when not attacking. */
  attack: number;
  hurt: boolean;
  /** 0..1 collapse progress for the death animation. */
  fall: number;
}

/** Pose for frame `col` of animation row `row`. */
function poseFor(row: number, col: number): Pose {
  const base: Pose = { bob: 0, stride: 0, attack: -1, hurt: false, fall: 0 };
  switch (row) {
    case 0:
      return { ...base, bob: [0, 0, 1, 1][col] ?? 0 };
    case 1: {
      const phase = Math.sin((col / 6) * Math.PI * 2);
      return { ...base, stride: phase, bob: Math.abs(Math.cos((col / 6) * Math.PI * 2)) > 0.5 ? 1 : 0 };
    }
    case 2:
      return { ...base, attack: col };
    case 3:
      return { ...base, hurt: true, bob: col };
    default:
      return { ...base, fall: col / 4 };
  }
}

type Draw = (ctx: CanvasRenderingContext2D, pose: Pose) => void;

/** Builds a 6x5 sheet; `draw` paints one pose with the origin at the feet and y pointing down. */
function buildSheet(draw: Draw, frame = FRAME): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(frame * COLS, frame * ROWS);
  for (let row = 0; row < ROWS; row++) {
    const frames = [4, 6, 4, 2, 5][row]!;
    for (let col = 0; col < frames; col++) {
      const pose = poseFor(row, col);
      ctx.save();
      ctx.translate(col * frame + frame / 2, row * frame + frame - 4);
      if (pose.fall > 0) {
        // Topple over around the feet and sink slightly.
        ctx.rotate(pose.fall * Math.PI * 0.48);
        ctx.translate(0, pose.fall * 4);
      } else if (pose.hurt) {
        ctx.rotate(-0.16);
      }
      draw(ctx, pose);
      ctx.restore();
    }
  }
  return canvas;
}

interface HumanoidStyle {
  cloak: string;
  cloakDark: string;
  skin: string;
  eye: string;
  accent: string;
  scale: number;
  /** Forward lean in px (hunched ghoul). */
  hunch: number;
  /** Floating cloak with no legs (shade). */
  floating: boolean;
  weapon: 'sword' | 'claw' | 'orb';
  hood: boolean;
}

function hurtTint(color: string, hurt: boolean): string {
  return hurt ? '#c0453a' : color;
}

function drawHumanoid(ctx: CanvasRenderingContext2D, pose: Pose, st: HumanoidStyle): void {
  ctx.scale(st.scale, st.scale);
  const hover = st.floating ? 9 + Math.sin(pose.bob * 2) : 0;
  const top = -34 + pose.bob - hover;
  const lean = st.hunch;

  // legs
  if (!st.floating) {
    const stride = pose.stride * 5;
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(-7 + stride, -14, 5, 14);
    ctx.fillRect(2 - stride, -14, 5, 14);
    ctx.fillStyle = '#14100e';
    ctx.fillRect(-8 + stride, -3, 7, 3);
    ctx.fillRect(1 - stride, -3, 7, 3);
  }

  // cloak / body
  ctx.beginPath();
  if (st.floating) {
    ctx.moveTo(-11 + lean, top + 8);
    ctx.lineTo(11 + lean, top + 8);
    ctx.lineTo(5, -hover + 2);
    ctx.lineTo(-5, -hover + 6);
  } else {
    ctx.moveTo(-11 + lean, top + 8);
    ctx.lineTo(11 + lean, top + 8);
    ctx.lineTo(13, -10);
    ctx.lineTo(-13, -10);
  }
  ctx.closePath();
  ctx.fillStyle = hurtTint(st.cloak, pose.hurt);
  ctx.fill();
  ctx.strokeStyle = st.cloakDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = st.accent;
  if (!st.floating) ctx.fillRect(-11, top + 20, 22, 3);

  // off-hand: lantern / fragment of divinity
  if (st.weapon === 'sword') {
    ctx.fillStyle = '#f2d36b';
    ctx.fillRect(-16, top + 20, 4, 4);
    ctx.fillStyle = 'rgba(242,211,107,0.25)';
    ctx.fillRect(-18, top + 18, 8, 8);
  }

  // head
  if (st.hood) {
    ctx.beginPath();
    ctx.moveTo(-9 + lean, top + 9);
    ctx.lineTo(-7 + lean, top - 3);
    ctx.lineTo(lean, top - 8);
    ctx.lineTo(7 + lean, top - 3);
    ctx.lineTo(9 + lean, top + 9);
    ctx.closePath();
    ctx.fillStyle = hurtTint(st.cloak, pose.hurt);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = st.skin;
  ctx.fillRect(-4 + lean, top - 1, 9, 7);
  ctx.fillStyle = st.eye;
  ctx.fillRect(lean + 0, top + 2, 2, 2);
  ctx.fillRect(lean + 3, top + 2, 2, 2);

  // weapon arm: raised on windup, swung through on the strike frames
  const shoulderX = 9 + lean;
  const shoulderY = top + 12;
  let angle = 1.35 + pose.stride * 0.45; // hanging, swinging while walking
  if (pose.attack >= 0) angle = [-2.3, -2.7, 0.35, 0.95][pose.attack] ?? angle;
  if (pose.hurt) angle = 2.2;
  if (pose.fall > 0) angle = 1.9;
  const armLen = 12;
  const tipX = shoulderX + Math.cos(angle) * armLen;
  const tipY = shoulderY + Math.sin(angle) * armLen;
  ctx.lineCap = 'round';
  ctx.strokeStyle = hurtTint(st.cloakDark, pose.hurt);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = st.skin;
  ctx.fillRect(tipX - 2, tipY - 2, 4, 4);

  if (st.weapon === 'sword') {
    ctx.strokeStyle = '#cfd6de';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + Math.cos(angle) * 17, tipY + Math.sin(angle) * 17);
    ctx.stroke();
    ctx.strokeStyle = '#8a6a2c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tipX - Math.sin(angle) * 3, tipY + Math.cos(angle) * 3);
    ctx.lineTo(tipX + Math.sin(angle) * 3, tipY - Math.cos(angle) * 3);
    ctx.stroke();
  } else if (st.weapon === 'claw') {
    ctx.strokeStyle = '#e7e2c8';
    ctx.lineWidth = 2;
    for (const off of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + Math.cos(angle + off) * 8, tipY + Math.sin(angle + off) * 8);
      ctx.stroke();
    }
  } else {
    // orb of dark light, brighter while charging / casting
    const glow = pose.attack >= 0 ? 1 : 0.5;
    ctx.fillStyle = `rgba(190,120,255,${0.25 * glow + 0.15})`;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9a8ff';
    ctx.fillRect(tipX - 2, tipY - 2, 4, 4);
  }
}

const PLAYER_STYLE: HumanoidStyle = {
  cloak: '#35506b',
  cloakDark: '#14212e',
  skin: '#d9b48c',
  eye: '#1a1410',
  accent: '#8a6a2c',
  scale: 1,
  hunch: 0,
  floating: false,
  weapon: 'sword',
  hood: true,
};

const GHOUL_STYLE: HumanoidStyle = {
  cloak: '#5b6b4a',
  cloakDark: '#262e1d',
  skin: '#9fb38a',
  eye: '#ffd24a',
  accent: '#3a2f22',
  scale: 1.08,
  hunch: 4,
  floating: false,
  weapon: 'claw',
  hood: false,
};

const SHADE_STYLE: HumanoidStyle = {
  cloak: '#4a3470',
  cloakDark: '#1d1233',
  skin: '#8e86a6',
  eye: '#ff6ad5',
  accent: '#7d4fc0',
  scale: 1,
  hunch: 0,
  floating: true,
  weapon: 'orb',
  hood: true,
};

const ARCHON_STYLE: HumanoidStyle = {
  cloak: '#5a1d2e',
  cloakDark: '#1b070d',
  skin: '#c9a98a',
  eye: '#ff5a3a',
  accent: '#d8b04a',
  scale: 1.5,
  hunch: 0,
  floating: false,
  weapon: 'sword',
  hood: true,
};

/** The boss uses a 96x96 frame so its larger body is not cropped. */
export const BOSS_FRAME = 96;

export function drawArchonSheet(): HTMLCanvasElement {
  return buildSheet((ctx, pose) => drawHumanoid(ctx, pose, ARCHON_STYLE), BOSS_FRAME);
}

export function drawPlayerSheet(): HTMLCanvasElement {
  return buildSheet((ctx, pose) => drawHumanoid(ctx, pose, PLAYER_STYLE));
}

export function drawGhoulSheet(): HTMLCanvasElement {
  return buildSheet((ctx, pose) => drawHumanoid(ctx, pose, GHOUL_STYLE));
}

export function drawShadeSheet(): HTMLCanvasElement {
  return buildSheet((ctx, pose) => drawHumanoid(ctx, pose, SHADE_STYLE));
}

/** Four-legged beast: low body, head forward, lunges on the attack frames. */
export function drawHoundSheet(): HTMLCanvasElement {
  return buildSheet((ctx, pose) => {
    const body = pose.hurt ? '#c0453a' : '#7a3b3b';
    const dark = '#2a1212';
    const lunge = pose.attack >= 0 ? [-3, -6, 8, 3][pose.attack]! : 0;
    ctx.translate(lunge, 0);
    const bob = pose.bob;
    const stride = pose.stride * 4;
    // legs (far pair darker)
    ctx.fillStyle = dark;
    ctx.fillRect(-12 + stride, -10, 4, 10);
    ctx.fillRect(6 - stride, -10, 4, 10);
    ctx.fillStyle = '#5c2a2a';
    ctx.fillRect(-7 - stride, -10, 4, 10);
    ctx.fillRect(11 + stride, -10, 4, 10);
    // body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -16 + bob, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.stroke();
    // tail
    ctx.strokeStyle = body;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -17 + bob);
    ctx.lineTo(-22, -24 + bob + stride * 0.3);
    ctx.stroke();
    // head + jaw
    ctx.fillStyle = body;
    ctx.fillRect(12, -25 + bob, 12, 10);
    ctx.fillStyle = dark;
    const open = pose.attack === 2 ? 4 : 0;
    ctx.fillRect(22, -18 + bob + open, 6, 3);
    ctx.fillStyle = '#f2f2e0';
    ctx.fillRect(23, -19 + bob + open, 2, 2);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(18, -23 + bob, 3, 3);
    // ears
    ctx.fillStyle = dark;
    ctx.fillRect(13, -29 + bob, 3, 5);
  });
}

/** 20x20 golden glow for the player's bolts. */
export function drawBolt(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(20, 20);
  const g = ctx.createRadialGradient(10, 10, 1, 10, 10, 10);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.4, 'rgba(255,214,102,0.95)');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 20, 20);
  return c;
}

/** 16x16 glowing projectile. */
export function drawOrb(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(16, 16);
  const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,230,255,1)');
  g.addColorStop(0.4, 'rgba(200,120,255,0.95)');
  g.addColorStop(1, 'rgba(120,40,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  return c;
}
