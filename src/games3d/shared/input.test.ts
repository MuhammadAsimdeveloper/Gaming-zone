// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createKeyboard } from './input';

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('createKeyboard', () => {
  it('captures the football action keys (shoot, pass, sprint)', () => {
    const canvas = document.createElement('canvas');
    const keyboard = createKeyboard(canvas);
    cleanup = keyboard.dispose;

    for (const code of ['KeyJ', 'KeyK', 'ShiftLeft', 'ShiftRight']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    }

    expect([...keyboard.keys]).toEqual(
      expect.arrayContaining(['KeyJ', 'KeyK', 'ShiftLeft', 'ShiftRight']),
    );
  });

  it('ignores keys typed into form fields', () => {
    const canvas = document.createElement('canvas');
    const input = document.createElement('input');
    document.body.append(canvas, input);
    const keyboard = createKeyboard(canvas);
    cleanup = keyboard.dispose;

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));

    expect(keyboard.keys.has('KeyJ')).toBe(false);
    input.remove();
    canvas.remove();
  });

  it('removes its listeners when disposed', () => {
    const canvas = document.createElement('canvas');
    const keyboard = createKeyboard(canvas);
    keyboard.dispose();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));

    expect(keyboard.keys.has('KeyJ')).toBe(false);
  });
});
