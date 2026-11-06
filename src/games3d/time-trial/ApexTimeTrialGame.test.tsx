// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApexTimeTrialGame from './ApexTimeTrialGame';
import type { GhostRecording } from './ghost';
import {
  EMPTY_RECORDS,
  GHOST_KEY_PREFIX,
  RECORDS_KEY,
  recordKey,
  saveGhost,
  saveRecords,
} from './persistence';
import { formatRaceTime } from '../shared/math';
import { getTimeTrialTrack } from './tracks';

function button(scope: HTMLElement, label: string): HTMLButtonElement {
  const found = scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function byText(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

const GHOST: GhostRecording = {
  version: 1,
  trackId: 'rift-loop',
  carId: 'rift-gt',
  time: 42.5,
  splits: [10, 20, 30, 35, 40, 42.5],
  samples: [
    { t: 0, x: 0, z: 0, heading: 0, speed: 0 },
    { t: 0.05, x: 1, z: 2, heading: 0.1, speed: 14 },
  ],
};

describe('ApexTimeTrialGame setup', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const mount = () => act(() => root.render(<ApexTimeTrialGame />));

  it('renders three circuits, medal targets and the start control', () => {
    mount();
    expect(container.textContent).toContain('Apex Time Trial');
    expect(button(container, 'Track 1: Rift Loop')).toBeTruthy();
    expect(button(container, 'Track 2: Glass Cut')).toBeTruthy();
    expect(button(container, 'Track 3: Terminal Spiral')).toBeTruthy();
    expect(byText(container, 'Start time trial')).toBeTruthy();

    const riffLoop = getTimeTrialTrack('rift-loop');
    expect(container.textContent).toContain(formatRaceTime(riffLoop.medals.gold));
  });

  it('switches circuit details and surface warnings with the selection', () => {
    mount();
    act(() => button(container, 'Track 2: Glass Cut').click());
    expect(container.textContent).toContain('Glass Cut');
    expect(container.textContent).toContain('Glass sector 38–62% · lower grip');
    expect(container.textContent).toContain('Tight walls, late apexes');

    act(() => button(container, 'Track 3: Terminal Spiral').click());
    expect(container.textContent).toContain('Metal sector 25–50% · lower grip');
    expect(container.textContent).toContain('Metal sector 78–100% · lower grip');
  });

  it('shows the saved personal best for the selected car and track', () => {
    saveRecords({
      ...EMPTY_RECORDS,
      runs: 4,
      best: {
        [recordKey('rift-loop', 'rift-gt')]: {
          time: 62.3,
          medal: 'silver',
          splits: [10, 20, 30, 40, 50, 62.3],
          setAt: '2026-11-06T12:00:00.000Z',
        },
        [recordKey('rift-loop', 'vanta-rs')]: {
          time: 58.1,
          medal: 'gold',
          splits: [9, 18, 28, 38, 48, 58.1],
          setAt: '2026-11-06T12:10:00.000Z',
        },
      },
    });

    mount();
    expect(container.textContent).toContain('1:02.30');
    expect(container.textContent).toContain('Runs stored');
    expect(container.textContent).toContain('4');

    act(() => button(container, 'Car: Vanta RS').click());
    expect(container.textContent).toContain('0:58.10');
    expect(container.textContent).not.toContain('1:02.30');
  });

  it('shows a saved ghost and clears it on request', () => {
    saveGhost(GHOST);
    mount();
    expect(container.textContent).toContain('Ghost ready · 0:42.50');

    act(() => button(container, 'Clear saved ghost').click());
    expect(container.textContent).toContain('No ghost yet');
    expect(window.localStorage.getItem(GHOST_KEY_PREFIX + recordKey('rift-loop', 'rift-gt'))).toBeNull();
  });

  it('treats malformed stored records as empty', () => {
    window.localStorage.setItem(RECORDS_KEY, '{"version":1,"best":{"rift-loop:rift-gt":{"time":-5}},"runs":2}');
    mount();
    expect(container.textContent).toContain('No PB yet');
    expect(container.textContent).not.toContain('1:02.30');
  });
});
