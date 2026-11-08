import { useEffect, useRef } from 'react';

export interface SimulationClockOptions {
  /** When false the interval is removed entirely. */
  active: boolean;
  /** Milliseconds between simulation ticks. */
  intervalMs: number;
  /** Called once per tick. Always the latest callback, never a stale closure. */
  onTick: () => void;
}

/**
 * A shared clock for turn/tick based simulation games.
 *
 * Ticks are skipped while the document is hidden or its window is blurred.
 * The clock does not catch up when focus returns, so no background progress
 * is applied to a player's simulation.
 */
export function useSimulationClock({ active, intervalMs, onTick }: SimulationClockOptions): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!active) return undefined;

    let isVisible = document.visibilityState !== 'hidden';
    let hasWindowFocus = true;

    function handleVisibility() {
      isVisible = document.visibilityState !== 'hidden';
    }

    function handleBlur() {
      hasWindowFocus = false;
    }

    function handleFocus() {
      hasWindowFocus = true;
    }

    function handlePageHide() {
      isVisible = false;
    }

    function handlePageShow() {
      isVisible = document.visibilityState !== 'hidden';
    }

    const timer = window.setInterval(() => {
      if (!isVisible || !hasWindowFocus) return;
      onTickRef.current();
    }, Math.max(250, intervalMs));

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [active, intervalMs]);
}
