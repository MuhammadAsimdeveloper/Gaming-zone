import { GameAudio } from '../shared/audio';

export class RallyAudio {
  private audio = new GameAudio();
  private skidClock = 0;

  start(): void {
    this.audio.start();
  }

  engine(ratio: number): void {
    this.audio.setSpeed(ratio);
    this.audio.setEngineVolume(0.03 + Math.min(1, Math.max(0, ratio)) * 0.07);
  }

  skid(amount: number, delta: number): void {
    if (amount <= 0.08) return;
    this.skidClock -= delta;
    if (this.skidClock > 0) return;
    this.skidClock = 0.16;
    this.audio.beep(120 + amount * 80, 70, 'sawtooth', 0.018 * Math.min(1, amount));
  }

  impact(strength: number): void {
    this.audio.crash(Math.min(1, Math.max(0.2, strength)));
  }

  countdown(final: boolean): void {
    this.audio.countdown(final);
  }

  lap(record = false): void {
    this.audio.lap();
    if (record) window.setTimeout(() => this.audio.beep(1568, 220, 'sine', 0.06), 240);
  }

  finish(): void {
    this.audio.setEngineVolume(0.0001);
    this.audio.beep(880, 160, 'sine', 0.08);
    window.setTimeout(() => this.audio.beep(1320, 320, 'sine', 0.08), 170);
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  setMuted(muted: boolean): void {
    if (this.audio.isMuted !== muted) this.audio.toggleMute();
  }

  get isMuted(): boolean {
    return this.audio.isMuted;
  }

  pause(): void {
    this.audio.setEngineVolume(0.0001);
    this.audio.suspend();
  }

  stopMusic(): void {
    this.audio.stopMusic();
  }

  resume(): void {
    this.audio.resume();
  }

  dispose(): void {
    this.audio.dispose();
  }
}
