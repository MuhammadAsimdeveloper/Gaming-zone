import { describe, expect, it } from 'vitest';
import { GameAudio } from './audio';

describe('GameAudio mute state', () => {
  it('preserves a muted choice before the audio context starts', () => {
    const audio = new GameAudio();

    audio.setMuted(true);

    expect(audio.isMuted).toBe(true);
  });

  it('can restore the previous mute choice after an engine is recreated', () => {
    const previousEngineAudio = new GameAudio();
    previousEngineAudio.setMuted(true);

    const nextEngineAudio = new GameAudio();
    nextEngineAudio.setMuted(previousEngineAudio.isMuted);

    expect(nextEngineAudio.isMuted).toBe(true);
    expect(nextEngineAudio.toggleMute()).toBe(false);
  });
});
