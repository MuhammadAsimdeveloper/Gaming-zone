import { readJson, writeJson } from '../../lib/storage';
import type { LifeState } from './simulation';

export const ENDING_GALLERY_KEY = 'neonrift:game:rift-life:endings';

export type EndingId =
  | 'rift-anchor'
  | 'kindred-spark'
  | 'groundbreaker'
  | 'storm-walker'
  | 'hollow-drift'
  | 'quiet-haven';

export interface EndingRule {
  id: EndingId;
  title: string;
  description: string;
  matches(state: LifeState): boolean;
}

function closeBonds(state: LifeState): number {
  return Object.values(state.relationships).filter((value) => value >= 50).length;
}

function bestBond(state: LifeState): number {
  return Math.max(0, ...Object.values(state.relationships));
}

/*
 * Order is the tie-breaker: the first matching rule wins, so two runs that
 * satisfy the same set of rules always resolve to the same ending.
 */
export const ENDING_TABLE: readonly EndingRule[] = [
  {
    id: 'rift-anchor',
    title: 'Rift Anchor',
    description: 'The town rebuilt itself around you: steady work, a loud community, and people who count you close.',
    matches: (state) => state.community >= 60 && state.jobProgress >= 60 && closeBonds(state) >= 2,
  },
  {
    id: 'kindred-spark',
    title: 'Kindred Spark',
    description: 'One relationship grew into the centre of the twenty-one days, and everything else orbited it.',
    matches: (state) => bestBond(state) >= 75,
  },
  {
    id: 'groundbreaker',
    title: 'Groundbreaker',
    description: 'You poured the days into the rig and the grid, and the work outlasted the weather.',
    matches: (state) => state.jobProgress >= 75,
  },
  {
    id: 'storm-walker',
    title: 'Storm Walker',
    description: 'The last day broke grey and furious, and you stood in it with the town behind you.',
    matches: (state) => state.weather === 'storm' && state.community >= 40,
  },
  {
    id: 'hollow-drift',
    title: 'Hollow Drift',
    description: 'You spent every reserve you had. The town remembers you mostly as a light that went out early.',
    matches: (state) => state.flags.includes('burnout'),
  },
  {
    id: 'quiet-haven',
    title: 'Quiet Haven',
    description: 'Nothing dramatic. A modest, steady life, a warm window, and a town that nods when you pass.',
    matches: () => true,
  },
];

export const ENDING_IDS: readonly EndingId[] = ENDING_TABLE.map((rule) => rule.id);

export function resolveEnding(state: LifeState): EndingId {
  const rule = ENDING_TABLE.find((candidate) => candidate.matches(state));
  return rule?.id ?? 'quiet-haven';
}

export function endingById(id: EndingId): EndingRule {
  const found = ENDING_TABLE.find((rule) => rule.id === id);
  if (!found) throw new Error(`Unknown ending: ${id}`);
  return found;
}

export function readEndingGallery(): EndingId[] {
  const raw = readJson<unknown>(ENDING_GALLERY_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is EndingId => typeof entry === 'string' && (ENDING_IDS as readonly string[]).includes(entry),
  );
}

export function saveEndingToGallery(id: EndingId): EndingId[] {
  const existing = readEndingGallery();
  if (existing.includes(id)) return existing;
  const next = [...existing, id];
  writeJson(ENDING_GALLERY_KEY, next);
  return next;
}
