import { describe, expect, it } from 'vitest';
import { AnimationLoop } from './animationLoop';

describe('AnimationLoop', () => {
  it('releases the renderer loop when stopped', () => {
    const calls: Array<(() => void) | null> = [];
    const loop = new AnimationLoop((callback) => calls.push(callback));
    const frame = () => undefined;

    loop.start(frame);
    expect(loop.running).toBe(true);
    expect(calls).toEqual([frame]);

    loop.stop();
    expect(loop.running).toBe(false);
    expect(calls).toEqual([frame, null]);
  });

  it('can be started again with a new callback', () => {
    const calls: Array<(() => void) | null> = [];
    const loop = new AnimationLoop((callback) => calls.push(callback));
    const first = () => undefined;
    const second = () => undefined;

    loop.start(first);
    loop.stop();
    loop.start(second);

    expect(loop.running).toBe(true);
    expect(calls).toEqual([first, null, second]);
  });
});
