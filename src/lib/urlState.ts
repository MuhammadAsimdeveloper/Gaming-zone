import type { GameSort } from './catalogue';
import { CATEGORY_IDS } from '../types/game';
import type { CategoryId } from '../types/game';

export const GAME_SORTS: GameSort[] = ['featured', 'popular', 'newest', 'title'];

export function parseSort(value: string | null): GameSort {
  return value && (GAME_SORTS as string[]).includes(value) ? (value as GameSort) : 'featured';
}

export function parseCategory(value: string | null): CategoryId | 'all' {
  return value && (CATEGORY_IDS as readonly string[]).includes(value)
    ? (value as CategoryId)
    : 'all';
}
