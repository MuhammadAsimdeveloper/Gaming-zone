# NeonRift

A free, instant-play browser gaming portal. Original branding, original games, no account and no download.

**Status:** the platform and 39 internal games are implemented, including the six-game Wave 2 slate: Neon Craft, Rift Rally, Neon Duel, Riftfall, Rift Life and Rift Ecology, plus Neon Coast: After Hours, an original one-district adventure shipped on 2026-11-09. The 50-game research and 15-game design package is complete in [`docs/research/`](docs/research/README.md). Five of the 15 shortlisted games are shipped — Rift Chess, Neon Rush, Lawn Protocol, Apex Time Trial and Street Cricket — completing Wave 1; the rest remain designs. The six-game Wave 2 spec (2026-11-04) is fully shipped: Neon Craft released on 2026-11-07, Rift Rally and Neon Duel on 2026-11-08, and Riftfall, Rift Life and Rift Ecology on 2026-11-09. The path to a 1000-game library is defined in the [1000-game expansion program](docs/games/1000-game-expansion-program.md): 39 shipped, 961 planned across 27 kit families, with no placeholder entries.

---

## Stack

- React 19 + TypeScript 5.9 (strict)
- Vite 8
- Tailwind CSS 4
- React Router 7
- Three.js 0.187 for 3D games
- Vitest 5 + Playwright 1.64
- LocalStorage for preferences and local records
- GitHub Actions CI, static hosting target: Cloudflare Pages

No backend, database, account system or paid service is required.

---

## Commands

```bash
npm install
npm run dev        # local development server
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests
npm run build      # typecheck + production build to dist/
npm run preview    # preview the production build
npm run build:consent   # second build with analytics + ads configured, to dist-consent/
npm run preview:consent # preview the configured-consent build
npm run test:e2e   # build, then Playwright browser tests against the preview
npm run check:bundle # enforce the initial and per-chunk bundle budgets against dist/
```

Playwright also builds and serves `dist-consent` on port 4176 automatically; the
configured-consent matrix uses it to prove provider loading against a build where
analytics and advertising are actually configured. Both provider hosts are
intercepted, so no test contacts Google.

Node 20+ is required. The project is developed on Node 24.

Playwright's Chromium is the only browser target in CI. Install it once with
`npx playwright install chromium` before running `npm run test:e2e` locally.

---

## Verification snapshot (2026-11-09)

The full programme report is in
[`docs/audits/2026-11-09-final-report.md`](docs/audits/2026-11-09-final-report.md).

| Command | Result |
|---|---|
| `npm ci` | Completed previously; lockfile unchanged |
| `npm run typecheck` | Passed with no output |
| `npm test` | 1176 tests passed in 136 files |
| `npm run build` | Passed; Rift Rally loads as its own 46.87 kB / 14.75 kB gzip chunk, Neon Duel as 48.95 kB / 15.05 kB gzip, Neon Craft as 143.92 kB / 43.63 kB gzip and Neon Coast as 55.24 kB / 17.89 kB gzip; the shared Three.js chunk is 567.22 kB raw / 140.83 kB gzip and is neither preloaded nor part of the initial bundle |
| `npm run check:bundle` | Passed; initial assets 128.7 kB gzip against a 170 kB budget, 39 lazy game chunks, every chunk within the 600 kB raw budget |
| `npm run build:consent` | Passed; same chunks with analytics and AdSense identifiers configured |
| `npx playwright test --workers=2` | 196 tests passed in 15 files |

The browser suite covers the homepage, catalogue, search, category filters, all thirty-nine game pages,
an axe-core WCAG 2.2 AA scan of every game route at desktop and mobile widths, sitemap and
robots.txt contents, launch/pause/resume/restart, favorites after reload, recently played, fullscreen state, 404,
mobile navigation, the absence of analytics/ad scripts in the default build, error-boundary
recovery, hidden-tab fairness, keyboard and touch input for the 2D games, and 2D game
completion/game-over. The configured-consent matrix runs against a second build and checks,
with both provider hosts intercepted, that nothing loads before a decision, each category is
independent, denials and grants survive a reload, and clearing a choice revokes only that
provider. A separate CSP check confirms the report-only policy is served, that five key
routes raise no `securitypolicyviolation` events in the default build, and that the
configured build stays clean once both consents are allowed. The seven 3D games are verified
for loading, pause/resume, restart, mute
and route-away console cleanliness. Rift Rally's browser case starts a race, checks the
canvas, mute toggle and paused dialog; Neon Duel's starts a ladder match, fires an attack and
checks the paused dialog; Riftfall's starts a run, checks the canvas, mute toggle and the
paused dialog's resume control; Rift Life's starts a 21-day run and takes a work shift; Rift
Ecology's starts a season, plants Glow Kelp and advances a day. Neon Craft also has a dedicated browser lifecycle:
create a seeded world, open the crafting panel, resume, save, reload, resume the same world,
delete it, and fall back to an unsaved world when IndexedDB is unavailable; its touch
controls are exercised on a mobile viewport. The other 3D games' action keys are covered by
unit-level keyboard-capture tests, not by a full browser playthrough, and a complete race,
time trial, match or over is not automated. Neon Craft's mining, crafting progression,
combat and farming loops are covered by unit tests, not played to completion in a browser.
Neon Coast's ten-case browser spec walks and drives the coupe, runs Tideglass Courier from
pickup to delivery on foot with real key events, checks the results panel and reward,
reloads the browser-local save, rejects a corrupt save, pauses, resumes, restarts, toggles
the game's fullscreen control, resizes, leaves the route, and holds 44 px touch controls on
a 390 px viewport. The cycle also fixed three 3D defects with regression tests: unreachable
Neon City Drive checkpoints, mute state resetting on reload, and finished runs that kept
simulating, rendering and playing audio behind the results screen.
No game is described as manually played beyond what these tests exercised.

CI runs on every pushed branch and every pull request in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Editorial Arcade refresh (2026-11-02)

- Browsing routes render on the light Editorial Arcade shell; `/game/:slug` renders the dark
  night palette via `data-theme`.
- Search is a WAI-ARIA combobox with Arrow/Home/End/Enter/Escape support.
- Footer links meet the 24px WCAG 2.2 target minimum.
- axe-core WCAG 2.2 AA scans report zero critical/serious violations on `/`, `/games`,
  `/about`, and `/game/neon-apex` at 1440px and 390px.
- Verification: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`,
  `npx playwright test --workers=2` — 407 unit tests and 76 browser tests, all passing.

---

## Routes

| Path | Page |
|---|---|
| `/` | Home |
| `/games` | All games with search, filters and sorting |
| `/popular` | Popular ordering |
| `/new` | Newest ordering |
| `/categories` | Category index |
| `/category/:categoryId` | Category listing |
| `/game/:slug` | Reusable game player |
| `/favorites` | Locally saved favourites |
| `/recently-played` | Locally tracked recent games |
| `/about`, `/contact`, `/privacy`, `/terms` | Informational and legal pages |
| `*` | 404 |

---

## Implemented games

| Game | Category | Technology |
|---|---|---|
| Neon Snake | Arcade | Canvas 2D |
| Tic-Tac-Toe | Strategy | React |
| Memory Match | Puzzle | React |
| Rock Paper Scissors | Casual | React |
| Reaction Time Challenge | Casual | React |
| Rift Breaker | Arcade | Canvas 2D |
| Math Sprint | Educational | React |
| Neon Apex | Racing | Three.js |
| Rift Striker | Sports | Three.js |
| Neon City Drive | Racing | Three.js |
| Neon Harvest | Simulation | React |
| Rift Transit | Simulation | React |
| Grid Supply | Simulation | React |
| Rift Colony | Simulation | React |
| Orbit Market | Simulation | React |
| Neon Diner | Simulation | React |
| Skyport | Simulation | React |
| Rift Hospital | Simulation | React |
| Park Pulse | Simulation | React |
| Factory Line | Simulation | React |
| Cargo Ring | Simulation | React |
| Aqua Grid | Simulation | React |
| Signal Stack | Puzzle | React |
| Rift Runner | Arcade | Canvas 2D |
| Rift Tactics | Strategy | React |
| Rift Chess | Strategy | React DOM + chess.js |
| Neon Rush | Arcade | Canvas 2D |
| Penalty Protocol | Sports | Canvas 2D |
| Hoop Circuit | Sports | Canvas 2D |
| Lawn Protocol | Strategy | Canvas 2D |
| Apex Time Trial | Racing | Three.js |
| Street Cricket | Sports | Three.js |
| Neon Craft | Simulation | Three.js |
| Rift Rally | Racing | Three.js |
| Neon Duel | Action | Canvas 2D |
| Riftfall | Action | Canvas 2D |
| Rift Life | Adventure | React |
| Rift Ecology | Simulation | React + SVG |
| Neon Coast: After Hours | Adventure | Canvas 2D |

All thirty-nine are original implementations. No commercial game assets, code or branding are used.
Rift Chess uses the open-source chess.js library (BSD-2-Clause) for move generation; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## Research and design package

The full deliverable is indexed at [`docs/research/README.md`](docs/research/README.md):

- 50-game research report with sourced findings and explicit verification limits.
- Weighted shortlist of the best 15 concepts.
- 15 game design documents with features, architecture, milestones, testing and limitations.
- Licence audit, source-repository directory, technical architecture and delivery roadmap.
- Six-game Wave 2 design spec (2026-11-04): Neon Craft plus Rift Rally, Neon Duel, Riftfall, Rift Life and Rift Ecology. All six are shipped — Neon Craft on 2026-11-07, Rift Rally and Neon Duel on 2026-11-08, and Riftfall, Rift Life and Rift Ecology on 2026-11-09. See [`docs/superpowers/specs/2026-11-04-games-wave2-design.md`](docs/superpowers/specs/2026-11-04-games-wave2-design.md).
- [1000-game expansion program](docs/games/1000-game-expansion-program.md): kit and variant architecture, the 27-family portfolio allocation to 1000 games, the nine-phase roadmap, quality gates, catalogue scaling and licensing policy. 39 games carry catalogue entries today; the remaining 961 are planned, not shipped.
- [Neon Coast: After Hours design and verification](docs/games/neon-coast.md): the Vela district, missions, persistence, tested behaviour and measured size.
- [25-game enhancement report (2026-11-05)](docs/ENHANCEMENT-REPORT-2026-11-05.md): verified fixes, a per-game status table and a prioritized file-specific backlog.

Start with the [package index](docs/research/README.md).

---

## Configuration

Configuration is optional and read from Vite environment variables at build time. Nothing is required to run the existing games.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_SITE_URL` | Canonical site URL | `https://neonrift.pages.dev` |
| `VITE_CONTACT_EMAIL` | Address shown on the contact page | empty |
| `VITE_GA_MEASUREMENT_ID` | Analytics ID; analytics stays idle when empty | empty |
| `VITE_EXTERNAL_GAME_ORIGINS` | Comma-separated HTTPS origins approved for embedding | empty |
| `VITE_ADS_ENABLED` | Enables ad slots when exactly `true` | disabled |
| `VITE_ADSENSE_CLIENT` | AdSense client ID | empty |
| `VITE_ADSENSE_SLOT_*` | Ad slot IDs per placement | empty |

Do not commit `.env` files. The `.gitignore` already excludes them.

**Admin note:** no admin route, dashboard or authentication is shipped in this build, and no browser passcode mechanism exists. `src/lib/adminStore.ts` only merges optional local catalogue overrides that a visitor's own browser stores; it is a local convenience, not a security control. A real multi-user administration system would need a separately approved backend and authentication architecture, which this static project does not have. See `docs/research/ROADMAP.md` for the planned honest admin work.

---

## Deployment

Cloudflare Pages (not deployed by this repository):

```text
Build command:    npm run build
Output directory: dist
Node version:     20+
```

The build is a static site. `public/_redirects` provides the SPA fallback for deep links, and `public/_headers` sets baseline security headers plus a **report-only** Content-Security-Policy. The policy is not enforced; it is served by the preview server from the same `public/_headers` line and reports violations so the remaining directives can be tightened safely. See [`docs/audits/2026-11-07-csp-evaluation.md`](docs/audits/2026-11-07-csp-evaluation.md).

---

## Next games

Three tracks are queued. **Only the shipped games have catalogue entries.**

- **1000-game expansion program (2026-11-06):** kit and variant architecture plus a
  nine-phase roadmap from 39 to 1000 tested games. Phase 1 is the catalogue scale
  foundation; Phase 2 covers the Wave 2 slate. See
  [`docs/games/1000-game-expansion-program.md`](docs/games/1000-game-expansion-program.md).
- **Wave 2 six-game slate (2026-11-04):** Neon Craft, Rift Rally, Neon Duel, Riftfall, Rift
  Life and Rift Ecology, split into three sub-waves. All three sub-waves are shipped: Neon
  Craft (2A) on 2026-11-07, Rift Rally and Neon Duel (2B) on 2026-11-08, and Riftfall, Rift
  Life and Rift Ecology (2C) on 2026-11-09. See
  [`docs/superpowers/specs/2026-11-04-games-wave2-design.md`](docs/superpowers/specs/2026-11-04-games-wave2-design.md).
- **Wave 1:** complete as of 2026-11-07 — Rift Chess, Neon Rush, Lawn Protocol, Apex Time
  Trial and Street Cricket are shipped, integrated and tested.
- **Neon Coast cycle (2026-11-09):** the one-district vertical slice is shipped with three
  handcrafted missions plus a repeatable glow run, browser-local progression and touch
  controls. Further districts are designed as data, not shipped.

---

## Limitations

- Progress, favourites and records are stored in this browser only. There is no account or cloud save.
- Full 3D race/match completion is not covered by automated tests and has not been manually played to the end. Load, controls, pause/resume, restart, mute and cleanup are covered. Neon Craft's save/resume/delete lifecycle is covered in a browser; its mining, crafting, combat and farming progression is covered by unit tests, not played to completion.
- Clearing site data removes local progress.
- No admin dashboard or authentication is shipped. No browser passcode exists. `adminStore.ts` only applies optional local catalogue overrides from this browser; it is not authentication and is never a server-side admin feature.
- Ads are disabled by default. No ad script loads unless ads are explicitly enabled, configured, and advertising consent is granted.
- Analytics is disabled by default and loads only after analytics consent is granted.
- External game embedding is deny-by-default and requires an explicit HTTPS allowlist.
- Five of the 15 shortlist games are shipped (Rift Chess, Neon Rush, Lawn Protocol, Apex Time Trial, Street Cricket); the remaining ten are designs, not shipped features.
- All six games in the 2026-11-04 Wave 2 spec are shipped. Riftfall, Rift Life and Rift Ecology are covered by rules unit tests, shell tests and a browser boot/start/input check; a full sixty-day ecology season and a complete twenty-one-day Rift Life run are not yet played end to end in the browser suite.
- The 1000-game target is a documented program, not a shipped library. 39 games have catalogue entries today; the remaining 961 are planned. No placeholder records exist.
- Game records are local; the site does not display invented player counts, ratings or revenue.
- The Content-Security-Policy is report-only, not enforced. Violations are collected but nothing is blocked; enforcement needs a real report collector and a period of clean reports.
- The shared Three.js chunk is 553.9 KiB raw (567.22 kB decimal) and ~141 kB gzip. It is lazy-loaded and absent from the initial bundle; `npm run check:bundle` enforces a 600 kB per-chunk budget and a 170 kB initial gzip budget. Three.js ships as a single module, so it cannot be split further without replacing the library.

---

## Licence and asset policy

- Application code in this repository is the project's own work.
- Third-party libraries keep their own licences; see `docs/research/LICENSE-AUDIT.md`.
- No proprietary game assets, extracted files, logos, characters or copyrighted maps are included.
- The research targets are referenced for study only; the designs are clean-room reinterpretations of general genre mechanics.
