import { ArrowRight, Search, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategory } from '../../data/categories';
import { track } from '../../lib/analytics';
import { filterGames, sortGames } from '../../lib/catalogue';
import { cn } from '../../lib/cn';
import { resolveComboboxKey, shouldShowPanel } from '../../lib/combobox';
import { useCatalogue } from '../../providers/CatalogueProvider';
import type { Game } from '../../types/game';
import { GameThumbnail } from '../game/GameThumbnail';

export function SearchBar({
  id,
  size = 'header',
  shortcut = false,
  onSubmitted,
  className,
}: {
  id: string;
  size?: 'header' | 'hero';
  shortcut?: boolean;
  onSubmitted?: () => void;
  className?: string;
}) {
  const { publishedGames } = useCatalogue();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const results = useMemo(() => {
    const trimmed = term.trim();
    if (!trimmed) return [];
    return sortGames(filterGames(publishedGames, { query: trimmed }), 'featured').slice(0, 5);
  }, [publishedGames, term]);

  const showPanel = shouldShowPanel(open, term);
  const activeGame = showPanel && activeIndex >= 0 ? results[activeIndex] : undefined;

  useEffect(() => {
    setActiveIndex(-1);
  }, [term]);

  useEffect(() => {
    if (showPanel && activeIndex >= results.length) setActiveIndex(-1);
  }, [showPanel, activeIndex, results.length]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!shortcut) return;

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      const wantsShortcut =
        (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
      const wantsSlash = event.key === '/' && !isTypingTarget(event.target);

      if (wantsShortcut || wantsSlash) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);

  function runSearch(query: string, resultCount: number) {
    const trimmed = query.trim();
    track('search', { search_term: trimmed, results_count: resultCount });
    setOpen(false);
    setActiveIndex(-1);
    onSubmitted?.();
    navigate(trimmed ? `/games?q=${encodeURIComponent(trimmed)}` : '/games');
  }

  function selectGame(game: Game) {
    track('search', {
      search_term: term.trim(),
      results_count: results.length,
      selected_game: game.slug,
    });
    setOpen(false);
    setActiveIndex(-1);
    onSubmitted?.();
    navigate(`/game/${game.slug}`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(term, results.length);
    inputRef.current?.blur();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const action = resolveComboboxKey(event.key, {
      open: showPanel,
      activeIndex,
      count: results.length,
    });
    if (action.type === 'none') return;

    event.preventDefault();
    if (action.type === 'move') {
      setOpen(true);
      setActiveIndex(action.index);
    } else if (action.type === 'select') {
      const game = results[action.index];
      if (game) selectGame(game);
    } else {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <form
      ref={containerRef}
      role="search"
      onSubmit={handleSubmit}
      className={cn('relative w-full', className)}
    >
      <div className="relative">
        <Search
          className={cn(
            'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted',
            size === 'hero' ? 'h-5 w-5' : 'h-4 w-4',
          )}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && !containerRef.current?.contains(next)) {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={size === 'hero' ? 'Search games, categories, moods...' : 'Search games'}
          aria-label="Search games"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={showPanel}
          aria-controls={showPanel ? `${id}-results` : undefined}
          aria-activedescendant={activeGame ? `${id}-option-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'field w-full text-ink transition focus:outline-none',
            size === 'hero'
              ? 'h-14 rounded-2xl pl-12 pr-28 text-[15px]'
              : 'h-10 rounded-full pl-9 pr-16 text-sm',
          )}
        />
        {size === 'hero' ? (
          <button
            type="submit"
            className="absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-brand hover:text-white night:bg-gradient-to-r night:from-electric-500 night:to-plasma-500 night:text-night-950"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-raised px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted xl:block">
            Ctrl K
          </kbd>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {showPanel ? `${results.length} game${results.length === 1 ? '' : 's'} found` : ''}
      </p>

      {showPanel ? (
        <div
          id={`${id}-results`}
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl shadow-black/15 backdrop-blur-xl night:bg-night-900 night:shadow-black/60"
        >
          {results.length > 0 ? (
            <div
              role="listbox"
              aria-label="Game suggestions"
              className="max-h-[320px] overflow-y-auto p-2"
            >
              {results.map((game, index) => (
                <button
                  key={game.id}
                  type="button"
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectGame(game)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition',
                    index === activeIndex ? 'bg-sunken' : 'hover:bg-sunken',
                  )}
                >
                  <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                    <GameThumbnail game={game} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{game.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {getCategory(game.category).name}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-5">
              <SearchX className="h-5 w-5 text-muted" aria-hidden="true" />
              <p className="text-sm text-muted">
                No games match <span className="font-medium text-ink">“{term.trim()}”</span> yet.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => runSearch(term, results.length)}
            className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-left text-sm font-medium text-brand transition hover:bg-sunken"
          >
            View all results
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </form>
  );
}
