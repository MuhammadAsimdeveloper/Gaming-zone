export type SpeciesId = 'kelp' | 'glowmoss' | 'grazer' | 'burrower' | 'skimmer' | 'reef-hunter';

export type SpeciesRole = 'producer' | 'herbivore' | 'predator';

export interface Species {
  id: SpeciesId;
  name: string;
  role: SpeciesRole;
  diet: SpeciesId | null;
  color: string;
  growth: number;
  capacity: number;
  appetite: number;
  conversion: number;
  mortality: number;
  halfSaturation: number;
}

export const SPECIES: readonly Species[] = [
  {
    id: 'kelp',
    name: 'Glow Kelp',
    role: 'producer',
    diet: null,
    color: '#4ade9d',
    growth: 0.45,
    capacity: 700,
    appetite: 0,
    conversion: 0,
    mortality: 0.02,
    halfSaturation: 0,
  },
  {
    id: 'glowmoss',
    name: 'Rift Glowmoss',
    role: 'producer',
    diet: null,
    color: '#7dd3fc',
    growth: 0.5,
    capacity: 620,
    appetite: 0,
    conversion: 0,
    mortality: 0.02,
    halfSaturation: 0,
  },
  {
    id: 'grazer',
    name: 'Mist Grazer',
    role: 'herbivore',
    diet: 'kelp',
    color: '#fbbf24',
    growth: 0,
    capacity: 0,
    appetite: 0.5,
    conversion: 0.5,
    mortality: 0.06,
    halfSaturation: 260,
  },
  {
    id: 'burrower',
    name: 'Mud Burrower',
    role: 'herbivore',
    diet: 'glowmoss',
    color: '#f472b6',
    growth: 0,
    capacity: 0,
    appetite: 0.45,
    conversion: 0.5,
    mortality: 0.06,
    halfSaturation: 220,
  },
  {
    id: 'skimmer',
    name: 'Fin Skimmer',
    role: 'predator',
    diet: 'grazer',
    color: '#a78bfa',
    growth: 0,
    capacity: 0,
    appetite: 0.4,
    conversion: 0.35,
    mortality: 0.05,
    halfSaturation: 45,
  },
  {
    id: 'reef-hunter',
    name: 'Reef Hunter',
    role: 'predator',
    diet: 'burrower',
    color: '#fb7185',
    growth: 0,
    capacity: 0,
    appetite: 0.36,
    conversion: 0.35,
    mortality: 0.05,
    halfSaturation: 40,
  },
];

export const SPECIES_IDS: readonly SpeciesId[] = SPECIES.map((species) => species.id);

const BY_ID = new Map<SpeciesId, Species>(SPECIES.map((species) => [species.id, species]));

export function speciesById(id: SpeciesId): Species {
  const species = BY_ID.get(id);
  if (!species) throw new Error(`Unknown species: ${id}`);
  return species;
}
