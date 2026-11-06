type Wave = OscillatorType;

/** Small Web Audio helper for the 2D sports games: no engine hum, just event tones. */
export class SportsAudio {
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
    master.gain.value = this.muted ? 0 : 0.55;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
  }

  tone(frequency: number, duration = 0.12, type: Wave = 'sine', volume = 0.08, delay = 0): void {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  kick(power = 1): void {
    this.tone(150 + power * 40, 0.09, 'triangle', 0.12);
    this.tone(70, 0.12, 'sine', 0.08, 0.01);
  }

  whistle(): void {
    this.tone(1850, 0.16, 'square', 0.05);
    this.tone(2100, 0.2, 'square', 0.04, 0.12);
  }

  goal(): void {
    this.tone(523, 0.12, 'triangle', 0.09);
    this.tone(659, 0.12, 'triangle', 0.09, 0.1);
    this.tone(784, 0.2, 'triangle', 0.1, 0.2);
  }

  save(): void {
    this.tone(220, 0.14, 'sawtooth', 0.08);
    this.tone(160, 0.18, 'sawtooth', 0.06, 0.09);
  }

  miss(): void {
    this.tone(240, 0.2, 'sine', 0.06);
    this.tone(180, 0.24, 'sine', 0.05, 0.1);
  }

  score(): void {
    this.tone(740, 0.08, 'square', 0.06);
    this.tone(988, 0.12, 'square', 0.05, 0.07);
  }

  bounce(): void {
    this.tone(320, 0.05, 'triangle', 0.05);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.context.currentTime, 0.05);
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
