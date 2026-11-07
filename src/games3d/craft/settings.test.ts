import { describe, expect, it } from 'vitest';
import { defaultPreferences, sanitizePreferences } from './settings';

describe('craft preferences', () => {
  it('uses the quality tier defaults when nothing is stored', () => {
    expect(defaultPreferences('desktop')).toEqual({
      renderDistance: 6,
      fov: 75,
      sensitivity: 1,
      shadows: true,
      reducedEffects: false,
    });
    expect(defaultPreferences('mobile')).toMatchObject({
      renderDistance: 3,
      shadows: false,
    });
  });

  it('keeps the mobile render distance inside the mobile range', () => {
    expect(
      sanitizePreferences({ renderDistance: 8 }, 'mobile').renderDistance,
    ).toBe(4);
    expect(
      sanitizePreferences({ renderDistance: 1 }, 'mobile').renderDistance,
    ).toBe(2);
    expect(
      sanitizePreferences({ renderDistance: 3 }, 'mobile').renderDistance,
    ).toBe(3);
  });

  it('clamps field of view and sensitivity to the supported range', () => {
    expect(sanitizePreferences({ fov: 10 }, 'desktop').fov).toBe(60);
    expect(sanitizePreferences({ fov: 140 }, 'desktop').fov).toBe(90);
    expect(sanitizePreferences({ sensitivity: 0 }, 'desktop').sensitivity).toBe(0.2);
    expect(sanitizePreferences({ sensitivity: 9 }, 'desktop').sensitivity).toBe(3);
  });

  it('falls back to defaults for malformed values', () => {
    const result = sanitizePreferences(
      {
        renderDistance: 'far',
        fov: Number.NaN,
        sensitivity: null,
        shadows: 'yes',
        reducedEffects: 1,
      },
      'desktop',
    );
    expect(result).toEqual(defaultPreferences('desktop'));
  });

  it('accepts stored booleans and rounds render distance', () => {
    const result = sanitizePreferences(
      { renderDistance: 5.6, shadows: false, reducedEffects: true },
      'desktop',
    );
    expect(result.renderDistance).toBe(6);
    expect(result.shadows).toBe(false);
    expect(result.reducedEffects).toBe(true);
  });
});