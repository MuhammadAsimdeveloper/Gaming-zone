# Repository Audit — 2026-11-07

**Repository:** `https://github.com/MuhammadAsimdeveloper/Gaming-zone`
**Branch inspected:** `feat/games-wave2`
**Commit inspected:** `7756a14401e14787e2d308429ab0ebae0ea8ac89` (`feat(craft): add greedy mesher with ambient occlusion`)
**Working tree:** clean at the start of the audit (only `test-results/` artefacts from the browser run, which are git-ignored)
**Audit method:** commands were executed against this checkout; every result below is copied from actual output. Nothing in this report is inferred from documentation counts alone.

---

## 1. Baseline verification

| Command | Result | Evidence |
| --- | --- | --- |
| `npm ci` | **exit 0** | `found 0 vulnerabilities` |
| `npm run typecheck` | **exit 0** | no diagnostics |
| `npm test` | **exit 0** | `Test Files 79 passed (79)`, `Tests 719 passed (719)`, 59.57 s |
| `npm run build` | **exit 0** | built in ~10 s; `dist/assets/scenery-DyPD_8pX.js 565.24 kB │ gzip: 141.54 kB`; Vite warns about a chunk larger than 500 kB |
| `npx playwright install chromium` | **exit 0** | Chromium and headless shell installed |
| `npx playwright test --workers=2` | **exit 1** | `94 passed`, `2 failed` in 11.3 min |

The two browser failures are real and are listed as defects in §6. The Playwright wrapper printed `PW_EXIT:1`; the run is **not** green.

### Failed browser tests

1. `e2e/apex-time-trial.spec.ts:89` — *apex time trial on mobile › exposes on-screen steering, drift and pedals*
   - Error: `Tearing down "context" exceeded the test timeout of 45000ms.`
   - All locator assertions had completed; the failure is in browser-context teardown. This is consistent with a WebGL renderer or animation loop that does not stop when the page is closed. Root cause is not yet proven.
2. `e2e/gameplay.spec.ts:359` — *mobile input and hidden-tab fairness › reaction time re-arms the round after the tab is hidden*
   - Error: `expect(locator).toBeVisible() failed` for `^False start — 500 ms`.
   - Page snapshot shows round 1 already recorded at **4167 ms** and the panel in the green state. After four hidden seconds the round resolves instead of being re-armed, so the next click is a valid reaction rather than a false start. This is a product defect, not a flaky locator.

---

## 2. Repository identity and catalogue

- The workspace is the correct repository; `origin` points at `MuhammadAsimdeveloper/Gaming-zone`.
- **Actual game count: 32.** Derived from `src/data/games.json`, not from prose.
- Category distribution: arcade 4, strategy 4, puzzle 2, casual 2, educational 1, racing 3, sports 4, simulation 12.
- **Catalogue ↔ registry:** 32 catalogue records, 32 keys in `src/games/registry.ts`, and the two sets of `internalKey` values match exactly. No duplicate ids or slugs. Every local thumbnail referenced by the catalogue exists. No record currently points at an external URL.
- Every published game renders: `e2e/navigation.spec.ts` (“every published game page renders its runtime”) visits all 32 slugs, and `e2e/gameplay.spec.ts` boots, starts and unmounts each of the 32 games. Both tests passed in the run above.
- The catalogue has no explicit `status`/`published` field; all 32 records are implicitly published. Any future sitemap or “index only published games” work must therefore keep using the single catalogue as the source of truth.

---

## 3. Architecture

- React 19.3.1, TypeScript 5.9.3 (strict), Vite 8.3.5, Tailwind CSS 4.3.3, React Router 7.18.5, Three.js 0.187, Vitest 5.0.5, Playwright 1.64.1, `chess.js` 1.4.
- Route pages in `src/pages/`, shared components in `src/components/`, state in `src/providers/`, catalogue in `src/data/games.json`, lazy game mapping in `src/games/registry.ts`, 2D games in `src/games/`, 3D engines and games in `src/games3d/`, platform utilities in `src/lib/`, browser tests in `e2e/`.
- The shared player (`GamePage.tsx`) wraps an internal React game or an external iframe; games clean up their own RAF/timers/listeners.
- Neon Craft foundation modules exist: `blocks.ts`, `noise.ts`, `terrain.ts`, `world.ts`, `light.ts`, `mesher.ts`. There is no `raycast.ts` and no playable Neon Craft component yet.

---

## 4. Genuinely implemented

- Catalogue, search, category and listing pages, favorites, recently played, game detail and player shell, fullscreen, pause/resume, restart.
- 32 original games across arcade, strategy, puzzle, casual, educational, racing, sports and simulation, including 3D racing, football and open-world driving.
- Shared design system (light editorial shell, dark player), responsive layouts and touch controls on the games that declare them.
- Local-first progress, favorites and records via `localStorage`.
- Consent separation for analytics and advertising (`src/lib/consent.ts`), both opt-in.
- External-game URL validation with HTTPS-only origins, credential rejection and a development-only localhost exception (`src/lib/embed.ts`).
- SEO metadata, Open Graph image, JSON-LD in the app shell; SPA redirects.
- Unit suite covering rules, engines, persistence and platform utilities (719 tests).
- Browser suite covering navigation, every game page, gameplay flows, mobile input, hidden-tab behavior, privacy in the unconfigured build, accessibility (axe) on five routes at three widths.

## 5. Partially implemented

- **Neon Craft:** world generation, chunk storage, lighting and a greedy mesher exist; there is no raycast, controller, inventory, crafting, farming, survival, creatures, save UI or game component. The mesher is committed but its tests take a shortcut that violates the Bedrock invariant (finding C-02).
- **Privacy verification:** only the default unconfigured build is tested. There is no configured-consent environment proving opt-in, denial, category independence, revocation or reload persistence.
- **External game embedding:** validation and sandbox exist, but the sandbox uses `allow-scripts` together with `allow-same-origin`, and same-origin embeds are not explicitly rejected.
- **Admin:** dormant browser-only scaffolding exists; it is not an authentication boundary.
- **SEO:** per-page metadata exists; there is no `robots.txt` or `sitemap.xml`, and no build step derives one from the catalogue.
- **CI:** installs, typechecks, unit-tests, builds and runs Chromium tests, but only on `main`/`master` and pull requests.

## 6. Missing

- Playable Neon Craft and the five Wave 2 companion games (Rift Rally, Neon Duel, Riftfall, Rift Life, Rift Ecology).
- Content-Security-Policy in `public/_headers`.
- Configured-consent automated tests.
- Feature-branch CI verification.
- `robots.txt`, `sitemap.xml`.
- Bounded chunk streaming, benchmark harness and render-distance settings.
- Reduced-motion support in the games named in the enhancement report.
- A published-game flag and any catalogue-scaling machinery beyond the documented 1000-game program.

---

## 7. Findings by severity

### Critical

**C-01 — CI never verifies `feat/games-wave2`.**
`.github/workflows/ci.yml` triggers only on pushes to `master`/`main` and on pull requests. Every commit on the active development branch (including the six Neon Craft commits) reaches the remote unverified by CI. Directive B1 requires feature-branch pushes.

**C-02 — `VoxelWorld.applyEdits()` bypasses the Bedrock invariant.**
`src/games3d/craft/world.ts:148` revalidates coordinates and block ids but records every edit without checking the current block. `setBlock` refuses to overwrite Bedrock (`world.ts:101`), but a save overlay containing `y = 0` edits is replayed over the generated floor. `src/games3d/craft/mesher.test.ts` currently relies on this gap to clear chunk `(0,0)`. Directive D2 explicitly forbids untrusted save data from bypassing protected Bedrock.

### High

**H-01 — Two baseline browser failures.** Reaction Time hidden-tab round resolution is a product defect. Apex Time Trial mobile teardown timeout points at renderer/loop cleanup and must be reproduced and fixed, not retried.

**H-02 — External iframe sandbox is over-permissive for same-origin embeds.**
`src/pages/GamePage.tsx:325` uses `allow-scripts allow-same-origin`. For a document on the parent origin that combination defeats the sandbox. `validateExternalGameUrl` does not reject a URL whose origin equals the site origin. No external game is configured today, so the risk is latent, but directive B3 requires an explicit rejection and sandbox review.

**H-03 — Privacy claims are under-tested.**
`e2e/privacy.spec.ts` covers only “nothing loads before consent in the default build”. The required matrix — analytics opt-in, advertising opt-in, category independence, denial, revocation, reload persistence — is absent. Timezone is used only as a hint and that is correctly not treated as proof of location.

**H-04 — No Content-Security-Policy.**
`public/_headers` ships `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`, but no CSP. A report-only policy must be designed around React/Vite output, Three.js, workers, optional analytics/AdSense and approved frames before anything is enforced.
*Resolved 2026-11-07:* a report-only policy now ships from `public/_headers` and is served by the preview server. Enforcement remains open. See [`2026-11-07-csp-evaluation.md`](2026-11-07-csp-evaluation.md).

**H-05 — Neon Craft cannot be played.**
No raycast, controller, inventory, crafting, farming, survival, creatures or save flow. The flagship Wave 2 game cannot be registered until the loop in directive D11 completes.

### Medium

**M-01 — Scenery chunk exceeds the 500 kB warning threshold** (565.24 kB raw, 141.54 kB gzip). Investigate splitting the shared 3D scenery and lazy-loading per game.

**M-02 — Documentation is stale.** `README.md` still states Wave 2 “none of it is implemented” and that no game code exists, while six foundation modules are committed. The 32/968 counts are correct.

**M-03 — No `robots.txt` or `sitemap.xml`.** Crawlers rely on defaults; sitemap generation must follow the catalogue so unlisted games cannot be indexed.

**M-04 — Admin scaffolding could be mistaken for authentication.** Browser-only passcode handling must stay clearly labelled local-only; no backend/auth system exists.

**M-05 — Catalogue has no explicit publication state.** Today all 32 games are published, but SEO, listing and sitemap logic cannot distinguish draft records if the catalogue grows.

**M-06 — Lighting cost.** `computeChunkLight()` snapshots a padded 3×3 chunk region through `world.getBlock()`, which can generate and cache neighbouring chunks. There is no measurement of the cost per chunk, and no dirty-queue or incremental relight strategy.

**M-07 — Mesher quality gaps** (parked from the Task 6 report): out-of-chunk neighbour light reads as 0, producing dark border faces; water and lava share the transparent bucket; no AO diagonal flip; ~24 ms per chunk versus a 4 ms target.

### Low

- `e2e/a11y.spec.ts` sweeps only `/`, `/games`, `/about`, `/game/neon-apex` and `/game/neon-snake`; the other 27 game pages are not axe-audited.
- No performance regression harness for chunk generation, meshing, lighting or memory.
- The 1000-game program is documentation only; no kit or variant generator exists yet.

---

## 8. Security and privacy observations

- External URLs must be HTTPS, may not embed credentials, and must match an allowlist; lookalike subdomains and same-origin-as-parent URLs are not separately tested (same-origin is a real gap — H-02).
- `javascript:` and `data:` URLs already fail the protocol check; that must be locked in by tests.
- Iframes use `referrerPolicy="no-referrer"` and a restrictive `allow` list.
- Consent is opt-in for both categories; neither category implies the other; storage keys are namespaced.
- No analytics or advertising provider is configured or loaded by default, and the unconfigured-build test verifies zero external requests.
- No secrets, environment files or provider keys are committed.

## 9. Gameplay defects to fix (Phase C backlog)

1. 3D mute settings do not persist.
2. Neon Apex countdown timing.
3. Rock Paper Scissors timer behavior in a hidden tab.
4. Snake keyboard event scoping.
5. Math Sprint live-region announcements and timing.
6. Rift Hospital difficulty target tuning.
7. Park Pulse difficulty target tuning.
8. Factory Line difficulty target tuning.
9. Cargo Ring score target versus starting-reserve consistency.
10. Reduced-motion behavior in Snake, Signal Stack and Rift Runner.
11. Reaction Time resolves a round after the tab is hidden instead of re-arming (baseline failure).
12. Apex Time Trial mobile teardown timeout (baseline failure; needs reproduction).

## 10. Performance risks

- 565 kB shared scenery chunk shipped to every 3D game.
- Unbounded chunk cache and generation; no render-distance control.
- Full 3×3 lighting snapshot per chunk with possible neighbour generation.
- Mesher is ~6× slower than the target and emits black border faces.
- No measured frame budget, memory ceiling or WebGL disposal test beyond “unmounts cleanly”.

## 11. Accessibility observations

- Axe passes on the sampled routes; keyboard and touch flows are covered for many games.
- Missing coverage: the remaining 27 game pages, dynamic live regions during play, and reduced-motion variants.
- Reduced-motion gaps are already documented for Snake, Signal Stack and Rift Runner.

## 12. Test coverage summary

| Layer | Count | Status |
| --- | --- | --- |
| Unit / integration (Vitest) | 79 files, 719 tests | all passing |
| Browser (Playwright) | 96 tests, 12 specs | 94 passing, 2 failing |
| Accessibility | 5 routes × 3 widths + axe on game player | passing |
| Catalogue/registry integrity | 32 records ↔ 32 keys, thumbnails present | passing (audited manually) |

---

## 13. Ordered next-development plan

1. **Restore a green baseline (test-first):** reproduce and fix the Reaction Time hidden-tab round and the Apex Time Trial teardown; keep both tests as regression gates.
2. **Phase B1:** run CI on every branch push; keep artefact upload on failure.
3. **Phase B3:** add malicious/malformed URL tests, reject same-origin embeds, re-review sandbox flags.
4. **Phase B2:** configured-consent test environment with intercepted provider requests and the full consent matrix.
5. **Phase B5:** report-only CSP designed around the real feature set.
6. **Phase B4:** document admin as local-only scaffolding; no security claims.
7. **Phase C:** fix the ten backlogged gameplay defects plus the two baseline failures, each with a regression test; tune difficulty with simulation-first tests.
8. **Phase D:** resume Neon Craft. First rule on the mesher fixture and fix `applyEdits` Bedrock protection, then add DDA raycast, controller, mining/building, crafting (≥24 recipes), farming, survival, creatures, saves and streaming. Register and publish only after the full D11 loop passes in a browser on desktop and mobile.
9. **Phase E:** build Rift Rally and Neon Duel, then Riftfall, Rift Life and Rift Ecology, one at a time, each with deterministic rules tests and dedicated Playwright coverage.
10. **Phase F:** code splitting, accessibility sweep across all games, sitemap/robots, advertising validation.
11. **Phase G:** real kit/variant scaling per the 1000-game program. No placeholder catalogue entries and no palette swaps.

---

## 14. Evidence appendix

```
$ npm ci                     → exit 0, found 0 vulnerabilities
$ npm run typecheck          → exit 0
$ npm test                   → Test Files 79 passed (79); Tests 719 passed (719); 59.57s
$ npm run build              → exit 0; scenery-DyPD_8pX.js 565.24 kB (gzip 141.54 kB)
$ npx playwright install chromium → exit 0
$ npx playwright test --workers=2 → 94 passed, 2 failed (11.3m), exit 1
```
