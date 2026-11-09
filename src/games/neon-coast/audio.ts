/**
 * Procedural Web Audio for Neon Coast. No samples and no licensed material:
 * every cue is synthesised from oscillators at runtime.
 */

export type AudioCue =
  | 'enter-car'
  | 'exit-car'
  | 'checkpoint'
  | 'discover'
  | 'shard'
  | 'complete'
  | 'failed';

export interface CoastAudioChannel {
  start(): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
  toggleMute(): boolean;
  readonly muted: boolean;
  updateEngine(speed: number): void;
  cue(cue: AudioCue): void;
}

type Wave = OscillatorType;

export class NeonCoastAudio implements CoastAudioChannel {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private mutedState = false;

  get muted(): boolean {
    return this.mutedState;
  }

  start(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      return;
    }
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = this.mutedState ? 0 : 0.45;
    master.connect(context.destination);

    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = 55;
    engineOscillator.connect(engineGain);
    engineGain.connect(master);
    engineOscillator.start();

    this.context = context;
    this.master = master;
    this.engineOscillator = engineOscillator;
    this.engineGain = engineGain;
  }

  private tone(
    frequency: number,
    duration = 0.12,
    wave: Wave = 'sine',
    volume = 0.06,
    delay = 0,
  ): void {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  updateEngine(speed: number): void {
    if (!this.context || !this.engineGain || !this.engineOscillator) return;
    const ratio = Math.min(Math.abs(speed) / 430, 1);
    const gain = this.mutedState ? 0 : 0.008 + ratio * 0.03;
    this.engineGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.08);
    this.engineOscillator.frequency.setTargetAtTime(
      55 + ratio * 95,
      this.context.currentTime,
      0.08,
    );
  }

  cue(cue: AudioCue): void {
    switch (cue) {
      case 'enter-car':
        this.tone(180, 0.1, 'triangle', 0.07);
        this.tone(260, 0.14, 'triangle', 0.05, 0.06);
        break;
      case 'exit-car':
        this.tone(220, 0.1, 'triangle', 0.05);
        break;
      case 'checkpoint':
        this.tone(660, 0.08, 'sine', 0.06);
        this.tone(880, 0.12, 'sine', 0.05, 0.06);
        break;
      case 'discover':
        this.tone(520, 0.12, 'triangle', 0.06);
        this.tone(780, 0.16, 'triangle', 0.05, 0.08);
        break;
      case 'shard':
        this.tone(980, 0.06, 'sine', 0.05);
        this.tone(1320, 0.09, 'sine', 0.04, 0.04);
        break;
      case 'complete':
        this.tone(523, 0.12, 'triangle', 0.08);
        this.tone(659, 0.12, 'triangle', 0.08, 0.1);
        this.tone(784, 0.14, 'triangle', 0.08, 0.2);
        this.tone(1046, 0.24, 'triangle', 0.07, 0.3);
        break;
      case 'failed':
        this.tone(300, 0.2, 'sawtooth', 0.05);
        this.tone(220, 0.26, 'sawtooth', 0.045, 0.14);
        this.tone(150, 0.34, 'sine', 0.05, 0.3);
        break;
    }
  }

  toggleMute(): boolean {
    this.mutedState = !this.mutedState;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.mutedState ? 0 : 0.45, this.context.currentTime, 0.05);
    }
    return this.mutedState;
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume().catch(() => undefined);
  }

  dispose(): void {
    if (this.engineOscillator) {
      try {
        this.engineOscillator.stop();
      } catch {
        // The oscillator may already be stopped.
      }
      this.engineOscillator.disconnect();
    }
    this.engineOscillator = null;
    this.engineGain?.disconnect();
    this.engineGain = null;
    const context = this.context;
    if (context) void context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
  }
}
