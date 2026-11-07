# Technical Architecture

> Architecture record for the existing NeonRift platform and planning guide for the next 15 games.
> The platform and its 25 games are implemented. The 15 shortlisted games remain designs, except
> Rift Chess, which has an approved-for-planning implementation plan and no code yet.
> A separate six-game Wave 2 slate (Neon Craft plus five companions) has a written design spec
> dated 2026-11-04; it is not implemented.
> Verification results below were recorded on 2026-11-04.

---

## 1. Existing platform

| Layer | Technology | Notes |
|---|---|---|
| UI | React 19 + TypeScript 5.9 (strict) | `noUnusedLocals` and `noUnusedParameters` are on |
| Build | Vite 8 | Static output; Cloudflare Pages target |
| Styling | Tailwind CSS 4 (`@theme` tokens) | Custom palette and typography tokens |
| Routing | React Router 7 | 14 routes including game, category, favourites and legal pages |
| Icons | Lucide React | No icon fonts |
| 3D | Three.js 0.187 | Imperative engines mounted and disposed by React |
| State | React context providers | Toast, Preferences, Catalogue |
| Persistence | LocalStorage | Preferences, dormant admin session, per-game records |
| Tests | Vitest 5 + Playwright 1.64 | Unit tests for pure logic; browser E2E against the production preview |
| CI | GitHub Actions | Node 20, `npm ci`, typecheck, unit, build, Playwright on Chromium |

### Route map

```
/                     Home
/games                All games
/popular              Popular
/new                  New
/categories           Category index
/category/:id         Category listing
/game/:slug           Reusable player
/favorites            Favourites
/recently-played      Recently played
/about                About
/contact              Contact
/privacy              Privacy
/terms                Terms
*                     404
```

### Game integration points

1. `src/types/game.ts` — `Game`, `CATEGORY_IDS`, `INTERNAL_GAME_KEYS`.
2. `src/data/games.ts` (catalogue data) — one metadata record per game.
3. `src/games/registry.ts` — lazy import keyed by `internalKey`.
4. `src/pages/GamePage.tsx` — shared player shell; no per-game chrome.
5. `public/art/` — thumbnail asset.

A new game is integrated by adding **one metadata record, one registry entry, one component folder and one thumbnail**. It must not modify the player shell unless a genuinely shared capability is missing.

---

## 2. Non-negotiable constraints

- **Static hosting.** No server process, database or secret at runtime.
- **No account.** Progress is local to the browser and must be described honestly.
- **Lazy loading.** A heavy engine must never load on a page that does not use it.
- **Clean disposal.** Every listener, timer, animation frame, audio node and WebGL resource is released on unmount.
- **Mobile first.** Touch controls are required, not optional.
- **Pause on hidden.** `visibilitychange` pauses simulation and audio.
- **No fake data.** No simulated leaderboards, fake players or invented statistics.
- **No external runtime calls** unless explicitly approved and documented.

---

## 3. Shared game module pattern

```
src/games/<game-key>/
  <Game>Game.tsx      React mount, HUD, overlays, menu
  engine.ts           Simulation and render loop (framework-free)
  audio.ts            Web Audio effects/music (optional)
  rules.ts            Pure rules/state transitions (testable)
  types.ts            Local types
  levels.ts           Level/wave/track data (optional)
  engine.test.ts      Vitest coverage for rules
```

### Rules

- **`engine.ts` must not import React.** React owns mounting, HUD and menus; the engine owns simulation and rendering.
- **`rules.ts` must be pure.** Given state and input, return the next state. This is what Vitest tests.
- **HUD state is emitted, not read.** The engine calls an `onHud` callback at a bounded rate (e.g. 10 Hz), not every frame.
- **The engine exposes `start`, `pause`, `resume`, `restart`, `dispose`.** The player shell already has restart/fullscreen controls; the game must honour them.
- **Input is owned by the engine**, with a shared keyboard/touch helper. Do not attach global listeners without cleanup.

### Shared 2D helpers (to be added with the first 2D game)

```
src/games/shared2d/
  loop.ts        fixed-timestep loop with accumulator and pause
  input.ts       keyboard, pointer/touch, virtual joystick
  canvas.ts      DPR-aware resize and coordinate mapping
  rng.ts         seeded deterministic RNG
  audio.ts       lazy AudioContext, mute/volume, gesture unlock
  storage.ts     namespaced, versioned local records
```

These are small utilities, not an engine. They should stay under ~300 lines each and be covered by tests where logic is non-trivial.

### Shared 3D helpers (existing pattern)

The three current 3D games each own an engine class with:

- renderer, scene, camera, resize observer;
- `lastFrame` + manual `performance.now()` delta (no deprecated `THREE.Clock`);
- `PCFShadowMap`, capped device pixel ratio;
- pause/resume/dispose;
- an audio class with gesture unlock.

New 3D games should reuse that lifecycle pattern rather than adding React Three Fiber. R3F is a valid choice but would introduce a second 3D paradigm into the codebase.

---

## 4. Simulation architecture

### Fixed timestep

All action games use a fixed simulation step with an accumulator:

```
const STEP = 1 / 60;
accumulator += Math.min(delta, 0.1);
while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
render(accumulator / STEP);
```

Benefits: deterministic behaviour, stable physics, reproducible tests, and a clean path to replays or lockstep multiplayer later.

### Determinism

- Use a seeded PRNG (`mulberry32` or similar) for spawns and procedural content.
- Never use `Math.random()` in simulation code that tests or replays depend on.
- Store the seed with a run record if replays are offered.

### Pause and visibility

- `pause()` stops simulation but keeps the last rendered frame.
- `visibilitychange` and `blur` pause automatically; show a resume overlay.
- Audio suspends on pause and resumes only after a user gesture.

---

## 5. Engine selection per game

| # | Game | Renderer | Why |
|---|---|---|---|
| 1 | Rift Chess | React DOM + SVG/CSS board | No game loop needed; accessible DOM pieces. Plan: [RIFT-CHESS-IMPLEMENTATION-PLAN.md](RIFT-CHESS-IMPLEMENTATION-PLAN.md) |
| 2 | Neon Rush | Three.js | 3D lanes and trains; reuses existing renderer lifecycle |
| 3 | Strata | Canvas 2D | Tilemap, lighting and particles are cheap and controllable |
| 4 | Lawn Protocol | Canvas 2D + DOM HUD | Grid simulation; DOM for seed cards |
| 5 | Apex Time Trial | Three.js | Reuses Neon Apex track/vehicle code |
| 6 | Rift Tactics | Canvas 2D | Fixed-tick lane simulation; sprites/vector units |
| 7 | Neon Arena | Canvas 2D | Top-down arena; simple projectile collision |
| 8 | Voxel Rift | Three.js + Web Worker | Chunk meshing off the main thread |
| 9 | Rift Delve | Three.js | Isometric 3D rooms; reuse materials/lighting |
| 10 | Undercurrent | Canvas 2D | Top-down room combat and particles |
| 11 | Hollow Signal | Canvas 2D | Precise platformer physics and parallax |
| 12 | Habitat | Canvas 2D isometric + DOM UI | Agent simulation; DOM for build menus |
| 13 | Street Cricket | Three.js + DOM timing UI | 3D pitch, simple ball physics |
| 14 | Nightfall | Canvas 2D | Top-down survival, day/night lighting |
| 15 | Rift Hold | Canvas 2D isometric + DOM UI | Grid base building; DOM for upgrade panels |

**No new engine dependency is required for any of the 15.** Add one only if a prototype proves the custom path is materially slower or worse.

The separate six-game slate from 2026-11-04 follows the same platform contracts. Neon Craft is
planned as a self-contained Three.js voxel engine (chunk streaming, greedy meshing and baked
light); Rift Rally reuses the existing Three.js racing pattern; Neon Duel, Riftfall, Rift Life
and Rift Ecology use Canvas 2D and React. No implementation exists yet. See the
[Wave 2 spec](../superpowers/specs/2026-11-04-games-wave2-design.md).

---

## 6. Data model and persistence

### Catalogue record

Existing `Game` fields include: `id`, `slug`, `title`, `tagline`, `description`, `category`, `secondaryCategories`, `type` (`internal` | `external`), `internalKey`, `thumbnail`, `instructions`, `controls`, `featured`, `popularityRank`, `createdAt`, `externalUrl`, `allowedOrigins`.

New games must provide honest instructions and controls. No placeholder text.

### Local storage

| Key | Contents | Lifetime |
|---|---|---|
| `neonrift:prefs:v1` | Favourites, recents, sound preference | Persistent |
| `neonrift:admin-session` | Dev-only admin session | 8 hours |
| `neonrift:game:<key>:record` | Best score / completion record | Persistent |
| `neonrift:game:<key>:save` | Run or level save, if the game supports it | Persistent, versioned |

Rules:

- Namespace every key with `neonrift:game:<key>:`.
- Version the payload (`{ v: 1, ... }`) and handle unknown versions by resetting, not crashing.
- Never store personal data, tokens or secrets.
- Wrap storage in `try/catch`; private mode can block it.

---

## 7. Performance budgets

These are **budgets**, not measured results.

| Budget | Target |
|---|---|
| Initial route JS (no game) | ≤ 220 KB gzip |
| 2D game chunk | ≤ 120 KB gzip |
| 3D game chunk | ≤ 600 KB gzip (current Three.js chunk is ~562 KB raw / ~141 KB gzip) |
| First interactive on mid mobile / 4G | ≤ 2.5 s |
| Frame rate | 60 fps desktop; 45–60 fps mobile; never below 30 |
| 3D draw calls | ≤ 150 per frame |
| 3D triangles | ≤ 150k visible per frame |
| Texture size | ≤ 2048 × 2048, compressed where possible |
| Device pixel ratio cap | 1.5–1.8 |
| Canvas 2D entities | ≤ 500 active; pooled projectiles/particles |
| Memory | ≤ 200 MB on mobile |
| Audio nodes | Pooled; no per-frame node creation |

### Techniques

- Lazy-load every game chunk.
- Instance repeated 3D geometry (buildings, lamps, trees).
- Use `requestAnimationFrame` with a fixed-step accumulator, not `setInterval`.
- Frustum-cull and distance-cull; no post-processing unless measured and necessary.
- Pre-render static 2D layers to offscreen canvases.
- Pool bullets, particles and obstacles.
- Avoid per-frame allocations in hot loops.
- Pause rendering when the tab is hidden.

---

## 8. Audio architecture

- One `AudioContext` per game, created lazily on the first user gesture.
- Master gain plus separate music/SFX gains.
- `suspend()` on pause/hidden; `resume()` on gesture.
- Procedural synthesis preferred: oscillators, noise buffers, filters and envelopes.
- No autoplay; no audio before interaction.
- A visible mute control in the game HUD, persisted in preferences.

---

## 9. Input architecture

| Input | Desktop | Mobile |
|---|---|---|
| Movement | WASD / arrows | Virtual joystick or swipe |
| Primary action | Mouse / Space | Tap button |
| Secondary | Right click / Shift | Second button |
| Pause | Esc / P | Pause button |
| Fullscreen | Player shell button | Player shell button |

Rules:

- Pointer events, not mouse-only events.
- Prevent page scroll only while the game canvas is focused.
- Show touch controls only on coarse pointers, not on small desktop windows.
- Provide remapping only if it is genuinely implemented; otherwise document fixed bindings.

---

## 10. Testing strategy

| Layer | Tool | What is tested |
|---|---|---|
| Pure rules | Vitest | Move legality, wave spawning, damage math, scoring, collision helpers |
| Simulation | Vitest | Fixed-step determinism, seeded RNG, win/loss transitions |
| Persistence | Vitest | Save/load, version mismatch, blocked storage |
| Consent and ads | Vitest + Playwright | Separate analytics/advertising choices, no scripts before consent, withdrawal |
| Integration | Playwright | Mount, pause/resume, restart, fullscreen, favorites/recent, route change, 404, error recovery |
| Game QA | Playwright | All 25 games load; 2D completion/game-over; 3D mute, pause, restart, canvas size and unmount; simulation start/plant/water |
| Mobile | Playwright emulation + manual device | Touch controls, hidden-tab fairness, 390×844 layouts |
| Regression | Build + typecheck | `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test` |

Current verified totals: 234 Vitest tests in 27 files and 66 Playwright tests (verified 2026-11-04). The production build
produces a shared Three.js scenery chunk at 561.57 kB raw / 140.51 kB gzip and triggers the >500 kB warning. No CSP ships yet. Full 3D race/match completion is not automated and has not been manually played to the end.

### Definition of done per game

- Core loop playable from menu to win/loss and restart.
- Pause/resume and visibility handling work.
- Touch and keyboard both work.
- No console errors or warnings.
- Record persists correctly.
- Engine disposes cleanly on route change.
- `npm run typecheck`, `npm test` and `npm run build` pass.
- Desktop and mobile browser QA completed.
- Catalogue metadata, thumbnail and instructions are honest.
- Limitations documented.

---

## 11. Security

- No secrets in the client bundle.
- No admin authentication ships. The dormant browser passcode module was removed on 2026-11-07; `adminStore.ts` only merges local, visitor-owned catalogue overrides and is labelled local-only.
- External games remain on the HTTPS allowlist with a sandboxed iframe.
- No `eval`, `new Function`, or untrusted dynamic script injection. The only injected scripts are the configured, consent-gated analytics and advertising loaders.
- Sanitise any user-entered text before rendering.
- A Content Security Policy ships in report-only mode (`public/_headers`, mirrored by the preview server); enforcement is a follow-up after clean reports. See `docs/audits/2026-11-07-csp-evaluation.md`.
- Do not add third-party analytics or ad scripts without configuration and approval.

---

## 12. Deployment

Target: Cloudflare Pages.

```
Build command:   npm run build
Output directory: dist
Node version:    20+ (project currently uses Node 24 locally)
```

Required static files:

- `public/_redirects` — SPA fallback to `/index.html`.
- `public/_headers` — cache and security headers.
- `.env.example` — documented env vars with empty values.

No environment variable is required for the first 15 games. Optional: site URL, contact email, analytics ID, AdSense IDs (ads remain disabled by default).

Deployment is **not** authorised by this document. It requires explicit approval.

---

## 13. What not to build

- No custom backend, database or auth service for single-player games.
- No real-time multiplayer infrastructure until a specific game is approved and a free-tier service is verified.
- No microservices, queues or workers beyond a Web Worker for chunk meshing.
- No React Three Fiber migration.
- No second state-management library.
- No asset pipeline that requires paid tools.
- No live-service economy, battle pass or gacha.

---

## 14. Architecture decision record (summary)

| Decision | Choice | Reason |
|---|---|---|
| 3D rendering | Three.js, imperative | Already installed and proven in three games |
| 2D rendering | Canvas 2D + React DOM | No new dependency; full control; small bundles |
| Physics | Custom arcade physics | The 15 games do not need a full rigid-body engine |
| Game loop | Fixed timestep | Determinism, stable physics, testability |
| State | React context for app; plain classes for engines | Avoids per-frame React renders |
| Persistence | LocalStorage, versioned and namespaced | No backend; honest local-only progress |
| Loading | Lazy registry | Heavy engines load only on their game route |
| Audio | Web Audio synthesis | Zero asset licensing cost; small payload |
| Hosting | Cloudflare Pages static | Free tier fits; no server |
| Tests | Vitest for rules and simulation | Fast and dependency-light |
