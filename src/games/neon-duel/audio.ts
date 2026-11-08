import { GameAudio } from '../../games3d/shared/audio';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class DuelAudio {
  private audio = new GameAudio();

  start(): void {
    this.audio.start();
  }

  hit(strength: number): void {
    const amount = clamp(strength, 0.1, 1);
    this.audio.crash(0.35 + amount * 0.5);
    this.audio.beep(120 + amount * 90, 60, 'square', 0.05);
  }

  block(): void {
    this.audio.beep(220, 80, 'triangle', 0.055);
    this.audio.beep(165, 60, 'triangle', 0.035);
  }

  whoosh(): void {
    this.audio.beep(320, 130, 'sawtooth', 0.035);
  }

  ko(): void {
    this.audio.crash(1);
    this.audio.beep(90, 420, 'sawtooth', 0.07);
  }

  countdown(final: boolean): void {
    this.audio.countdown(final);
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

  dispose(): void {
    this.audio.dispose();
  }
}
