# NeonRift — Deep Audit

> **Remediation update (5 November 2026):** a second remediation pass audited all 25 shipped games, reproduced and fixed sixteen player-facing or accessibility defects, and hardened the smoke suite. The current unit suite is 288 tests in 38 files; typecheck passes. See [`docs/ENHANCEMENT-REPORT-2026-11-05.md`](docs/ENHANCEMENT-REPORT-2026-11-05.md) for the fix list, per-game status and remaining backlog. This audit remains the record of the original findings.

> **Remediation update (3 November 2026):** C1 (Rift Striker keyboard actions), H1 (Tab trap, replaced with `Q`), H2 (stuck pointer shoot), M1 (Memory clock), M2 (Reaction Time Space), the admin-edit validation part of H5, and the H6/D1/D2/D3 documentation errors have been fixed in the working tree. Neon Harvest plus fourteen further original games (Rift Transit, Grid Supply, Rift Colony, Orbit Market, Neon Diner, Skyport, Rift Hospital, Park Pulse, Factory Line, Cargo Ring, Aqua Grid, Signal Stack, Rift Runner and Rift Tactics) and a shared simulation clock were added. The unit suite is now 234 tests in 27 files; typecheck and build pass. The findings below remain as the audit record for everything not marked fixed.

**Date:** 3 November 2026  
**Scope:** the whole repository at commit `6bcf8b4` (`main`): React/TypeScript platform, 10 games, Three.js engines, consent/ads/analytics, SEO, deployment config, tests and the research/design documents.  
**Mode:** read-only. No application source was changed. A temporary Vitest config was created and deleted; `dist/` was rebuilt (it is gitignored).

**Overall verdict:** this is substantially stronger than the average hobby game portal. The TypeScript is strict, the game loops are carefully cleaned up, Three.js is genuinely lazy-loaded, consent/ads are deny-by-default in code, there are no XSS sinks and the dependency audit is clean. Two things hold it back:

1. **One critical gameplay defect:** Rift Striker's advertised keyboard shoot/pass/sprint keys never reach the engine.
2. **The test and documentation claims run ahead of what is actually verified.** In particular, the privacy test is vacuous because analytics and ads are unconfigured, and no 3D game is given verified gameplay input by the browser suite.

There is no critical security vulnerability and no unexpected data-loss path in shipped features (clearing site data removing local progress is documented behaviour).

---

## 1. Verification performed

Environment: Windows, Node `v24.22.0`, npm `11.19.1`, no `.env` file, clean working tree.

| Check | Result | Notes |
|---|---|---|
| `npm run typecheck` | **Pass** | `tsc --noEmit`, no output |
| `npm test` | **Pass — 70 tests / 7 files** | Required `--configLoader native --pool=threads` because this sandbox blocks Vitest's config bundler and forks (`spawn EPERM`). Not a project defect on a normal CI host. |
| `npm run build` | **Pass** | Required `--configLoader native` for the same sandbox reason. `scenery` chunk **561.48 kB raw / 140.49 kB gzip**; >500 kB warning reproduces exactly. |
| `npx playwright test --list` | **51 tests / 5 files** | Execution blocked here: Playwright forks a worker (`spawn EPERM`). Browser-test results below are therefore **not re-verified**, only the static test definitions were audited. |
| `npm audit` | **0 vulnerabilities** | 19 prod / 138 dev dependencies |
| `npm ls --depth=0` | **Clean** | All declared versions installed |
| `git status` | **Clean** | Temporary audit config removed |

Unit-test breakdown: `AppErrorBoundary` 4, `useVisibilityPause` 4, `theme` 4, `consent` 14, `ads` 3, `combobox` 17, `lib` 24 = **70**. The browser suite is **51**.

> The two README snapshots (`49 tests/5 files`, `37 browser tests`) are stale, not current. The later "Editorial Arcade" paragraph correctly says 233/66. See H6.

---

## 2. Critical

### C1 — Rift Striker keyboard shooting, passing and sprinting are dead

**Evidence**

- [`src/games3d/shared/input.ts#L22-L33`](src/games3d/shared/input.ts#L22-L33) — `CAPTURED` contains arrows, Space, WASD and `KeyC` only.
- [`src/games3d/shared/input.ts#L43-L46`](src/games3d/shared/input.ts#L43-L46) — a key is added to the state set **only if it is in `CAPTURED`**.
- [`src/games3d/football/engine.ts#L374`](src/games3d/football/engine.ts#L374) — reads `ShiftLeft` / `ShiftRight` for sprint.
- [`src/games3d/football/engine.ts#L389-L390`](src/games3d/football/engine.ts#L389-L390) — reads `KeyJ` (shoot) and `KeyK` (pass).
- The catalogue advertises exactly those keys: [`src/data/games.json#L244-L261`](src/data/games.json#L244-L261), and the in-game controls panel repeats them.

**Failure:** a keyboard-only player can move and tackle but **can never charge a shot, release a shot, pass, or sprint for the entire match**. Mouse shooting exists but is also affected by H2; touch works.

**Fix:** add `KeyJ`, `KeyK`, `ShiftLeft`, `ShiftRight` to `CAPTURED` (or capture all keys while the game owns focus, still ignoring form fields), then add an e2e test that presses `j` and asserts the shot counter/ball velocity changes. This also needs an engine-level test hook; see H4.

---

## 3. High

### H1 — Rift Striker traps the keyboard (WCAG 2.1.2)

**Evidence:** [`src/games3d/football/RiftStrikerGame.tsx#L252-L270`](src/games3d/football/RiftStrikerGame.tsx#L252-L270) prevents the default action of **every** `Tab` whenever phase is `live` or `paused`, regardless of which element has focus.

**Failure:** a keyboard-only player cannot Tab from the canvas to the pause, mute or camera controls; while paused, they cannot Tab to Resume, Restart match or Change setup. The pause overlay is a mouse-only destination, which is a WCAG 2.1.2 keyboard-trap failure. Because the handler is on `window` with no target check, it also swallows Tab inside the header search while a match is running.

**Fix:** only intercept Tab when `document.activeElement === canvas` **and** `phase === 'live'`; never while an overlay is open. Better: use a different key for player switching (e.g. `Q`) and leave Tab alone. Add a Playwright keyboard traversal test.

### H2 — Stuck mouse-shoot flag disables shooting permanently

**Evidence:** [`src/games3d/football/engine.ts#L185-L187`](src/games3d/football/engine.ts#L185-L187) listens for `pointerup`/`pointercancel` on the canvas only; [`#L1028-L1035`](src/games3d/football/engine.ts#L1028-L1035) sets `pointerShoot = true` on pointerdown.

**Failure:** press on the canvas, drag/release over the HUD or outside the canvas → the canvas never sees `pointerup` → `pointerShoot` stays `true`. `shootInput` is then permanently true, so the release-to-shoot edge never fires again; the player cannot shoot for the rest of the match. With C1 this removes the last desktop shooting route.

**Fix:** `canvas.setPointerCapture(event.pointerId)` on pointerdown, and/or listen for `pointerup`/`pointercancel` on `window`; reset `pointerShoot` in `pause()`, `blur` and `finishMatch()`.

### H3 — The consent/privacy E2E is vacuous

**Evidence**

- [`e2e/privacy.spec.ts#L4-L28`](e2e/privacy.spec.ts#L4-L28) is titled "no analytics or advertising loads before consent", but the test build has neither configured.
- [`src/config/site.ts#L24`](src/config/site.ts#L24) and [`#L32`](src/config/site.ts#L32) leave `GA_MEASUREMENT_ID` empty and `ADS_ENABLED` false without env vars.
- [`src/lib/analytics.ts#L56-L57`](src/lib/analytics.ts#L56-L57) and [`src/lib/ads.ts#L49-L53`](src/lib/ads.ts#L49-L53) short-circuit on **configuration** before they ever check consent.

**Failure:** the test would still pass if consent gating were deleted entirely. The consent banner (the only place a visitor can grant/deny) is never rendered during any axe scan or e2e run. The README's claim that the suite covers "consent behavior" is therefore unsupported, and a privacy-critical regression would ship green.

**Fix:** add a second Playwright project (or a `test:e2e:configured` build) with dummy `VITE_GA_MEASUREMENT_ID`, `VITE_ADS_ENABLED=true`, `VITE_ADSENSE_CLIENT` and slot IDs. Assert: no `googletagmanager`/`adsbygoogle` request before "Allow"; a request after; "Clear choice" removes the script; no banner when unconfigured. Add unit tests for `initializeAnalytics`, `resetAnalytics`, `loadAdsenseScript`, `resetAdsense` with mocked config.

### H4 — "3D games are verified for input ... cleanup" is not true

**Evidence**

- [`e2e/gameplay.spec.ts#L153-L183`](e2e/gameplay.spec.ts#L153-L183) starts each 3D game, checks a canvas exists, toggles mute, pauses/resumes and restarts.
- [`e2e/gameplay.spec.ts#L195-L210`](e2e/gameplay.spec.ts#L195-L210) is the only 3D input test, and it only clicks Neon Apex's touch buttons; it never asserts the car moved.
- [`e2e/gameplay.spec.ts#L287-L302`](e2e/gameplay.spec.ts#L287-L302) — `assertSizedCanvas` only checks `canvas.width > 0 && height > 0`, which any canvas satisfies; `assertMuteToggle` checks an ARIA label, not audio state.
- "Cleanup" is a 600 ms wait followed by navigation and a no-console-errors assertion ([`#L186-L190`](e2e/gameplay.spec.ts#L186-L190)); it does not assert disposal, RAF cancellation or WebGL context release.
- The claim: [`README.md#L56-L58`](README.md#L56-L58), [`README.md#L172`](README.md#L172), [`docs/research/ARCHITECTURE.md#L268`](docs/research/ARCHITECTURE.md#L268).

**Failure:** the suite gives false confidence: it cannot detect C1, H2 or any input regression in the 3D games. The "all ten games boot and accept input" suite only sends real gameplay input to the 2D games; Neon Apex's touch test clicks buttons without asserting any effect on the car.

**Fix:** expose a small test/introspection surface (`engine.getDebugState()` returning position, shot count, disposed flag, listener count) or assert visible HUD changes; drive `KeyW`, `KeyJ`, `Tab`, `P` in Playwright; count WebGL contexts before/after 10 navigations.

### H5 — "Admin helper modules are dormant" is false, and stored edits are unvalidated

**Evidence**

- [`src/providers/CatalogueProvider.tsx#L6-L12`](src/providers/CatalogueProvider.tsx#L6-L12) imports `adminStore`; [`#L37-L43`](src/providers/CatalogueProvider.tsx#L37-L43) reads `neonrift:admin:v1` and calls `mergeCatalogue(baseGames, adminState)` on **every load**.
- [`src/lib/adminStore.ts#L63-L69`](src/lib/adminStore.ts#L63-L69) accepts any object as an edit patch; [`#L94-L107`](src/lib/adminStore.ts#L94-L107) spreads it over the base game without validating the resulting shape.
- [`src/pages/GamePage.tsx#L401`](src/pages/GamePage.tsx#L401) calls `game.instructions.map(...)`, so an edit such as `{"edits":{"neon-snake":{"instructions":null}}}` in local storage throws and takes down the page via the error boundary.
- The claim: [`README.md#L174`](README.md#L174). Only `adminAuth.ts` is actually dormant/untree-shaken from the bundle.

**Failure:** a stale or corrupted admin record can brick any game page, and the docs misdescribe the architecture. Every visitor also gets an empty `neonrift:admin:v1` written on first load.

**Fix:** validate edit patches with a strict partial schema (`isGameLike`-style per field), validate the merged result, or gate the admin merge behind `DEV`/a feature flag and remove it from production. Update the README to distinguish `adminAuth` (dormant) from `adminStore` (active).

### H6 — Current verification numbers contradict each other

**Evidence:** [`README.md#L49-L51`](README.md#L49-L51) says 49 unit tests / 5 files and 37 browser tests; [`README.md#L72`](README.md#L72) says 70 / 51. [`docs/research/ARCHITECTURE.md#L272-L275`](docs/research/ARCHITECTURE.md#L272-L275) calls 49/37 the "Current verified totals"; [`docs/research/ROADMAP.md#L57-L59`](docs/research/ROADMAP.md#L57-L59) and [`#L69-L71`](docs/research/ROADMAP.md#L69-L71) repeat them.

**Verified now:** 234 unit tests / 27 files, 66 browser tests / 5 files.

**Failure:** anyone reading the status docs gets two different "current" pictures. Since the project explicitly sells honesty, this matters more than the numbers themselves.

**Fix:** one generated verification table (or a CI job that writes counts into the README), and label the 2026-11-02 snapshot as "pre-UI-refresh baseline".

---

## 4. Medium

### Gameplay and state

**M1 — Memory Match's clock runs on wall time and never pauses.** [`src/games/memory/MemoryGame.tsx#L124-L144`](src/games/memory/MemoryGame.tsx#L124-L144) ticks off `Date.now()` and computes `elapsed` from it at completion; no `useVisibilityPause` is used. Switching tabs for five minutes mid-board destroys the score (`1000 - moves*10 - elapsed*2` clamps to 0) and reports a false time. Fix: accumulate only visible milliseconds (Math Sprint's `endAtRef` shift is the pattern), and add a pause/visibility test.

**M2 — Reaction Time's Space key stops working after the toolbar Restart is clicked.** [`src/games/reaction-time/ReactionTimeGame.tsx#L195-L208`](src/games/reaction-time/ReactionTimeGame.tsx#L195-L208) deliberately ignores Space when the event target is a button other than the panel; the toolbar Restart button stays mounted and keeps focus ([`#L278-L282`](src/games/reaction-time/ReactionTimeGame.tsx#L278-L282)). In Chrome/Firefox, pressing Space then re-activates Restart instead of registering a reaction — every Space restarts the run, so the run can never be recorded. Fix: remove the `BUTTON` exception, or blur/focus the panel in `startRun`.

**M3 — Mute state desynchronises after an in-game restart (all three 3D games).** A restart constructs a new engine and a new `GameAudio` whose `muted` starts `false` ([`src/games3d/shared/audio.ts#L12`](src/games3d/shared/audio.ts#L12)); React's `muted` state survives. Mute → Restart → the icon says muted but audio is audible. Fix: pass the current mute state into engine construction or call a new `setMuted` after creating it.

**M4 — The render loop and audio continue after the race/match ends.** [`src/games3d/racing/engine.ts#L314-L365`](src/games3d/racing/engine.ts#L314-L365) falls through to `updateCamera` + `render` for `finished`; [`src/games3d/driving/engine.ts#L306-L355`](src/games3d/driving/engine.ts#L306-L355) and [`src/games3d/football/engine.ts#L313-L349`](src/games3d/football/engine.ts#L313-L349) do the same. The results overlay sits over a 60 fps WebGL render plus engine/music audio. Fix: render one final frame, stop the animation loop, suspend audio; re-arm on restart.

**M5 — Alt-tabbing to another window does not pause.** [`src/games/shared/useVisibilityPause.ts#L4-L11`](src/games/shared/useVisibilityPause.ts#L4-L11) only observes `visibilitychange`. On multi-monitor/side-by-side setups `visibilityState` stays `visible`; Rift Breaker keeps simulating and the football clock keeps running while the player is looking elsewhere. Fix: also pause on `window` `blur` and `pagehide`, resume on `focus`.

**M6 — Neon City Drive's first checkpoint is under the car at spawn.** [`src/games3d/driving/city.ts#L81-L88`](src/games3d/driving/city.ts#L81-L88) starts "First Light" at `point(2,4)` = `(0,72)`; the player spawns at `(0,72)` ([`src/games3d/driving/engine.ts#L124-L127`](src/games3d/driving/engine.ts#L124-L127)); the checkpoint check awards anything within the radius ([`#L483-L499`](src/games3d/driving/engine.ts#L483-L499)). Checkpoint 1/5 is awarded on the first frame. Fix: move the spawn (e.g. `z = 60`) or the first waypoint.

**M7 — HUD state is pushed into React 12.5 times per second.** `hudTimer >= 0.08` in racing [`#L360-L364`](src/games3d/racing/engine.ts#L360-L364), driving [`#L350-L354`](src/games3d/driving/engine.ts#L350-L354) and football [`#L344-L348`](src/games3d/football/engine.ts#L344-L348) calls `setHud`, re-rendering the whole game component while WebGL renders. On low-end mobile this competes with the frame budget. Fix: throttle to ~5 Hz and memoise HUD subtrees, or update the HUD imperatively.

**M8 — WebGL contexts are not explicitly released, and context loss has no UI.** The three `dispose()` methods call `renderer.dispose()` but not `forceContextLoss()`; see racing [`#L784-L794`](src/games3d/racing/engine.ts#L784-L794). Repeated game navigations can exhaust the browser's context budget; the page then shows a frozen canvas with no message. Fix: `renderer.forceContextLoss()` after dispose, plus a `webglcontextlost` handler that pauses and offers Restart.

**M9 — No live announcements in any 3D game; Rift Striker has none at all.** Football score/goal UI ([`src/games3d/football/RiftStrikerGame.tsx#L436-L443`](src/games3d/football/RiftStrikerGame.tsx#L436-L443)) is visual only. Racing/driving announce only "off track". Fix: an `sr-only` polite region for score/time and assertive announcement for goals.

**M10 — The toolbar "Restart game" on 3D pages returns to the setup menu, not a restart.** [`src/pages/GamePage.tsx#L172-L179`](src/pages/GamePage.tsx#L172-L179) increments `restartKey`, remounting the game component, whose initial phase is `menu` ([`src/games3d/racing/NeonApexGame.tsx#L119`](src/games3d/racing/NeonApexGame.tsx#L119)). The toast says "Game restarted" while showing setup. Fix: rename for 3D or wire it to the in-game restart action.

### Accessibility

**A1 — Disabling a focused cell/card throws keyboard focus to `<body>` after every move.** Tic-Tac-Toe disables occupied cells and every cell during the AI turn ([`src/games/tic-tac-toe/TicTacToeGame.tsx#L401-L409`](src/games/tic-tac-toe/TicTacToeGame.tsx#L401-L409)); Memory disables all cards while locked ([`src/games/memory/MemoryGame.tsx#L307`](src/games/memory/MemoryGame.tsx#L307)). Keyboard-only players must re-Tab from the page header every move. Fix: keep elements focusable with `aria-disabled`, guard handlers, or move focus deliberately.

**A2 — Math Sprint's live region announces every second for 60 seconds.** [`src/games/math-sprint/MathSprintGame.tsx#L288-L297`](src/games/math-sprint/MathSprintGame.tsx#L288-L297) builds `"${timeLeft} seconds left..."`; it is rendered in a `role=status` live region at [`#L343-L345`](src/games/math-sprint/MathSprintGame.tsx#L343-L345). This repeatedly interrupts the answer feedback. Fix: keep the visible timer out of the live region; announce milestones and results only.

**A3 — Snake and Rift Breaker capture keys page-wide.** [`src/games/snake/SnakeGame.tsx#L393-L431`](src/games/snake/SnakeGame.tsx#L393-L431) and [`src/games/brick-breaker/BrickBreakerGame.tsx#L215-L235`](src/games/brick-breaker/BrickBreakerGame.tsx#L215-L235) attach to `window`, skip only form fields, and `preventDefault` on arrows/WASD/Space. With a game mounted, arrows stop scrolling the long detail page, and Space on a focused toolbar button pauses instead of activating it. Fix: scope to the focusable game region, or ignore events whose target is a button/link.

**A4 — The search focus indicator is suppressed on three controls.** [`src/components/search/SearchBar.tsx#L187`](src/components/search/SearchBar.tsx#L187), [`src/components/game/GameToolbar.tsx#L55`](src/components/game/GameToolbar.tsx#L55) and [`#L77`](src/components/game/GameToolbar.tsx#L77) add `focus:outline-none`; the built CSS sets `outline-style:none` on focus, which overrides the global `:focus-visible` rule ([`src/index.css#L180-L183`](src/index.css#L180-L183)). Only a 1px border tint remains. Fix: use `focus-visible:outline-*` or remove the utility.

**A5 — SPA route changes do not move focus or announce the new page.** [`src/components/layout/SiteLayout.tsx#L25-L27`](src/components/layout/SiteLayout.tsx#L25-L27) renders `<main>` without `tabIndex={-1}`; `ScrollToTop` only scrolls. A keyboard/screen-reader user who activates a nav link is left on `<body>` with no page-change announcement. Fix: on `pathname` change, focus the `h1` or `main` (`tabIndex={-1}`) and keep the skip link target focusable.

**A6 — Listing pages skip a heading level.** `GameCard` renders `<h3>` ([`src/components/game/GameCard.tsx#L68-L75`](src/components/game/GameCard.tsx#L68-L75)) but `/games`, `/category/:id` and `/favorites` go from the page `h1` straight to card `h3`, with no `h2`. Fix: add a visually hidden `h2` or render card titles at `h2`.

**A7 — The combobox's `aria-controls` does not point at the listbox.** [`src/components/search/SearchBar.tsx#L182`](src/components/search/SearchBar.tsx#L182) points at `${id}-results`, which is the wrapper div at [`#L213-L222`](src/components/search/SearchBar.tsx#L213-L222); the `role="listbox"` is the inner element. Fix: put the id on the listbox.

### Privacy, security and hardening

**S1 — No CSP or HSTS.** [`public/_headers#L1-L5`](public/_headers#L1-L5) has nosniff, frame, referrer and permissions only. The README acknowledges the missing CSP; HSTS is not mentioned. For a static site with no HTML-injection sink the practical risk is low, but it is the main missing defense-in-depth layer. Fix: add a tested CSP (`script-src 'self'` plus hashes for the inline theme script; explicit GA/AdSense origins when configured) and HSTS at the Cloudflare zone.

**S2 — The privacy policy omits two keys the app writes.** [`src/lib/analytics.ts#L17`](src/lib/analytics.ts#L17) writes `neonrift:visitor` after analytics consent; `CatalogueProvider` writes `neonrift:admin:v1` for every visitor. The policy's list ([`src/pages/PrivacyPage.tsx#L73-L99`](src/pages/PrivacyPage.tsx#L73-L99)) mentions neither. Fix: list them, or stop writing an empty admin record.

**S3 — The "cannot read this page" iframe claim is conditional.** [`src/pages/GamePage.tsx#L343-L346`](src/pages/GamePage.tsx#L343-L346) says the external game cannot read favorites/stored data, but the iframe is sandboxed with `allow-scripts allow-same-origin` ([`#L322-L332`](src/pages/GamePage.tsx#L322-L332)). That is safe for a genuinely cross-origin host; if an operator ever allowlists the portal's own origin, the sandbox no longer isolates it. Fix: reject same-origin entries in `validateExternalGameUrl`, or qualify the copy.

**S4 — The dormant admin passcode hash is brute-forceable if ever enabled.** `VITE_ADMIN_PASSCODE_HASH` ships to the client ([`src/lib/adminAuth.ts#L21-L25`](src/lib/adminAuth.ts#L21-L25)); a browser-side passcode is not authentication, which the README correctly says. No action needed while no admin route ships; keep the warning prominent.

### SEO, sharing and deployment

**E1 — Every deep link is served with homepage social metadata, and game share images are SVGs.** [`index.html#L26`](index.html#L26) and [`#L36`](index.html#L36) use a **relative** `og:image`; there is no static `og:url`, canonical or per-route title. `Seo` fixes these only after JavaScript runs ([`src/components/seo/Seo.tsx#L49-L85`](src/components/seo/Seo.tsx#L49-L85)), which social scrapers do not execute. Worse, game pages point `og:image` at an SVG thumbnail ([`src/pages/GamePage.tsx#L209-L215`](src/pages/GamePage.tsx#L209-L215); the catalogue thumbnails are `.svg`), and major social platforms do not render SVG preview images.

**E2 — The SPA fallback makes unknown URLs HTTP 200.** [`public/_redirects#L1`](public/_redirects#L1) rewrites everything to `index.html` with 200; the React 404 page is client-side `noindex` only. Crawlers that do not run JS see the homepage metadata with a 200. Fix: Cloudflare Pages Functions or a prerender step that returns real 404s and per-route HTML.

**E3 — `SITE_URL` can diverge between canonical tags and the sitemap.** [`vite.config.ts#L7-L11`](vite.config.ts#L7-L11) reads `process.env` only; Vite `.env` values are not copied into `process.env` for config evaluation, while [`src/config/site.ts#L18-L20`](src/config/site.ts#L18-L20) reads `import.meta.env`. A local `.env.local` with `VITE_SITE_URL` therefore produces a sitemap/robots pointing at the default `neonrift.pages.dev` while canonicals point at the configured domain. Fix: use `loadEnv` in `vite.config.ts`.

**E4 — No per-route HTML means no reliable non-JS crawlability.** The site is a client-rendered SPA with lazy pages; initial HTML contains only the shell. The sitemap exists and Google executes JS, but this is a structural limitation worth stating in the README's limitations.

**E5 — PWA/apple-touch icons are SVG-only.** [`index.html#L39`](index.html#L39) uses `favicon.svg` as the `apple-touch-icon`, and the manifest has only an SVG icon ([`public/site.webmanifest#L9-L15`](public/site.webmanifest#L9-L15)). iOS does not support SVG apple-touch icons, and Chromium's install prompt is most reliable with 192/512 PNG icons. Low impact, easy fix.

### Build, tests and CI

**T1 — CI uses Node 20, but Vitest 5 declares `^22.12 || ^24 || >=26`.** [`.github/workflows/ci.yml#L17-L21`](.github/workflows/ci.yml#L17-L21) sets `node-version: 20`; `node_modules/vitest/package.json` says `^22.12.0 || ^24.0.0 || >=26.0.0`. Vite 8 requires 20.19+, so the install may succeed with a warning, but this is an unsupported matrix and could break on any Vitest update. Fix: use Node 24 in CI (matches local development) or pin Vitest 4.

**T2 — E2E tests are not typechecked.** [`tsconfig.json#L21`](tsconfig.json#L21) includes only `src`; Playwright transpiles `e2e/*.ts` without type checking. A broken helper signature ships until runtime. Fix: add `e2e` (and the config files) to a separate `tsconfig.e2e.json` and run it in CI.

**T3 — `npx playwright test` can run against a stale `dist`.** [`playwright.config.ts#L21-L26`](playwright.config.ts#L21-L26) starts `npm run preview` against whatever is in `dist`, with `reuseExistingServer: !CI`; the README's bare command does not build. `npm run test:e2e` and CI do build first. Fix: document only `npm run test:e2e`, or make the webServer command build.

**T4 — Error-boundary "Try again"/"Restart game" cannot recover a failed lazy chunk.** [`src/components/errors/AppErrorBoundary.tsx#L26-L28`](src/components/errors/AppErrorBoundary.tsx#L26-L28) resets state, but `React.lazy` caches the rejected import promise; re-rendering throws the same error immediately. [`src/components/game/GameErrorBoundary.tsx#L25-L28`](src/components/game/GameErrorBoundary.tsx#L25-L28) has the same issue. The resilience test works because it clicks "Reload page", not "Try again" ([`e2e/resilience.spec.ts#L19-L21`](e2e/resilience.spec.ts#L19-L21)). Fix: reload the page for chunk failures, or recreate the lazy component/key so the import retries.

**T5 — High-risk coverage gaps.** No tests for: `useLocalStorageState`, `useBestScore`, `sanitizeAdminState`, `validatePreferences`, configured analytics/ads, consent withdrawal, the consent banner, AdSlot, external iframe validation in the UI, or 3D engine disposal. [`docs/research/ARCHITECTURE.md#L263-L268`](docs/research/ARCHITECTURE.md#L263-L268) claims persistence/consent coverage that does not exist.

**T6 — The axe gate is critical/serious only, and scans only four routes.** [`e2e/a11y.spec.ts#L30-L31`](e2e/a11y.spec.ts#L30-L31) filters to critical/serious (matching the README wording), and the route list is `/`, `/games`, `/about`, `/game/neon-apex` at two widths. Moderate/minor violations pass, and the consent banner, privacy page, contact page, favorites, categories and in-game HUD are never scanned. `networkidle` is also a fragile wait.

**T7 — No lint/format/coverage gate.** There is no ESLint, Prettier or coverage threshold in `package.json` or CI. TypeScript strictness catches a lot, but unused exports, hook-dependency mistakes and dead code are not enforced.

### Documentation accuracy

**D1 — The README says "90-second match"; Rift Striker is 120 seconds.** [`README.md#L57`](README.md#L57) vs [`src/games3d/football/engine.ts#L94`](src/games3d/football/engine.ts#L94) (`MATCH_SECONDS = 120`) and the catalogue's "two-minute clock". Fix the number.

**D2 — "Twenty of the 50 reference games score 1–2/5" is wrong.** [`docs/research/50-GAMES-RESEARCH.md#L11`](docs/research/50-GAMES-RESEARCH.md#L11). The score table in [`docs/research/SHORTLIST-15.md#L41-L90`](docs/research/SHORTLIST-15.md#L41-L90) has **11** games with browser feasibility 1–2 (one at 1/5, ten at 2/5), not 20. Fix the sentence and add a count check.

**D3 — "21 verified repositories" is wrong.** [`docs/research/README.md#L17`](docs/research/README.md#L17) and [`#L31`](docs/research/README.md#L31) say 21; [`docs/research/SOURCE-DIRECTORY.md#L22-L40`](docs/research/SOURCE-DIRECTORY.md#L22-L40) lists **19** verified repositories, with two 404 candidates making 21 candidates total. Fix to "19 verified + 2 not found = 21 candidates".

**D4 — "No dynamic script injection" is false.** [`docs/research/ARCHITECTURE.md#L297`](docs/research/ARCHITECTURE.md#L297) vs [`src/lib/analytics.ts#L67-L71`](src/lib/analytics.ts#L67-L71), [`src/lib/ads.ts#L60-L67`](src/lib/ads.ts#L60-L67) and [`src/components/seo/Seo.tsx#L72-L79`](src/components/seo/Seo.tsx#L72-L79). The intended claim is "no untrusted injection"; say that.

**D5 — The architecture's "prevent page scroll only while the canvas is focused" rule is not followed.** [`docs/research/ARCHITECTURE.md#L253`](docs/research/ARCHITECTURE.md#L253) vs the page-wide handlers in A3.

**D6 — The 2026-11-02 snapshots are presented as current in ARCHITECTURE/ROADMAP.** See H6.

### Code quality and low-risk observations

- **Dead code:** `sanitizeThumbnailUrl` is only used by its test ([`src/lib/embed.ts#L76`](src/lib/embed.ts#L76)); `pageSlice` only by tests ([`src/lib/catalogue.ts#L72`](src/lib/catalogue.ts#L72)); `formatScore` is never rendered ([`src/lib/format.ts#L30`](src/lib/format.ts#L30)); `adminAuth.ts` is entirely unused. Either use them (especially the thumbnail sanitizer) or remove them.
- **`useBestScore` can overwrite a better score written by another tab** ([`src/games/shared/useBestScore.ts#L45-L57`](src/games/shared/useBestScore.ts#L45-L57)); it compares against a ref refreshed only on mount/key change. Re-read storage inside `submit`, and clamp negative values.
- **Reaction Time can average six rounds after a tab hide during the final result** ([`src/games/reaction-time/ReactionTimeGame.tsx#L215-L235`](src/games/reaction-time/ReactionTimeGame.tsx#L215-L235) re-arms even when five results are already recorded). Guard on `results.length >= ROUNDS`.
- **Snake starts the run on a reversal input without turning** ([`src/games/snake/SnakeGame.tsx#L128-L135`](src/games/snake/SnakeGame.tsx#L128-L135)); the first key is silently ignored while the run begins in the old direction.
- **Tic-Tac-Toe "Impossible" minimax is uncached** ([`src/games/tic-tac-toe/TicTacToeGame.tsx#L102-L128`](src/games/tic-tac-toe/TicTacToeGame.tsx#L102-L128)); the first AI move was measured at ~57 ms / 59.7k nodes here, likely 150–300 ms on a mid-range phone. Memoise by board string.
- **Countdown shows 4, not 3** ([`src/games3d/racing/engine.ts#L134`](src/games3d/racing/engine.ts#L134) starts at 3.99 and the HUD uses `Math.ceil`). Clamp the display.
- **Fullscreen does not resize the framebuffer.** [`src/pages/GamePage.tsx#L133-L143`](src/pages/GamePage.tsx#L133-L143) changes the element size; the engines only listen to `window.resize`. Add a `ResizeObserver`.
- **`navigator.clipboard` is used without a guard in Share** ([`src/pages/GamePage.tsx#L156-L162`](src/pages/GamePage.tsx#L156-L162)); on a non-secure origin the synchronous property access throws. Use `navigator.clipboard?.writeText` inside try/catch.
- **`AdRegion`/`AdSlot` are cleanly gated**; no defect found. `loadAdsenseScript` resolves on error and `pushAd` swallows refusals — acceptable.
- **README "2,143 modules transformed"** could not be reproduced (Vite 8/Rolldown does not print that count); the chunk size is reproduced exactly.

---

## 5. What is genuinely solid

- **Strict TypeScript, no escape hatches in application code.** `strict`, `noUnusedLocals`, `noUnusedParameters`, no `any`, no `@ts-ignore`, no TODO/FIXME markers (the axe spec has one documented `@ts-expect-error` for the injected `window.axe`).
- **No XSS sinks.** No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or `document.write`; JSON-LD is assigned with `textContent`; catalogue/search text is React-escaped.
- **Real lazy-loading.** `dist/index.html` preloads only small shell chunks; the 561 kB Three.js `scenery` chunk is reachable only from the three 3D game chunks. The home page does not load Three.js.
- **Good game-loop hygiene.** Snake/Brick Breaker use a single RAF loop with cancellation; timers are cleared on unmount; phase guards and `event.repeat` checks prevent double scoring; Memory uses Fisher–Yates; RPS is uniform; Tic-Tac-Toe's win/minimax logic is correct.
- **3D engines are better than typical hobby code:** capped DPR, instanced city/stadium geometry, delta-clamped physics, exponential damping, continuous goal-line crossing, finish guards, and a real `dispose()` that traverses and disposes geometries/materials, clears the animation loop, removes listeners and closes the AudioContext.
- **Consent and ads are deny-by-default in code.** Analytics/ads scripts are created only after configuration **and** grant; `resetAnalytics`/`resetAdsense` remove scripts on withdrawal; AdSlot re-checks config, consent and admin placement.
- **Storage is defensive.** All reads/writes are wrapped, corrupt JSON falls back, preferences are validated/deduped, and games tolerate blocked storage.
- **Accessibility baseline is above average:** semantic landmarks, skip link, focus-visible styling, `aria-pressed` toggles, labelled icon buttons, live regions in the 2D games, `prefers-reduced-motion` handling, 24px footer targets.
- **The research package is unusually candid** about what was not verified, and explicitly separates the 15 designs from the 10 shipped games. The two count errors above are fixable; they do not look like invented evidence.
- **Dependency posture is clean:** `npm audit` reports 0 vulnerabilities; fonts are self-hosted with OFL notices; no proprietary game assets are present.

---

## 6. Recommended fix order

### P0 — this week (correctness and honesty)

1. **C1**: add `KeyJ`, `KeyK`, `ShiftLeft`, `ShiftRight` to the captured set; test with real key events.
2. **H2**: pointer capture or window-level pointerup; reset shoot state on pause/blur.
3. **H1**: stop swallowing Tab; only intercept when the canvas owns focus and the match is live.
4. **M1**: pause Memory's clock on visibility change and accumulate visible time.
5. **M2**: fix Reaction Time's Space/button interaction.
6. **H3/H4**: make the privacy e2e real with a configured build; add 3D input and disposal assertions.
7. **H6/D1/D2/D3**: correct the verification table and the three factual doc errors.

### P1 — next (quality and resilience)

8. Validate admin edit patches or gate the admin merge behind `DEV`; stop writing `admin:v1` for every visitor (**H5/S2**).
9. Fix mute desync, post-finish render/audio, alt-tab pause, context loss, first-checkpoint spawn and HUD throttling (**M3–M8**).
10. Add route-change focus management and fix the disabled-cell focus loss; remove `focus:outline-none` from the three inputs (**A1/A4/A5**).
11. Add per-route static metadata and PNG OG images, and return real 404s (**E1/E2**).
12. Make error-boundary retry reload for chunk failures (**T4**); switch CI to Node 24 and typecheck `e2e` (**T1/T2**).

### P2 — polish

13. Fix the remaining Low items: 90-second wording, architecture claims, dead code, countdown, fullscreen resize, clipboard guard, PWA icons, sharing copy.
14. Add lint/format and coverage thresholds, and expand the axe gate to the consent banner, legal pages and in-game HUD.

---

## 7. Method and limits

- Read every file under `src/`, `e2e/`, `public/`, `.github/` and the top-level configs; read the README, the research index, roadmap, architecture, shortlist and design docs; inspected the production `dist` bundle and generated `sitemap.xml`/`robots.txt`.
- Re-ran typecheck, unit tests, build and dependency audit. Browser tests could not execute in this sandbox (`spawn EPERM`), so all browser-behaviour findings are from source/test inspection, not a live run. The existing `test-results/.last-run.json` reports `"status": "passed"` from an earlier run, but that is not independent verification.
- Runtime claims about axe results, gzip sizes, the old "2.4 minutes" figure and GitHub-API research metadata were not re-verified. The 561.57 kB raw chunk, 140.51 kB gzip, 234/66 test counts, 19 repo rows and 11 feasibility scores were verified.
- No source file was modified; the only temporary artefact was removed and the git tree is clean.
