import type { SpikeState } from '../systems/hazards';
import { makeCanvas } from './PlaceholderArt';

/** Pictures of the ruins' hazards, drawn with canvas code (no image files): floor spikes in three states, an arrow slit, wall torches. */

/** Spikes are on a 64 x 64 sprite whose floor diamond is centred at (32, 48), the same as a wall block (anchor y = 0.25). */
export const SPIKE_SPRITE = { width: 64, height: 64 };

/** The 3 x 3 grid of spikes, in sprite pixels: one step along +x runs right-down, one along +y runs left-down. */
function spikeSpots(): [number, number][] {
  const spots: [number, number][] = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) spots.push([32 + i * 9 - j * 9, 48 + i * 4.5 + j * 4.5]);
  }
  // back to front: smaller x + y first
  return spots.sort((a, b) => a[1] - b[1]);
}

export function drawSpikes(state: SpikeState): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SPIKE_SPRITE.width, SPIKE_SPRITE.height);
  // the plate the spikes come out of: a worn stone slab, a little smaller than the tile
  ctx.fillStyle = '#2a2830';
  ctx.strokeStyle = '#121016';
  ctx.beginPath();
  ctx.moveTo(32, 34);
  ctx.lineTo(61, 48);
  ctx.lineTo(32, 62);
  ctx.lineTo(3, 48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [x, y] of spikeSpots()) {
    // the hole
    ctx.fillStyle = '#0b0a0e';
    ctx.beginPath();
    ctx.ellipse(x, y, 4.2, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    if (state === 'hidden') continue;
    const height = state === 'warn' ? 4 : 15;
    // the spike: a steel cone, lit from the left
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.moveTo(x - 3.2, y);
    ctx.lineTo(x, y - height);
    ctx.lineTo(x, y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a626c';
    ctx.beginPath();
    ctx.moveTo(x + 3.2, y);
    ctx.lineTo(x, y - height);
    ctx.lineTo(x, y + 1);
    ctx.closePath();
    ctx.fill();
    if (state === 'up') {
      ctx.fillStyle = '#d6dde5';
      ctx.fillRect(Math.round(x - 1), Math.round(y - height + 1), 1, 3); // the glint on the tip
    }
  }
  return c;
}

/** An arrow slit in a wall face: a narrow dark opening in a stone frame. `hot` is the moment before it shoots (it glows). */
export function drawArrowSlit(hot: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 32);
  if (hot) {
    const glow = ctx.createRadialGradient(12, 16, 1, 12, 16, 12);
    glow.addColorStop(0, 'rgba(160, 255, 90, 0.9)');
    glow.addColorStop(1, 'rgba(160, 255, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 24, 32);
  }
  ctx.fillStyle = '#26232a';
  ctx.fillRect(7, 6, 10, 20); // the frame
  ctx.fillStyle = hot ? '#8fe05a' : '#050407';
  ctx.fillRect(10, 8, 4, 16); // the slit
  ctx.fillStyle = '#4b4650';
  ctx.fillRect(6, 5, 12, 1);
  ctx.fillRect(6, 26, 12, 1);
  return c;
}

/** Wall torch: an iron bracket with a cold blue-green flame. Two frames so it flickers. 20 x 34, the bracket's foot at the bottom centre. */
export function drawTorch(frame: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(20, 34);
  // bracket
  ctx.fillStyle = '#2b2830';
  ctx.fillRect(8, 22, 4, 11);
  ctx.fillStyle = '#4b4650';
  ctx.fillRect(5, 20, 10, 3);
  ctx.fillRect(6, 17, 1, 4);
  ctx.fillRect(13, 17, 1, 4);
  // flame: outer blue, middle teal, white-cyan core; the second frame leans and is a little taller
  const lean = frame === 0 ? 0 : 1;
  const tall = frame === 0 ? 0 : 2;
  const flame = (color: string, w: number, h: number, dy: number): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(10 - w, 18 - dy);
    ctx.quadraticCurveTo(10 - w, 10 - dy - h / 2, 10 + lean, 18 - dy - h - tall);
    ctx.quadraticCurveTo(10 + w, 10 - dy - h / 2, 10 + w, 18 - dy);
    ctx.closePath();
    ctx.fill();
  };
  flame('#1d5fd0', 5, 14, 0);
  flame('#2fd0c8', 3.6, 11, 1);
  flame('#d6fffb', 1.8, 6, 2);
  return c;
}

/** A fog cloud: white, solid in the middle and soft only at its rim, so a few of them really cover the view. 128 x 128. */
export function drawCloud(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.55, 'rgba(255, 255, 255, 0.85)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

/** A warning disc: a translucent filled circle with a bright rim (it is squashed into an ellipse on the floor). 128 x 128. */
export function drawDisc(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = 'rgba(255, 150, 50, 0.45)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 140, 1)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(64, 64, 59, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

/** Ripples on the water where something lies hidden: two thin rings. 48 x 24. */
export function drawRipple(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 24);
  ctx.strokeStyle = 'rgba(200, 235, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(24, 12, 20, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200, 235, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(24, 12, 11, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

/** A broken piece of stone (the pieces a stone monster falls apart into). 12 x 10. */
export function drawChunk(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(12, 10);
  ctx.fillStyle = '#1e1c22';
  ctx.beginPath();
  ctx.moveTo(1, 6);
  ctx.lineTo(4, 1);
  ctx.lineTo(9, 1);
  ctx.lineTo(11, 5);
  ctx.lineTo(8, 9);
  ctx.lineTo(3, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a8478';
  ctx.beginPath();
  ctx.moveTo(2, 6);
  ctx.lineTo(4.5, 2);
  ctx.lineTo(8.5, 2);
  ctx.lineTo(10, 5);
  ctx.lineTo(7.5, 8);
  ctx.lineTo(3.5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b3ac9c';
  ctx.fillRect(5, 3, 3, 1);
  ctx.fillStyle = '#5c584f';
  ctx.fillRect(4, 7, 4, 1);
  return c;
}

/** A summoned stone pillar: a round carved column with a rough top, standing on its foot at the bottom centre (the foot is 8 px above the bottom). 40 x 84. */
export function drawPillarColumn(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(40, 84);
  const body = ctx.createLinearGradient(6, 0, 34, 0);
  body.addColorStop(0, '#6f695f');
  body.addColorStop(0.45, '#a39c8c');
  body.addColorStop(1, '#4a463f');
  ctx.fillStyle = body;
  ctx.fillRect(7, 10, 26, 66);
  // the foot and the broken top
  ctx.beginPath();
  ctx.ellipse(20, 76, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c2bba9';
  ctx.beginPath();
  ctx.ellipse(20, 10, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57534b';
  ctx.fillRect(10, 20, 2, 40);
  ctx.fillRect(26, 28, 2, 30);
  // carved bands, with a faint gold glow in the grooves
  ctx.fillStyle = '#d9b25a';
  for (const y of [26, 42, 58]) ctx.fillRect(9, y, 22, 1);
  ctx.fillStyle = '#2c2a26';
  for (const y of [27, 43, 59]) ctx.fillRect(9, y, 22, 1);
  return c;
}

/** Soft round glow, white in the middle fading out (tint it with the material colour); drawn with additive blending so it lights what is under it. 128 x 128. */
export function drawGlow(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  g.addColorStop(0.35, 'rgba(200, 200, 200, 0.4)');
  g.addColorStop(1, 'rgba(120, 120, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}
