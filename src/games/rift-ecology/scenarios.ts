import { SPECIES_IDS, type SpeciesId } from './species';

export type ScenarioId = 'kelp-forest' | 'rift-marsh' | 'ember-ridge';

export interface Scenario {
  id: ScenarioId;
  name: string;
  blurb: string;
  seasons: readonly [number, number, number, number];
  start: Record<SpeciesId, number>;
  capacityModifier: Record<SpeciesId, number>;
  targets: Partial<Record<SpeciesId, number>>;
}

function capacity(overrides: Partial<Record<SpeciesId, number>>): Record<SpeciesId, number> {
  const base = Object.fromEntries(SPECIES_IDS.map((id) => [id, 1])) as Record<SpeciesId, number>;
  return { ...base, ...overrides };
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'kelp-forest',
    name: 'Kelp Forest',
    blurb: 'Cold rift shallows where glow kelp feeds the grazers and skimmers patrol the fronds.',
    seasons: [1.15, 1, 0.45, 0.9],
    start: { kelp: 560, glowmoss: 160, grazer: 40, burrower: 22, skimmer: 40, 'reef-hunter': 12 },
    capacityModifier: capacity({ glowmoss: 0.6 }),
    targets: { kelp: 450, grazer: 25, skimmer: 8 },
  },
  {
    id: 'rift-marsh',
    name: 'Rift Marsh',
    blurb: 'Warm reed beds ruled by glowmoss, burrowers and the reef hunters that stalk them.',
    seasons: [0.85, 1.15, 0.9, 0.5],
    start: { kelp: 120, glowmoss: 480, grazer: 12, burrower: 40, skimmer: 8, 'reef-hunter': 34 },
    capacityModifier: capacity({ kelp: 0.65 }),
    targets: { glowmoss: 400, burrower: 26, 'reef-hunter': 8 },
  },
  {
    id: 'ember-ridge',
    name: 'Ember Ridge',
    blurb: 'Volcanic terraces scoured by heat seasons, where only the boldest food webs hold.',
    seasons: [1.05, 0.55, 1.2, 0.55],
    start: { kelp: 90, glowmoss: 300, grazer: 16, burrower: 46, skimmer: 16, 'reef-hunter': 32 },
    capacityModifier: capacity({ kelp: 0.5, glowmoss: 0.8 }),
    targets: { glowmoss: 240, burrower: 28, 'reef-hunter': 9 },
  },
];

export const SCENARIO_IDS: readonly ScenarioId[] = SCENARIOS.map((scenario) => scenario.id);

const BY_ID = new Map<ScenarioId, Scenario>(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function scenarioById(id: ScenarioId): Scenario {
  const scenario = BY_ID.get(id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}
