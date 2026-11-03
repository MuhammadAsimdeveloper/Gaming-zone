export function nextOptionIndex(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

export function edgeOptionIndex(count: number, edge: 'start' | 'end'): number {
  if (count <= 0) return -1;
  return edge === 'start' ? 0 : count - 1;
}

export function shouldShowPanel(open: boolean, term: string): boolean {
  return open && term.trim().length > 0;
}

export type ComboboxKeyAction =
  | { type: 'move'; index: number }
  | { type: 'select'; index: number }
  | { type: 'close' }
  | { type: 'none' };

export function resolveComboboxKey(
  key: string,
  { open, activeIndex, count }: { open: boolean; activeIndex: number; count: number },
): ComboboxKeyAction {
  if (key === 'ArrowDown') return { type: 'move', index: nextOptionIndex(activeIndex, 1, count) };
  if (key === 'ArrowUp') return { type: 'move', index: nextOptionIndex(activeIndex, -1, count) };
  if (key === 'Home' && open) return { type: 'move', index: edgeOptionIndex(count, 'start') };
  if (key === 'End' && open) return { type: 'move', index: edgeOptionIndex(count, 'end') };
  if (key === 'Enter' && activeIndex >= 0 && activeIndex < count) {
    return { type: 'select', index: activeIndex };
  }
  if (key === 'Escape') return { type: 'close' };
  return { type: 'none' };
}
