# NeonRift Editorial Arcade UI Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the uniform dark-neon shell with the approved Editorial Arcade design — a warm light browsing surface and a dark, immersive game route — while fixing the search combobox and target-size accessibility defects and preserving every existing game, route, and behavior.

**Architecture:** Semantic CSS variables (`--nr-*`) are mapped into Tailwind theme tokens (`--color-surface`, `--color-ink`, `--color-line`, etc.) and switched by `data-theme="day" | "night"` on `<html>`. A route helper sets `night` for `/game/*` and `day` for everything else, with `useLayoutEffect` before paint. Existing components migrate from hard-coded `night-*`/`white/[...]` classes to semantic utilities (`surface-card`, `surface-panel`, `field`, `chip`, `chip-active`, `accent-tile`, `game-card`). No runtime dependencies are added; `axe-core` is dev-only.

**Tech Stack:** React 19.3, TypeScript 5.9 (strict), Vite 8.3, Tailwind CSS 4.3 (CSS-first `@theme`), React Router 7.18, Vitest 5, Playwright 1.64, axe-core 4.10 (dev).

**Spec:** `docs/superpowers/specs/2026-11-02-ui-refresh-design.md`

## Global Constraints

- Branch: `feature/platform-hardening`. Never force-push. Do not push or deploy in this plan.
- Preserve the existing architecture, the 10 games, game registry, catalogue data, routes, consent/advertising behavior, SEO, and user copy. Do not delete or rewrite game modules.
- Do not add runtime dependencies. The only new package is `axe-core` as a dev dependency.
- No fake data, invented stats, ratings, or counters. Every number comes from `publishedGames`, `categoryCounts`, `newThisMonth`, or local preferences.
- Keep existing accessible names used by E2E unless this plan explicitly changes them (`searchbox` → `combobox` is the only intentional rename).
- All colors must come from semantic tokens or the fixed `night-*` art palette. `night-*` is only allowed on dark art frames, player chrome, and image overlays — never on a browsing page surface.
- Reduced motion must disable the marquee, float, and fade animations.
- Repository commit convention for this wave: **one commit at the end (Task 10)**. Tasks 1–9 end with verification checkpoints but no commits. This matches the project's one-commit-per-wave history; the user must explicitly authorize a push separately.
- Verification commands are exactly: `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test --workers=2`.

## File Structure

New files:

- `src/lib/theme.ts` — route-to-theme decision and DOM application.
- `src/lib/theme.test.ts` — unit tests for the helper.
- `src/lib/combobox.ts` — pure option navigation, panel visibility, and key-resolution helpers.
- `src/lib/combobox.test.ts` — unit tests for option navigation, open/close, and key handling.
- `src/components/game/GameMarquee.tsx` — CSS-only title/category marquee.
- `e2e/a11y.spec.ts` — axe WCAG AA scans, theme, overflow, target sizes.
- `docs/research/UI-CREDITS.md` — open-source provenance.

Modified files:

- `src/index.css`, `index.html`, `src/main.tsx`, `src/components/layout/SiteLayout.tsx`.
- `src/components/search/SearchBar.tsx`.
- `src/components/ui/{Button,Badge,SectionHeader,PageHeader,CtaBand,EmptyState}.tsx`.
- `src/components/brand/Logo.tsx`.
- `src/components/layout/{Header,Footer,MobileTabBar}.tsx`.
- `src/components/analytics/ConsentBanner.tsx`, `src/providers/ToastProvider.tsx`.
- `src/components/game/{GameCard,GameGrid,GameRail,GameToolbar}.tsx`.
- `src/components/errors/AppErrorBoundary.tsx`, `src/components/game/GameErrorBoundary.tsx`.
- `src/components/ads/AdSlot.tsx`.
- `src/pages/{HomePage,GamesPage,CategoryPage,CategoriesPage,NewPage,PopularPage,FavoritesPage,RecentlyPlayedPage,GamePage,AboutPage,ContactPage,NotFoundPage,PrivacyPage}.tsx`.
- `src/components/legal/LegalPage.tsx`, `src/App.tsx`.
- `e2e/navigation.spec.ts`, `package.json`, `package-lock.json`, `README.md`.

---

### Task 1: Theme foundation and route switching

**Files:**

- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`
- Modify: `src/main.tsx`
- Modify: `src/components/layout/SiteLayout.tsx`
- Modify: `index.html`
- Modify: `src/index.css`

**Interfaces:**

- Produces: `type Theme = 'day' | 'night'`; `themeForPath(pathname: string): Theme`; `applyTheme(theme: Theme): void`.
- Consumes: nothing.
- Later tasks consume the Tailwind tokens `surface`, `raised`, `sunken`, `ink`, `ink-soft`, `muted`, `line`, `brand`, `accent`, `danger`, `warning`, `mint`, and utilities `surface-card`, `surface-panel`, `surface-subtle`, `field`, `chip`, `chip-active`, `accent-tile`, `game-card`, `animate-marquee`.

- [x] **Step 1: Write the failing theme test**

Create `src/lib/theme.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, themeForPath } from './theme';

describe('themeForPath', () => {
  it('keeps browsing routes on the day theme', () => {
    expect(themeForPath('/')).toBe('day');
    expect(themeForPath('/games')).toBe('day');
    expect(themeForPath('/category/racing')).toBe('day');
    expect(themeForPath('/about')).toBe('day');
  });

  it('switches game routes to the night theme', () => {
    expect(themeForPath('/game')).toBe('night');
    expect(themeForPath('/game/neon-snake')).toBe('night');
  });
});

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    document.head.innerHTML = '';
  });

  function addMeta(name: string, content: string) {
    const meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.append(meta);
    return meta;
  }

  it('applies the night palette, color scheme and theme color', () => {
    const themeColor = addMeta('theme-color', '#F5F1E6');
    const colorScheme = addMeta('color-scheme', 'light');

    applyTheme('night');

    expect(document.documentElement.dataset.theme).toBe('night');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(themeColor.content).toBe('#070B16');
    expect(colorScheme.content).toBe('dark');
  });

  it('applies the day palette, color scheme and theme color', () => {
    const themeColor = addMeta('theme-color', '#070B16');
    const colorScheme = addMeta('color-scheme', 'dark');

    applyTheme('day');

    expect(document.documentElement.dataset.theme).toBe('day');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(themeColor.content).toBe('#F5F1E6');
    expect(colorScheme.content).toBe('light');
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL — `Failed to resolve import "./theme"` / module does not exist.

- [x] **Step 3: Implement the theme helper**

Create `src/lib/theme.ts`:

```ts
export type Theme = 'day' | 'night';

export function themeForPath(pathname: string): Theme {
  return pathname === '/game' || pathname.startsWith('/game/') ? 'night' : 'day';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const night = theme === 'night';

  root.dataset.theme = theme;
  root.style.colorScheme = night ? 'dark' : 'light';

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = night ? '#070B16' : '#F5F1E6';

  const colorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.content = night ? 'dark' : 'light';
}
```

- [x] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS — 4 tests.

- [x] **Step 5: Apply the theme before React renders**

Edit `src/main.tsx` to import the helper and apply the initial route theme before `createRoot`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { applyTheme, themeForPath } from './lib/theme';
import './index.css';

applyTheme(themeForPath(window.location.pathname));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
```

- [x] **Step 6: Switch the theme on every route change**

Replace `src/components/layout/SiteLayout.tsx` with:

```tsx
import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { applyTheme, themeForPath } from '../../lib/theme';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileTabBar } from './MobileTabBar';
import { ScrollToTop } from './ScrollToTop';

export function SiteLayout() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    applyTheme(themeForPath(pathname));
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-surface"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <ScrollToTop />
    </div>
  );
}
```

- [x] **Step 7: Set the initial document metadata to the light shell**

In `index.html`, change the two theme metas and add a blocking head script so a deep link to a
game route paints dark on the first frame, before the module bundle runs:

```html
<meta name="theme-color" content="#F5F1E6" />
<meta name="color-scheme" content="light" />
<script>
  document.documentElement.dataset.theme =
    location.pathname === '/game' || location.pathname.startsWith('/game/') ? 'night' : 'day';
  document.documentElement.style.colorScheme =
    document.documentElement.dataset.theme === 'night' ? 'dark' : 'light';
</script>
```

The predicate mirrors `themeForPath`; change both together if the game route prefix ever moves.

- [x] **Step 8: Replace the design tokens and base styles**

Replace everything in `src/index.css` from line 1 through the end of the second `@layer utilities` block (the block containing `.animate-fade-up` … `.animate-shimmer`) with the CSS below. Keep the four `@font-face` declarations verbatim and place them between `@custom-variant` and `@theme`. Keep the `/* Memory game 3D flip */` section and the existing `@media (prefers-reduced-motion: reduce)` block, then add the marquee disable rule described after the code.

```css
@import "tailwindcss";

@custom-variant night (&:where([data-theme="night"], [data-theme="night"] *));

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif;

  --color-surface: var(--nr-surface);
  --color-raised: var(--nr-raised);
  --color-sunken: var(--nr-sunken);
  --color-ink: var(--nr-ink);
  --color-ink-soft: var(--nr-ink-soft);
  --color-muted: var(--nr-muted);
  --color-line: var(--nr-line);
  --color-line-strong: var(--nr-line-strong);
  --color-brand: var(--nr-brand);
  --color-accent: var(--nr-accent);
  --color-danger: var(--nr-danger);
  --color-warning: var(--nr-warning);
  --color-mint: var(--nr-mint);

  --color-electric-300: var(--nr-electric-300);
  --color-electric-400: var(--nr-electric-400);
  --color-electric-500: var(--nr-electric-500);
  --color-electric-600: var(--nr-electric-600);
  --color-plasma-300: var(--nr-plasma-300);
  --color-plasma-400: var(--nr-plasma-400);
  --color-plasma-500: var(--nr-plasma-500);
  --color-plasma-600: var(--nr-plasma-600);
  --color-coral: var(--nr-danger);

  --color-night-950: #050814;
  --color-night-900: #070c1a;
  --color-night-850: #0a1122;
  --color-night-800: #0e172c;
  --color-night-700: #16213d;
  --color-night-600: #1e2b4d;

  --radius-4xl: 2rem;
}

:root,
[data-theme="day"] {
  --nr-surface: #f5f1e6;
  --nr-raised: #fffdf7;
  --nr-sunken: #eae4d5;
  --nr-ink: #14161c;
  --nr-ink-soft: #3b3f4a;
  --nr-muted: #5d6270;
  --nr-line: rgba(20, 22, 28, 0.14);
  --nr-line-strong: rgba(20, 22, 28, 0.55);
  --nr-brand: #2447d8;
  --nr-accent: #7c3aed;
  --nr-danger: #d92d4a;
  --nr-warning: #8a4b00;
  --nr-mint: #0a6a47;
  --nr-electric-300: #1f3fd6;
  --nr-electric-400: #2e5bff;
  --nr-electric-500: #2e5bff;
  --nr-electric-600: #1e3fcc;
  --nr-plasma-300: #6d28d9;
  --nr-plasma-400: #7c3aed;
  --nr-plasma-500: #7c3aed;
  --nr-plasma-600: #5b21b6;
  --nr-glow-a: rgba(46, 91, 255, 0.1);
  --nr-glow-b: rgba(124, 58, 237, 0.08);
  --nr-dots: rgba(20, 22, 28, 0.08);
  --nr-focus: #2e5bff;
  --nr-selection: rgba(46, 91, 255, 0.22);
  --nr-scroll-track: #eae4d5;
  --nr-scroll-thumb: #c9c1ae;
  --nr-gradient-end: #d92d4a;
  color-scheme: light;
}

[data-theme="night"] {
  --nr-surface: #070b16;
  --nr-raised: #0c1322;
  --nr-sunken: #050814;
  --nr-ink: #f2f5ff;
  --nr-ink-soft: #d7ddec;
  --nr-muted: #a2aec7;
  --nr-line: rgba(255, 255, 255, 0.12);
  --nr-line-strong: rgba(255, 255, 255, 0.45);
  --nr-brand: #6ba4ff;
  --nr-accent: #b285ff;
  --nr-danger: #ff6b81;
  --nr-warning: #fbbf24;
  --nr-mint: #4ade9d;
  --nr-electric-300: #9cc0ff;
  --nr-electric-400: #6ba4ff;
  --nr-electric-500: #4c8dff;
  --nr-electric-600: #2f6fed;
  --nr-plasma-300: #cbb0ff;
  --nr-plasma-400: #b285ff;
  --nr-plasma-500: #a06bff;
  --nr-plasma-600: #7c3aed;
  --nr-glow-a: rgba(107, 164, 255, 0.14);
  --nr-glow-b: rgba(178, 133, 255, 0.1);
  --nr-dots: rgba(255, 255, 255, 0.05);
  --nr-focus: #f2f5ff;
  --nr-selection: rgba(107, 164, 255, 0.35);
  --nr-scroll-track: #050814;
  --nr-scroll-thumb: #1e2b4d;
  --nr-gradient-end: #f0a6ff;
  color-scheme: dark;
}

@layer base {
  html {
    scroll-behavior: smooth;
    -webkit-tap-highlight-color: transparent;
    scrollbar-color: var(--nr-scroll-thumb) var(--nr-scroll-track);
  }

  body {
    @apply min-h-dvh bg-surface font-sans text-ink antialiased;
    background-image:
      radial-gradient(1100px 620px at 82% -12%, var(--nr-glow-a), transparent 62%),
      radial-gradient(900px 540px at -8% 2%, var(--nr-glow-b), transparent 58%),
      radial-gradient(var(--nr-dots) 1px, transparent 1px);
    background-size: auto, auto, 22px 22px;
    background-attachment: fixed, fixed, fixed;
  }

  h1,
  h2,
  h3,
  h4 {
    @apply font-display tracking-tight;
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }

  ::selection {
    background: var(--nr-selection);
    color: var(--nr-ink);
  }

  :focus-visible {
    outline: 2px solid var(--nr-focus);
    outline-offset: 2px;
  }

  ::-webkit-scrollbar {
    width: 11px;
    height: 11px;
  }

  ::-webkit-scrollbar-track {
    background: var(--nr-scroll-track);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--nr-scroll-thumb);
    border-radius: 999px;
    border: 3px solid var(--nr-scroll-track);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--nr-scroll-thumb) 70%, var(--nr-ink));
  }
}

@layer utilities {
  .text-gradient {
    background-image: linear-gradient(
      100deg,
      var(--nr-brand) 0%,
      var(--nr-accent) 55%,
      var(--nr-gradient-end) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .no-scrollbar {
    scrollbar-width: none;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .surface-card {
    background-color: var(--nr-raised);
    border: 1px solid var(--nr-line);
    box-shadow: 5px 5px 0 0 color-mix(in srgb, var(--nr-ink) 12%, transparent);
  }

  [data-theme="night"] .surface-card {
    box-shadow: 0 22px 60px -32px rgba(0, 0, 0, 0.85);
  }

  .surface-panel {
    background-color: var(--nr-raised);
    border: 1px solid var(--nr-line);
  }

  .surface-subtle {
    background-color: var(--nr-sunken);
    border: 1px solid var(--nr-line);
  }

  .field {
    background-color: var(--nr-raised);
    border: 1px solid var(--nr-line-strong);
    color: var(--nr-ink);
  }

  .field::placeholder {
    color: var(--nr-muted);
    opacity: 1;
  }

  .field:focus {
    border-color: color-mix(in srgb, var(--nr-brand) 65%, var(--nr-line));
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: 1px solid var(--nr-line);
    background-color: var(--nr-raised);
    color: var(--nr-muted);
    transition: color 0.2s, background-color 0.2s, border-color 0.2s;
  }

  .chip:hover {
    color: var(--nr-ink);
    border-color: color-mix(in srgb, var(--nr-ink) 30%, var(--nr-line));
  }

  .chip-active {
    background-color: var(--nr-ink);
    border-color: var(--nr-ink);
    color: var(--nr-surface);
  }

  .accent-tile {
    background-color: color-mix(in srgb, var(--chip, var(--nr-brand)) 18%, var(--nr-raised));
    border: 1px solid color-mix(in srgb, var(--chip, var(--nr-brand)) 38%, var(--nr-line));
  }

  .game-card {
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  }

  .game-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--nr-ink) 32%, var(--nr-line));
    box-shadow: 6px 6px 0 0 color-mix(in srgb, var(--nr-ink) 16%, transparent);
  }

  [data-theme="night"] .game-card:hover {
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow: 0 24px 60px -28px rgba(0, 0, 0, 0.9);
  }
}

@keyframes nr-fade-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes nr-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes nr-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes nr-pulse-glow {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes nr-shimmer {
  from {
    background-position: -200% 0;
  }
  to {
    background-position: 200% 0;
  }
}

@keyframes nr-pop {
  0% {
    transform: scale(0.85);
    opacity: 0;
  }
  70% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes nr-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@layer utilities {
  .animate-fade-up {
    animation: nr-fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .animate-fade-in {
    animation: nr-fade-in 0.5s ease-out both;
  }

  .animate-float {
    animation: nr-float 7s ease-in-out infinite;
  }

  .animate-pulse-glow {
    animation: nr-pulse-glow 5s ease-in-out infinite;
  }

  .animate-pop {
    animation: nr-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .animate-shimmer {
    background-image: linear-gradient(
      100deg,
      rgba(255, 255, 255, 0.03) 20%,
      rgba(255, 255, 255, 0.08) 40%,
      rgba(255, 255, 255, 0.03) 60%
    );
    background-size: 200% 100%;
    animation: nr-shimmer 1.6s linear infinite;
  }

  .animate-marquee {
    animation: nr-marquee 38s linear infinite;
  }

  .marquee:hover .animate-marquee {
    animation-play-state: paused;
  }
}
```

Two token adjustments are deliberate accessibility derivations from the approved spec:
`--nr-brand` in the day palette is `#2447D8` rather than `#2E5BFF` so brand text on a
`brand/10` tint clears 4.5:1, while `--nr-electric-400` keeps `#2E5BFF` for non-text glow;
`--nr-line-strong` is a separate control-boundary token because the 14%-ink divider line is
too faint to satisfy WCAG 1.4.11 on light inputs.

Then inside the existing `@media (prefers-reduced-motion: reduce)` block add:

```css
  .animate-marquee {
    animation: none !important;
  }
```

- [x] **Step 9: Verify the theme foundation**

Run:

```bash
npm run typecheck
npx vitest run src/lib/theme.test.ts
npm run build
```

Expected: typecheck clean; 4 theme tests pass; build succeeds. The UI will look half-migrated at this point — that is expected until Task 3–8.

---

### Task 2: Accessible search combobox

**Files:**

- Create: `src/lib/combobox.ts`
- Create: `src/lib/combobox.test.ts`
- Modify: `src/components/search/SearchBar.tsx`
- Modify: `e2e/navigation.spec.ts`

**Interfaces:**

- Produces: `nextOptionIndex(current: number, delta: 1 | -1, count: number): number`; `edgeOptionIndex(count: number, edge: 'start' | 'end'): number`; `shouldShowPanel(open: boolean, term: string): boolean`; `resolveComboboxKey(key, state): ComboboxKeyAction`.
- `ComboboxKeyAction` is `{ type: 'move'; index: number } | { type: 'select'; index: number } | { type: 'close' } | { type: 'none' }`.
- `SearchBar` keeps its public props unchanged: `{ id: string; size?: 'header' | 'hero'; shortcut?: boolean; onSubmitted?: () => void; className?: string }`.

- [x] **Step 1: Write the failing combobox helper test**

Create `src/lib/combobox.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { edgeOptionIndex, nextOptionIndex, resolveComboboxKey, shouldShowPanel } from './combobox';

describe('nextOptionIndex', () => {
  it('starts at the first option when moving down from none', () => {
    expect(nextOptionIndex(-1, 1, 3)).toBe(0);
  });

  it('starts at the last option when moving up from none', () => {
    expect(nextOptionIndex(-1, -1, 3)).toBe(2);
  });

  it('wraps past the end', () => {
    expect(nextOptionIndex(2, 1, 3)).toBe(0);
  });

  it('wraps past the start', () => {
    expect(nextOptionIndex(0, -1, 3)).toBe(2);
  });

  it('returns -1 when there are no options', () => {
    expect(nextOptionIndex(-1, 1, 0)).toBe(-1);
    expect(nextOptionIndex(0, -1, 0)).toBe(-1);
  });
});

describe('edgeOptionIndex', () => {
  it('returns the first and last indexes', () => {
    expect(edgeOptionIndex(4, 'start')).toBe(0);
    expect(edgeOptionIndex(4, 'end')).toBe(3);
  });

  it('returns -1 when empty', () => {
    expect(edgeOptionIndex(0, 'start')).toBe(-1);
    expect(edgeOptionIndex(0, 'end')).toBe(-1);
  });
});

describe('resolveComboboxKey', () => {
  const closedNone = { open: false, activeIndex: -1, count: 3 };

  it('moves down from no active option', () => {
    expect(resolveComboboxKey('ArrowDown', closedNone)).toEqual({ type: 'move', index: 0 });
  });

  it('moves up from no active option', () => {
    expect(resolveComboboxKey('ArrowUp', closedNone)).toEqual({ type: 'move', index: 2 });
  });

  it('jumps to the first option on Home while open', () => {
    expect(resolveComboboxKey('Home', { open: true, activeIndex: 2, count: 3 })).toEqual({
      type: 'move',
      index: 0,
    });
  });

  it('jumps to the last option on End while open', () => {
    expect(resolveComboboxKey('End', { open: true, activeIndex: 0, count: 3 })).toEqual({
      type: 'move',
      index: 2,
    });
  });

  it('does not hijack Home or End when the panel is closed', () => {
    expect(resolveComboboxKey('Home', closedNone)).toEqual({ type: 'none' });
    expect(resolveComboboxKey('End', closedNone)).toEqual({ type: 'none' });
  });

  it('selects the active option on Enter', () => {
    expect(resolveComboboxKey('Enter', { open: true, activeIndex: 1, count: 3 })).toEqual({
      type: 'select',
      index: 1,
    });
  });

  it('lets Enter submit the form when no option is active', () => {
    expect(resolveComboboxKey('Enter', { open: true, activeIndex: -1, count: 3 })).toEqual({
      type: 'none',
    });
  });

  it('closes on Escape', () => {
    expect(resolveComboboxKey('Escape', { open: true, activeIndex: 1, count: 3 })).toEqual({
      type: 'close',
    });
  });

  it('ignores unrelated keys', () => {
    expect(resolveComboboxKey('Tab', { open: true, activeIndex: 1, count: 3 })).toEqual({
      type: 'none',
    });
  });
});

describe('shouldShowPanel', () => {
  it('opens only when the input has a non-empty term', () => {
    expect(shouldShowPanel(true, 'neon')).toBe(true);
    expect(shouldShowPanel(false, 'neon')).toBe(false);
    expect(shouldShowPanel(true, '   ')).toBe(false);
    expect(shouldShowPanel(true, '')).toBe(false);
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/lib/combobox.test.ts`
Expected: FAIL — cannot resolve `./combobox`.

- [x] **Step 3: Implement the helpers**

Create `src/lib/combobox.ts`:

```ts
export function nextOptionIndex(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

export function edgeOptionIndex(count: number, edge: 'start' | 'end'): number {
  if (count <= 0) return -1;
  return edge === 'start' ? 0 : count - 1;
}

export function shouldShowPanel(open: boolean, term: string): boolean {
  return open && term.trim().length > 0;
}

export type ComboboxKeyAction =
  | { type: 'move'; index: number }
  | { type: 'select'; index: number }
  | { type: 'close' }
  | { type: 'none' };

export function resolveComboboxKey(
  key: string,
  { open, activeIndex, count }: { open: boolean; activeIndex: number; count: number },
): ComboboxKeyAction {
  if (key === 'ArrowDown') return { type: 'move', index: nextOptionIndex(activeIndex, 1, count) };
  if (key === 'ArrowUp') return { type: 'move', index: nextOptionIndex(activeIndex, -1, count) };
  if (key === 'Home' && open) return { type: 'move', index: edgeOptionIndex(count, 'start') };
  if (key === 'End' && open) return { type: 'move', index: edgeOptionIndex(count, 'end') };
  if (key === 'Enter' && activeIndex >= 0 && activeIndex < count) {
    return { type: 'select', index: activeIndex };
  }
  if (key === 'Escape') return { type: 'close' };
  return { type: 'none' };
}
```

- [x] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/lib/combobox.test.ts`
Expected: PASS — 17 tests.

- [x] **Step 5: Rewrite `SearchBar` as a WAI-ARIA combobox**

Replace `src/components/search/SearchBar.tsx` with:

```tsx
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
```

- [x] **Step 6: Update the browser test selector and add keyboard coverage**

In `e2e/navigation.spec.ts`, change the two header search lines:

```ts
await search.getByRole('combobox').fill('neon apex');
await search.getByRole('combobox').press('Enter');
```

Then add this test after `header search submits to the catalogue`:

```ts
  test('search suggestions are keyboard navigable', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    const search = page.getByRole('search').filter({ has: page.locator('#header-search') });
    const combobox = search.getByRole('combobox');
    await combobox.fill('neon');
    await combobox.press('ArrowDown');

    await expect(search.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await combobox.press('Enter');

    await expect(page).toHaveURL(/\/game\/neon-(apex|city-drive|snake)/);
    expectNoErrors(errors);
  });
```

- [x] **Step 7: Verify the combobox**

Run:

```bash
npm run typecheck
npx vitest run src/lib/combobox.test.ts
npm run build
```

Expected: typecheck clean; 17 helper tests pass; build succeeds.

---

### Task 3: Shared primitives, chrome, consent and toast

**Files:**

- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Badge.tsx`
- Modify: `src/components/ui/SectionHeader.tsx`
- Modify: `src/components/ui/PageHeader.tsx`
- Modify: `src/components/ui/CtaBand.tsx`
- Modify: `src/components/ui/EmptyState.tsx`
- Modify: `src/components/brand/Logo.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/components/layout/MobileTabBar.tsx`
- Modify: `src/components/analytics/ConsentBanner.tsx`
- Modify: `src/providers/ToastProvider.tsx`
- Modify: `src/components/errors/AppErrorBoundary.tsx`
- Modify: `src/components/game/GameErrorBoundary.tsx`
- Modify: `src/components/ads/AdSlot.tsx`
- Modify: `src/App.tsx`

**Interfaces:**

- `ButtonVariant` gains `'inverse'`. All existing variants and sizes keep their names.
- No component props change. All accessible names stay the same.

- [x] **Step 1: Restyle Button and add the inverse variant**

In `src/components/ui/Button.tsx` replace the type and variant map:

```ts
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-surface shadow-[4px_4px_0_0_rgba(20,22,28,0.22)] hover:bg-brand hover:text-white night:bg-gradient-to-r night:from-electric-500 night:to-plasma-500 night:text-night-950 night:shadow-[0_10px_34px_-12px_rgba(76,141,255,0.75)] night:ring-1 night:ring-white/15',
  secondary:
    'border border-line bg-raised text-ink hover:border-ink/30 hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  outline: 'border border-brand/40 bg-brand/5 text-brand hover:bg-brand/10',
  danger: 'border border-coral/30 bg-coral/10 text-coral hover:bg-coral/20',
  inverse: 'bg-surface text-ink hover:bg-brand hover:text-surface',
};
```

Keep `buttonClasses`, `Button`, and `ButtonLink` unchanged.

- [x] **Step 2: Restyle Badge tones**

In `src/components/ui/Badge.tsx` replace `toneClasses`:

```ts
const toneClasses: Record<Tone, string> = {
  neutral: 'border-line bg-raised text-muted',
  electric: 'border-brand/30 bg-brand/10 text-brand',
  plasma: 'border-plasma-500/30 bg-plasma-500/10 text-plasma-300',
  mint: 'border-mint/25 bg-mint/10 text-mint',
  amber: 'border-warning/25 bg-warning/10 text-warning',
  coral: 'border-coral/25 bg-coral/10 text-coral',
};
```

- [x] **Step 3: Restyle SectionHeader**

In `src/components/ui/SectionHeader.tsx`:

- Eyebrow class becomes `mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand`.
- Action link class becomes `group inline-flex min-h-6 items-center gap-1.5 rounded-full px-1 py-1 text-sm font-medium text-muted transition hover:text-ink`.

- [x] **Step 4: Replace PageHeader**

Replace `src/components/ui/PageHeader.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { Container } from './Container';

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(680px 260px at 18% -20%, color-mix(in srgb, var(--nr-brand) 16%, transparent), transparent 70%), radial-gradient(520px 220px at 82% 0%, color-mix(in srgb, var(--nr-accent) 12%, transparent), transparent 70%)',
        }}
      />
      <Container className="relative py-12 sm:py-16">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-ink sm:text-4xl lg:text-[2.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-[15px]">{description}</p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </Container>
    </div>
  );
}
```

- [x] **Step 5: Replace CtaBand with the ink panel**

Replace `src/components/ui/CtaBand.tsx` with:

```tsx
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from './Button';
import { Container } from './Container';

export function CtaBand({
  eyebrow = 'Jump in',
  title,
  description,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryTo: string;
  primaryLabel: string;
  secondaryTo?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="mt-16 sm:mt-20">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-surface sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-accent/25 blur-3xl"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface/70">
                {eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-surface sm:text-3xl">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-surface/75">{description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to={primaryTo} size="lg" variant="inverse">
                {primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              {secondaryTo && secondaryLabel ? (
                <ButtonLink
                  to={secondaryTo}
                  variant="ghost"
                  size="lg"
                  className="text-surface/80 hover:bg-white/10 hover:text-surface"
                >
                  {secondaryLabel}
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
```

- [x] **Step 6: Restyle EmptyState**

In `src/components/ui/EmptyState.tsx` replace the two class strings:

```tsx
'flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-raised/60 px-6 py-16 text-center',
```

and

```tsx
'grid h-14 w-14 place-items-center rounded-2xl border border-brand/20 bg-brand/10 text-brand',
```

- [x] **Step 7: Make the Logo theme-aware**

In `src/components/brand/Logo.tsx`:

- Change the icon wrapper class to:

```tsx
className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl shadow-[3px_3px_0_0_rgba(20,22,28,0.25)] ring-1 ring-ink/15 transition-transform duration-300 group-hover:scale-105 night:shadow-none"
```

- Change the two SVG gradient stops to:

```tsx
<stop offset="0" stopColor="var(--nr-brand)" />
<stop offset="1" stopColor="var(--nr-accent)" />
```

- Keep the wordmark markup unchanged (`text-ink` + `.text-gradient` already adapt).

- [x] **Step 8: Restyle Header**

In `src/components/layout/Header.tsx`:

```tsx
const iconLinkClasses =
  'relative grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink';
```

- Header element: `className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-xl"`.
- Primary NavLink active: `'bg-ink text-surface'`; inactive: `'text-muted hover:bg-sunken hover:text-ink'`.
- Favorites count: `bg-brand text-surface` (light-on-brand in day, dark-on-brand in night).
- Mobile search drawer: `className="border-t border-line px-4 py-3 md:hidden"`.
- Mobile nav wrapper: `className="border-t border-line bg-raised lg:hidden"`.
- Mobile NavLink active: `'bg-ink text-surface'`; inactive: `'text-muted hover:bg-sunken hover:text-ink'`.

- [x] **Step 9: Restyle Footer and meet the 24px target**

In `src/components/layout/Footer.tsx`:

- Footer element: `className="mt-20 border-t border-line bg-raised/60"`.
- Column heading: `text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/80`.
- Footer link:

```tsx
className="inline-flex min-h-6 items-center text-sm text-muted transition hover:text-ink"
```

- Bottom rule: `border-t border-line pt-6`.
- Replace any `text-muted/50`, `text-muted/60`, or `text-muted/70` footnote text in this component with `text-muted` so it passes contrast.

- [x] **Step 10: Restyle the mobile tab bar**

In `src/components/layout/MobileTabBar.tsx`:

- Nav element: `className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"`.
- Tab class:

```tsx
className={({ isActive }) =>
  cn(
    'mx-1 my-1 flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition',
    isActive ? 'bg-ink text-surface' : 'text-muted',
  )
}
```

- Icon class: `cn('h-5 w-5', isActive && 'scale-105')` — remove the blue `drop-shadow`.

- [x] **Step 11: Restyle the consent banner without changing logic**

In `src/components/analytics/ConsentBanner.tsx`:

- `ConsentChoice` wrapper: `className="flex flex-col gap-3 rounded-xl border border-line bg-sunken/60 p-3 sm:flex-row sm:items-center sm:justify-between"`.
- Banner section: `className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-raised/95 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl night:shadow-black/60"`.
- "Keep both off": `className="text-xs font-medium text-muted underline underline-offset-2 transition hover:text-ink"`.
- Privacy link: `className="text-xs font-medium text-brand underline underline-offset-2"`.

- [x] **Step 12: Restyle ToastProvider**

In `src/providers/ToastProvider.tsx` change the toast container class to:

```tsx
className="animate-pop flex items-center gap-2.5 rounded-full border border-line bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-2xl shadow-black/25"
```

and the icon to:

```tsx
<CheckCircle2 className="h-4 w-4 text-surface/70" aria-hidden="true" />
```

- [x] **Step 13: Restyle the error boundaries and ad placeholder**

In `src/components/errors/AppErrorBoundary.tsx`:

- Root: `bg-surface text-ink`.
- Panel: `surface-card`.
- Dev details: `border border-line bg-sunken`.
- Home link: `text-brand`.

In `src/components/game/GameErrorBoundary.tsx`:

- Panel: `border border-line bg-raised`.

In `src/components/ads/AdSlot.tsx`:

- Placeholder frame: `border border-line bg-raised/50`.
- “Advertisement” label: `text-muted` (not `text-muted/50`).

In `src/App.tsx`, `RouteFallback` spinner:

```tsx
<div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-line border-t-brand" />
```

- [x] **Step 14: Verify primitives and chrome**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck clean; all existing 49+ unit tests pass; build succeeds.

---

### Task 4: Game cards, grids, rails and catalogue toolbar

**Files:**

- Modify: `src/components/game/GameCard.tsx`
- Modify: `src/components/game/GameGrid.tsx`
- Modify: `src/components/game/GameRail.tsx`
- Modify: `src/components/game/GameToolbar.tsx`

**Interfaces:**

- `GameCard` gains `size?: 'default' | 'feature'` (default `'default'`). Existing `game`, `priority`, `className` props stay.
- `GameGrid`, `GameRail`, `GameToolbar` keep their exact prop signatures.

- [x] **Step 1: Add the feature size to GameCard and restyle it**

Replace `src/components/game/GameCard.tsx` with:

```tsx
import { ArrowUpRight, Heart, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCategory } from '../../data/categories';
import { track } from '../../lib/analytics';
import { cn } from '../../lib/cn';
import { usePreferences } from '../../providers/PreferencesProvider';
import { useToast } from '../../providers/ToastProvider';
import type { Game } from '../../types/game';
import { GameThumbnail } from './GameThumbnail';

export function GameCard({
  game,
  priority = false,
  size = 'default',
  className,
}: {
  game: Game;
  priority?: boolean;
  size?: 'default' | 'feature';
  className?: string;
}) {
  const { isFavorite, toggleFavorite } = usePreferences();
  const { showToast } = useToast();
  const category = getCategory(game.category);
  const favorite = isFavorite(game.id);
  const feature = size === 'feature';

  function handleFavorite() {
    const added = toggleFavorite(game.id);
    showToast(added ? 'Added to favorites' : 'Removed from favorites');
    track('favorite', { game: game.slug, action: added ? 'add' : 'remove' });
  }

  return (
    <article className={cn('group relative min-w-0', feature && 'h-full', className)}>
      <Link to={`/game/${game.slug}`} className={cn('block', feature && 'flex h-full flex-col')}>
        <div
          className={cn(
            'game-card relative overflow-hidden rounded-3xl border border-line bg-sunken',
            feature ? 'min-h-[320px] flex-1 sm:min-h-[380px]' : 'aspect-[16/10]',
          )}
        >
          <GameThumbnail game={game} priority={priority} />
          <div className="absolute inset-0 bg-gradient-to-t from-night-950/85 via-night-950/5 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
            <span className="rounded-full border border-white/15 bg-night-950/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
              {category.name}
            </span>
            {game.featured ? (
              <span className="rounded-full border border-white/15 bg-night-950/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
                Featured
              </span>
            ) : null}
          </div>
          <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-night-950 shadow-xl shadow-black/40">
              <Play className="h-5 w-5 translate-x-[1px] fill-current" aria-hidden="true" />
            </span>
          </div>
        </div>
        <div
          className={cn(
            'flex items-start justify-between gap-3 px-0.5',
            feature ? 'mt-4' : 'mt-3',
          )}
        >
          <div className="min-w-0">
            <h3
              className={cn(
                'truncate font-display font-semibold text-ink',
                feature ? 'text-xl sm:text-2xl' : 'text-[15px]',
              )}
            >
              {game.title}
            </h3>
            <p
              className={cn(
                'mt-0.5 truncate text-muted',
                feature ? 'text-sm' : 'text-[13px]',
              )}
            >
              {game.tagline}
            </p>
          </div>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-muted/60 transition group-hover:text-brand"
            aria-hidden="true"
          />
        </div>
      </Link>
      <button
        type="button"
        onClick={handleFavorite}
        aria-label={favorite ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
        aria-pressed={favorite}
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-night-950/60 text-white backdrop-blur-md transition hover:bg-night-950/85 focus-visible:outline-white"
      >
        <Heart className={cn('h-4 w-4 transition', favorite && 'fill-coral text-coral')} aria-hidden="true" />
      </button>
    </article>
  );
}
```

- [x] **Step 2: Let grids stretch feature cards**

In `src/components/game/GameGrid.tsx` add `items-stretch` to the grid class:

```tsx
'grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
```

Also add `className="h-full"` to the per-card wrapper:

```tsx
<div
  key={game.id}
  className="animate-fade-up h-full"
  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
>
```

- [x] **Step 3: Keep the rail structure, adjust spacing only**

No structural change is required in `src/components/game/GameRail.tsx`. Keep the 272/310px widths and snap behavior.

- [x] **Step 4: Restyle GameToolbar**

In `src/components/game/GameToolbar.tsx`:

- Search icon: `text-muted`.
- Search input:

```tsx
className="field h-11 w-full rounded-full pl-11 pr-10 text-sm focus:outline-none"
```

- Clear-search button: `className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-sunken hover:text-ink"`.
- Sort select:

```tsx
className="h-11 w-full appearance-none rounded-full border border-line-strong bg-raised pl-4 pr-10 text-sm font-medium text-ink transition hover:border-ink/40 focus:outline-none sm:w-auto"
```

- "All" and category buttons use:

```tsx
className={cn(
  'chip shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium',
  activeCategory === 'all' ? 'chip-active' : '',
)}
```

and for each category, the same pattern with `activeCategory === category.id`.
- The count span inside a category button: `ml-1.5 text-[10px]` (no opacity; opacity would fail contrast).
- Clear filters button: `className="rounded-full px-2 py-1 font-medium text-brand transition hover:bg-brand/10"`.

- [x] **Step 5: Verify the catalogue components**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck clean; 49+ unit tests pass; build succeeds.

---

### Task 5: Editorial home page

**Files:**

- Create: `src/components/game/GameMarquee.tsx`
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**

- `GameMarquee` consumes `{ games: Game[] }` and renders an `aria-hidden` duplicated list. It never navigates.
- `HomePage` keeps all existing data derivations (`heroGame`, `trendingGames`, `newGames`, `recentGames`, `recommendation`, `newThisMonth`) and all routes.

- [x] **Step 1: Create the CSS marquee component**

Create `src/components/game/GameMarquee.tsx`:

```tsx
import { getCategory } from '../../data/categories';
import type { Game } from '../../types/game';

export function GameMarquee({ games }: { games: Game[] }) {
  return (
    <div
      aria-hidden="true"
      className="marquee overflow-hidden border-y border-line bg-raised py-4"
    >
      <div className="animate-marquee flex w-max">
        {[0, 1].map((group) => (
          <ul key={group} className="flex items-center gap-8 pr-8">
            {games.map((game) => (
              <li
                key={`${group}-${game.id}`}
                className="inline-flex items-center gap-3 whitespace-nowrap text-sm font-medium text-ink"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: game.accent }}
                />
                {game.title}
                <span className="text-muted">{getCategory(game.category).name}</span>
                <span className="text-muted/40">/</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Update HomePage imports**

In `src/pages/HomePage.tsx`:

- Remove `Gamepad2` and `Rocket` from the `lucide-react` import (the floating badges are replaced by real stat cards).
- Remove `Badge` from the `../components/ui/Badge` import.
- Add `import type { CSSProperties } from 'react';` for the `--chip` custom property casts.
- Add `import { GameCard } from '../components/game/GameCard';` and `import { GameMarquee } from '../components/game/GameMarquee';`.

- [x] **Step 3: Replace the hero section**

Replace the entire `<section className="relative overflow-hidden">` block (currently the section containing the hero through its closing `</section>` before `<div className="mt-6 space-y-16 …">`) with:

```tsx
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-20 h-[520px] w-[520px] rounded-full bg-accent/10 blur-3xl"
        />

        <Container className="relative grid items-center gap-12 py-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:py-20">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-[11px] font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {publishedGames.length} original games · instant play
            </div>

            <h1 className="mt-6 text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink">
              Your next favorite is <span className="text-gradient">one click away.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
              NeonRift is a growing library of free browser games built to start instantly. No
              downloads, no accounts, no waiting rooms — just pick a game and play.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/games" size="lg">
                Browse all games
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to={`/game/${heroGame.slug}`} variant="secondary" size="lg">
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Play {heroGame.title}
              </ButtonLink>
            </div>

            <div className="mt-8 max-w-xl">
              <SearchBar id="hero-search" size="hero" />
            </div>

            <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Always free
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                No account needed
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Built for mobile
              </li>
            </ul>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="surface-card rounded-[2rem] p-3">
              <Link
                to={`/game/${heroGame.slug}`}
                className="group block overflow-hidden rounded-[1.6rem] bg-night-950"
              >
                <div className="relative aspect-[16/11]">
                  <GameThumbnail game={heroGame} priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/20 to-transparent" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                    <span className="rounded-full border border-white/15 bg-night-950/65 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                      Featured
                    </span>
                    <span className="rounded-full border border-white/15 bg-night-950/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                      {heroCategory.name}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                      {heroGame.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-white/70">{heroGame.tagline}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-night-950 transition group-hover:bg-electric-300">
                        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                        Play now
                      </span>
                      <span className="text-xs text-white/50">Free · Instant</span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-display text-2xl font-semibold text-ink">
                    {publishedGames.length}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">
                    original games in the library
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-display text-2xl font-semibold text-ink">{newThisMonth}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">new this month</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <GameMarquee games={publishedGames} />
```

- [x] **Step 4: Replace the trending grid with the bento**

Replace the `<div className="mt-6"><GameGrid games={trendingGames} priorityCount={2} /></div>` inside the “Trending now” section with:

```tsx
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {trendingGames[0] ? (
                <div className="md:col-span-2 xl:row-span-2">
                  <GameCard game={trendingGames[0]} size="feature" priority />
                </div>
              ) : null}
              {trendingGames.slice(1).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
              <Link
                to="/popular"
                className="accent-tile group flex min-h-[120px] flex-col justify-between rounded-3xl p-5 transition hover:-translate-y-0.5 md:min-h-[160px]"
                style={{ '--chip': 'var(--nr-brand)' } as CSSProperties}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                  Curated
                </span>
                <span className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  See all popular picks
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </div>
```

- [x] **Step 5: Replace the category tiles with color blocks**

Replace the category tile grid contents with:

```tsx
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {populatedCategories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/category/${category.id}`}
                    className="accent-tile group relative overflow-hidden rounded-2xl p-4 transition duration-200 hover:-translate-y-0.5"
                    style={{ '--chip': category.accent } as CSSProperties}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-surface">
                      <CategoryIcon icon={category.icon} className="h-5 w-5" />
                    </span>
                    <span className="mt-4 block text-sm font-semibold text-ink">{category.name}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-soft">
                      {categoryCounts[category.id]} game{categoryCounts[category.id] === 1 ? '' : 's'}
                    </span>
                    <ArrowRight
                      className="absolute right-3.5 top-3.5 h-4 w-4 text-ink/30 transition group-hover:text-ink/70"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
```

- [x] **Step 6: Keep the remaining sections**

Leave the “Continue playing”, “New releases”, recommendations, `AdRegion`, and `CtaBand` sections unchanged. They inherit the new tokens automatically. Do not change their copy or routes.

- [x] **Step 7: Verify the home page**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck clean; 49+ unit tests pass; build succeeds. Start the preview and confirm the headline still contains “one click away” and “10 original games” (E2E depends on both).

---

### Task 6: Listing, category, search and history pages

**Files:**

- Modify: `src/pages/GamesPage.tsx`
- Modify: `src/pages/CategoryPage.tsx`
- Modify: `src/pages/CategoriesPage.tsx`
- Modify: `src/pages/NewPage.tsx`
- Modify: `src/pages/PopularPage.tsx`
- Modify: `src/pages/FavoritesPage.tsx`
- Modify: `src/pages/RecentlyPlayedPage.tsx`

**Interfaces:** No prop, route, copy, or data changes. Styling only.

- [x] **Step 1: Keep GamesPage behavior and rely on primitives**

`GamesPage` has no hard-coded dark surface left after Tasks 3–4. Change the
“Load more games” button from `variant="secondary"` to `variant="outline"` so it reads
as a deliberate secondary action on the paper surface. Confirm the toolbar, grid, empty
state, and CTA copy are otherwise unchanged.

- [x] **Step 2: Restyle CategoryPage**

In `src/pages/CategoryPage.tsx`:

- The count chip wrapper becomes `className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 text-xs font-medium text-ink"`.
- The category icon square becomes:

```tsx
className="grid h-6 w-6 place-items-center rounded-lg bg-ink text-surface"
```

and remove the inline `backgroundColor` / `color` style on that span.
- “All categories” link: `className="inline-flex min-h-6 items-center rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:text-ink"`.
- “Keep exploring” divider: `className="mt-14 border-t border-line pt-8"`.
- Category pills in “Keep exploring”:

```tsx
className="group inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-2 text-sm text-muted transition hover:border-ink/25 hover:text-ink"
```

- Do not keep the inline `style={{ color: entry.accent }}` on these pills: the accent is
  lower-contrast on the paper surface. Let the icon inherit the pill text color by giving it
  `className="h-4 w-4"` and no inline color.

- [x] **Step 3: Turn CategoriesPage cards into accent tiles**

In `src/pages/CategoriesPage.tsx`:

- Category card class becomes:

```tsx
className="accent-tile group relative overflow-hidden rounded-3xl p-6 transition duration-200 hover:-translate-y-0.5"
```

and add `style={{ '--chip': category.accent } as CSSProperties}` plus
`import type { CSSProperties } from 'react';`.
- The decorative glow blob keeps `backgroundColor: category.glow` but add `opacity-40 transition-opacity duration-300 group-hover:opacity-70`.
- The icon square becomes `className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-surface"` and remove its inline color styles.
- “View category” span: `className="relative mt-5 inline-flex min-h-6 items-center gap-1.5 text-xs font-medium text-ink-soft transition group-hover:text-brand"`.
- The footnote class becomes `text-muted` (not `text-muted/60`).

- [x] **Step 4: Restyle RecentlyPlayedPage surfaces**

In `src/pages/RecentlyPlayedPage.tsx`:

- List wrapper: `className="overflow-hidden rounded-3xl border border-line bg-raised/60"`.
- Row divider: `className="border-b border-line last:border-b-0"`.
- Row hover: `hover:bg-sunken`.
- Thumbnail frame: `className="relative aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-xl border border-line sm:w-32"`.
- Play circle:

```tsx
className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-raised text-ink transition group-hover:border-brand/40 group-hover:bg-brand/10 group-hover:text-brand"
```

- [x] **Step 5: Confirm NewPage, PopularPage and FavoritesPage need no structural changes.** Their PageHeader, grid, empty state, buttons, and CTA now use semantic tokens.

- [x] **Step 6: Verify listing pages**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck clean; all unit tests pass; build succeeds.

---

### Task 7: Night game detail route

**Files:**

- Modify: `src/pages/GamePage.tsx`

**Interfaces:** No behavior, route, control, or accessible-name changes. `Restart game`, `Enter fullscreen`, `Exit fullscreen`, favorite labels, `No account · progress stays in this browser`, and external-game safety copy must remain byte-identical.

- [x] **Step 1: Migrate all panel and border classes**

Apply these exact replacements in `src/pages/GamePage.tsx`:

- `PlayerSkeleton` frame: `className="grid min-h-[440px] place-items-center rounded-3xl border border-line bg-night-900"`.
- `iconButtonClasses` inactive branch:

```ts
'border-line bg-raised text-muted hover:border-ink/25 hover:text-ink'
```

- Player stage: `className={cn('relative overflow-hidden rounded-3xl border border-line bg-night-950 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]', isFullscreen && 'rounded-none border-0')}`.
- External-game launcher panel (`bg-white/[0.025]` occurrences): use `border-line bg-raised/60`.
- How-to-play and Controls panels: `className="rounded-3xl border border-line bg-raised/60 p-5"`.
- Instruction number chip: `bg-sunken text-ink`.
- Control key chip: `border border-line bg-sunken`.
- About panel: `className="mt-6 rounded-3xl border border-line bg-raised/60 p-5"`.
- Sidebar metadata panel: `className="rounded-3xl border border-line bg-raised/60 p-4"`.
- Sidebar thumbnail frame: `border border-line`.
- Related card: `className="group flex gap-3 rounded-2xl border border-line bg-raised/60 p-2.5 transition hover:border-ink/25 hover:bg-sunken"`.
- Related thumbnail frame: `border border-line`.
- Related “Play” label: `text-brand`.
- Category link hover: `hover:text-brand`.
- Keep `text-mint`, `text-electric-*`, `text-plasma-*`, `text-coral`, `bg-coral/*`, `bg-night-950`, and the art overlays: they resolve to the night palette on this route.
- Replace any `text-muted/50`, `text-muted/60`, or `text-muted/70` outside a dark image overlay with `text-muted`. Text inside the thumbnail gradient keeps its `text-white/*` classes.

- [x] **Step 2: Verify the game route**

Run:

```bash
npm run typecheck
npm test
npm run build
npx playwright test e2e/gameplay.spec.ts --workers=2
```

Then confirm via preview that `/game/neon-snake` sets `<html data-theme="night">`, the header/footer are dark, and the h1 plus the exact status line are still present. The gameplay suite must still boot, pause, restart, mute, and clean up all 10 games; the styling change must not touch game logic.

---

### Task 8: Static pages, legal chrome and 404

**Files:**

- Modify: `src/pages/AboutPage.tsx`
- Modify: `src/pages/ContactPage.tsx`
- Modify: `src/pages/NotFoundPage.tsx`
- Modify: `src/pages/PrivacyPage.tsx`
- Modify: `src/components/legal/LegalPage.tsx`

**Interfaces:** No copy or route changes. Existing legal caveats and “not legal advice” warning must remain.

- [x] **Step 1: Restyle AboutPage cards**

In `src/pages/AboutPage.tsx`:

- Stat cards, value cards, and step rows: replace `border-white/10 bg-white/[0.025]` with `border-line bg-raised/60`; step rows use `bg-raised/40`.
- Value icon square: `border-brand/20 bg-brand/10 text-brand`.
- Step icon square: `border-plasma-500/20 bg-plasma-500/10 text-plasma-300`.
- Replace any `text-muted/50`, `text-muted/60`, or `text-muted/70` in this page with `text-muted`.
- Keep all text, icons, and the `CtaBand` at the end unchanged.

- [x] **Step 2: Restyle ContactPage**

In `src/pages/ContactPage.tsx`:

- Direct-email card and topic cards: `border-line bg-raised`.
- Email icon square: `bg-brand/10 text-brand`.
- “Copy address”/mail buttons already use Button variants.
- Warning callout: `className="mt-6 rounded-2xl border border-warning/25 bg-warning/10 p-5 text-sm leading-6 text-warning"`. Keep its text verbatim.
- `<code>` class: `rounded bg-sunken px-1.5 py-0.5 text-[12px]`.
- Right panel: replace `rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 sm:p-8` with `surface-card rounded-3xl p-6 sm:p-8`.
- Bottom note: `border-line bg-raised/60`.

- [x] **Step 3: Restyle legal chrome**

In `src/components/legal/LegalPage.tsx`:

- Warning callout: `className="mt-12 flex gap-3 rounded-2xl border border-warning/25 bg-warning/10 p-5 text-sm leading-6 text-warning"`.
- Keep the heading, description, updated date, and section markup unchanged.

In `src/pages/PrivacyPage.tsx`, replace every `border-white/10 bg-white/[0.04]` and `border-white/[0.08] bg-white/[0.03]` panel with `border-line bg-raised`.

Across `AboutPage`, `ContactPage`, `LegalPage`, and `PrivacyPage`, replace `text-muted/50`,
`text-muted/60`, and `text-muted/70` with `text-muted`.

- [x] **Step 4: Restyle the 404 page**

In `src/pages/NotFoundPage.tsx`:

- Background blob: `bg-brand/10`.
- Gamepad icon: `text-brand`.
- Quick links get `min-h-6` and `inline-flex items-center` (already inline-flex; add `min-h-6`).

- [x] **Step 5: Verify static pages**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck clean; all unit tests pass; build succeeds.

---

### Task 9: Accessibility, theme and responsive browser gates

**Files:**

- Modify: `package.json`, `package-lock.json`
- Create: `e2e/a11y.spec.ts`

**Interfaces:**

- Adds dev dependency `axe-core@^4.10.2` only.
- New E2E suite covers axe, route theme, overflow, and footer target size.

- [x] **Step 1: Install axe-core as a dev dependency**

Run:

```bash
npm install -D axe-core@^4.10.2
```

Expected: `package.json` gains `"axe-core": "^4.10.2"` under `devDependencies`; `npm audit` reports 0 vulnerabilities.

- [x] **Step 2: Create the accessibility and responsive spec**

Create `e2e/a11y.spec.ts`:

```ts
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const ROUTES = ['/', '/games', '/about', '/game/neon-apex'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`axe WCAG AA: ${route} at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.addScriptTag({ path: axePath });

      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected by addScriptTag
        const results = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          },
        });
        return results.violations
          .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.target.join(' ')),
          }));
      });

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
}

test('browsing routes use the day theme and game routes use night', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

  await page.goto('/games');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

  await page.goto('/game/neon-snake');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');

  expectNoErrors(errors);
});

for (const width of [390, 768, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of ['/', '/games', '/categories', '/about', '/game/neon-snake']) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test('footer links meet the 24px target minimum', async ({ page }) => {
  await page.goto('/');
  const heights = await page
    .locator('footer a')
    .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().height)));

  expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
});
```

- [x] **Step 3: Run the new gates**

Run:

```bash
npm run build
npx playwright test e2e/a11y.spec.ts --workers=2
```

Expected: all axe scans report zero critical/serious violations; both theme assertions pass; overflow is ≤ 1px; footer links are ≥ 24px. If axe reports a contrast or ARIA failure, fix the named component before continuing. Do not disable rules.

- [x] **Step 4: Run the existing browser suite**

Run:

```bash
npx playwright test --workers=2
```

Expected: the existing 37 tests plus the 14 new a11y/theme/overflow/target/search tests (51 total) all pass.

---

### Task 10: Credits, documentation, full verification and commit

**Files:**

- Create: `docs/research/UI-CREDITS.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-11-02-ui-refresh.md` (check off completed steps)
- Commit all modified files.

**Interfaces:** None.

- [x] **Step 1: Write the open-source credits**

Create `docs/research/UI-CREDITS.md` with:

```markdown
# UI credits and open-source provenance

The NeonRift Editorial Arcade refresh adapts layout and interaction *patterns* from
MIT-licensed projects. No source package, component runtime, icon set, or asset was
copied into this repository.

## shadcn/ui

- Repository: https://github.com/shadcn-ui/ui
- License: MIT
- Adapted patterns: card composition (border + radius + shadow), focus-visible ring
  treatment, and the accessible listbox/option structure used by the search combobox.
- Not added as a dependency: the project does not use React Hook Form, Radix primitives,
  or the shadcn CLI.

## Magic UI

- Repository: https://github.com/magicuidesign/magicui
- License: MIT
- Adapted patterns: the marquee layout and the bento grid composition.
- Not added as a dependency: the marquee is CSS keyframes with `prefers-reduced-motion`
  handling; no framer-motion or copied component code is used.

## Excluded

- React Bits (https://github.com/DavidHDev/react-bits): excluded because GitHub reports
  a non-standard `NOASSERTION` license. No patterns or code were used.

## Original work

All NeonRift color tokens, copy, game thumbnails, icons (Lucide, ISC), and game code are
original or already licensed in this repository. No third-party marketing copy was reused.
```

- [x] **Step 2: Run the complete verification suite**

Run each command and record the exact output:

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright test --workers=2
```

Expected: 0 vulnerabilities; typecheck clean; all unit tests pass (49 baseline plus 21 new — 4 theme and 17 combobox — for 70 total); build succeeds with only the known Three.js chunk-size warning; all browser tests pass (37 baseline plus 14 new for 51 total).

- [x] **Step 3: Capture and inspect the refreshed pages**

With the preview server running on `http://127.0.0.1:4175`, capture every page type in the refreshed theme:

```bash
mkdir -p test-results/ui-after
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/ test-results/ui-after/home-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/games test-results/ui-after/games-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/category/racing test-results/ui-after/category-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/categories test-results/ui-after/categories-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/popular test-results/ui-after/popular-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/new test-results/ui-after/new-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/favorites test-results/ui-after/favorites-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/recently-played test-results/ui-after/recently-played-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/game/neon-apex test-results/ui-after/gamepage-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/about test-results/ui-after/about-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/contact test-results/ui-after/contact-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/privacy test-results/ui-after/privacy-desktop.png
npx playwright screenshot --viewport-size="1440,900" --full-page http://127.0.0.1:4175/not-a-real-page test-results/ui-after/not-found-desktop.png
npx playwright screenshot --viewport-size="390,844" --full-page http://127.0.0.1:4175/ test-results/ui-after/home-mobile.png
npx playwright screenshot --viewport-size="390,844" --full-page http://127.0.0.1:4175/game/neon-apex test-results/ui-after/gamepage-mobile.png
```

Inspect each image for: readable light surfaces, dark game route, no clipped headlines, no
overlapping cards, visible focus states, and no horizontal scrolling. Compare with the
`test-results/ui-audit/*.png` baseline captured during the audit.

- [x] **Step 4: Record verification in README**

Add a short section under the existing verification/testing notes:

```markdown
### Editorial Arcade refresh (2026-11-02)

- Browsing routes render on the light Editorial Arcade shell; `/game/:slug` renders the dark
  night palette via `data-theme`.
- Search is a WAI-ARIA combobox with Arrow/Home/End/Enter/Escape support.
- Footer links meet the 24px WCAG 2.2 target minimum.
- axe-core WCAG 2.2 AA scans report zero critical/serious violations on `/`, `/games`,
  `/about`, and `/game/neon-apex` at 1440px and 390px.
- Verification: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`,
  `npx playwright test --workers=2` all pass. Record the exact test counts from the run.
```

Replace the final sentence with the actual counts printed by Step 2. Do not invent numbers.

- [x] **Step 5: Review the diff before committing**

Run:

```bash
git status --short
git diff --stat
git diff -- src/index.css src/lib/theme.ts src/components/search/SearchBar.tsx
```

Confirm: no secrets, no `test-results/` artifacts, no changes under `src/games/`, no deleted
game files, and the only new dependency is `axe-core` in `devDependencies`.

- [x] **Step 6: Create the single wave commit**

Stage the changed files explicitly (not `git add -A`):

```bash
git add index.html package.json package-lock.json README.md \
  src/index.css src/main.tsx src/App.tsx \
  src/lib/theme.ts src/lib/theme.test.ts src/lib/combobox.ts src/lib/combobox.test.ts \
  src/components/brand/Logo.tsx \
  src/components/layout/Header.tsx src/components/layout/Footer.tsx \
  src/components/layout/MobileTabBar.tsx src/components/layout/SiteLayout.tsx \
  src/components/search/SearchBar.tsx \
  src/components/ui/Button.tsx src/components/ui/Badge.tsx src/components/ui/SectionHeader.tsx \
  src/components/ui/PageHeader.tsx src/components/ui/CtaBand.tsx src/components/ui/EmptyState.tsx \
  src/components/analytics/ConsentBanner.tsx src/providers/ToastProvider.tsx \
  src/components/errors/AppErrorBoundary.tsx src/components/game/GameErrorBoundary.tsx \
  src/components/ads/AdSlot.tsx \
  src/components/game/GameCard.tsx src/components/game/GameGrid.tsx \
  src/components/game/GameRail.tsx src/components/game/GameToolbar.tsx \
  src/components/game/GameMarquee.tsx src/components/legal/LegalPage.tsx \
  src/pages/HomePage.tsx src/pages/GamesPage.tsx src/pages/CategoryPage.tsx \
  src/pages/CategoriesPage.tsx src/pages/NewPage.tsx src/pages/PopularPage.tsx \
  src/pages/FavoritesPage.tsx src/pages/RecentlyPlayedPage.tsx src/pages/GamePage.tsx \
  src/pages/AboutPage.tsx src/pages/ContactPage.tsx src/pages/NotFoundPage.tsx \
  src/pages/PrivacyPage.tsx \
  e2e/navigation.spec.ts e2e/a11y.spec.ts \
  docs/research/UI-CREDITS.md docs/superpowers/plans/2026-11-02-ui-refresh.md

git commit -m "$(cat <<'EOF'
Refresh the NeonRift UI with the Editorial Arcade theme

Move browsing routes to a warm light shell and keep game routes dark and
immersive. Fix the search input's ARIA contract with a full combobox and
keyboard navigation, and raise footer links to the WCAG 2.2 target size.
Add axe-core browser gates, theme/overflow checks, and open-source credits.
EOF
)"
```

Do not push. Do not deploy. Report the commit hash.

- [x] **Step 7: Final status check**

Run:

```bash
git status --short
git log --oneline -3
```

Expected: clean working tree; HEAD is the new commit on `feature/platform-hardening`; the two prior hardening/design commits remain untouched.

---

## Self-review checklist

- Spec coverage: theme tokens and route switching (Task 1), combobox and keyboard (Task 2), chrome/primitives (Task 3), cards/grids (Task 4), home marquee/bento/categories (Task 5), listing pages (Task 6), dark game route (Task 7), static pages (Task 8), axe/responsive/target gates (Task 9), credits/docs/commit (Task 10).
- No placeholder steps: every code step contains the literal code or exact class replacement.
- Type consistency: `Theme`, `themeForPath`, `applyTheme`, `nextOptionIndex`, `edgeOptionIndex`, `shouldShowPanel`, `resolveComboboxKey`, `ComboboxKeyAction`, `GameCard size`, and `ButtonVariant 'inverse'` are introduced once and reused with the same names.
- Contrast: no `text-muted/50–/70` on a page surface; placeholder text uses the full `--nr-muted` token; accent colors are not used as standalone text on paper.
- Test impact: the only intentional selector change is `searchbox` → `combobox`; all other E2E accessible names are preserved. Unit total 70 (49 + 21); browser total 51 (37 + 14).
- Constraints: no game logic changes, no runtime dependencies, no push/deploy, one commit at the end.
