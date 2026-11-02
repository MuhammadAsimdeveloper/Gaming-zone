import type { CategoryId } from '../types/game';

export type CategoryIconKey =
  | 'joystick'
  | 'gauge'
  | 'puzzle'
  | 'compass'
  | 'trophy'
  | 'brain'
  | 'swords'
  | 'sparkles'
  | 'users'
  | 'graduation';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: CategoryIconKey;
  accent: string;
  glow: string;
}

export const categories: Category[] = [
  {
    id: 'arcade',
    name: 'Arcade',
    description: 'Snappy, pick-up-and-play classics built for quick sessions.',
    icon: 'joystick',
    accent: '#4c8dff',
    glow: 'rgba(76, 141, 255, 0.22)',
  },
  {
    id: 'racing',
    name: 'Racing',
    description: 'High-speed runs, tight corners and time trials.',
    icon: 'gauge',
    accent: '#f97316',
    glow: 'rgba(249, 115, 22, 0.2)',
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    description: 'Think, plan and solve. Games that reward a cool head.',
    icon: 'puzzle',
    accent: '#a06bff',
    glow: 'rgba(160, 107, 255, 0.22)',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    description: 'Explore handcrafted worlds and untangle small stories.',
    icon: 'compass',
    accent: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.2)',
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Timing, aim and reflexes in compact sports challenges.',
    icon: 'trophy',
    accent: '#4ade9d',
    glow: 'rgba(74, 222, 157, 0.2)',
  },
  {
    id: 'strategy',
    name: 'Strategy',
    description: 'Outsmart the board, the opponent or the odds.',
    icon: 'brain',
    accent: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.18)',
  },
  {
    id: 'action',
    name: 'Action',
    description: 'Fast decisions and constant motion.',
    icon: 'swords',
    accent: '#ff6b81',
    glow: 'rgba(255, 107, 129, 0.2)',
  },
  {
    id: 'casual',
    name: 'Casual',
    description: 'Easy to learn, hard to put down.',
    icon: 'sparkles',
    accent: '#b285ff',
    glow: 'rgba(178, 133, 255, 0.2)',
  },
  {
    id: 'multiplayer',
    name: 'Multiplayer',
    description: 'Play with friends on the same screen or online.',
    icon: 'users',
    accent: '#6ba4ff',
    glow: 'rgba(107, 164, 255, 0.2)',
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Learn something new without the classroom feel.',
    icon: 'graduation',
    accent: '#a3e635',
    glow: 'rgba(163, 230, 53, 0.18)',
  },
];

export function getCategory(id: CategoryId): Category {
  return categories.find((category) => category.id === id) ?? categories[0];
}
