# NeonRift

A free, instant-play browser gaming portal. Original branding, original games, no account and no download.

**Status:** the platform and 10 internal games are implemented. The 50-game research and 15-game design package is complete in [`docs/research/`](docs/research/README.md). **The 15 shortlisted games are designs only — they are not implemented, and no catalogue entry claims otherwise.**

---

## Stack

- React 19 + TypeScript 5.9 (strict)
- Vite 8
- Tailwind CSS 4
- React Router 7
- Three.js 0.187 for 3D games
- Vitest 5
- LocalStorage for preferences and local records
- Static hosting target: Cloudflare Pages

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
```

Node 20+ is required. The project is developed on Node 24.

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

All ten are original implementations. No commercial game assets, code or branding are used.

---

## Research and design package

The full deliverable is indexed at [`docs/research/README.md`](docs/research/README.md):

- 50-game research report with sourced findings and explicit verification limits.
- Weighted shortlist of the best 15 concepts.
- 15 game design documents with features, architecture, milestones, testing and limitations.
- Licence audit, source-repository directory, technical architecture and delivery roadmap.

Start with the [package index](docs/research/README.md).

---

## Configuration

Configuration is optional and read from Vite environment variables at build time. Nothing is required to run the existing games.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_SITE_URL` | Canonical site URL | `https://neonrift.pages.dev` |
| `VITE_CONTACT_EMAIL` | Address shown on the contact page | empty |
| `VITE_GA_MEASUREMENT_ID` | Analytics ID; analytics stays idle when empty | empty |
| `VITE_ADMIN_PASSCODE_HASH` | SHA-256 hash for the local dev admin gate | empty |
| `VITE_EXTERNAL_GAME_ORIGINS` | Comma-separated HTTPS origins approved for embedding | empty |
| `VITE_ADS_ENABLED` | Enables ad slots when exactly `true` | disabled |
| `VITE_ADSENSE_CLIENT` | AdSense client ID | empty |
| `VITE_ADSENSE_SLOT_*` | Ad slot IDs per placement | empty |

Do not commit `.env` files. The `.gitignore` already excludes them.

**Admin note:** the admin gate is a local convenience feature, not authentication. It does not protect a server, because there is no server. See the roadmap in `docs/research/ROADMAP.md` for the planned honest admin dashboard.

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

## Limitations

- Progress, favourites and records are stored in this browser only. There is no account or cloud save.
- Clearing site data removes local progress.
- The admin gate is not real authentication.
- Ads are disabled by default and no ad scripts are loaded.
- External game embedding is deny-by-default and requires an explicit HTTPS allowlist.
- The 15 games in the research shortlist are designs, not shipped features.
- Game records are local; the site does not display invented player counts, ratings or revenue.

---

## Licence and asset policy

- Application code in this repository is the project's own work.
- Third-party libraries keep their own licences; see `docs/research/LICENSE-AUDIT.md`.
- No proprietary game assets, extracted files, logos, characters or copyrighted maps are included.
- The research targets are referenced for study only; the designs are clean-room reinterpretations of general genre mechanics.
