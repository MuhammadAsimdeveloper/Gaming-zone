// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Layers } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameFrame, GameOverlay } from './GameFrame';

describe('GameOverlay', () => {
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

  function Scene({ open }: { open: boolean }) {
    return (
      <GameFrame title="Test game" icon={Layers}>
        <div>board</div>
        {open ? (
          <GameOverlay>
            <button type="button">Start</button>
          </GameOverlay>
        ) : null}
      </GameFrame>
    );
  }

  it('exposes overlay content as a dialog and moves focus into it', () => {
    act(() => root.render(<Scene open />));

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBeTruthy();
    expect(document.activeElement).toBe(dialog);
  });

  it('returns focus to the game frame when the overlay closes', () => {
    act(() => root.render(<Scene open />));
    act(() => root.render(<Scene open={false} />));

    const frame = document.querySelector('[data-game-frame]');
    expect(frame).not.toBeNull();
    expect(document.activeElement).toBe(frame);
  });
});
