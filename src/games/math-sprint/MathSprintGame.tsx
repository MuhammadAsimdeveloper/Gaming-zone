import { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator, Check, Flame, Play, RotateCcw, X } from 'lucide-react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';

type Phase = 'idle' | 'running' | 'over';

interface Question {
  prompt: string;
  answer: number;
  choices: number[];
}

interface Feedback {
  choice: number;
  correct: boolean;
  points: number;
}

const DURATION_SECONDS = 60;
const BEST_KEY = 'neonrift:game:math-sprint:best';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: ReadonlyArray<T>): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = next[i];
    next[i] = next[j];
    next[j] = temp;
  }
  return next;
}

function createQuestion(): Question {
  const kind = randomInt(0, 2);
  let prompt: string;
  let answer: number;

  if (kind === 0) {
    const a = randomInt(2, 49);
    const b = randomInt(2, 49);
    answer = a + b;
    prompt = `${a} + ${b}`;
  } else if (kind === 1) {
    const a = randomInt(20, 99);
    const b = randomInt(2, Math.max(2, Math.min(a - 1, 60)));
    answer = a - b;
    prompt = `${a} − ${b}`;
  } else {
    const a = randomInt(2, 12);
    const b = randomInt(2, 9);
    answer = a * b;
    prompt = `${a} × ${b}`;
  }

  const choices = new Set<number>([answer]);
  let guard = 0;
  const spread = Math.max(4, Math.round(answer * 0.25));

  while (choices.size < 4 && guard < 80) {
    guard += 1;
    const delta = randomInt(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (candidate >= 0) choices.add(candidate);
  }

  let filler = 1;
  while (choices.size < 4) {
    choices.add(answer + filler);
    filler += 1;
  }

  return { prompt, answer, choices: shuffle([...choices]) };
}

export default function MathSprintGame({ onStart, onComplete }: GameComponentProps) {
  const { best, submit } = useBestScore(BEST_KEY);

  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<Question>(() => createQuestion());
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [locked, setLocked] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  const phaseRef = useRef<Phase>('idle');
  const questionRef = useRef<Question>(question);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const correctRef = useRef(0);
  const lockedRef = useRef(false);
  const endAtRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const bestRef = useRef<number | null>(best);
  const answerRef = useRef<(choice: number) => void>(() => undefined);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    endAtRef.current = null;
    lockedRef.current = true;

    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    const finalScore = scoreRef.current;
    setFeedback(null);
    setLocked(true);
    setTimeLeft(0);
    setNewRecord(finalScore > 0 && (bestRef.current === null || finalScore > bestRef.current));
    setPhaseSafe('over');
    submit(finalScore);
    onCompleteRef.current?.({ score: finalScore, outcome: 'complete' });
  }, [setPhaseSafe, submit]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (phase !== 'running') return undefined;

    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) finishRun();
    };

    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [finishRun, phase]);

  useEffect(() => {
    let hiddenAt: number | null = null;

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        if (phaseRef.current === 'running') hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && phaseRef.current === 'running' && endAtRef.current !== null) {
        endAtRef.current += Date.now() - hiddenAt;
      }
      hiddenAt = null;
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const nextQuestion = () => {
    const next = createQuestion();
    questionRef.current = next;
    setQuestion(next);
  };

  const handleAnswer = (choice: number) => {
    if (phaseRef.current !== 'running' || lockedRef.current) return;

    const current = questionRef.current;
    const isCorrect = choice === current.answer;
    let points = 0;

    if (isCorrect) {
      const multiplier = 1 + Math.min(4, Math.floor(streakRef.current / 3));
      points = 10 * multiplier;
      scoreRef.current += points;
      streakRef.current += 1;
      correctRef.current += 1;
      setScore(scoreRef.current);
      setCorrectCount(correctRef.current);
      setStreak(streakRef.current);
      setBestStreak((currentBest) => Math.max(currentBest, streakRef.current));
    } else {
      streakRef.current = 0;
      setStreak(0);
    }

    lockedRef.current = true;
    setLocked(true);
    setFeedback({ choice, correct: isCorrect, points });

    feedbackTimerRef.current = window.setTimeout(
      () => {
        feedbackTimerRef.current = null;
        if (phaseRef.current !== 'running') return;
        setFeedback(null);
        setLocked(false);
        lockedRef.current = false;
        nextQuestion();
      },
      isCorrect ? 380 : 650,
    );
  };

  useEffect(() => {
    answerRef.current = handleAnswer;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }

      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < 4) {
        event.preventDefault();
        answerRef.current(index);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startRun = () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    const first = createQuestion();
    questionRef.current = first;
    setQuestion(first);
    scoreRef.current = 0;
    streakRef.current = 0;
    correctRef.current = 0;
    lockedRef.current = false;
    finishedRef.current = false;
    endAtRef.current = Date.now() + DURATION_SECONDS * 1000;

    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrectCount(0);
    setFeedback(null);
    setLocked(false);
    setNewRecord(false);
    setTimeLeft(DURATION_SECONDS);
    setPhaseSafe('running');
    onStartRef.current?.();
  };

  const multiplier = 1 + Math.min(4, Math.floor(streak / 3));
  const bestLabel = best === null ? '—' : best;
  const timeProgress = Math.max(0, Math.min(100, (timeLeft / DURATION_SECONDS) * 100));
  const statusLabel =
    phase === 'over'
      ? `Sprint complete. Score ${score}, ${correctCount} correct answers.`
      : feedback
        ? feedback.correct
          ? `Correct. ${feedback.points} points scored.`
          : 'Incorrect. Streak reset.'
        : phase === 'running'
          ? `${timeLeft} seconds left. Streak ${streak}.`
          : 'Ready. Press start sprint.';

  return (
    <GameFrame
      title="Math Sprint"
      subtitle="Sixty seconds of quick math."
      icon={Calculator}
      accent="plasma"
      hud={
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <GameStat label="Time" value={`${timeLeft}s`} tone={timeLeft <= 10 ? 'coral' : 'ink'} />
            <GameStat label="Score" value={score} tone="plasma" />
            <GameStat label="Best" value={bestLabel} />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-200',
                timeLeft <= 10 ? 'bg-coral' : 'bg-gradient-to-r from-electric-400 to-plasma-400',
              )}
              style={{ width: `${timeProgress}%` }}
            />
          </div>
        </div>
      }
      toolbar={
        <GameButton size="icon" variant="ghost" onClick={startRun} aria-label="Restart sprint" title="Restart sprint">
          <RotateCcw className="h-4 w-4" />
        </GameButton>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            Keys
            <Kbd>1</Kbd>
            <Kbd>2</Kbd>
            <Kbd>3</Kbd>
            <Kbd>4</Kbd>
            to answer
          </span>
          <span>Correct answers add 10 points × your streak multiplier (up to ×5).</span>
          <span>Sixty seconds, as many questions as you can.</span>
        </div>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>

      <div className="relative">
        <div className="rounded-2xl border border-white/10 bg-night-950/70 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Solve</span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                multiplier > 1
                  ? 'border-plasma-500/30 bg-plasma-500/10 text-plasma-300'
                  : 'border-white/10 bg-white/5 text-muted',
              )}
            >
              <Flame className="h-3 w-3" aria-hidden="true" />
              Streak {streak} · ×{multiplier}
            </span>
          </div>
          <p className="mt-2 text-center font-display text-4xl font-semibold tracking-tight tabular-nums text-ink sm:text-5xl">
            {question.prompt}
          </p>
          <p
            className={cn(
              'mt-2 min-h-4 text-center text-xs font-medium',
              feedback ? (feedback.correct ? 'text-mint' : 'text-coral') : 'text-muted',
            )}
            aria-live="polite"
          >
            {feedback
              ? feedback.correct
                ? `Correct · +${feedback.points} points`
                : `Not quite · answer was ${question.answer}`
              : 'Choose the correct answer'}
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {question.choices.map((choice, index) => {
            const showCorrect = feedback !== null && choice === question.answer;
            const showWrong = feedback !== null && feedback.choice === choice && !feedback.correct;

            return (
              <button
                key={`${question.prompt}-${choice}`}
                type="button"
                onClick={() => handleAnswer(choice)}
                disabled={phase !== 'running' || locked}
                aria-label={`Answer ${choice}, keyboard shortcut ${index + 1}`}
                className={cn(
                  'relative flex h-16 items-center justify-center rounded-2xl border font-display text-2xl font-semibold tabular-nums transition duration-150 active:scale-[0.98] disabled:cursor-default sm:h-20',
                  showCorrect
                    ? 'border-mint/50 bg-mint/15 text-mint'
                    : showWrong
                      ? 'border-coral/50 bg-coral/15 text-coral'
                      : 'border-white/10 bg-night-850/80 text-ink hover:border-electric-500/40 hover:bg-night-800',
                )}
              >
                {choice}
                <span className="absolute right-2.5 top-2 text-[10px] font-medium text-muted">{index + 1}</span>
                {showCorrect ? (
                  <Check className="absolute bottom-2 right-2.5 h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                {showWrong ? <X className="absolute bottom-2 right-2.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        {phase === 'idle' ? (
          <GameOverlay>
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-plasma-500/30 bg-plasma-500/10 text-plasma-300">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="font-display text-xl font-semibold text-ink">Sixty seconds. Go.</p>
            <p className="max-w-[18rem] text-xs leading-relaxed text-muted">
              Solve as many quick addition, subtraction and multiplication questions as you can. Streaks
              multiply your score.
            </p>
            <GameButton variant="primary" onClick={startRun}>
              <Play className="h-4 w-4" />
              Start sprint
            </GameButton>
          </GameOverlay>
        ) : null}

        {phase === 'over' ? (
          <GameOverlay tone="win" className="gap-2 p-3">
            <span className="rounded-full border border-plasma-500/30 bg-plasma-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-plasma-300">
              Sprint complete
            </span>
            <p className="font-display text-4xl font-semibold tabular-nums text-ink">{score}</p>
            <p className="text-xs text-muted">
              {correctCount} correct · best streak {bestStreak}
            </p>
            {newRecord ? (
              <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">
                New personal best
              </span>
            ) : (
              <p className="text-xs text-muted">Best · {bestLabel}</p>
            )}
            <GameButton variant="primary" onClick={startRun}>
              <RotateCcw className="h-4 w-4" />
              Sprint again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
