// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';

class FakeParam {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeNode {
  connect = vi.fn();
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];

  createGain(): FakeGain {
    return new FakeGain();
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createBiquadFilter(): FakeFilter {
    return new FakeFilter();
  }

  createBuffer(_channels: number, length: number, rate: number) {
    return { getChannelData: () => new Float32Array(length * rate) };
  }

  createBufferSource() {
    return { connect: vi.fn(), start: vi.fn(), buffer: null };
  }

  suspend = vi.fn(() => {
    this.state = 'suspended';
    return Promise.resolve();
  });

  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });

  close = vi.fn(() => Promise.resolve());
}

let context: FakeAudioContext;
const originalAudioContext = window.AudioContext;

beforeEach(() => {
  vi.useFakeTimers();
  context = new FakeAudioContext();
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: function Fake() {
      return context;
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: originalAudioContext,
  });
});

describe('GameAudio background music', () => {
  it('stops its music interval without muting scheduled effects', () => {
    const audio = new GameAudio();
    audio.start();

    vi.advanceTimersByTime(600);
    const scheduled = context.oscillators.length;
    expect(scheduled).toBeGreaterThan(2);

    audio.stopMusic();
    vi.advanceTimersByTime(2000);
    expect(context.oscillators.length).toBe(scheduled);

    audio.lap();
    vi.advanceTimersByTime(200);
    expect(context.oscillators.length).toBe(scheduled + 2);
    expect(context.suspend).not.toHaveBeenCalled();
  });

  it('leaves the context running when music stops so results audio can play', () => {
    const audio = new GameAudio();
    audio.start();
    audio.stopMusic();

    expect(context.state).toBe('running');
    audio.dispose();
    expect(context.close).toHaveBeenCalled();
  });
});
