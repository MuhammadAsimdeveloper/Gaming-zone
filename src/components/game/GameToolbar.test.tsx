// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameToolbar } from './GameToolbar';

let container: HTMLDivElement;
let root: Root;

function renderToolbar() {
  act(() => {
    root.render(
      <GameToolbar
        query=""
        onQueryChange={() => {}}
        sort="featured"
        onSortChange={() => {}}
        resultCount={25}
        hasActiveFilters={false}
        onClear={() => {}}
      />,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('GameToolbar', () => {
  it('gives the search field an id and name so browsers do not flag it as unlabelled', () => {
    renderToolbar();

    const input = container.querySelector<HTMLInputElement>('input[type="search"]');
    expect(input).toBeTruthy();
    expect(input?.id).toBe('game-search');
    expect(input?.getAttribute('name')).toBe('game-search');
  });
});
