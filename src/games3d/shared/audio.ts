type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  start(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.7;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 3;

    const engineGain = context.createGain();
    engineGain.gain.value = 0.0001;
    filter.connect(engineGain);
    engineGain.connect(master);

    const oscA = context.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 70;
    const oscB = context.createOscillator();
    oscB.type = 'square';
    oscB.frequency.value = 35;
    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start();
    oscB.start();

    this.context = context;
    this.master = master;
    this.engineGain = engineGain;
    this.engineOscA = oscA;
    this.engineOscB = oscB;
    this.engineFilter = filter;

    this.startMusic();
  }

  setSpeed(ratio: number): void {
    if (!this.context || !this.engineOscA || !this.engineOscB || !this.engineFilter) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const now = this.context.currentTime;
    this.engineOscA.frequency.setTargetAtTime(58 + clamped * 190, now, 0.08);
    this.engineOscB.frequency.setTargetAtTime(29 + clamped * 95, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(500 + clamped * 2600, now, 0.1);
  }

  setEngineVolume(value: number): void {
    if (!this.context || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(Math.max(0.0001, value), this.context.currentTime, 0.1);
  }

  beep(frequency = 660, duration = 120, type: OscillatorType = 'square', volume = 0.08): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration / 1000 + 0.03);
  }

  countdown(final: boolean): void {
    this.beep(final ? 880 : 440, final ? 380 : 150, final ? 'sine' : 'square', 0.09);
  }

  lap(): void {
    this.beep(880, 120, 'sine', 0.07);
    window.setTimeout(() => this.beep(1320, 160, 'sine', 0.06), 110);
  }

  crash(intensity = 1): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const duration = 0.28;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * duration, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = this.context.createGain();
    gain.gain.value = Math.min(0.22, 0.1 * intensity);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.context.currentTime, 0.05);
    }
    return this.muted;
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend();
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume();
  }

  dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.engineOscA?.stop();
    this.engineOscB?.stop();
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
    this.engineGain = null;
    this.engineOscA = null;
    this.engineOscB = null;
    this.engineFilter = null;
  }

  private startMusic(): void {
    if (!this.context || !this.master || this.musicTimer !== null) return;
    const scale = [110, 130.81, 164.81, 196, 220, 261.63, 329.63, 392];
    this.musicTimer = window.setInterval(() => {
      if (!this.context || !this.master || this.muted) return;
      const now = this.context.currentTime;
      const index = [0, 2, 4, 7, 4, 2, 5, 3][this.musicStep % 8] ?? 0;
      this.musicStep += 1;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = scale[index] ?? 220;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.018, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.36);
    }, 260);
  }
}
