// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RiftTacticsGame from './RiftTacticsGame';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Rift Tactics accessibility', () => {
  it('announces new battle log entries politely', () => {
    act(() => root.render(<RiftTacticsGame />));

    const start = Array.from(container.querySelectorAll('button')).find((button) =>
      /Start battle/.test(button.textContent ?? ''),
    );
    expect(start).toBeDefined();
    act(() => start!.click());

    const log = container.querySelector('[role="log"]');
    expect(log).not.toBeNull();
    expect(log!.getAttribute('aria-live')).toBe('polite');
    expect(log!.textContent).toContain('Your turn');
  });
});
