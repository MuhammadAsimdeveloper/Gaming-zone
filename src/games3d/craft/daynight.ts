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
const NIGHT_SKY_LIGHT = 0.25;

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
      return 1 - (1 - NIGHT_SKY_LIGHT) * progress;
    case 'night':
      return NIGHT_SKY_LIGHT;
    case 'dawn':
      return NIGHT_SKY_LIGHT + (1 - NIGHT_SKY_LIGHT) * progress;
  }
}
export interface SkyColor {
  r: number;
  g: number;
  b: number;
}

export interface SkyPalette {
  top: SkyColor;
  horizon: SkyColor;
  fog: SkyColor;
  sun: SkyColor;
  sunIntensity: number;
  ambientIntensity: number;
  starOpacity: number;
  /** Sunlight fraction, matching `skyLightAt`. */
  daylight: number;
  skyLight: number;
}

interface SkyKeyframe extends SkyPalette {
  at: number;
}

const DAY_SKY: Omit<SkyKeyframe, 'at'> = {
  top: { r: 0.28, g: 0.54, b: 0.88 },
  horizon: { r: 0.74, g: 0.88, b: 1 },
  fog: { r: 0.66, g: 0.8, b: 0.94 },
  sun: { r: 1, g: 0.95, b: 0.82 },
  sunIntensity: 2.2,
  ambientIntensity: 0.9,
  starOpacity: 0,
  daylight: 1,
  skyLight: 1,
};

const DUSK_SKY: Omit<SkyKeyframe, 'at'> = {
  top: { r: 0.16, g: 0.13, b: 0.34 },
  horizon: { r: 1, g: 0.46, b: 0.26 },
  fog: { r: 0.35, g: 0.26, b: 0.38 },
  sun: { r: 1, g: 0.5, b: 0.26 },
  sunIntensity: 0.85,
  ambientIntensity: 0.55,
  starOpacity: 0.35,
  daylight: 0.6,
  skyLight: 0.6,
};

const NIGHT_PALETTE: Omit<SkyKeyframe, 'at'> = {
  top: { r: 0.012, g: 0.03, b: 0.09 },
  horizon: { r: 0.05, g: 0.09, b: 0.22 },
  fog: { r: 0.03, g: 0.05, b: 0.12 },
  sun: { r: 0.42, g: 0.58, b: 1 },
  sunIntensity: 0.3,
  ambientIntensity: 0.32,
  starOpacity: 1,
  daylight: NIGHT_SKY_LIGHT,
  skyLight: NIGHT_SKY_LIGHT,
};

const DAWN_SKY: Omit<SkyKeyframe, 'at'> = {
  top: { r: 0.09, g: 0.19, b: 0.32 },
  horizon: { r: 0.26, g: 0.9, b: 0.8 },
  fog: { r: 0.15, g: 0.31, b: 0.37 },
  sun: { r: 0.8, g: 1, b: 0.95 },
  sunIntensity: 0.7,
  ambientIntensity: 0.5,
  starOpacity: 0.4,
  daylight: 0.6,
  skyLight: 0.6,
};

const SKY_KEYFRAMES: readonly SkyKeyframe[] = [
  { at: 0, ...DAY_SKY },
  { at: 300, ...DAY_SKY },
  { at: 405, ...DUSK_SKY },
  { at: 470, ...NIGHT_PALETTE, daylight: NIGHT_SKY_LIGHT, skyLight: NIGHT_SKY_LIGHT },
  { at: 620, ...NIGHT_PALETTE, daylight: NIGHT_SKY_LIGHT, skyLight: NIGHT_SKY_LIGHT },
  { at: 660, ...DAWN_SKY },
  { at: CYCLE_SECONDS, ...DAY_SKY },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(a: SkyColor, b: SkyColor, t: number): SkyColor {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

function mixSky(a: SkyKeyframe, b: SkyKeyframe, t: number): SkyPalette {
  return {
    top: mixColor(a.top, b.top, t),
    horizon: mixColor(a.horizon, b.horizon, t),
    fog: mixColor(a.fog, b.fog, t),
    sun: mixColor(a.sun, b.sun, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    starOpacity: lerp(a.starOpacity, b.starOpacity, t),
    daylight: lerp(a.daylight, b.daylight, t),
    skyLight: lerp(a.skyLight, b.skyLight, t),
  };
}

/**
 * Piecewise-linear sky palette over the twelve-minute cycle. Keyframes sit at the phase
 * boundaries plus one mid-dusk and one mid-dawn stop, so dusk warms before it darkens and
 * dawn warms before daylight returns. Both ends of the table share the day palette, which
 * keeps the wrap continuous.
 */
export function skyPalette(elapsed: number): SkyPalette {
  const seconds = wrapSeconds(elapsed);
  for (let index = 1; index < SKY_KEYFRAMES.length; index += 1) {
    const next = SKY_KEYFRAMES[index]!;
    if (seconds > next.at) continue;
    const previous = SKY_KEYFRAMES[index - 1]!;
    const span = next.at - previous.at;
    const t = span === 0 ? 0 : (seconds - previous.at) / span;
    return mixSky(previous, next, t);
  }
  return mixSky(DAY_SKY as SkyKeyframe, DAY_SKY as SkyKeyframe, 0);
}
