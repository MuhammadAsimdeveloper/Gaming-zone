import { endingById, resolveEnding, type EndingId } from './endings';
import { NPC_IDS, npcById, type ConversationChoice, type NpcId } from './npcs';

export type { ConversationChoice, NpcId };

export type ActivityId = 'work' | 'rest' | 'community' | NpcId;
export type Weather = 'clear' | 'rain' | 'storm';
export type LifeStatus = 'playing' | 'finished';

export interface LifeState {
  seed: number;
  day: number;
  slot: number;
  energy: number;
  jobProgress: number;
  community: number;
  relationships: Record<NpcId, number>;
  flags: string[];
  weather: Weather;
  status: LifeStatus;
  endingId: EndingId | null;
}

export type LifeEventType = 'activity' | 'day' | 'scene' | 'conversation' | 'blocked' | 'ending';

export interface LifeEvent {
  type: LifeEventType;
  message: string;
  npcId?: NpcId;
  choices?: readonly ConversationChoice[];
}

export interface ActivityOption {
  id: ActivityId;
  label: string;
  description: string;
  energyCost: number;
  available: boolean;
  reason: string | null;
}

export const DAYS = 21;
export const SLOTS_PER_DAY = 3;
export const MAX_ENERGY = 100;
export const START_ENERGY = 70;
export const MAX_PROGRESS = 100;
export const NPC_VISIT_COST = 6;
export const NPC_VISIT_GAIN = 9;
export const WORK_COST = 18;
export const COMMUNITY_COST = 16;
export const REST_GAIN = 26;
export const OVERNIGHT_GAIN = 20;
export const SCENE_THRESHOLD = 25;

const ACTIVITY_COSTS: Record<'work' | 'rest' | 'community', number> = {
  work: WORK_COST,
  rest: 0,
  community: COMMUNITY_COST,
};

const ACTIVITY_LABELS: Record<'work' | 'rest' | 'community', { label: string; description: string }> = {
  work: { label: 'Rig shift', description: 'Repair the lines and raise job progress.' },
  rest: { label: 'Rest', description: 'Recover energy without leaving the room.' },
  community: { label: 'Community duty', description: 'Help the town and raise its regard for you.' },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function weatherFor(seed: number, day: number): Weather {
  const rng = mulberry32((seed ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0);
  const roll = rng();
  if (roll < 0.5) return 'clear';
  if (roll < 0.8) return 'rain';
  return 'storm';
}

function isNpcId(activity: ActivityId): activity is NpcId {
  return (NPC_IDS as readonly string[]).includes(activity);
}

function activityCost(activity: ActivityId): number {
  return isNpcId(activity) ? NPC_VISIT_COST : ACTIVITY_COSTS[activity];
}

function emptyRelationships(): Record<NpcId, number> {
  const relationships = {} as Record<NpcId, number>;
  for (const id of NPC_IDS) relationships[id] = 0;
  return relationships;
}

function maybeUnlockScene(state: LifeState, npcId: NpcId, events: LifeEvent[]): void {
  const npc = npcById(npcId);
  const flag = `scene:${npcId}`;
  if (state.relationships[npcId] < npc.scene.at) return;
  if (state.flags.includes(flag)) return;
  state.flags.push(flag);
  events.push({ type: 'scene', message: `${npc.scene.title}. ${npc.scene.text}`, npcId });
}

export function createLife(seed: number): LifeState {
  const normalized = seed >>> 0;
  return {
    seed: normalized,
    day: 1,
    slot: 0,
    energy: START_ENERGY,
    jobProgress: 0,
    community: 0,
    relationships: emptyRelationships(),
    flags: [],
    weather: weatherFor(normalized, 1),
    status: 'playing',
    endingId: null,
  };
}

export function activitiesFor(state: LifeState): ActivityOption[] {
  const daySpent = state.slot >= SLOTS_PER_DAY;
  const finished = state.status !== 'playing';

  const options: ActivityOption[] = (['work', 'rest', 'community'] as const).map((id) => {
    const cost = ACTIVITY_COSTS[id];
    const affordable = id === 'rest' || state.energy >= cost;
    return {
      id,
      label: ACTIVITY_LABELS[id].label,
      description: ACTIVITY_LABELS[id].description,
      energyCost: cost,
      available: !finished && !daySpent && affordable,
      reason: finished
        ? 'The twenty-one days are over.'
        : daySpent
          ? 'The day is spent. Advance the clock.'
          : affordable
            ? null
            : 'Not enough energy. Rest first.',
    };
  });

  for (const npc of NPC_IDS.map((id) => npcById(id))) {
    const affordable = state.energy >= NPC_VISIT_COST;
    options.push({
      id: npc.id,
      label: `Visit ${npc.name}`,
      description: npc.tagline,
      energyCost: NPC_VISIT_COST,
      available: !finished && !daySpent && affordable,
      reason: finished
        ? 'The twenty-one days are over.'
        : daySpent
          ? 'The day is spent. Advance the clock.'
          : affordable
            ? null
            : 'Not enough energy. Rest first.',
    });
  }

  return options;
}

export function performActivity(state: LifeState, activity: ActivityId): LifeEvent[] {
  if (state.status !== 'playing') {
    return [{ type: 'blocked', message: 'This life has already found its ending.' }];
  }
  if (state.slot >= SLOTS_PER_DAY) {
    return [{ type: 'blocked', message: 'The day is spent. Advance the clock.' }];
  }

  const cost = activityCost(activity);
  if (activity !== 'rest' && state.energy < cost) {
    return [{ type: 'blocked', message: 'Not enough energy. Rest first.' }];
  }

  state.slot += 1;
  state.energy = clamp(state.energy - cost, 0, MAX_ENERGY);
  const events: LifeEvent[] = [];

  if (activity === 'work') {
    const gain = state.weather === 'storm' ? 7 : state.weather === 'rain' ? 9 : 10;
    state.jobProgress = clamp(state.jobProgress + gain, 0, MAX_PROGRESS);
    events.push({ type: 'activity', message: `Shifted the rig lines (+${gain} job).` });
    return events;
  }

  if (activity === 'rest') {
    const before = state.energy;
    state.energy = clamp(state.energy + REST_GAIN, 0, MAX_ENERGY);
    events.push({ type: 'activity', message: `Rested by the window (+${state.energy - before} energy).` });
    return events;
  }

  if (activity === 'community') {
    const gain = state.weather === 'storm' ? 5 : 7;
    state.community = clamp(state.community + gain, 0, MAX_PROGRESS);
    events.push({ type: 'activity', message: `Helped around town (+${gain} community).` });
    return events;
  }

  const npc = npcById(activity);
  state.relationships[activity] = clamp(state.relationships[activity] + NPC_VISIT_GAIN, 0, MAX_PROGRESS);
  events.push({ type: 'activity', message: `Spent time with ${npc.name}.` });
  maybeUnlockScene(state, activity, events);
  events.push({
    type: 'conversation',
    message: `${npc.name} waits for your answer.`,
    npcId: activity,
    choices: npc.choices,
  });
  return events;
}

export function applyChoice(state: LifeState, npcId: NpcId, index: number): LifeEvent[] {
  if (state.status !== 'playing') {
    return [{ type: 'blocked', message: 'This life has already found its ending.' }];
  }
  const npc = npcById(npcId);
  const choice = npc.choices[index];
  if (!choice) {
    return [{ type: 'blocked', message: 'That answer is not available.' }];
  }

  state.relationships[npcId] = clamp(state.relationships[npcId] + choice.relationship, 0, MAX_PROGRESS);
  state.community = clamp(state.community + choice.community, 0, MAX_PROGRESS);
  state.energy = clamp(state.energy + choice.energy, 0, MAX_ENERGY);

  const events: LifeEvent[] = [{ type: 'conversation', message: choice.reply, npcId }];
  maybeUnlockScene(state, npcId, events);
  return events;
}

export function advanceDay(state: LifeState): LifeEvent[] {
  if (state.status !== 'playing') {
    return [{ type: 'blocked', message: 'This life has already found its ending.' }];
  }

  if (state.slot < SLOTS_PER_DAY) {
    state.slot += 1;
    const left = SLOTS_PER_DAY - state.slot;
    return [
      {
        type: 'day',
        message: left === 0 ? 'The day is spent.' : `Time passes. ${left} block${left === 1 ? '' : 's'} left today.`,
      },
    ];
  }

  const events: LifeEvent[] = [];
  if (state.energy <= 0 && !state.flags.includes('burnout')) {
    state.flags.push('burnout');
    events.push({ type: 'activity', message: 'You ran the day down to nothing.' });
  }

  if (state.day >= DAYS) {
    state.status = 'finished';
    state.endingId = resolveEnding(state);
    const ending = endingById(state.endingId);
    events.push({ type: 'ending', message: `${ending.title}. ${ending.description}` });
    return events;
  }

  state.day += 1;
  state.slot = 0;
  state.energy = clamp(state.energy + OVERNIGHT_GAIN, 0, MAX_ENERGY);
  state.weather = weatherFor(state.seed, state.day);
  events.unshift({ type: 'day', message: `Day ${state.day}. The sky is ${state.weather}.` });
  return events;
}
