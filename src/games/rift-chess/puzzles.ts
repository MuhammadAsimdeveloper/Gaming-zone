import type { Square } from 'chess.js';
import { RiftChess, type PromotionPiece } from './rules';

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

export interface Puzzle {
  id: string;
  title: string;
  fen: string;
  solution: string[];
  mateIn: 1 | 2;
  difficulty: PuzzleDifficulty;
}

export interface PuzzleMove {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
  san: string;
}

/** Original compositions generated and verified in-repo; no external puzzle database. */
export const PUZZLES: ReadonlyArray<Puzzle> = [
  {
    id: 'p01',
    title: 'Back-rank finish',
    fen: 'k7/3R4/8/8/8/8/5R1K/8 w - - 0 1',
    solution: ['Rf8#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p02',
    title: 'Queen and rook squeeze',
    fen: '7k/8/3R4/K7/8/8/8/6Q1 w - - 0 1',
    solution: ['Rh6#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p03',
    title: 'Corner net',
    fen: 'k7/8/8/7R/1Q6/8/1K6/8 w - - 0 1',
    solution: ['Ra5#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p04',
    title: 'Double attack',
    fen: 'R7/8/6Q1/8/8/1K6/8/7k w - - 0 1',
    solution: ['Rh8#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p05',
    title: 'Lone rook mate',
    fen: '4R3/8/8/8/8/7K/8/7k w - - 0 1',
    solution: ['Re1#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p06',
    title: 'Bishop\'s escort',
    fen: '8/8/2BQ4/8/8/1K6/8/k7 w - - 0 1',
    solution: ['Qd1#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p07',
    title: 'Diagonal lock',
    fen: '8/8/8/8/7B/8/2Q5/k4K2 w - - 0 1',
    solution: ['Bf6#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p08',
    title: 'Heavy-piece hunt',
    fen: 'k7/4Q3/8/2R5/8/K7/8/8 w - - 0 1',
    solution: ['Rc8#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p09',
    title: 'Ladder mates',
    fen: '3R3K/8/8/8/1R6/8/8/k7 w - - 0 1',
    solution: ['Ra8#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p10',
    title: 'The box',
    fen: 'k1K5/7Q/8/8/8/8/8/8 w - - 0 1',
    solution: ['Qb7#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p11',
    title: 'Knight cover',
    fen: 'k7/2K5/8/8/8/8/8/3N1Q2 w - - 0 1',
    solution: ['Qa6#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p12',
    title: 'Rank and file',
    fen: 'k7/6Q1/5R2/8/8/8/6K1/8 w - - 0 1',
    solution: ['Rf8#'],
    mateIn: 1,
    difficulty: 'easy',
  },
  {
    id: 'p13',
    title: 'Queen strikes',
    fen: 'R7/2K5/8/8/8/8/2Q5/7k w - - 0 1',
    solution: ['Ra1#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p14',
    title: 'Bishop angle',
    fen: 'k7/2Q5/8/7K/8/8/8/1B6 w - - 0 1',
    solution: ['Be4#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p15',
    title: 'Rook lift',
    fen: '8/8/8/8/1K3R2/8/4Q3/k7 w - - 0 1',
    solution: ['Rf1#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p16',
    title: 'Twin rooks',
    fen: '7k/1K6/8/6R1/8/8/8/5R2 w - - 0 1',
    solution: ['Rh1#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p17',
    title: 'Edge control',
    fen: 'R2Q1K1k/8/8/8/8/8/8/8 w - - 0 1',
    solution: ['Qh4#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p18',
    title: 'Cut-off',
    fen: 'k7/8/8/5R2/8/8/4K3/1Q6 w - - 0 1',
    solution: ['Ra5#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p19',
    title: 'Queen sweep',
    fen: 'k7/8/8/8/1R6/7Q/3K4/8 w - - 0 1',
    solution: ['Qa3#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p20',
    title: 'Rook corral',
    fen: '7k/1K6/8/8/1R6/8/6R1/8 w - - 0 1',
    solution: ['Rh4#'],
    mateIn: 1,
    difficulty: 'medium',
  },
  {
    id: 'p21',
    title: 'Bishop check, queen mate',
    fen: '8/8/8/3K3B/8/8/4Q3/7k w - - 0 1',
    solution: ['Bf3+', 'Kg1', 'Qg2#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p22',
    title: 'Quiet queen',
    fen: '8/2K4Q/4R3/8/8/8/8/k7 w - - 0 1',
    solution: ['Qh2', 'Kb1', 'Re1#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p23',
    title: 'Corner drive',
    fen: '7k/8/2R5/8/Q2K4/8/8/8 w - - 0 1',
    solution: ['Qa7', 'Kg8', 'Rc8#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p24',
    title: 'Bishop in reserve',
    fen: '7k/8/B7/7K/8/8/8/3Q4 w - - 0 1',
    solution: ['Kg6', 'Kg8', 'Qd8#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p25',
    title: 'Bishop\'s last word',
    fen: 'K6B/8/8/8/8/4Q3/8/7k w - - 0 1',
    solution: ['Qh3+', 'Kg1', 'Bd4#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p26',
    title: 'Rook and king',
    fen: 'k2K4/8/8/8/8/8/5R2/8 w - - 0 1',
    solution: ['Kc7', 'Ka7', 'Ra2#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p27',
    title: 'Room to breathe',
    fen: 'k7/4R3/8/K7/8/8/8/8 w - - 0 1',
    solution: ['Kb6', 'Kb8', 'Re8#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p28',
    title: 'Knight first',
    fen: '8/8/8/6QN/8/8/8/3K3k w - - 0 1',
    solution: ['Nf4', 'Kh2', 'Qg2#'],
    mateIn: 2,
    difficulty: 'medium',
  },
  {
    id: 'p29',
    title: 'Queen behind the king',
    fen: '4K2k/8/8/8/2Q5/8/8/8 w - - 0 1',
    solution: ['Kf7', 'Kh7', 'Qh4#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p30',
    title: 'King leads',
    fen: '7k/8/8/6K1/3R4/8/8/8 w - - 0 1',
    solution: ['Kg6', 'Kg8', 'Rd8#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p31',
    title: 'Boxed in',
    fen: '7k/8/4K3/8/2Q5/8/8/8 w - - 0 1',
    solution: ['Kf7', 'Kh7', 'Qh4#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p32',
    title: 'Bishop arrives',
    fen: '8/8/8/3B4/8/5Q2/8/k4K2 w - - 0 1',
    solution: ['Qa3+', 'Kb1', 'Be4#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p33',
    title: 'Waiting king',
    fen: '8/8/8/5N2/K7/8/6Q1/k7 w - - 0 1',
    solution: ['Ka3', 'Kb1', 'Qb2#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p34',
    title: 'Cut and mate',
    fen: '1K6/8/2Q5/8/6B1/8/8/k7 w - - 0 1',
    solution: ['Qc1+', 'Ka2', 'Be6#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p35',
    title: 'Knight\'s rest',
    fen: '8/6K1/4N3/8/8/8/4Q3/7k w - - 0 1',
    solution: ['Nf4', 'Kg1', 'Qg2#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p36',
    title: 'Marching king',
    fen: '7k/8/5K2/8/8/5R2/8/8 w - - 0 1',
    solution: ['Kf7', 'Kh7', 'Rh3#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p37',
    title: 'Standard net',
    fen: 'k7/8/8/2K5/8/4R3/8/8 w - - 0 1',
    solution: ['Kb6', 'Kb8', 'Re8#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p38',
    title: 'Quiet king',
    fen: '8/8/8/6Q1/8/4K3/8/7k w - - 0 1',
    solution: ['Kf3', 'Kh2', 'Qg2#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p39',
    title: 'Bishop finish',
    fen: 'k7/2Q5/8/8/8/8/2K5/4B3 w - - 0 1',
    solution: ['Qc8+', 'Ka7', 'Bf2#'],
    mateIn: 2,
    difficulty: 'hard',
  },
  {
    id: 'p40',
    title: 'Rook finish',
    fen: '7k/8/8/4R1K1/8/8/8/8 w - - 0 1',
    solution: ['Kg6', 'Kg8', 'Re8#'],
    mateIn: 2,
    difficulty: 'hard',
  },
];

export function puzzleById(id: string): Puzzle | null {
  return PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function puzzleMoves(puzzle: Puzzle): PuzzleMove[] {
  const game = new RiftChess(puzzle.fen);
  const moves: PuzzleMove[] = [];
  for (const san of puzzle.solution) {
    const move = game.moveSan(san);
    if (!move) return [];
    moves.push({ from: move.from, to: move.to, promotion: move.promotion, san: move.san });
  }
  return moves;
}
