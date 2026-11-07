// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { GameAudio } from './audio';
import { THREE_D_MUTE_KEY, readMutedPreference, writeMutedPreference } from './mutePreference';

describe('3D mute preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to unmuted when nothing is stored', () => {
    expect(readMutedPreference()).toBe(false);
  });

  it('reads back a stored choice', () => {
    writeMutedPreference(true);
    expect(window.localStorage.getItem(THREE_D_MUTE_KEY)).toBe('true');
    expect(readMutedPreference()).toBe(true);

    writeMutedPreference(false);
    expect(readMutedPreference()).toBe(false);
  });

  it('ignores malformed records', () => {
    window.localStorage.setItem(THREE_D_MUTE_KEY, '{not json');
    expect(readMutedPreference()).toBe(false);

    window.localStorage.setItem(THREE_D_MUTE_KEY, '"yes"');
    expect(readMutedPreference()).toBe(false);
  });

  it('starts the audio engine from the stored choice and persists toggles', () => {
    writeMutedPreference(true);

    const audio = new GameAudio();
    expect(audio.isMuted).toBe(true);

    expect(audio.toggleMute()).toBe(false);
    expect(readMutedPreference()).toBe(false);
    expect(new GameAudio().isMuted).toBe(false);
  });
});