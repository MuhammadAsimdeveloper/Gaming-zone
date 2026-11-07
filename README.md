# NeonRift

A free, instant-play browser gaming portal. Original branding, original games, no account and no download.

**Status:** the platform and 32 internal games are implemented. The 50-game research and 15-game design package is complete in [`docs/research/`](docs/research/README.md). Five of the 15 shortlisted games are shipped — Rift Chess, Neon Rush, Lawn Protocol, Apex Time Trial and Street Cricket — completing Wave 1; the rest remain designs. A six-game Wave 2 design spec (Neon Craft plus five companions) was written on 2026-11-04; none of it is implemented and no catalogue entry exists for it. The path to a 1000-game library is defined in the [1000-game expansion program](docs/games/1000-game-expansion-program.md): 32 shipped, 968 planned across 27 kit families, with no placeholder entries.

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
```

Playwright also builds and serves `dist-consent` on port 4176 automatically; the
configured-consent matrix uses it to prove provider loading against a build where
analytics and advertising are actually configured. Both provider hosts are
intercepted, so no test contacts Google.

Node 20+ is required. The project is developed on Node 24.

Playwright's Chromium is the only browser target in CI. Install it once with
`npx playwright install chromium` before running `npm run test:e2e` locally.

---

## Verification snapshot (2026-11-07)

| Command | Result |
|---|---|
| `npm ci` | Completed previously; lockfile unchanged |
| `npm run typecheck` | Passed with no output |
| `npm test` | 723 tests passed in 79 files |
| `npm run build` | Passed; Street Cricket loads as its own 48.60 kB / 15.11 kB gzip chunk; the shared Three.js scenery chunk is 565.24 kB raw / 141.54 kB gzip and still triggers the existing >500 kB warning |
| `npm run build:consent` | Passed; same chunks with analytics and AdSense identifiers configured |
| `npx playwright test --workers=2` | 104 tests passed in 12 files |

The browser suite covers the homepage, catalogue, search, category filters, all thirty-two game pages,
launch/pause/resume/restart, favorites after reload, recently played, fullscreen state, 404,
mobile navigation, the absence of analytics/ad scripts in the default build, error-boundary
recovery, hidden-tab fairness, keyboard and touch input for the 2D games, and 2D game
completion/game-over. The configured-consent matrix runs against a second build and checks,
with both provider hosts intercepted, that nothing loads before a decision, each category is
independent, denials and grants survive a reload, and clearing a choice revokes only that
provider. The five 3D games are verified for loading, pause/resume, restart, mute
and route-away console cleanliness; their action keys are covered by unit-level keyboard-capture
tests, not by a full browser playthrough, and a complete race, time trial, match or over is
not automated. No game is described as manually played beyond what these tests exercised.

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

All thirty-two are original implementations. No commercial game assets, code or branding are used.
Rift Chess uses the open-source chess.js library (BSD-2-Clause) for move generation; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## Research and design package

The full deliverable is indexed at [`docs/research/README.md`](docs/research/README.md):

- 50-game research report with sourced findings and explicit verification limits.
- Weighted shortlist of the best 15 concepts.
- 15 game design documents with features, architecture, milestones, testing and limitations.
- Licence audit, source-repository directory, technical architecture and delivery roadmap.
- Six-game Wave 2 design spec (2026-11-04): Neon Craft plus Rift Rally, Neon Duel, Riftfall, Rift Life and Rift Ecology. Design only; implementation has not started. See [`docs/superpowers/specs/2026-11-04-games-wave2-design.md`](docs/superpowers/specs/2026-11-04-games-wave2-design.md).
- [1000-game expansion program](docs/games/1000-game-expansion-program.md): kit and variant architecture, the 27-family portfolio allocation to 1000 games, the nine-phase roadmap, quality gates, catalogue scaling and licensing policy. 32 games carry catalogue entries today; the remaining 968 are planned, not shipped.
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
| `VITE_ADMIN_PASSCODE_HASH` | Reserved for dormant local admin scaffolding; no admin route ships | empty |
| `VITE_EXTERNAL_GAME_ORIGINS` | Comma-separated HTTPS origins approved for embedding | empty |
| `VITE_ADS_ENABLED` | Enables ad slots when exactly `true` | disabled |
| `VITE_ADSENSE_CLIENT` | AdSense client ID | empty |
| `VITE_ADSENSE_SLOT_*` | Ad slot IDs per placement | empty |

Do not commit `.env` files. The `.gitignore` already excludes them.

**Admin note:** no admin route or dashboard is shipped in this build. `src/lib/adminAuth.ts` is dormant scaffolding. If a dashboard is added later it must be described as local-only convenience, never as secure server authentication, because there is no server and a browser passcode cannot protect one. See `docs/research/ROADMAP.md` for the planned honest admin work.

---

## Deployment

Cloudflare Pages (not deployed by this repository):

```text
Build command:    npm run build
Output directory: dist
Node version:     20+
```

The build is a static site. `public/_redirects` provides the SPA fallback for deep links, and `public/_headers` sets baseline security headers. A Content-Security-Policy is not yet configured because the optional analytics and ad integrations must be validated against it first.

---

## Next games

Three tracks are queued. **Only the shipped games have catalogue entries.**

- **1000-game expansion program (2026-11-06):** kit and variant architecture plus a
  nine-phase roadmap from 32 to 1000 tested games. Phase 1 is the catalogue scale
  foundation; Phase 2 covers the Wave 2 slate. See
  [`docs/games/1000-game-expansion-program.md`](docs/games/1000-game-expansion-program.md).
- **Wave 2 six-game slate (2026-11-04):** Neon Craft, Rift Rally, Neon Duel, Riftfall, Rift
  Life and Rift Ecology, split into three sub-waves. The design spec is written and awaiting
  review at
  [`docs/superpowers/specs/2026-11-04-games-wave2-design.md`](docs/superpowers/specs/2026-11-04-games-wave2-design.md).
- **Wave 1:** complete as of 2026-11-07 — Rift Chess, Neon Rush, Lawn Protocol, Apex Time
  Trial and Street Cricket are shipped, integrated and tested.

---

## Limitations

- Progress, favourites and records are stored in this browser only. There is no account or cloud save.
- Full 3D race/match completion is not covered by automated tests and has not been manually played to the end. Load, controls, pause/resume, restart, mute and cleanup are covered.
- Clearing site data removes local progress.
- No admin dashboard is shipped. `adminAuth.ts` is dormant scaffolding and is not authentication. `adminStore.ts` only applies optional local catalogue overrides from this browser; it is not authentication and is never a server-side admin feature.
- Ads are disabled by default. No ad script loads unless ads are explicitly enabled, configured, and advertising consent is granted.
- Analytics is disabled by default and loads only after analytics consent is granted.
- External game embedding is deny-by-default and requires an explicit HTTPS allowlist.
- Five of the 15 shortlist games are shipped (Rift Chess, Neon Rush, Lawn Protocol, Apex Time Trial, Street Cricket); the remaining ten are designs, not shipped features.
- The six games in the 2026-11-04 Wave 2 spec are designs only. No game code, catalogue entry, thumbnail or test exists for them yet.
- The 1000-game target is a documented program, not a shipped library. 32 games have catalogue entries today; the remaining 968 are planned. No placeholder records exist.
- Game records are local; the site does not display invented player counts, ratings or revenue.
- No Content-Security-Policy ships yet; the optional analytics and ad integrations must be validated against it before one is added.
- The production build warns about the shared Three.js chunk exceeding 500 kB raw. It is lazy-loaded and compressed to ~140 kB gzip, but further splitting is still an open performance task.

---

## Licence and asset policy

- Application code in this repository is the project's own work.
- Third-party libraries keep their own licences; see `docs/research/LICENSE-AUDIT.md`.
- No proprietary game assets, extracted files, logos, characters or copyrighted maps are included.
- The research targets are referenced for study only; the designs are clean-room reinterpretations of general genre mechanics.
