export type FighterId = 'volt' | 'kestrel' | 'mako' | 'sable';
export type MoveId = 'light' | 'heavy' | 'special';
export type AiTier = 'rookie' | 'standard' | 'rival';

/**
 * Frame data is expressed in 60 Hz ticks. `startup` ticks pass before the
 * hitbox is live for `active` ticks, then `recovery` ticks lock the fighter.
 */
export interface MoveSpec {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chip: number;
  reach: number;
  hitstop: number;
  knockback: number;
  meterCost: number;
  meterGainHit: number;
  meterGainBlock: number;
  cancelInto: MoveId[];
}

export interface FighterSpec {
  id: FighterId;
  name: string;
  tagline: string;
  description: string;
  color: string;
  accent: string;
  maxHealth: number;
  walkSpeed: number;
  jumpSpeed: number;
  dashSpeed: number;
  hurtboxWidth: number;
  hurtboxHeight: number;
  specialName: string;
  moves: Record<MoveId, MoveSpec>;
}

export interface LadderRung {
  fighter: FighterId;
  tier: AiTier;
  name: string;
}

export const FIGHTERS: Record<FighterId, FighterSpec> = {
  volt: {
    id: 'volt',
    name: 'Volt',
    tagline: 'Measured all-rounder',
    description:
      'Clean confirms, dependable reach and no real weakness. Volt rewards patient spacing and converts a landed light into heavy pressure.',
    color: '#38e8ff',
    accent: '#a06bff',
    maxHealth: 1000,
    walkSpeed: 2.6,
    jumpSpeed: 8.4,
    dashSpeed: 11,
    hurtboxWidth: 0.62,
    hurtboxHeight: 1.75,
    specialName: 'Ion Rush',
    moves: {
      light: {
        startup: 4,
        active: 3,
        recovery: 7,
        damage: 38,
        chip: 6,
        reach: 1.25,
        hitstop: 5,
        knockback: 2.4,
        meterCost: 0,
        meterGainHit: 6,
        meterGainBlock: 3,
        cancelInto: ['heavy', 'special'],
      },
      heavy: {
        startup: 9,
        active: 4,
        recovery: 15,
        damage: 92,
        chip: 12,
        reach: 1.5,
        hitstop: 9,
        knockback: 5.2,
        meterCost: 0,
        meterGainHit: 10,
        meterGainBlock: 5,
        cancelInto: [],
      },
      special: {
        startup: 8,
        active: 5,
        recovery: 20,
        damage: 150,
        chip: 20,
        reach: 1.8,
        hitstop: 13,
        knockback: 7.2,
        meterCost: 50,
        meterGainHit: 0,
        meterGainBlock: 0,
        cancelInto: [],
      },
    },
  },
  kestrel: {
    id: 'kestrel',
    name: 'Kestrel',
    tagline: 'Long-reach skirmisher',
    description:
      'The fastest fighter on the roster, trading health for reach. Kestrel pokes from outside most hurtboxes and escapes with a rising jump.',
    color: '#ffcf5c',
    accent: '#ff6b9d',
    maxHealth: 880,
    walkSpeed: 3.3,
    jumpSpeed: 9,
    dashSpeed: 13,
    hurtboxWidth: 0.56,
    hurtboxHeight: 1.68,
    specialName: 'Skyline Break',
    moves: {
      light: {
        startup: 3,
        active: 3,
        recovery: 6,
        damage: 32,
        chip: 5,
        reach: 1.55,
        hitstop: 4,
        knockback: 1.9,
        meterCost: 0,
        meterGainHit: 7,
        meterGainBlock: 3,
        cancelInto: ['heavy', 'special'],
      },
      heavy: {
        startup: 8,
        active: 4,
        recovery: 14,
        damage: 82,
        chip: 11,
        reach: 1.8,
        hitstop: 8,
        knockback: 4.6,
        meterCost: 0,
        meterGainHit: 11,
        meterGainBlock: 5,
        cancelInto: [],
      },
      special: {
        startup: 7,
        active: 4,
        recovery: 18,
        damage: 136,
        chip: 18,
        reach: 2,
        hitstop: 12,
        knockback: 6.6,
        meterCost: 50,
        meterGainHit: 0,
        meterGainBlock: 0,
        cancelInto: [],
      },
    },
  },
  mako: {
    id: 'mako',
    name: 'Mako',
    tagline: 'Heavy pressure bruiser',
    description:
      'Slow on the walk but terrifying inside close range. Mako soaks hits, punishes blocked pressure and ends rounds with a single heavy read.',
    color: '#ff7a59',
    accent: '#ffcf5c',
    maxHealth: 1180,
    walkSpeed: 2,
    jumpSpeed: 7.6,
    dashSpeed: 9.5,
    hurtboxWidth: 0.72,
    hurtboxHeight: 1.85,
    specialName: 'Tide Wrecker',
    moves: {
      light: {
        startup: 6,
        active: 4,
        recovery: 10,
        damage: 52,
        chip: 8,
        reach: 1.15,
        hitstop: 7,
        knockback: 3.4,
        meterCost: 0,
        meterGainHit: 8,
        meterGainBlock: 4,
        cancelInto: ['heavy', 'special'],
      },
      heavy: {
        startup: 12,
        active: 5,
        recovery: 18,
        damage: 118,
        chip: 16,
        reach: 1.5,
        hitstop: 11,
        knockback: 6.8,
        meterCost: 0,
        meterGainHit: 12,
        meterGainBlock: 6,
        cancelInto: [],
      },
      special: {
        startup: 10,
        active: 6,
        recovery: 24,
        damage: 176,
        chip: 24,
        reach: 1.7,
        hitstop: 15,
        knockback: 8.4,
        meterCost: 50,
        meterGainHit: 0,
        meterGainBlock: 0,
        cancelInto: [],
      },
    },
  },
  sable: {
    id: 'sable',
    name: 'Sable',
    tagline: 'Counter-punish technician',
    description:
      'A deliberate fighter built around reads. Sable builds meter quickly, then cashes it in with the strongest special on the roster.',
    color: '#a06bff',
    accent: '#4ade9d',
    maxHealth: 960,
    walkSpeed: 2.9,
    jumpSpeed: 8.6,
    dashSpeed: 11.5,
    hurtboxWidth: 0.6,
    hurtboxHeight: 1.72,
    specialName: 'Null Lattice',
    moves: {
      light: {
        startup: 4,
        active: 3,
        recovery: 8,
        damage: 36,
        chip: 6,
        reach: 1.35,
        hitstop: 5,
        knockback: 2.1,
        meterCost: 0,
        meterGainHit: 8,
        meterGainBlock: 4,
        cancelInto: ['heavy', 'special'],
      },
      heavy: {
        startup: 10,
        active: 4,
        recovery: 16,
        damage: 88,
        chip: 12,
        reach: 1.6,
        hitstop: 9,
        knockback: 4.8,
        meterCost: 0,
        meterGainHit: 12,
        meterGainBlock: 6,
        cancelInto: [],
      },
      special: {
        startup: 9,
        active: 6,
        recovery: 22,
        damage: 168,
        chip: 22,
        reach: 1.95,
        hitstop: 14,
        knockback: 7.6,
        meterCost: 50,
        meterGainHit: 0,
        meterGainBlock: 0,
        cancelInto: [],
      },
    },
  },
};

export const FIGHTER_ORDER: FighterId[] = ['volt', 'kestrel', 'mako', 'sable'];

export const DUEL_LADDER: LadderRung[] = [
  { fighter: 'volt', tier: 'rookie', name: 'Volt · Warm-up' },
  { fighter: 'kestrel', tier: 'rookie', name: 'Kestrel · Rooftops' },
  { fighter: 'mako', tier: 'standard', name: 'Mako · Dry Dock' },
  { fighter: 'kestrel', tier: 'rival', name: 'Kestrel · Overdrive' },
  { fighter: 'sable', tier: 'rival', name: 'Sable · Finale' },
];
