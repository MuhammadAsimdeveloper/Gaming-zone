import {
  BASE_WEAPONS,
  WEAPON_IDS,
  type RunState,
  type WeaponId,
  type WeaponStats,
} from './simulation';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  maxStacks: number;
  apply(stats: Record<WeaponId, WeaponStats>, state: RunState): void;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  blade: { ...BASE_WEAPONS.blade },
  arc: { ...BASE_WEAPONS.arc },
  rail: { ...BASE_WEAPONS.rail },
  bloom: { ...BASE_WEAPONS.bloom },
};

function tuneWeapons(
  stats: Record<WeaponId, WeaponStats>,
  tune: (weapon: WeaponStats) => void,
): void {
  for (const id of WEAPON_IDS) tune(stats[id]);
}

export const UPGRADES: readonly Upgrade[] = [
  {
    id: 'edge-oil',
    name: 'Edge Oil',
    description: 'Every weapon deals +6 damage.',
    maxStacks: 3,
    apply: (stats) => tuneWeapons(stats, (weapon) => (weapon.damage += 6)),
  },
  {
    id: 'quick-hands',
    name: 'Quick Hands',
    description: 'Attack cooldowns fall by 15%.',
    maxStacks: 3,
    apply: (stats) =>
      tuneWeapons(stats, (weapon) => {
        weapon.cooldownTicks = Math.max(6, Math.round(weapon.cooldownTicks * 0.85));
      }),
  },
  {
    id: 'long-reach',
    name: 'Long Reach',
    description: 'Weapon range grows by 12%.',
    maxStacks: 3,
    apply: (stats) =>
      tuneWeapons(stats, (weapon) => {
        weapon.range = Math.round(weapon.range * 1.12);
      }),
  },
  {
    id: 'split-shot',
    name: 'Split Shot',
    description: 'Splash area grows by 18 units.',
    maxStacks: 3,
    apply: (stats) => tuneWeapons(stats, (weapon) => (weapon.area += 18)),
  },
  {
    id: 'kinetic-boots',
    name: 'Kinetic Boots',
    description: 'Dash cooldown drops by 6 ticks.',
    maxStacks: 2,
    apply: (_stats, state) => {
      state.dashCooldownLength = Math.max(12, state.dashCooldownLength - 6);
    },
  },
  {
    id: 'rift-heart',
    name: 'Rift Heart',
    description: 'Maximum health grows by 20 and heals 20.',
    maxStacks: 3,
    apply: (_stats, state) => {
      state.player.maxHealth += 20;
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 20);
    },
  },
  {
    id: 'combo-core',
    name: 'Combo Core',
    description: 'Combo decay waits 60 more ticks.',
    maxStacks: 2,
    apply: (_stats, state) => {
      state.comboDecayTicks += 60;
    },
  },
  {
    id: 'parry-focus',
    name: 'Parry Focus',
    description: 'The parry window grows by 4 ticks.',
    maxStacks: 2,
    apply: (_stats, state) => {
      state.parryWindow += 4;
    },
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    description: 'Score multiplier gains 0.25.',
    maxStacks: 3,
    apply: (_stats, state) => {
      state.scoreBonus += 0.25;
    },
  },
];

export function rollOffers(run: RunState, count = 3): Upgrade[] {
  const pool = UPGRADES.filter((upgrade) => (run.upgrades[upgrade.id] ?? 0) < upgrade.maxStacks);
  const offers: Upgrade[] = [];
  const limit = Math.min(count, pool.length);
  for (let index = 0; index < limit; index += 1) {
    const pick = Math.floor(run.rng() * pool.length);
    const [upgrade] = pool.splice(pick, 1);
    if (upgrade) offers.push(upgrade);
  }
  return offers;
}

export function applyUpgrade(run: RunState, upgradeId: string): boolean {
  const upgrade = UPGRADES.find((candidate) => candidate.id === upgradeId);
  if (!upgrade) return false;
  const stacks = run.upgrades[upgradeId] ?? 0;
  if (stacks >= upgrade.maxStacks) return false;
  upgrade.apply(run.weapons, run);
  run.upgrades[upgradeId] = stacks + 1;
  return true;
}
