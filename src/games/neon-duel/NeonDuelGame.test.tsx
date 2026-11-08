// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NeonDuelGame, { LADDER_KEY } from './NeonDuelGame';
import { DUEL_LADDER, FIGHTERS, FIGHTER_ORDER } from './fighters';
import type { DuelSnapshot } from './session';

interface MockSessionConfig {
  player: string;
  rival: string;
  tier: string;
  training: boolean;
}

interface MockSession {
  readonly config: MockSessionConfig;
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly step: ReturnType<typeof vi.fn>;
  readonly view: DuelSnapshot;
  emit: (patch: Partial<DuelSnapshot>) => void;
}

const { sessions } = vi.hoisted(() => ({ sessions: [] as unknown[] }));

vi.mock('./session', async () => {
  const { FIGHTERS: specs } = await import('./fighters');
  const { createFighterState } = await import('./combat');

  class MockDuelSession {
    readonly config: MockSessionConfig;
    readonly dispose = vi.fn();
    readonly step = vi.fn(() => ({ events: [], cues: [] }));
    view: DuelSnapshot;

    constructor(config: MockSessionConfig & { seed: number; roundSeconds?: number }) {
      this.config = config;
      const player = config.player as keyof typeof specs;
      const rival = config.rival as keyof typeof specs;
      const roundTicks = 3600;
      this.view = {
        a: createFighterState(specs[player], -2.6, 1),
        b: createFighterState(specs[rival], 2.6, -1),
        timerTicks: roundTicks,
        roundTicks,
        round: 1,
        wins: { player: 0, rival: 0 },
        banner: null,
        shake: 0,
        effects: [],
        training: config.training,
        rivalName: specs[rival].name,
        clock: 0,
        phase: 'intro',
        winner: null,
        match: {
          round: 1,
          wins: { player: 0, rival: 0 },
          timerTicks: roundTicks,
          roundTicks,
          phase: 'intro',
          roundWinner: null,
          winner: null,
          bannerTicks: 0,
        },
      };
      sessions.push(this);
    }

    snapshot(): DuelSnapshot {
      return this.view;
    }

    get phase(): DuelSnapshot['phase'] {
      return this.view.phase;
    }

    get winner(): DuelSnapshot['winner'] {
      return this.view.winner;
    }

    emit(patch: Partial<DuelSnapshot>): void {
      this.view = { ...this.view, ...patch };
    }
  }

  return { DuelSession: MockDuelSession };
});

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

describe('NeonDuelGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let frames: FrameRequestCallback[];
  let clock: number;

  beforeEach(() => {
    window.localStorage.clear();
    sessions.length = 0;
    mounted = true;
    frames = [];
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (mounted) act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mount = (props: { onStart?: () => void; onComplete?: (event: unknown) => void } = {}) =>
    act(() => root.render(<NeonDuelGame onStart={props.onStart} onComplete={props.onComplete} />));

  const frame = (delta = 17) => {
    clock += delta;
    act(() => {
      const batch = frames.splice(0, frames.length);
      for (const callback of batch) callback(clock);
    });
  };

  const startLadder = () => {
    act(() => byText(container, 'Start ladder').click());
    act(() => byText(container, 'Fight').click());
  };

  const sessionAt = (index = 0): MockSession => sessions[index] as MockSession;

  it('renders four fighters and five ladder rungs before a run', () => {
    mount();

    for (const id of FIGHTER_ORDER) {
      expect(button(container, `Fighter: ${FIGHTERS[id].name}`)).toBeTruthy();
    }
    for (const rung of DUEL_LADDER) {
      expect(container.textContent).toContain(rung.name);
    }
    expect(byText(container, 'Start ladder')).toBeTruthy();
  });

  it('starts a match with the chosen fighter and reports onStart once', () => {
    const onStart = vi.fn();
    mount({ onStart });

    act(() => button(container, `Fighter: ${FIGHTERS.mako.name}`).click());
    act(() => byText(container, 'Start ladder').click());
    expect(container.textContent).toContain(`Mako vs ${FIGHTERS[DUEL_LADDER[0]!.fighter].name}`);

    act(() => byText(container, 'Fight').click());

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(sessionAt().config).toMatchObject({ player: 'mako', rival: 'volt', training: false });
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('freezes the simulation while paused', () => {
    mount();
    startLadder();
    frame();

    const session = sessionAt();
    const before = session.step.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    act(() => button(container, 'Pause match').click());
    frame();
    frame();
    expect(session.step.mock.calls.length).toBe(before);

    act(() => button(container, 'Resume match').click());
    frame();
    expect(session.step.mock.calls.length).toBeGreaterThan(before);
  });

  it('advances and persists the ladder after a match win', () => {
    mount();
    startLadder();

    act(() => sessionAt().emit({ phase: 'matchOver', winner: 'player' }));
    frame();

    expect(window.localStorage.getItem(LADDER_KEY)).toBe('1');
    expect(container.textContent).toContain('Match won');
    expect(container.textContent).toContain(DUEL_LADDER[1]!.name);
  });

  it('ends the run and reports a loss exactly once', () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    startLadder();

    act(() => sessionAt().emit({ phase: 'matchOver', winner: 'rival' }));
    frame();
    frame();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ outcome: 'loss', score: 0 });
    expect(container.querySelector('[role="dialog"][aria-label="Run over"]')).not.toBeNull();
  });

  it('completes the run with a win after clearing the final rung', () => {
    window.localStorage.setItem(LADDER_KEY, '4');
    const onComplete = vi.fn();
    mount({ onComplete });
    startLadder();

    expect(sessionAt().config).toMatchObject({ rival: 'sable', tier: 'rival' });

    act(() => sessionAt().emit({ phase: 'matchOver', winner: 'player' }));
    frame();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ outcome: 'win', score: DUEL_LADDER.length });
    expect(container.querySelector('[role="dialog"][aria-label="Run over"]')).not.toBeNull();
  });

  it('cancels the loop and disposes the session on unmount', () => {
    mount();
    startLadder();
    const session = sessionAt();

    act(() => root.unmount());
    mounted = false;

    expect(session.dispose).toHaveBeenCalled();
    expect(vi.mocked(cancelAnimationFrame)).toHaveBeenCalled();
  });
});
