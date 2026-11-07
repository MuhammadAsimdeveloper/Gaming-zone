import { readMutedPreference, writeMutedPreference } from '../shared/mutePreference';

export class StadiumAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private muted = readMutedPreference();

  start(): void {
    if (this.context) {
      this.resumeContext();
      return;
    }
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.8;
    master.connect(context.destination);

    const length = context.sampleRate * 4;
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = last * 0.985 + white * 0.015;
        data[i] = last * 2.4;
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    const crowdGain = context.createGain();
    crowdGain.gain.value = 0.045;
    source.connect(filter);
    filter.connect(crowdGain);
    crowdGain.connect(master);
    source.start();

    this.context = context;
    this.master = master;
    this.crowdGain = crowdGain;
  }

  kick(power = 1): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
    gain.gain.setValueAtTime(0.16 * power, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
    this.noiseBurst(0.05, 900, 0.06 * power);
  }

  pass(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  tackle(): void {
    this.noiseBurst(0.14, 700, 0.1);
  }

  whistle(long = false): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const duration = long ? 0.6 : 0.32;
    for (const frequency of [2150, 2870]) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'square';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
      gain.gain.setValueAtTime(0.045, now + duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
  }

  goal(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      const start = now + index * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    if (this.crowdGain) {
      this.crowdGain.gain.cancelScheduledValues(now);
      this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
      this.crowdGain.gain.linearRampToValueAtTime(0.18, now + 0.15);
      this.crowdGain.gain.linearRampToValueAtTime(0.045, now + 2.4);
    }
    this.noiseBurst(0.5, 1600, 0.09);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    writeMutedPreference(this.muted);
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.context.currentTime, 0.05);
    }
    return this.muted;
  }

  pause(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }

  resume(): void {
    this.resumeContext();
  }

  dispose(): void {
    const context = this.context;
    if (context) void context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.crowdGain = null;
  }

  private resumeContext(): void {
    if (this.context?.state !== 'suspended') return;
    void this.context.resume().catch(() => undefined);
  }

  private noiseBurst(duration: number, frequency: number, volume: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }
}
