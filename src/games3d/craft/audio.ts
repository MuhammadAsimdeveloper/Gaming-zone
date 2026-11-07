import { BLOCK } from './blocks';
import type { DayPhase } from './daynight';

export type FootstepSurface = 'grass' | 'stone' | 'sand' | 'wood' | 'water';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MUTE_STORAGE_KEY = 'neonrift-craft:muted';

const SURFACES: Partial<Record<number, FootstepSurface>> = {
  [BLOCK.Dirt]: 'grass',
  [BLOCK.Grass]: 'grass',
  [BLOCK.Moss]: 'grass',
  [BLOCK.RiftwoodLeaves]: 'grass',
  [BLOCK.GlowwoodLeaves]: 'grass',
  [BLOCK.Glowcap]: 'grass',
  [BLOCK.Reeds]: 'grass',
  [BLOCK.GlowKelp]: 'grass',
  [BLOCK.Flower]: 'grass',
  [BLOCK.Farmland]: 'grass',
  [BLOCK.GlowberryCrop0]: 'grass',
  [BLOCK.GlowberryCrop1]: 'grass',
  [BLOCK.GlowberryCrop2]: 'grass',
  [BLOCK.GlowberryCrop3]: 'grass',
  [BLOCK.RiftrootCrop0]: 'grass',
  [BLOCK.RiftrootCrop1]: 'grass',
  [BLOCK.RiftrootCrop2]: 'grass',
  [BLOCK.RiftrootCrop3]: 'grass',
  [BLOCK.Sand]: 'sand',
  [BLOCK.Gravel]: 'sand',
  [BLOCK.Clay]: 'sand',
  [BLOCK.Mud]: 'sand',
  [BLOCK.RiftwoodLog]: 'wood',
  [BLOCK.GlowwoodLog]: 'wood',
  [BLOCK.Planks]: 'wood',
  [BLOCK.Workbench]: 'wood',
  [BLOCK.Kiln]: 'wood',
  [BLOCK.Water]: 'water',
};

const FOOTSTEP_FREQUENCY: Record<FootstepSurface, number> = {
  grass: 900,
  stone: 1500,
  sand: 700,
  wood: 520,
  water: 620,
};

export function footstepSurface(blockId: number): FootstepSurface {
  return SURFACES[blockId] ?? 'stone';
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadMuted(storage: StorageLike | null = defaultStorage()): boolean {
  if (storage === null) return false;
  try {
    return storage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveMuted(
  storage: StorageLike | null = defaultStorage(),
  muted: boolean,
): void {
  if (storage === null) return;
  try {
    storage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Storage can be blocked by the browser; muting still applies for this session.
  }
}

/**
 * Procedural WebAudio graph. Created after the first user gesture and torn down on
 * unmount; every sound is synthesised, so the game ships no audio files.
 */
export class CraftAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private chirpTimer: number | null = null;
  private muted = false;
  private phase: DayPhase | null = null;

  get isReady(): boolean {
    return this.context !== null;
  }

  init(storage: StorageLike | null = defaultStorage()): void {
    if (this.context !== null) {
      void this.context.resume();
      return;
    }
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
    const context = new window.AudioContext();
    const master = context.createGain();
    master.gain.value = loadMuted(storage) ? 0 : 0.6;
    master.connect(context.destination);
    const ambience = context.createGain();
    ambience.gain.value = 0.05;
    ambience.connect(master);

    this.muted = loadMuted(storage);
    this.context = context;
    this.master = master;
    this.ambience = ambience;
  }

  setMuted(muted: boolean, storage: StorageLike | null = defaultStorage()): void {
    this.muted = muted;
    saveMuted(storage, muted);
    if (this.context !== null && this.master !== null) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.context.currentTime, 0.02);
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  dispose(): void {
    if (this.chirpTimer !== null) {
      window.clearInterval(this.chirpTimer);
      this.chirpTimer = null;
    }
    this.stopDrone();
    if (this.context !== null) void this.context.close();
    this.context = null;
    this.master = null;
    this.ambience = null;
    this.noise = null;
    this.phase = null;
  }

  footstep(surface: FootstepSurface): void {
    this.burst(0.08, 0.06, 'lowpass', FOOTSTEP_FREQUENCY[surface]);
  }

  breakBlock(surface: FootstepSurface): void {
    this.burst(0.18, 0.12, 'lowpass', FOOTSTEP_FREQUENCY[surface] * 0.9);
    this.tone(180, 0.12, 'triangle', 0.04, 90);
  }

  placeBlock(): void {
    this.tone(140, 0.08, 'square', 0.04, 110);
    this.burst(0.05, 0.03, 'bandpass', 1200);
  }

  swing(): void {
    this.burst(0.09, 0.03, 'bandpass', 1900);
  }

  hurt(): void {
    this.tone(220, 0.18, 'sawtooth', 0.07, 110);
  }

  death(): void {
    this.tone(320, 0.24, 'triangle', 0.07, 180, 0);
    this.tone(260, 0.26, 'triangle', 0.06, 140, 0.12);
    this.tone(180, 0.4, 'triangle', 0.05, 90, 0.24);
  }

  eat(): void {
    this.burst(0.06, 0.04, 'lowpass', 700);
    this.burst(0.06, 0.03, 'lowpass', 900);
  }

  creature(kind: 'gloomling' | 'cinder-wisp'): void {
    if (kind === 'gloomling') {
      this.tone(92, 0.5, 'sawtooth', 0.04, 58);
      this.tone(120, 0.35, 'triangle', 0.02, 80);
    } else {
      this.tone(880, 0.4, 'sine', 0.035, 1380);
      this.tone(1320, 0.3, 'sine', 0.02, 1760, 0.15);
    }
  }

  setPhase(phase: DayPhase, daylight: number): void {
    if (phase === this.phase) {
      this.applyAmbience(daylight);
      return;
    }
    this.phase = phase;
    this.stopDrone();
    this.stopChirps();

    if (phase === 'night') {
      this.startDrone();
    } else if (phase === 'day' || phase === 'dawn') {
      this.startChirps();
    }
    this.applyAmbience(daylight);
  }

  private applyAmbience(daylight: number): void {
    if (this.context === null || this.ambience === null) return;
    const target = 0.03 + Math.max(0, Math.min(1, daylight)) * 0.07;
    this.ambience.gain.setTargetAtTime(target, this.context.currentTime, 0.4);
  }

  private startDrone(): void {
    const context = this.context;
    const ambience = this.ambience;
    if (context === null || ambience === null) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 55;
    gain.gain.value = 0.5;
    oscillator.connect(gain);
    gain.connect(ambience);
    oscillator.start();
    this.drone = oscillator;
    this.droneGain = gain;
  }

  private stopDrone(): void {
    if (this.drone !== null) {
      try {
        this.drone.stop();
      } catch {
        // Already stopped; nothing to release.
      }
      this.drone.disconnect();
      this.drone = null;
    }
    if (this.droneGain !== null) {
      this.droneGain.disconnect();
      this.droneGain = null;
    }
  }

  private startChirps(): void {
    if (typeof window === 'undefined' || this.chirpTimer !== null) return;
    this.chirpTimer = window.setInterval(() => {
      if (this.context === null || this.muted) return;
      this.tone(1440, 0.06, 'sine', 0.015, 1760);
      this.tone(1560, 0.05, 'sine', 0.012, 1900, 0.09);
    }, 4200);
  }

  private stopChirps(): void {
    if (this.chirpTimer !== null) {
      window.clearInterval(this.chirpTimer);
      this.chirpTimer = null;
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    level: number,
    slideTo?: number,
    delay = 0,
  ): void {
    const context = this.context;
    const master = this.master;
    if (context === null || master === null) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    }
    gain.gain.setValueAtTime(Math.max(0.0001, level), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private burst(duration: number, level: number, type: BiquadFilterType, frequency: number): void {
    const context = this.context;
    const master = this.master;
    if (context === null || master === null) return;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer(context);
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    const start = context.currentTime;
    gain.gain.setValueAtTime(Math.max(0.0001, level), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise !== null) return this.noise;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    this.noise = buffer;
    return buffer;
  }
}