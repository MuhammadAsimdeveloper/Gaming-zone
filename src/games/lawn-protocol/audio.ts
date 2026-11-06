type OscillatorWave = OscillatorType;

/** Procedural cues for the rooftop defence: no samples, no licensing. */
export class LawnAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  start(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.5;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
  }

  tone(frequency: number, duration = 0.12, wave: OscillatorWave = 'sine', volume = 0.06, delay = 0): void {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  plant(): void {
    this.tone(240, 0.1, 'triangle', 0.07);
    this.tone(360, 0.12, 'triangle', 0.05, 0.05);
  }

  shovel(): void {
    this.tone(160, 0.1, 'sawtooth', 0.05);
  }

  collect(): void {
    this.tone(880, 0.07, 'sine', 0.05);
    this.tone(1180, 0.1, 'sine', 0.04, 0.05);
  }

  shot(): void {
    this.tone(520, 0.05, 'square', 0.035);
  }

  hit(): void {
    this.tone(190, 0.07, 'triangle', 0.05);
  }

  down(): void {
    this.tone(320, 0.16, 'sawtooth', 0.05);
    this.tone(180, 0.2, 'sawtooth', 0.04, 0.08);
  }

  wave(): void {
    this.tone(140, 0.3, 'sawtooth', 0.06);
    this.tone(190, 0.34, 'sawtooth', 0.05, 0.05);
  }

  purge(): void {
    this.tone(90, 0.35, 'square', 0.07);
    this.tone(420, 0.2, 'triangle', 0.04, 0.05);
  }

  win(): void {
    this.tone(523, 0.14, 'triangle', 0.08);
    this.tone(659, 0.14, 'triangle', 0.08, 0.12);
    this.tone(784, 0.26, 'triangle', 0.09, 0.24);
  }

  lose(): void {
    this.tone(300, 0.22, 'sawtooth', 0.06);
    this.tone(220, 0.3, 'sawtooth', 0.05, 0.16);
    this.tone(150, 0.4, 'sine', 0.05, 0.34);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.context.currentTime, 0.05);
    }
    return this.muted;
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume().catch(() => undefined);
  }

  dispose(): void {
    const context = this.context;
    if (context) void context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
  }
}
