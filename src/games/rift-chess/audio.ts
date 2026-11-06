export type CueKind = 'move' | 'capture' | 'check' | 'end' | 'solved';

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  exponentialRampToValueAtTime(value: number, endTime: number): void;
}

export interface GainLike {
  gain: AudioParamLike;
  connect(destination: unknown): void;
}

export interface OscillatorLike {
  type: OscillatorType;
  frequency: AudioParamLike;
  connect(destination: GainLike): void;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  currentTime: number;
  state: string;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export interface ChessAudio {
  play(kind: CueKind): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  dispose(): void;
}

interface CueNote {
  frequency: number;
  offset: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

const CUES: Record<CueKind, ReadonlyArray<CueNote>> = {
  move: [{ frequency: 330, offset: 0, duration: 0.06, type: 'triangle', gain: 0.05 }],
  capture: [{ frequency: 170, offset: 0, duration: 0.11, type: 'square', gain: 0.05 }],
  check: [
    { frequency: 440, offset: 0, duration: 0.09, type: 'sine', gain: 0.06 },
    { frequency: 587, offset: 0.09, duration: 0.09, type: 'sine', gain: 0.06 },
  ],
  end: [
    { frequency: 392, offset: 0, duration: 0.16, type: 'triangle', gain: 0.06 },
    { frequency: 293.66, offset: 0.11, duration: 0.16, type: 'triangle', gain: 0.06 },
    { frequency: 196, offset: 0.22, duration: 0.2, type: 'triangle', gain: 0.06 },
  ],
  solved: [
    { frequency: 523.25, offset: 0, duration: 0.1, type: 'triangle', gain: 0.06 },
    { frequency: 659.25, offset: 0.09, duration: 0.1, type: 'triangle', gain: 0.06 },
    { frequency: 783.99, offset: 0.18, duration: 0.14, type: 'triangle', gain: 0.06 },
  ],
};

function defaultCreateContext(): AudioContextLike | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    return new AudioContext() as unknown as AudioContextLike;
  } catch {
    return null;
  }
}

export function createChessAudio(
  createContext: () => AudioContextLike | null = defaultCreateContext,
): ChessAudio {
  let context: AudioContextLike | null = null;
  let attempted = false;
  let muted = false;
  let disposed = false;

  function ensureContext(): AudioContextLike | null {
    if (context || attempted) return context;
    attempted = true;
    try {
      context = createContext();
    } catch {
      context = null;
    }
    if (context && context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    return context;
  }

  return {
    play(kind) {
      if (muted || disposed) return;
      const ctx = ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }

      const start = ctx.currentTime + 0.01;
      for (const note of CUES[kind]) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const begins = start + note.offset;
        const ends = begins + note.duration;

        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.frequency, begins);
        gain.gain.setValueAtTime(note.gain, begins);
        gain.gain.exponentialRampToValueAtTime(0.0001, ends);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(begins);
        oscillator.stop(ends);
      }
    },
    setMuted(next) {
      muted = next;
    },
    isMuted() {
      return muted;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const current = context;
      context = null;
      if (current) {
        void current.close().catch(() => undefined);
      }
    },
  };
}
