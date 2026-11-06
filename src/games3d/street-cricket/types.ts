export type TimingGrade = 'perfect' | 'good' | 'ok' | 'edge' | 'miss';

export type WicketKind = 'bowled' | 'caught' | 'run-out' | 'stumped';

export type Boundary = 4 | 6 | null;

export interface BallOutcome {
  batRuns: number;
  extras: number;
  legal: boolean;
  wicket: WicketKind | null;
  boundary: Boundary;
  timing: TimingGrade;
  note: string;
}

export const DOT_BALL: BallOutcome = {
  batRuns: 0,
  extras: 0,
  legal: true,
  wicket: null,
  boundary: null,
  timing: 'ok',
  note: 'Defended into the pitch.',
};
