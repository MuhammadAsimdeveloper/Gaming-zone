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
 * A tiny shared clock for turn/tick based simulation games.
 *
 * It deliberately does not catch up after a background tab: ticks that would
 * have happened while the page was hidden are skipped, so a player never
 * returns to a simulation that advanced while they were away.
 */
export function useSimulationClock({ active, intervalMs, onTick }: SimulationClockOptions): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!active) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      onTickRef.current();
    }, Math.max(250, intervalMs));

    return () => window.clearInterval(timer);
  }, [active, intervalMs]);
}
