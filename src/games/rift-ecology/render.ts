import { scenarioById, type Scenario, type ScenarioId } from './scenarios';
import { SPECIES, speciesById, type SpeciesId, type SpeciesRole } from './species';

export interface HabitatMarker {
  id: SpeciesId;
  name: string;
  color: string;
  role: SpeciesRole;
  x: number;
  y: number;
  radius: number;
}

export interface HabitatLayout {
  width: number;
  height: number;
  ridge: string;
  markers: HabitatMarker[];
}

const BAND_Y: Record<SpeciesRole, number> = {
  producer: 168,
  herbivore: 120,
  predator: 74,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildLinePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * step : width / 2;
      const y = height - clamp(value / max, 0, 1) * height;
      return `${index === 0 ? 'M' : 'L'}${round(x)},${round(y)}`;
    })
    .join(' ');
}

export function buildHabitatLayout(scenarioInput: Scenario | ScenarioId): HabitatLayout {
  const scenario = typeof scenarioInput === 'string' ? scenarioById(scenarioInput) : scenarioInput;
  const width = 320;
  const height = 220;

  const markers: HabitatMarker[] = [];
  for (const role of ['producer', 'herbivore', 'predator'] as const) {
    const members = SPECIES.filter((species) => species.role === role);
    members.forEach((species, index) => {
      const spread = width - 80;
      const x = 40 + (index + 0.5) * (spread / members.length);
      const start = Math.max(1, scenario.start[species.id]);
      markers.push({
        id: species.id,
        name: species.name,
        color: speciesById(species.id).color,
        role,
        x: round(x),
        y: BAND_Y[role],
        radius: round(clamp(5 + Math.sqrt(start) / 1.6, 6, 18)),
      });
    });
  }

  return {
    width,
    height,
    ridge: 'M0,150 L35,132 L70,140 L105,118 L140,128 L175,108 L210,122 L245,100 L280,116 L320,102 L320,220 L0,220 Z',
    markers,
  };
}
