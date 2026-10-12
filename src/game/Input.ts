import { KEYBINDINGS, MOUSE_BINDINGS, type InputAction, type MouseAction } from '../config/gameConfig';
import type { Vec2 } from './iso';

/** `PointerEvent.buttons` bit for each `PointerEvent.button` index (left, middle, right). */
const BUTTON_BITS = [1, 4, 2] as const;

/**
 * Keyboard + mouse state.
 * Mouse events are only listened to on the game canvas, so clicks on HTML UI overlays
 * never register as game input. Call `endFrame()` once per tick to clear edge-triggered state.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly codeToActions = new Map<string, InputAction[]>();

  /** Pointer position in CSS pixels relative to the canvas' top-left. */
  readonly pointer: Vec2 = { x: 0, y: 0 };
  pointerInside = false;
  private readonly buttonsDown = new Set<number>();
  private readonly buttonsPressedThisFrame = new Set<number>();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    if (this.codeToActions.has(e.code)) e.preventDefault();
    if (!e.repeat) this.pressedThisFrame.add(e.code);
    this.down.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private readonly onBlur = () => {
    this.down.clear();
    this.buttonsDown.clear();
  };
  private readonly onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointerInside = true;
    // Pressing a second button while one is held fires pointermove (not pointerdown), so
    // button state must always be read from `e.buttons`, never inferred from down/up events.
    this.syncButtons(e.buttons);
  };
  private readonly onPointerLeave = () => {
    this.pointerInside = false;
  };
  private readonly onPointerDown = (e: PointerEvent) => {
    // Pointer position must be fresh on press, before the first move event arrives.
    this.onPointerMove(e);
  };
  private readonly onPointerUp = (e: PointerEvent) => {
    this.syncButtons(e.buttons);
  };
  private readonly onContextMenu = (e: Event) => e.preventDefault();

  constructor(private readonly canvas: HTMLCanvasElement) {
    for (const [action, codes] of Object.entries(KEYBINDINGS) as [InputAction, readonly string[]][]) {
      for (const code of codes) {
        const list = this.codeToActions.get(code) ?? [];
        list.push(action);
        this.codeToActions.set(code, list);
      }
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Reconciles held buttons with a `PointerEvent.buttons` bitmask, recording new presses. */
  private syncButtons(mask: number): void {
    for (let button = 0; button < BUTTON_BITS.length; button++) {
      const isDown = (mask & BUTTON_BITS[button]!) !== 0;
      const wasDown = this.buttonsDown.has(button);
      if (isDown && !wasDown) {
        this.buttonsDown.add(button);
        this.buttonsPressedThisFrame.add(button);
      } else if (!isDown && wasDown) {
        this.buttonsDown.delete(button);
      }
    }
  }

  /** True while any key bound to the action is held. */
  isDown(action: InputAction): boolean {
    for (const code of KEYBINDINGS[action]) if (this.down.has(code)) return true;
    return false;
  }

  /** True only on the frame a key bound to the action went down. */
  wasPressed(action: InputAction): boolean {
    for (const code of KEYBINDINGS[action]) if (this.pressedThisFrame.has(code)) return true;
    return false;
  }

  /** True while the mouse button bound to the action is held (pressed on the canvas). */
  isMouseDown(action: MouseAction): boolean {
    return this.buttonsDown.has(MOUSE_BINDINGS[action]);
  }

  /** True only on the frame the mouse button bound to the action went down. */
  wasMousePressed(action: MouseAction): boolean {
    return this.buttonsPressedThisFrame.has(MOUSE_BINDINGS[action]);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.buttonsPressedThisFrame.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.down.clear();
    this.pressedThisFrame.clear();
    this.buttonsDown.clear();
    this.buttonsPressedThisFrame.clear();
  }
}

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}
