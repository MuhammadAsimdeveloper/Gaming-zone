import { StadiumAudio } from '../football/audio';
import type { TimingGrade } from './types';

/** Cricket cues layered over the shared stadium ambience and synth kit. */
export class CricketAudio {
  private base = new StadiumAudio();

  start(): void {
    this.base.start();
  }

  toggleMute(): boolean {
    return this.base.toggleMute();
  }

  suspend(): void {
    this.base.pause();
  }

  resume(): void {
    this.base.resume();
  }

  dispose(): void {
    this.base.dispose();
  }

  release(): void {
    this.base.pass();
  }

  bat(grade: TimingGrade, quality: number): void {
    if (grade === 'perfect') {
      this.base.kick(0.95);
      this.base.goal();
    } else if (grade === 'good') {
      this.base.kick(0.7);
    } else if (grade === 'ok') {
      this.base.kick(0.45);
    } else if (grade === 'edge') {
      this.base.tackle();
    } else {
      this.base.tackle();
    }
    if (quality > 0.7) this.base.whistle();
  }

  stumps(): void {
    this.base.tackle();
    this.base.tackle();
  }

  catchTaken(): void {
    this.base.tackle();
    this.base.pass();
  }

  six(): void {
    this.base.goal();
  }

  four(): void {
    this.base.whistle();
  }

  runs(): void {
    this.base.pass();
  }

  matchEnd(): void {
    this.base.whistle(true);
  }
}
