import {
  Crosshair,
  Move,
  RotateCcw,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import {
  TACTICS_SIZE,
  attackSelected,
  canAttack,
  canMoveTo,
  createTacticsState,
  distance,
  moveSelected,
  selectUnit,
  selectedUnit,
  startTactics,
  tacticsScore,
  unitAt,
  type TacticsState,
  type Unit,
} from './simulation';

const BEST_KEY = 'neonrift:game:rift-tactics:best';

export default function RiftTacticsGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<TacticsState>(createTacticsState);
  const { best, submit } = useBestScore(BEST_KEY);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    if ((state.phase !== 'won' && state.phase !== 'lost') || finishedRef.current) return;
    finishedRef.current = true;
    const score = tacticsScore(state);
    if (state.phase === 'won') submit(score);
    onCompleteRef.current?.({ score, outcome: state.phase === 'won' ? 'win' : 'loss' });
  }, [state, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startTactics(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createTacticsState());
  }, []);

  const selected = selectedUnit(state);
  const players = state.units.filter((unit) => unit.team === 'player');
  const enemies = state.units.filter((unit) => unit.team === 'enemy');
  const score = tacticsScore(state);
  const win = state.phase === 'won';
  const overlayOpen = state.phase === 'ready' || state.phase === 'won' || state.phase === 'lost';
  const status =
    state.phase === 'ready'
      ? 'Squad ready. Start the battle.'
      : state.phase === 'won'
        ? `Sector secured in ${state.turn} turns. Score ${score}.`
        : state.phase === 'lost'
          ? 'Squad wiped.'
          : `Turn ${state.turn}. ${players.length} squad, ${enemies.length} hostiles.${selected ? ` ${selected.name} selected.` : ''}`;

  function handleCell(x: number, y: number) {
    if (state.phase !== 'player') return;
    const occupant = unitAt(state, x, y);
    if (occupant?.team === 'player') {
      setState((current) => selectUnit(current, occupant.id));
      return;
    }
    if (occupant?.team === 'enemy') {
      if (selected && canAttack(state, occupant.id)) {
        setState((current) => attackSelected(current, occupant.id));
      }
      return;
    }
    if (selected && canMoveTo(state, x, y)) {
      setState((current) => moveSelected(current, x, y));
    }
  }

  function cellClasses(unit: Unit | undefined): string {
    if (!unit) return 'border-white/10 bg-white/[0.025] hover:border-white/20';
    if (unit.team === 'player') {
      return unit.id === state.selectedId
        ? 'border-mint bg-mint/15'
        : 'border-electric-400/50 bg-electric-500/15';
    }
    return 'border-coral/40 bg-coral/10';
  }

  return (
    <GameFrame
      title="Rift Tactics"
      subtitle="A small squad. A tight grid."
      icon={Swords}
      accent="plasma"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <GameStat label="Turn" value={state.turn} />
          <GameStat label="Squad" value={players.length} tone="electric" />
          <GameStat label="Hostiles" value={enemies.length} tone="coral" />
          <GameStat label="Phase" value={state.phase === 'player' ? 'Your move' : state.phase === 'enemy' ? 'Enemy' : state.phase === 'won' ? 'Won' : state.phase === 'lost' ? 'Lost' : 'Ready'} />
          <GameStat label="Best" value={best === null ? '—' : best} tone="mint" />
        </div>
      }
      toolbar={
        <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart battle" title="Restart battle">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </GameButton>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Select a squad unit, then move one square or attack a hostile in range.</span>
          <span>Every action gives one enemy a turn.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="mx-auto w-full max-w-[380px]">
              <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Tactics grid">
                {Array.from({ length: TACTICS_SIZE * TACTICS_SIZE }, (_, index) => {
                  const x = index % TACTICS_SIZE;
                  const y = Math.floor(index / TACTICS_SIZE);
                  const unit = unitAt(state, x, y);
                  const moveTarget = selected && canMoveTo(state, x, y);
                  const attackTarget = unit && unit.team === 'enemy' && selected && canAttack(state, unit.id);
                  return (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      onClick={() => handleCell(x, y)}
                      aria-label={
                        unit
                          ? `Cell ${x + 1},${y + 1}: ${unit.team === 'player' ? 'squad' : 'hostile'} ${unit.name} ${unit.hp} of ${unit.maxHp} health`
                          : `Cell ${x + 1},${y + 1}: empty${moveTarget ? ', move here' : ''}`
                      }
                      className={cn(
                        'relative aspect-square rounded-lg border p-1 text-left transition',
                        cellClasses(unit),
                        attackTarget && 'ring-2 ring-coral',
                        moveTarget && 'ring-2 ring-mint/70',
                      )}
                    >
                      {unit ? (
                        <span className="flex h-full flex-col justify-between">
                          <span
                            className={cn(
                              'text-[9px] font-semibold uppercase tracking-[0.08em]',
                              unit.team === 'player' ? 'text-electric-300' : 'text-coral',
                            )}
                          >
                            {unit.name}
                          </span>
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: unit.maxHp }, (_, hp) => (
                              <span
                                key={hp}
                                className={cn(
                                  'h-1 w-1.5 rounded-full',
                                  hp < unit.hp ? (unit.team === 'player' ? 'bg-mint' : 'bg-coral') : 'bg-white/15',
                                )}
                              />
                            ))}
                          </span>
                          <span className="text-[9px] text-muted">ATK {unit.atk}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[10px] text-muted">
                <Move className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Move one square · <Crosshair className="mx-1 inline h-3 w-3" aria-hidden="true" />
                attack in range
              </p>
            </div>

            <div className="space-y-3">
              <section aria-label="Selected unit" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Selected</h3>
                {selected ? (
                  <div className="mt-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <Shield className="h-4 w-4 text-mint" aria-hidden="true" />
                      {selected.name}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {selected.hp}/{selected.maxHp} HP · ATK {selected.atk} · range {selected.range}
                    </p>
                    <p className="mt-2 text-[10px] text-muted">
                      {enemies.filter((enemy) => distance(selected, enemy) <= selected.range).length} hostile(s) in range.
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted">Pick a squad unit on the grid.</p>
                )}
              </section>

              <section aria-label="Battle log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Battle log</h3>
                <ul
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-label="Battle log entries"
                  className="mt-2 space-y-1 text-[10px] leading-4 text-muted"
                >
                  {state.log.map((entry, index) => (
                    <li key={`${entry}-${index}`} className="truncate">
                      · {entry}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
              Turn-based tactics
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Clear the sector</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Three squad units against three hostiles. Move one square or attack in range; every
              action gives one enemy a turn. Finish the fight in as few turns as possible.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <PlayIcon />
              Start battle
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'won' || state.phase === 'lost' ? (
          <GameOverlay tone={win ? 'win' : 'loss'}>
            <span className={cn('grid h-12 w-12 place-items-center rounded-2xl', win ? 'bg-mint/10 text-mint' : 'bg-coral/10 text-coral')}>
              <Swords className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Sector secured' : 'Squad wiped'}
            </h3>
            <p className="text-sm text-muted">
              {win ? `Won in ${state.turn} turns for ${score} points.` : 'The hostiles held the grid.'}
            </p>
            <p className="text-[11px] text-muted">Best {best === null ? '—' : `${best} points`}</p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}

function PlayIcon() {
  return <Users className="h-4 w-4 fill-current" aria-hidden="true" />;
}
