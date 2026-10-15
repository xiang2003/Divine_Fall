import type { DamageType } from '../data/damageTypes';
import type { CameraController } from './CameraController';
import type { Vec2 } from './iso';

export type DamageKind = 'dealt' | 'crit' | 'taken' | 'heal' | 'levelup' | 'gold' | 'status';

const POOL_SIZE = 32;
const LIFETIME = 0.9;
/** Pixels the number rises over its lifetime. */
const RISE = 38;
/** Starting height above the feet in pixels. */
const START_HEIGHT = 44;

interface Entry {
  el: HTMLDivElement;
  active: boolean;
  age: number;
  wx: number;
  wy: number;
}

/**
 * Floating combat text. A fixed pool of DOM elements is reused (nothing is created or removed
 * during play) and positioned each frame from world coordinates, so text stays crisp at any zoom.
 */
export class DamageNumbers {
  private readonly layer: HTMLDivElement;
  private readonly pool: Entry[] = [];
  private nextSlot = 0;
  private readonly screen: Vec2 = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'damage-layer';
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'damage-number';
      el.style.display = 'none';
      this.layer.appendChild(el);
      this.pool.push({ el, active: false, age: 0, wx: 0, wy: 0 });
    }
    container.appendChild(this.layer);
  }

  /** `type` colours the number by the kind of damage (physical stays the plain colour of its kind). */
  spawn(wx: number, wy: number, text: string, kind: DamageKind, type: DamageType = 'physical', color?: string): void {
    // Reuse the oldest slot when everything is busy; a burst never allocates.
    let entry = this.pool.find((e) => !e.active);
    if (!entry) {
      entry = this.pool[this.nextSlot]!;
      this.nextSlot = (this.nextSlot + 1) % POOL_SIZE;
    }
    entry.active = true;
    entry.age = 0;
    // Slight horizontal jitter so rapid hits don't stack exactly.
    entry.wx = wx + (Math.random() - 0.5) * 0.4;
    entry.wy = wy + (Math.random() - 0.5) * 0.4;
    entry.el.textContent = text;
    entry.el.className = `damage-number ${kind}${type === 'physical' ? '' : ` t-${type}`}`;
    entry.el.style.color = color ?? '';
    entry.el.style.display = 'block';
  }

  update(dt: number, camera: CameraController): void {
    for (const e of this.pool) {
      if (!e.active) continue;
      e.age += dt;
      if (e.age >= LIFETIME) {
        e.active = false;
        e.el.style.display = 'none';
        continue;
      }
      const t = e.age / LIFETIME;
      camera.worldToScreen(e.wx, e.wy, this.screen);
      const y = this.screen.y - START_HEIGHT - RISE * t;
      e.el.style.transform = `translate(${Math.round(this.screen.x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      e.el.style.opacity = String(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
  }

  clear(): void {
    for (const e of this.pool) {
      e.active = false;
      e.el.style.display = 'none';
    }
  }

  dispose(): void {
    this.layer.remove();
    this.pool.length = 0;
  }
}
