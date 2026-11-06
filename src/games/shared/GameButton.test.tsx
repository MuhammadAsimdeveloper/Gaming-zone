// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameButton } from './GameFrame';

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

describe('GameButton touch targets', () => {
  it.each(['sm', 'icon'] as const)('keeps %s buttons at least 44px tall on coarse pointers', (size) => {
    act(() => root.render(<GameButton size={size}>Go</GameButton>));

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.className).toContain('[@media(pointer:coarse)]:h-11');
  });

  it('keeps icon buttons square on coarse pointers', () => {
    act(() => root.render(<GameButton size="icon">Go</GameButton>));

    const button = container.querySelector('button');
    expect(button!.className).toContain('[@media(pointer:coarse)]:w-11');
  });
});
