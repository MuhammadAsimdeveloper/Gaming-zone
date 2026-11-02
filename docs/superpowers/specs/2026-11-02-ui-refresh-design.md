# NeonRift UI/UX refresh — Editorial Arcade

- Date: 2026-11-02
- Status: Approved in chat; awaiting spec review
- Branch: `feature/platform-hardening`
- Scope owner: NeonRift platform

## Context

The current interface is a cohesive dark-neon theme, but nearly every surface is the same
near-black. Hierarchy depends on glow rather than layout, contrast, or color. The audit also
found one critical accessibility defect and two usability gaps:

- Search inputs set `aria-expanded` without combobox semantics (axe `aria-allowed-attr`, two
  nodes on the homepage).
- Search suggestions cannot be navigated by keyboard.
- Footer links are 17px tall, below the WCAG 2.2 24px target minimum.
- No browser console errors or horizontal overflow were found across 8 pages at 1440px and
  390px.

## Goal

Move the browsing experience to a warm, light, editorial arcade shell while keeping the game
route dark and immersive. Fix the accessibility defects as part of the same change. Preserve
all game logic, catalogue data, routes, consent behavior, ads behavior, and the existing 10
games.

## Non-goals

- No game engine, gameplay, physics, or canvas changes.
- No new games or catalogue content.
- No new runtime dependencies.
- No backend, accounts, leaderboards, or monetization changes.
- No changes to analytics/advertising consent semantics.
- No public deployment or force-push.

## Direction

**Editorial Arcade** (approved): warm bone canvas, ink typography, art-first cards, offset
shadows, color-blocked category tiles, a CSS marquee, and a dark player route. Open-source
patterns are adapted from MIT-licensed repositories, not installed as runtime packages.

## Architecture

### Theme switching

- Add semantic CSS variables for surface, raised surface, sunken surface, ink, muted, line,
  and accent roles.
- `:root` and `[data-theme='day']` use the light palette.
- `[data-theme='night']` uses the existing night palette.
- `SiteLayout` sets `document.documentElement.dataset.theme` to `night` for paths beginning
  `/game/`, and `day` otherwise. Use `useLayoutEffect` so the theme is applied before paint,
  and update `color-scheme` plus the `theme-color` meta in the same pass.
- Components consume semantic tokens (`bg-surface`, `text-ink`, `border-line`, etc.) instead
  of hard-coded `night-*` values. Night-only art panels may still use `night-*`.
- Body background and texture are token-driven. The dark route covers the full viewport.

### Tokens

Light:

| Token | Value |
|---|---|
| surface | `#F5F1E6` |
| surface-raised | `#FFFDF7` |
| surface-sunken | `#EAE4D5` |
| ink | `#14161C` |
| ink-soft | `#3B3F4A` |
| muted | `#5D6270` |
| line | `rgba(20, 22, 28, 0.14)` |
| electric | `#2E5BFF` |
| plasma | `#7C3AED` |
| coral | `#D92D4A` |

Night:

| Token | Value |
|---|---|
| surface | `#070B16` |
| surface-raised | `#0C1322` |
| surface-sunken | `#050814` |
| ink | `#F2F5FF` |
| muted | `#A2AEC7` |
| line | `rgba(255, 255, 255, 0.12)` |
| electric | `#6BA4FF` |
| plasma | `#B285FF` |
| coral | `#FF6B81` |

Category and game accents remain data-driven. They are used as block fills or borders with
ink text, never as small text on paper unless darkened via `color-mix`.

### Visual language

- Display type: Space Grotesk; body: Inter (both already self-hosted).
- Hero: `clamp(2.8rem, 6vw, 5rem)`, tight tracking, balanced wrapping.
- Cards: 24px radius, 1px line, ink offset shadow, no neon glow in light mode.
- Sections: numbered/letter-spaced eyebrows, generous vertical rhythm, thin rules.
- Texture: CSS dot grid at low ink opacity; no image assets.
- Motion: CSS-only fade-up, hover lift, and marquee. Reduced motion disables all of it.

## Page composition

### Home

1. Editorial hero: left copy, search, dual CTAs and real trust points; right featured-game
   cabinet with category sticker, play CTA, and two real stat cards.
2. CSS marquee of the 10 real game titles and categories.
3. Continue playing rail when local history exists.
4. Trending bento: one large card plus three standard cards from the existing popular sort.
5. Category tiles: six populated categories, accent block per category, name and real count.
6. New releases rail.
7. Recommendation grid using the existing local-signal logic.
8. Ink CTA panel with existing copy and routes.

### Games, category, search

- Paper filter bar with ink active chips.
- Responsive 3/4-column game grid.
- Outline "Load more" control.
- Empty states remain honest and use existing copy.

### Game detail

- Entire route uses `data-theme='night'`.
- Preserve the existing breadcrumb, title area, toolbar, player card, setup sidebar,
  how-to/controls panels, and related games.
- Restyle surfaces, badges, buttons, focus rings, and related cards for the night palette.
- No change to game loading, pause, restart, fullscreen, mute, or error boundaries.

### Static pages and 404

- Shared light page header, editorial prose width, and paper callout panels.
- No new claims or fake metrics.

### Header, footer, mobile tab bar, consent

- Light paper header and footer with ink active states; night variants on game routes.
- Footer links get a minimum 24px hit area.
- Mobile tab bar uses paper with an ink active pill; night variant on game routes.
- Consent banner uses semantic surfaces and remains fully keyboard accessible.

## Interactions and accessibility

### Search combobox

Implement WAI-ARIA combobox behavior in the existing `SearchBar`:

- Input: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant` when an option is active.
- Suggestions: `role="listbox"` and `role="option"` with stable IDs.
- Keyboard: ArrowDown/ArrowUp cycle, Home/End jump, Enter opens the active result, Escape
  closes the panel and returns focus to the input.
- Announce the result count with a visually hidden `role="status"`.
- Keep the existing Ctrl/Cmd+K and `/` shortcuts.
- Pointer hover updates the active option; clicking still navigates.

### Other fixes

- Favorite buttons: 40px on touch, visible focus ring, `aria-pressed` preserved.
- Focus: 2px electric ring with 2px offset on paper; white ring on night.
- Skip link remains first in the tab order.
- Category accents never carry small text below AA contrast.
- All existing accessible names used by E2E tests stay stable, or tests are updated with the
  new visible labels.

## Open-source use

- **shadcn/ui** (MIT): adapt card composition, focus-visible treatment, and accessible menu
  structure.
- **Magic UI** (MIT): adapt marquee and bento layout patterns using CSS, without framer-motion
  or copied assets.
- Do not use React Bits: GitHub reports a non-standard `NOASSERTION` licence.
- Add `docs/research/UI-CREDITS.md` with repository URLs, licence names, and a precise list
  of adapted patterns.
- No runtime packages are added. `axe-core` is added as a dev dependency only.

## File plan

- Theme and utilities: `src/index.css`, `src/components/layout/SiteLayout.tsx`.
- Shared chrome: `Header`, `Footer`, `MobileTabBar`, `Logo`, `SearchBar`, `ConsentBanner`.
- Primitives: `Button`, `Badge`, `SectionHeader`, `PageHeader`, `CtaBand`, `EmptyState`,
  `Container`.
- Catalogue: `GameCard`, `GameGrid`, `GameRail`, `GameThumbnail` fallback.
- Pages: `HomePage`, `GamesPage`, `CategoryPage`, `CategoriesPage`, `NewPage`, `PopularPage`,
  `FavoritesPage`, `RecentlyPlayedPage`, `GamePage`, `AboutPage`, `ContactPage`, `NotFoundPage`,
  and legal page chrome.
- Tests: new combobox unit tests, new axe Playwright spec, updated selectors where needed.
- Docs: this spec, `UI-CREDITS.md`, README verification notes.

## Testing

1. Unit tests for combobox open/close, active option, arrow keys, Enter, Escape, Home/End.
2. Unit tests for the night-theme path decision if extracted into a helper.
3. Playwright axe scan on `/`, `/games`, `/game/neon-apex`, and `/about` at desktop and mobile.
   Require zero critical or serious violations.
4. Existing 49 unit tests and 37 browser tests must pass.
5. Responsive checks at 390px, 768px, and 1440px with no horizontal overflow.
6. Visual capture of every page type before and after; manual inspection.
7. `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test --workers=2`.

## Risks and mitigations

- **Theme leakage:** token-driven colors plus an explicit route switch; screenshot both themes.
- **Test breakage:** keep accessible names stable; update only where labels intentionally move.
- **Marquee distraction:** pause on hover/focus, `prefers-reduced-motion` disables it.
- **Contrast regressions:** axe gate plus manual ratio checks for new pairings.
- **Bundle growth:** CSS-only approach; axe stays in dev dependencies.

## Definition of done

- Browsing routes render on the light Editorial Arcade shell; game routes render dark.
- All 10 games still boot, play, pause, restart, mute, and clean up.
- Search is a working keyboard-accessible combobox.
- axe reports zero critical/serious violations on the audited pages.
- No horizontal overflow at 390px, 768px, or 1440px.
- Typecheck, 49+ unit tests, build, and 37+ browser tests pass.
- UI credits and README verification notes are committed.
- Changes are committed on `feature/platform-hardening`; nothing is pushed or deployed.
