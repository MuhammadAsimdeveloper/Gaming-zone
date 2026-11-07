import type { DayPhase } from './creatures';

export type { DayPhase };

export const CYCLE_SECONDS = 720;
export const PHASE_SECONDS: Record<DayPhase, number> = {
  day: 360,
  dusk: 90,
  night: 180,
  dawn: 90,
};

const PHASE_ORDER: readonly DayPhase[] = ['day', 'dusk', 'night', 'dawn'];
const NIGHT_SKY = 0.25;

export interface ClockState {
  day: number;
  phase: DayPhase;
  progress: number;
  secondsIntoCycle: number;
  label: string;
}

function wrapSeconds(elapsed: number): number {
  const wrapped = elapsed % CYCLE_SECONDS;
  return wrapped < 0 ? wrapped + CYCLE_SECONDS : wrapped;
}

export function phaseAt(elapsed: number): DayPhase {
  const seconds = wrapSeconds(elapsed);
  let start = 0;
  for (const phase of PHASE_ORDER) {
    start += PHASE_SECONDS[phase];
    if (seconds < start) return phase;
  }
  return 'day';
}

function phaseStart(phase: DayPhase): number {
  let start = 0;
  for (const candidate of PHASE_ORDER) {
    if (candidate === phase) return start;
    start += PHASE_SECONDS[candidate];
  }
  return 0;
}

export function clockAt(elapsed: number): ClockState {
  const secondsIntoCycle = wrapSeconds(elapsed);
  const phase = phaseAt(secondsIntoCycle);
  const start = phaseStart(phase);
  const minutes = Math.floor(secondsIntoCycle * 2) + 6 * 60;
  const hours = Math.floor(minutes / 60) % 24;
  const minuteOfHour = minutes % 60;
  return {
    day: Math.floor(elapsed / CYCLE_SECONDS) + 1,
    phase,
    progress: (secondsIntoCycle - start) / PHASE_SECONDS[phase],
    secondsIntoCycle,
    label: `${String(hours).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`,
  };
}

export function skyLightAt(elapsed: number): number {
  const { phase, progress } = clockAt(elapsed);
  switch (phase) {
    case 'day':
      return 1;
    case 'dusk':
      return 1 - (1 - NIGHT_SKY) * progress;
    case 'night':
      return NIGHT_SKY;
    case 'dawn':
      return NIGHT_SKY + (1 - NIGHT_SKY) * progress;
  }
}