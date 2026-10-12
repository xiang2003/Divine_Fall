import type { EquipSlot } from '../data/items';
import { makeCanvas } from './PlaceholderArt';

/** Item icons are 32x32 and drawn in neutral steel / leather tones; rarity is shown by the glow and text colour. */
export const ICON_SIZE = 32;

const OUTLINE = '#15110c';
const STEEL = '#c9d0d8';
const STEEL_DARK = '#8b95a1';
const LEATHER = '#8a5a34';
const LEATHER_DARK = '#5b3a1f';
const GOLD = '#d8b04a';

export function drawItemIcon(slot: EquipSlot): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(ICON_SIZE, ICON_SIZE);
  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE;
  switch (slot) {
    case 'weapon': {
      // blade (diagonal), guard, grip, pommel
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(25, 4);
      ctx.lineTo(28, 7);
      ctx.lineTo(13, 22);
      ctx.lineTo(10, 19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = STEEL_DARK;
      ctx.beginPath();
      ctx.moveTo(25, 4);
      ctx.lineTo(28, 7);
      ctx.lineTo(20, 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(7, 17);
      ctx.lineTo(14, 24);
      ctx.lineTo(12, 26);
      ctx.lineTo(5, 19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = LEATHER_DARK;
      ctx.fillRect(4, 23, 5, 5);
      ctx.strokeRect(4.5, 23.5, 4, 4);
      break;
    }
    case 'helmet': {
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(6, 22);
      ctx.lineTo(6, 14);
      ctx.quadraticCurveTo(16, 2, 26, 14);
      ctx.lineTo(26, 22);
      ctx.lineTo(21, 22);
      ctx.lineTo(21, 17);
      ctx.lineTo(11, 17);
      ctx.lineTo(11, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = STEEL_DARK;
      ctx.fillRect(15, 6, 2, 11);
      break;
    }
    case 'chest': {
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.moveTo(4, 8);
      ctx.lineTo(11, 5);
      ctx.lineTo(14, 8);
      ctx.lineTo(18, 8);
      ctx.lineTo(21, 5);
      ctx.lineTo(28, 8);
      ctx.lineTo(25, 14);
      ctx.lineTo(24, 28);
      ctx.lineTo(8, 28);
      ctx.lineTo(7, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = LEATHER;
      ctx.fillRect(8, 19, 16, 3);
      ctx.fillStyle = STEEL_DARK;
      ctx.fillRect(15, 9, 2, 10);
      break;
    }
    case 'boots': {
      ctx.fillStyle = LEATHER;
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.lineTo(16, 4);
      ctx.lineTo(16, 17);
      ctx.lineTo(27, 21);
      ctx.lineTo(27, 27);
      ctx.lineTo(6, 27);
      ctx.lineTo(6, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = LEATHER_DARK;
      ctx.fillRect(6, 24, 21, 3);
      ctx.fillStyle = GOLD;
      ctx.fillRect(8, 8, 8, 2);
      break;
    }
    case 'ring': {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(16, 19, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(16, 19, 8, 0, Math.PI * 2);
      ctx.stroke();
      // gem
      ctx.fillStyle = '#7fe0ff';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 4);
      ctx.lineTo(21, 9);
      ctx.lineTo(16, 13);
      ctx.lineTo(11, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  return c;
}

/** White soft ring, tinted per rarity at runtime. 48x24 so it matches the isometric ground plane. */
export function drawLootRing(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(48, 24);
  ctx.translate(24, 12);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 24);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
