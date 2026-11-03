// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, themeForPath } from './theme';

describe('themeForPath', () => {
  it('keeps browsing routes on the day theme', () => {
    expect(themeForPath('/')).toBe('day');
    expect(themeForPath('/games')).toBe('day');
    expect(themeForPath('/category/racing')).toBe('day');
    expect(themeForPath('/about')).toBe('day');
  });

  it('switches game routes to the night theme', () => {
    expect(themeForPath('/game')).toBe('night');
    expect(themeForPath('/game/neon-snake')).toBe('night');
  });
});

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    document.head.innerHTML = '';
  });

  function addMeta(name: string, content: string) {
    const meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.append(meta);
    return meta;
  }

  it('applies the night palette, color scheme and theme color', () => {
    const themeColor = addMeta('theme-color', '#F5F1E6');
    const colorScheme = addMeta('color-scheme', 'light');

    applyTheme('night');

    expect(document.documentElement.dataset.theme).toBe('night');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(themeColor.content).toBe('#070B16');
    expect(colorScheme.content).toBe('dark');
  });

  it('applies the day palette, color scheme and theme color', () => {
    const themeColor = addMeta('theme-color', '#070B16');
    const colorScheme = addMeta('color-scheme', 'dark');

    applyTheme('day');

    expect(document.documentElement.dataset.theme).toBe('day');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(themeColor.content).toBe('#F5F1E6');
    expect(colorScheme.content).toBe('light');
  });
});
