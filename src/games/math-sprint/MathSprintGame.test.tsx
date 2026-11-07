// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MathSprintGame from './MathSprintGame';

function byText(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

function answerButtons(scope: HTMLElement): HTMLButtonElement[] {
  return [...scope.querySelectorAll<HTMLButtonElement>('button[aria-label^="Answer "]')];
}

function announcement(scope: HTMLElement): string {
  return scope.querySelector('[role="status"]')?.textContent?.trim() ?? '';
}

describe('MathSprintGame', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const startSprint = () => {
    act(() => root.render(<MathSprintGame />));
    act(() => byText(container, 'Start sprint').click());
  };

  it('announces the new problem after each answer instead of the clock', () => {
    startSprint();

    const first = announcement(container);
    expect(first).toMatch(/^Problem: /);
    expect(first, 'the ticking clock is not announced').not.toContain('seconds left');

    act(() => answerButtons(container)[0].click());
    expect(announcement(container)).toMatch(/^(Correct\.|Incorrect\.)/);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    const next = announcement(container);
    expect(next).toMatch(/^Problem: /);
    const prompt = next.replace(/^Problem: /, '').replace(/\.$/, '');
    expect(container.textContent).toContain(prompt);
  });

  it('counts the clock down one second at a time', () => {
    startSprint();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.textContent).toContain('59 seconds left');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.textContent).toContain('58 seconds left');
  });

  it('ends the sprint exactly at sixty seconds', () => {
    startSprint();

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(announcement(container)).toMatch(/^Problem: /);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(announcement(container)).toMatch(/^Sprint complete\./);
    expect(container.textContent).toContain('Sprint complete');
  });
});