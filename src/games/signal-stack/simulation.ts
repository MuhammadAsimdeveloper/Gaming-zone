export const STACK_WIDTH = 100;
export const STACK_START_WIDTH = 46;

export type StackPhase = 'ready' | 'playing' | 'over';

export interface StackBlock {
  x: number;
  width: number;
}

export interface StackState {
  blocks: StackBlock[];
  score: number;
  perfects: number;
  phase: StackPhase;
  speed: number;
}

export function createStackState(): StackState {
  return {
    blocks: [{ x: (STACK_WIDTH - STACK_START_WIDTH) / 2, width: STACK_START_WIDTH }],
    score: 0,
    perfects: 0,
    phase: 'ready',
    speed: 46,
  };
}

export function startStack(state: StackState): StackState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'playing' };
}

export function topBlock(state: StackState): StackBlock {
  return state.blocks[state.blocks.length - 1]!;
}

export function overlapWidth(a: StackBlock, x: number): number {
  const start = Math.max(a.x, x);
  const end = Math.min(a.x + a.width, x + a.width);
  return Math.max(0, end - start);
}

export function dropBlock(state: StackState, markerX: number): StackState {
  if (state.phase !== 'playing') return state;

  const top = topBlock(state);
  const overlap = overlapWidth(top, markerX);
  if (overlap <= 0.5) {
    return { ...state, phase: 'over', score: state.score };
  }

  const perfect = Math.abs(top.x - markerX) <= 1.5;
  const width = perfect
    ? Math.min(STACK_WIDTH, top.width + 2)
    : Math.max(4, overlap);
  const x = Math.max(0, Math.min(STACK_WIDTH - width, perfect ? top.x - 1 : Math.max(top.x, markerX)));

  return {
    ...state,
    blocks: [...state.blocks, { x, width }],
    score: state.score + (perfect ? 20 : 10),
    perfects: state.perfects + (perfect ? 1 : 0),
    speed: Math.min(120, state.speed + 3),
  };
}
