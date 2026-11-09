# NeonRift final development report — Wave 2 and platform quality

- Date: 2026-11-09
- Branch: `feat/games-wave2`
- Scope: the six-game Wave 2 slate, platform hardening (Phases B–C), Neon Craft
  release (Phase D), Wave 2B/2C delivery (Phase E) and the quality pass (Phase F)
- Evidence: every figure below comes from a command run on 2026-11-09; commands are
  listed in §3 so the results can be reproduced.

## 1. Result

NeonRift now ships **38 original browser games** with catalogue entries, original key art,
dashboard integration and automated coverage. The 2026-11-07 repository audit baselined 32
games, already including the five Wave 1 titles (Rift Chess, Neon Rush, Lawn Protocol, Apex
Time Trial, Street Cricket). This programme added the six Wave 2 games: Neon Craft (sub-wave
2A), Rift Rally and Neon Duel (2B, taking the catalogue to 35), then Riftfall, Rift Life and
Rift Ecology (2C, taking it to 38).

The 1000-game target is a documented programme, not a shipped library: 38 games exist today
and 962 are planned in
[`../games/1000-game-expansion-program.md`](../games/1000-game-expansion-program.md).
No placeholder catalogue records exist.

## 2. What shipped in Wave 2

| Sub-wave | Game | Category | Rendering | Tests |
|---|---|---|---|---|
| 2A | Neon Craft | Simulation | Three.js voxel engine | Unit suites for blocks, mining, crafting, combat, streaming, saves plus a dedicated browser lifecycle |
| 2B | Rift Rally | Racing | Three.js | 31 unit tests across track, physics, ghost and shell |
| 2B | Neon Duel | Action | Canvas 2D | 52 unit tests across fighters, combat, match, AI, session, render and shell |
| 2C | Riftfall | Action | Canvas 2D | 36 unit tests across arena simulation, weapons/upgrades, render and shell |
| 2C | Rift Life | Adventure | React | 27 unit tests across the day/slot calendar, relationships, endings and shell |
| 2C | Rift Ecology | Simulation | React + SVG | 27 unit tests across the population model and shell |

Each Wave 2 game has deterministic, seeded rules with pure unit tests, a playable shell, an
original SVG thumbnail, catalogue instructions and controls that match the real inputs, and a
boot/start/input case in the shared browser gameplay matrix. Wave 2B and 2C cases also appear
in the catalogue boot matrix, the axe sweep and the sitemap checks.

Key commits: `f11e051` (Wave 2B registration), `f02f28e` (Rift Ecology), `fd9faf8` (Wave 2C
registration and documentation) and `1c570c8` (quality pass).

## 3. Verification snapshot (2026-11-09)

| Command | Result |
|---|---|
| `npm run typecheck` | Passed with no output |
| `npm test` | 1079 tests passed in 123 files |
| `npm run build` | Passed; entry 285.69 kB raw / 91.15 kB gzip; every game is a lazy chunk |
| `npm run check:bundle` | Passed; initial assets 128.0 kB gzip against a 170 kB budget, 38 lazy game chunks, every chunk within 600 kB raw |
| `npx playwright test --workers=2` | 196 tests passed in 15 spec files |
| `npm run build:consent` | Passed; used by the configured-consent matrix |
| `npm run check:bundle --initial-kb=1` | Fails as intended (exit 1), proving the guard is enforced |

## 4. Defects found and fixed

Every repaired gameplay defect has a regression test that failed before the fix:

- **Phase C game defects:** ten backlogged issues across the 2D and 3D games, plus the two
  baseline browser failures (Reaction Time hidden-tab round, Apex Time Trial teardown).
  Each is covered by a unit or browser test retained as a gate.
- **Phase D Neon Craft:** Bedrock protection on edits, DDA raycast, controller and mining
  behaviour, crafting progress, farming and save/resume were corrected and covered.
- **Phase E Wave 2:** rules bugs found by deterministic simulation tests were fixed during
  each game's own task, before integration.
- **Phase F accessibility:** the full axe sweep over all 38 game routes found one serious
  colour-contrast violation on the Reaction Time Challenge round chips (9 px labels dimmed by
  `opacity-60`). The dimming was removed in
  [`src/games/reaction-time/ReactionTimeGame.tsx`](../../src/games/reaction-time/ReactionTimeGame.tsx);
  the sweep now passes on desktop and mobile. The route list is generated from the shared
  `GAMES` fixture, so the gate grows with the catalogue.

## 5. Accessibility

- axe-core WCAG 2.2 AA runs against 41 routes (home, listing, about and **all 38 game
  routes**) at 1440×900 and 390×844 — 82 scans per run — plus focus, overflow, touch-target
  and combobox checks.
- Game overlays use `role="dialog"`, `aria-modal` and a label; they take focus on open and
  return it to the frame on close. Simulations expose a polite `role="status"` summary
  instead of per-frame announcements.
- Reduced-motion handling is honoured by the canvas games that animate continuously.

## 6. Performance and code splitting

- Every game is registered through `lazy()` and builds as its own chunk; the bundle guard
  asserts exactly one lazy chunk per published game and that no game or Three.js chunk is
  preloaded by `index.html`.
- The shared Three.js chunk is 553.9 KiB raw / ~141 kB gzip and loads only when a 3D game
  opens. Three.js ships as a single module, so the enforced 600 kB chunk budget is the guard
  against further growth rather than an artificial warning.
- Simulations avoid per-frame React state: mutable state lives in refs and a reducer drives
  HUD updates at 10 Hz.

## 7. SEO, advertising and privacy

- `vite.config.ts` emits `sitemap.xml` and `robots.txt` at build time from the published
  catalogue. New browser checks verify that every published game, static page and category
  appears exactly once, that every listed game route is served, and that robots blocks
  `/admin`, `/favorites` and `/recently-played` while pointing at the sitemap.
- Advertising is off by default. A unit guard asserts that the shipped build has no client,
  no slots and no placement renderable even with consent. The configured-consent matrix
  intercepts Google hosts and proves nothing loads before a decision, that each category is
  independent, that choices survive reloads, and that withdrawal removes the loader.
- Analytics is likewise consent-gated. The CSP remains report-only; it is a collector, not an
  enforced policy.

## 8. Testing approach

- Rules are written as pure functions with seeded randomness and tested before the shell.
- Balance is tuned with simulation-first tests; target values are not adjusted to make a test
  pass.
- Shell tests run under jsdom and exercise start, pause, restart, completion, unmount and
  console cleanliness.
- The browser matrix boots all 38 games, starts them, exercises input, and verifies clean
  teardown; dedicated suites cover the games with deep lifecycles (Neon Craft, Rift Chess,
  Rift Rally, Neon Duel, sports games).

## 9. Known limitations

- Progress, favorites and records are browser-local. There are no accounts, cloud saves,
  online opponents or global leaderboards.
- A complete 60-day Rift Ecology season, 21-day Rift Life run or 12-wave Riftfall run is not
  automated end to end in a browser; their rules are covered by unit tests and their shells by
  browser boot/start/input checks. Neon Craft's progression is unit-tested rather than played
  to completion.
- The CSP is report-only; enforcement needs a report collector and a clean report period.
- Three.js cannot be split below its single-module build; the chunk budget is the guard.
- The 1000-game target requires 962 more authored variants at an honest cadence of 10–20 per
  month; the programme document records that trade-off.

## 10. Next

1. Phase 1 of the expansion programme: catalogue scale foundation (chunked index, manifest
   generator, generated boot sweep, search pagination).
2. Phases 2–9: 962 real variants across 27 kit families, each gated by the same rules,
   accessibility and browser checks used here.

## 11. Commands

```bash
npm run typecheck
npm test
npm run build
npm run check:bundle
npx playwright test --workers=2
```
