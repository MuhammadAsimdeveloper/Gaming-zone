export class AnimationLoop {
  private active = false;

  constructor(private readonly setAnimationLoop: (callback: (() => void) | null) => void) {}

  get running(): boolean {
    return this.active;
  }

  start(callback: () => void): void {
    this.active = true;
    this.setAnimationLoop(callback);
  }

  stop(): void {
    this.active = false;
    this.setAnimationLoop(null);
  }
}
