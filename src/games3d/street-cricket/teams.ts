export interface District {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  sky: string;
  ground: string;
  primary: string;
  secondary: string;
  accent: string;
  /** Modest batting power modifier source, 0-1. */
  power: number;
  /** Modest bowling control modifier source, 0-1. */
  control: number;
}

export const DISTRICTS: ReadonlyArray<District> = [
  {
    id: 'harbour-row',
    name: 'Harbour Row',
    shortName: 'Harbour',
    tagline: 'Salt air, tight ropes, loud crowds.',
    sky: '#0b1b2b',
    ground: '#12303c',
    primary: '#19c2b8',
    secondary: '#f4d06f',
    accent: '#63f2e4',
    power: 0.56,
    control: 0.5,
  },
  {
    id: 'mint-terrace',
    name: 'Mint Terrace',
    shortName: 'Mint',
    tagline: 'Rooftop gardens and patient batting.',
    sky: '#0d1f1a',
    ground: '#14342a',
    primary: '#5ce6a2',
    secondary: '#e8fff4',
    accent: '#a6ffd2',
    power: 0.48,
    control: 0.58,
  },
  {
    id: 'cinder-yard',
    name: 'Cinder Yard',
    shortName: 'Cinder',
    tagline: 'Foundry heat and heavy hitting.',
    sky: '#221310',
    ground: '#3a211a',
    primary: '#ff7a3d',
    secondary: '#ffd9a8',
    accent: '#ffb067',
    power: 0.62,
    control: 0.42,
  },
  {
    id: 'lantern-hill',
    name: 'Lantern Hill',
    shortName: 'Lantern',
    tagline: 'Festival lights and fearless running.',
    sky: '#1b1026',
    ground: '#2c1b3b',
    primary: '#d86bff',
    secondary: '#ffd166',
    accent: '#f5a6ff',
    power: 0.52,
    control: 0.52,
  },
  {
    id: 'glass-quarter',
    name: 'Glass Quarter',
    shortName: 'Glass',
    tagline: 'Tower shadows and precise bowling.',
    sky: '#0a1622',
    ground: '#122b3c',
    primary: '#58b6ff',
    secondary: '#d6f1ff',
    accent: '#9bd8ff',
    power: 0.46,
    control: 0.6,
  },
  {
    id: 'tidewalk',
    name: 'Tidewalk',
    shortName: 'Tide',
    tagline: 'Sea breeze, late swing, quick singles.',
    sky: '#101b2c',
    ground: '#163247',
    primary: '#2f7dff',
    secondary: '#ff8f70',
    accent: '#7db4ff',
    power: 0.55,
    control: 0.5,
  },
];

export function districtById(id: string): District {
  return DISTRICTS.find((district) => district.id === id) ?? DISTRICTS[0]!;
}

export function battingModifier(district: District): number {
  return 0.95 + district.power * 0.1;
}

export function opponentFor(playerDistrictId: string, rng: () => number = Math.random): string {
  const candidates = DISTRICTS.filter((district) => district.id !== playerDistrictId);
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(rng() * candidates.length)));
  return candidates[index]!.id;
}
