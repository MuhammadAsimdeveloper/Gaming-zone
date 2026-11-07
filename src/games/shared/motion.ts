import { useEffect, useState } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function preferenceQuery(): MediaQueryList | null {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia(REDUCED_MOTION_QUERY);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => preferenceQuery()?.matches ?? false);

  useEffect(() => {
    const query = preferenceQuery();
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

// The orb's soft pulse is decorative; a still orb reads the same.
export function foodPulse(reduced: boolean, time: number): number {
  return reduced ? 1 : 0.75 + Math.sin(time / 260) * 0.15;
}

// Ground dashes sell the speed of travel; holding them steady keeps the cue.
export function groundDashOffset(reduced: boolean, distance: number): number {
  return reduced ? 0 : -((distance * 0.8) % 64);
}

// The bar has to keep moving to be playable, so reduced motion slows its pace.
export function markerSpeed(reduced: boolean, speed: number): number {
  return reduced ? speed * 0.6 : speed;
}