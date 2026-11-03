import { describe, expect, it } from 'vitest';
import { edgeOptionIndex, nextOptionIndex, resolveComboboxKey, shouldShowPanel } from './combobox';

describe('nextOptionIndex', () => {
  it('starts at the first option when moving down from none', () => {
    expect(nextOptionIndex(-1, 1, 3)).toBe(0);
  });

  it('starts at the last option when moving up from none', () => {
    expect(nextOptionIndex(-1, -1, 3)).toBe(2);
  });

  it('wraps past the end', () => {
    expect(nextOptionIndex(2, 1, 3)).toBe(0);
  });

  it('wraps past the start', () => {
    expect(nextOptionIndex(0, -1, 3)).toBe(2);
  });

  it('returns -1 when there are no options', () => {
    expect(nextOptionIndex(-1, 1, 0)).toBe(-1);
    expect(nextOptionIndex(0, -1, 0)).toBe(-1);
  });
});

describe('edgeOptionIndex', () => {
  it('returns the first and last indexes', () => {
    expect(edgeOptionIndex(4, 'start')).toBe(0);
    expect(edgeOptionIndex(4, 'end')).toBe(3);
  });

  it('returns -1 when empty', () => {
    expect(edgeOptionIndex(0, 'start')).toBe(-1);
    expect(edgeOptionIndex(0, 'end')).toBe(-1);
  });
});

describe('resolveComboboxKey', () => {
  const closedNone = { open: false, activeIndex: -1, count: 3 };

  it('moves down from no active option', () => {
    expect(resolveComboboxKey('ArrowDown', closedNone)).toEqual({ type: 'move', index: 0 });
  });

  it('moves up from no active option', () => {
    expect(resolveComboboxKey('ArrowUp', closedNone)).toEqual({ type: 'move', index: 2 });
  });

  it('jumps to the first option on Home while open', () => {
    expect(resolveComboboxKey('Home', { open: true, activeIndex: 2, count: 3 })).toEqual({
      type: 'move',
      index: 0,
    });
  });

  it('jumps to the last option on End while open', () => {
    expect(resolveComboboxKey('End', { open: true, activeIndex: 0, count: 3 })).toEqual({
      type: 'move',
      index: 2,
    });
  });

  it('does not hijack Home or End when the panel is closed', () => {
    expect(resolveComboboxKey('Home', closedNone)).toEqual({ type: 'none' });
    expect(resolveComboboxKey('End', closedNone)).toEqual({ type: 'none' });
  });

  it('selects the active option on Enter', () => {
    expect(resolveComboboxKey('Enter', { open: true, activeIndex: 1, count: 3 })).toEqual({
      type: 'select',
      index: 1,
    });
  });

  it('lets Enter submit the form when no option is active', () => {
    expect(resolveComboboxKey('Enter', { open: true, activeIndex: -1, count: 3 })).toEqual({
      type: 'none',
    });
  });

  it('closes on Escape', () => {
    expect(resolveComboboxKey('Escape', { open: true, activeIndex: 1, count: 3 })).toEqual({
      type: 'close',
    });
  });

  it('ignores unrelated keys', () => {
    expect(resolveComboboxKey('Tab', { open: true, activeIndex: 1, count: 3 })).toEqual({
      type: 'none',
    });
  });
});

describe('shouldShowPanel', () => {
  it('opens only when the input has a non-empty term', () => {
    expect(shouldShowPanel(true, 'neon')).toBe(true);
    expect(shouldShowPanel(false, 'neon')).toBe(false);
    expect(shouldShowPanel(true, '   ')).toBe(false);
    expect(shouldShowPanel(true, '')).toBe(false);
  });
});
