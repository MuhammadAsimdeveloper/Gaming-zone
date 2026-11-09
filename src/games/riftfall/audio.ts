import { GameAudio } from '../../games3d/shared/audio';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class RiftfallAudio {
  private audio = new GameAudio();
  private mutedState = this.audio.isMuted;

  start(): void {
    this.audio.start();
  }

  hit(strength = 1): void {
    const amount = clamp(strength, 0.1, 1);
    this.audio.crash(0.25 + amount * 0.4);
    this.audio.beep(180 + amount * 140, 50, 'square', 0.045);
  }

  parry(): void {
    this.audio.beep(660, 90, 'triangle', 0.06);
    this.audio.beep(990, 140, 'sine', 0.05);
  }

  dash(): void {
    this.audio.beep(280, 90, 'sawtooth', 0.035);
  }

  wave(): void {
    this.audio.beep(520, 120, 'sine', 0.05);
    window.setTimeout(() => this.audio.beep(780, 160, 'sine', 0.05), 110);
  }

  boss(): void {
    this.audio.crash(0.8);
    this.audio.beep(80, 380, 'sawtooth', 0.06);
  }

  select(): void {
    this.audio.beep(740, 80, 'square', 0.04);
  }

  ko(): void {
    this.audio.crash(1);
    this.audio.beep(90, 420, 'sawtooth', 0.07);
  }

  victory(): void {
    this.audio.lap();
    window.setTimeout(() => this.audio.beep(1320, 240, 'sine', 0.05), 260);
  }

  toggleMute(): boolean {
    this.mutedState = this.audio.toggleMute();
    return this.mutedState;
  }

  setMuted(muted: boolean): void {
    this.mutedState = this.audio.isMuted !== muted ? this.audio.toggleMute() : muted;
  }

  get isMuted(): boolean {
    return this.mutedState;
  }

  dispose(): void {
    this.audio.dispose();
  }
}
