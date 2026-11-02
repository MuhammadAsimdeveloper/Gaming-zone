import { ArrowRight, Search, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCategory } from '../../data/categories';
import { track } from '../../lib/analytics';
import { filterGames, sortGames } from '../../lib/catalogue';
import { cn } from '../../lib/cn';
import { useCatalogue } from '../../providers/CatalogueProvider';
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

  const results = useMemo(() => {
    const trimmed = term.trim();
    if (!trimmed) return [];
    return sortGames(filterGames(publishedGames, { query: trimmed }), 'featured').slice(0, 5);
  }, [publishedGames, term]);

  const showPanel = open && term.trim().length > 0;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
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
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);

  function runSearch(query: string, resultCount: number) {
    const trimmed = query.trim();
    track('search', { search_term: trimmed, results_count: resultCount });
    setOpen(false);
    onSubmitted?.();
    navigate(trimmed ? `/games?q=${encodeURIComponent(trimmed)}` : '/games');
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(term, results.length);
    inputRef.current?.blur();
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
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={size === 'hero' ? 'Search games, categories, moods...' : 'Search games'}
          aria-label="Search games"
          aria-expanded={showPanel}
          aria-controls={`${id}-results`}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'w-full border text-ink placeholder:text-muted/70 transition focus:bg-night-900 focus:outline-none focus:ring-2 focus:ring-electric-500/25',
            size === 'hero'
              ? 'h-14 rounded-2xl border-white/10 bg-night-900/75 pl-12 pr-28 text-[15px] focus:border-electric-400/50'
              : 'h-10 rounded-full border-white/10 bg-white/[0.05] pl-9 pr-16 text-sm focus:border-electric-400/50',
          )}
        />
        {size === 'hero' ? (
          <button
            type="submit"
            className="absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-gradient-to-r from-electric-500 to-plasma-500 px-4 text-sm font-semibold text-white shadow-lg shadow-electric-500/25 transition hover:brightness-110"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted/70 xl:block">
            Ctrl K
          </kbd>
        )}
      </div>

      {showPanel ? (
        <div
          id={`${id}-results`}
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-night-900/98 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          {results.length > 0 ? (
            <ul className="max-h-[320px] overflow-y-auto p-2">
              {results.map((game) => (
                <li key={game.id}>
                  <Link
                    to={`/game/${game.slug}`}
                    onClick={() => {
                      track('search', {
                        search_term: term.trim(),
                        results_count: results.length,
                        selected_game: game.slug,
                      });
                      setOpen(false);
                      onSubmitted?.();
                    }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.06]"
                  >
                    <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      <GameThumbnail game={game} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{game.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {getCategory(game.category).name}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted/60" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
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
            className="flex w-full items-center justify-between border-t border-white/[0.07] px-4 py-3 text-left text-sm font-medium text-electric-300 transition hover:bg-white/[0.04]"
          >
            View all results
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </form>
  );
}
