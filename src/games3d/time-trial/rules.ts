export type RunStatus = 'ready' | 'running' | 'finished' | 'invalid';
export type MedalTier = 'author' | 'gold' | 'silver' | 'bronze' | 'none';

export interface MedalThresholds {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

export interface TrialRulesConfig {
  totalLaps: number;
  checkpointsPerLap: number;
}

export interface RunState {
  status: RunStatus;
  clock: number;
  lap: number;
  nextGate: number;
  splits: number[];
  invalidReason: string | null;
  respawns: number;
  offTrackTime: number;
}

export const OFF_TRACK_LIMIT = 1.5;

export function createRun(): RunState {
  return {
    status: 'ready',
    clock: 0,
    lap: 1,
    nextGate: 1,
    splits: [],
    invalidReason: null,
    respawns: 0,
    offTrackTime: 0,
  };
}

export function beginRun(state: RunState): RunState {
  if (state.status !== 'ready') return state;
  return { ...state, status: 'running', clock: 0 };
}

export function advanceRun(state: RunState, dt: number): RunState {
  if (state.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return state;
  return { ...state, clock: state.clock + dt };
}

export function registerGate(state: RunState, gate: number, config: TrialRulesConfig): RunState {
  if (state.status !== 'running') return state;
  const checkpointCount = config.checkpointsPerLap;

  if (gate === 0) {
    if (state.nextGate !== checkpointCount + 1) return state;
    const splits = [...state.splits, state.clock];
    if (state.lap >= config.totalLaps) {
      return { ...state, splits, status: 'finished' };
    }
    return { ...state, splits, lap: state.lap + 1, nextGate: 1 };
  }

  if (gate === state.nextGate) {
    return {
      ...state,
      splits: [...state.splits, state.clock],
      nextGate: state.nextGate + 1,
    };
  }

  if (gate > state.nextGate && gate <= checkpointCount) {
    return {
      ...state,
      status: 'invalid',
      invalidReason: `Missed checkpoint ${state.nextGate}`,
    };
  }

  return state;
}

export function registerOffTrack(state: RunState, offTrack: boolean, dt: number): RunState {
  if (state.status !== 'running') return state;
  const offTrackTime = offTrack ? state.offTrackTime + Math.max(0, dt) : 0;
  if (offTrackTime > OFF_TRACK_LIMIT) {
    return {
      ...state,
      offTrackTime,
      status: 'invalid',
      invalidReason: 'Off track for too long',
    };
  }
  return { ...state, offTrackTime };
}

export function respawnRun(state: RunState): RunState {
  if (state.status !== 'running') return state;
  return { ...state, respawns: state.respawns + 1, offTrackTime: 0 };
}

export function sectorCount(config: TrialRulesConfig): number {
  return config.totalLaps * (config.checkpointsPerLap + 1);
}

export function splitsRemaining(state: RunState, config: TrialRulesConfig): number {
  return Math.max(0, sectorCount(config) - state.splits.length);
}

export function medalForTime(thresholds: MedalThresholds, time: number): MedalTier {
  if (!Number.isFinite(time) || time <= 0) return 'none';
  if (time <= thresholds.author) return 'author';
  if (time <= thresholds.gold) return 'gold';
  if (time <= thresholds.silver) return 'silver';
  if (time <= thresholds.bronze) return 'bronze';
  return 'none';
}

export function formatSplitDelta(delta: number): string {
  if (!Number.isFinite(delta)) return '±0.00';
  const magnitude = Math.abs(delta).toFixed(2);
  if (magnitude === '0.00') return '±0.00';
  return `${delta > 0 ? '+' : '−'}${magnitude}`;
}
