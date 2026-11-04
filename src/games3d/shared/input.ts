export interface TouchDriveState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export const emptyTouchDrive: TouchDriveState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  handbrake: false,
};

interface KeyboardState {
  keys: Set<string>;
  dispose: () => void;
}

const CAPTURED = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyC',
  'KeyJ',
  'KeyK',
  'ShiftLeft',
  'ShiftRight',
]);

export function createKeyboard(canvas: HTMLCanvasElement): KeyboardState {
  const keys = new Set<string>();

  function onPointerDown() {
    canvas.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    if (CAPTURED.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    keys,
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}

export function readDriveInput(keys: Set<string>, touch: TouchDriveState): TouchDriveState {
  return {
    forward: touch.forward || keys.has('ArrowUp') || keys.has('KeyW'),
    back: touch.back || keys.has('ArrowDown') || keys.has('KeyS'),
    left: touch.left || keys.has('ArrowLeft') || keys.has('KeyA'),
    right: touch.right || keys.has('ArrowRight') || keys.has('KeyD'),
    handbrake: touch.handbrake || keys.has('Space'),
  };
}
