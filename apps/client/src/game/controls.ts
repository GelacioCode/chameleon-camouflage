import { BUTTON, clampPitch } from '@chameleon/shared';

const KEY_BUTTONS: Record<string, number> = {
  KeyW: BUTTON.forward,
  ArrowUp: BUTTON.forward,
  KeyS: BUTTON.back,
  ArrowDown: BUTTON.back,
  KeyA: BUTTON.left,
  ArrowLeft: BUTTON.left,
  KeyD: BUTTON.right,
  ArrowRight: BUTTON.right,
  ShiftLeft: BUTTON.sprint,
  ShiftRight: BUTTON.sprint,
};
const COLOR_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
const MOUSE_SENSITIVITY = 0.0024;
const DRAG_SENSITIVITY = 0.004;
const DRAG_CLICK_PX = 5;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export class Controls {
  yaw = 0;
  pitch = 0;
  onFire: (() => void) | null = null;
  onColorKey: ((index: number) => void) | null = null;
  private readonly keys = new Set<string>();
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly element: HTMLElement) {
    this.listen(window, 'keydown', (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code in KEY_BUTTONS) {
        e.preventDefault();
        this.keys.add(e.code);
      }
      const color = COLOR_KEYS.indexOf(e.code);
      if (color >= 0 && !e.repeat) this.onColorKey?.(color);
    });
    this.listen(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    this.listen(window, 'blur', () => this.keys.clear());

    this.listen(element, 'mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.locked) this.onFire?.();
    });
    this.listen(document, 'mousemove', (e: MouseEvent) => {
      if (!this.locked) return;
      this.look(e.movementX * MOUSE_SENSITIVITY, e.movementY * MOUSE_SENSITIVITY);
    });

    // Drag-look fallback when pointer lock is unavailable or released.
    this.listen(element, 'pointerdown', (e: PointerEvent) => {
      if (this.locked) return;
      element.setPointerCapture(e.pointerId);
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    });
    this.listen(element, 'pointermove', (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.look(dx * DRAG_SENSITIVITY, dy * DRAG_SENSITIVITY);
    });
    this.listen(element, 'pointerup', (e: PointerEvent) => {
      if (this.drag?.id !== e.pointerId) return;
      const click = this.drag.moved < DRAG_CLICK_PX && e.pointerType === 'mouse';
      this.drag = null;
      if (click) element.requestPointerLock?.()?.catch?.(() => undefined);
    });
    this.listen(element, 'pointercancel', () => {
      this.drag = null;
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  buttons(): number {
    let b = 0;
    for (const key of this.keys) b |= KEY_BUTTONS[key] ?? 0;
    return b;
  }

  dispose(): void {
    if (this.locked) document.exitPointerLock();
    for (const fn of this.cleanup) fn();
  }

  private look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = clampPitch(this.pitch - dy);
  }

  private listen<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void): void {
    target.addEventListener(type, fn as EventListener);
    this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
  }
}
