import { describe, expect, it, vi } from 'vitest';
import { createChessAudio, type AudioContextLike } from './audio';

interface FakeParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
}

interface FakeOscillator {
  type: string;
  frequency: FakeParam;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function fakeParam(): FakeParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function fakeContext(state: string = 'running') {
  const oscillators: FakeOscillator[] = [];
  const gains: Array<{ gain: FakeParam; connect: ReturnType<typeof vi.fn> }> = [];

  const context = {
    currentTime: 10,
    state,
    destination: { id: 'destination' },
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),
    createOscillator(): FakeOscillator {
      const oscillator: FakeOscillator = {
        type: 'sine',
        frequency: fakeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      const gain = { gain: fakeParam(), connect: vi.fn() };
      gains.push(gain);
      return gain;
    },
  };

  return { audio: context as unknown as AudioContextLike, oscillators, gains, raw: context };
}

describe('createChessAudio', () => {
  it('does not build an audio context until a cue plays', () => {
    const factory = vi.fn(() => fakeContext().audio);
    const audio = createChessAudio(factory);

    expect(factory).not.toHaveBeenCalled();
    audio.play('move');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('plays one short tone for a quiet move', () => {
    const fake = fakeContext();
    const audio = createChessAudio(() => fake.audio);

    audio.play('move');

    expect(fake.oscillators).toHaveLength(1);
    const oscillator = fake.oscillators[0];
    expect(oscillator.type).toBe('triangle');
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(330, expect.closeTo(10.01, 5));
    expect(oscillator.start).toHaveBeenCalledWith(expect.closeTo(10.01, 5));
    expect(oscillator.stop).toHaveBeenCalledWith(expect.closeTo(10.07, 5));
    expect(oscillator.connect).toHaveBeenCalledWith(fake.gains[0]);
    expect(fake.gains[0].connect).toHaveBeenCalledWith(fake.raw.destination);
  });

  it('plays a lower, longer tone for a capture', () => {
    const fake = fakeContext();
    const audio = createChessAudio(() => fake.audio);

    audio.play('capture');

    expect(fake.oscillators).toHaveLength(1);
    expect(fake.oscillators[0].type).toBe('square');
    expect(fake.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(170, expect.any(Number));
    expect(fake.oscillators[0].stop).toHaveBeenCalledWith(expect.closeTo(10.12, 5));
  });

  it('plays two rising tones for check', () => {
    const fake = fakeContext();
    const audio = createChessAudio(() => fake.audio);

    audio.play('check');

    expect(fake.oscillators).toHaveLength(2);
    expect(fake.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
    expect(fake.oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(587, expect.closeTo(10.1, 5));
  });

  it('plays a descending figure at the end of a game', () => {
    const fake = fakeContext();
    const audio = createChessAudio(() => fake.audio);

    audio.play('end');

    expect(fake.oscillators).toHaveLength(3);
    const frequencies = fake.oscillators.map((oscillator) => oscillator.frequency.setValueAtTime.mock.calls[0][0]);
    expect(frequencies).toEqual([392, 293.66, 196]);
  });

  it('stays silent while muted and plays again after unmuting', () => {
    const fake = fakeContext();
    const factory = vi.fn(() => fake.audio);
    const audio = createChessAudio(factory);

    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.play('move');
    expect(fake.oscillators).toHaveLength(0);
    expect(factory).not.toHaveBeenCalled();

    audio.setMuted(false);
    audio.play('move');
    expect(fake.oscillators).toHaveLength(1);
  });

  it('resumes a suspended context before scheduling sound', () => {
    const fake = fakeContext('suspended');
    const audio = createChessAudio(() => fake.audio);

    audio.play('move');

    expect(fake.raw.resume).toHaveBeenCalledTimes(1);
    expect(fake.oscillators).toHaveLength(1);
  });

  it('closes the context on dispose and ignores later cues', () => {
    const fake = fakeContext();
    const audio = createChessAudio(() => fake.audio);

    audio.play('move');
    audio.dispose();
    audio.play('check');
    audio.dispose();

    expect(fake.raw.close).toHaveBeenCalledTimes(1);
    expect(fake.oscillators).toHaveLength(1);
  });

  it('stays silent when no audio context is available', () => {
    const audio = createChessAudio(() => null);

    expect(() => audio.play('move')).not.toThrow();
    expect(() => audio.dispose()).not.toThrow();
  });

  it('stays silent when the context factory throws', () => {
    const audio = createChessAudio(() => {
      throw new Error('blocked');
    });

    expect(() => audio.play('check')).not.toThrow();
  });
});
