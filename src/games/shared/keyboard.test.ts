// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isInteractiveTarget } from './keyboard';

describe('isInteractiveTarget', () => {
  it('ignores keys aimed at form controls', () => {
    const input = document.createElement('input');
    expect(isInteractiveTarget(input)).toBe(true);

    const select = document.createElement('select');
    expect(isInteractiveTarget(select)).toBe(true);
  });

  it('ignores keys aimed at buttons and links', () => {
    const button = document.createElement('button');
    expect(isInteractiveTarget(button)).toBe(true);

    const link = document.createElement('a');
    expect(isInteractiveTarget(link)).toBe(true);
  });

  it('ignores keys aimed at content inside a button', () => {
    const button = document.createElement('button');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    button.append(icon);
    expect(isInteractiveTarget(icon)).toBe(true);
  });

  it('claims keys aimed at the game surface', () => {
    const board = document.createElement('div');
    expect(isInteractiveTarget(board)).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});
