# NeonRift development report — Neon Coast cycle and platform defects

- Date: 2026-11-09
- Branch: `feat/neon-coast` (branched from `feat/games-wave2` at `e48d50d`)
- Scope: Phase 1 defect fixes to the three existing 3D games, and the Neon Coast:
  After Hours vertical slice (Phases 2–7 of the cycle directive)
- Evidence: every figure below comes from a command run on 2026-11-09. Commands are
  listed in §7 so the results can be reproduced.

## 1. Result

The repository now ships **39 original browser games**. The new entry is
**Neon Coast: After Hours**, a top-down open-district adventure set in the fictional
Solara Bay. It has one playable district (Vela), an on-foot character, one original car
with arcade physics, ambient traffic and pedestrians, three handcrafted missions plus a
repeatable challenge, a tutorial, progression with browser-local saves, and desktop and
touch controls.

The three previously shipped 3D games also received lifecycle, HUD-rate and input fixes
that were found by auditing them rather than by any reported failure. All three fixes
carry regression tests, and two of them are now proven in a browser with real key events.

The 1000-game target remains a programme, not a library: 39 games exist and 961 are
planned in [`../games/1000-game-expansion-program.md`](../games/1000-game-expansion-program.md).
No placeholder catalogue records exist.

## 2. Defects fixed (Phase 1)

| # | Defect | Fix | Regression proof |
|---|---|---|---|
| 1 | **Neon City Drive checkpoints could be unreachable.** Gate progression advanced on a radius test that ignored the track's own geometry, so a gate could be reported missed while the car was physically unable to reach it. | `advanceCheckpoint` in a new `src/games3d/driving/progress.ts`; `checkCheckpoint` now delegates to it. | `progress.test.ts` (3 tests, seen red before implementation) plus a real-key browser run that drives to gate 1 and observes the HUD flip to Gate 2. |
| 2 | **3D audio mute did not survive a restart or reload.** The engine re-created its audio graph on restart and initialised the master gain as if sound were on. | The engine constructor reads the persisted mute preference; `GameAudio.stopMusic()` was added so finishing a run stops background music without suspending the whole context. | Unit test asserts master gain is `0` on a muted engine and `0.7` after unmuting; `gameplay3d.spec.ts` reloads the page and confirms the mute state persists. |
| 3 | **A finished 3D run kept simulating, rendering and playing audio** behind the results dialog, burning frames and leaking the loop into a restart. | New shared `AnimationLoop`: every finish path stops the loop and stops background audio; restart constructs a fresh engine; dispose cancels listeners, timers, RAF and the WebGL context. `StadiumAudio.pauseSoon()` covers the football cue tail. | `animationLoop` unit tests (seen red while the module was missing) and browser pause/restart coverage in `gameplay3d.spec.ts`. |
| 4 | **HUD emitted React state on every frame** in the 3D games, causing 60 renders per second while the underlying values were unchanged. | `HudPump` emits at most 10 times per second and skips structurally equal payloads; the countdown is an integer, so it only emits when it changes. | `hudPump` tests: 60 frames yield 10 emissions, and identical payloads are skipped until forced. Float accumulation made the interval check use a 1e-6 epsilon. |
| 5 | **Neon Coast queued input could vanish.** An `interact` or `acceptMission` tap was cleared on a zero-delta frame before any simulation step consumed it, so the first E press or mission accept could be dropped. | The engine clears queued taps only when at least one fixed step ran. | Engine suite regression tests (9 tests in the suite). |

A sixth issue was found in the test harness, not the product. The Neon Coast
end-to-end completion test assumed its final waypoint would always register; completing
the mission freezes the world, so the walk could stall just short of the marker. The
helper now stops as soon as the results dialog opens. Recorded in §6.

## 3. What shipped in Neon Coast

| Area | Delivered |
|---|---|
| District | Vela — 2400×2000 units, four vertical and four horizontal roads, buildings and props per block, eight landmarks, one paved garage forecourt |
| On foot | Walk 120 u/s, sprint 175 u/s, 900 u/s² acceleration, circle collision against shared building/prop rectangles |
| Driving | One original car: 430 u/s top speed, 260 acceleration, 480 braking, 160 reverse, 2.4 rad/s steering, handbrake with steering boost, 25% speed retained on collision, enter/exit radius 110 |
| Ambient life | Six traffic cars on seeded block loops that brake for a walker ahead; nine pedestrians with walking, pausing and turning moods |
| Missions | Tideglass Courier (pickup then delivery, 100 s, $450), Lantern Circuit (eight ordered gates, requires a vehicle, 100 s, $800), Landmark Trail (five of eight landmarks, 180 s, $600), Glow Run (eight seeded shards, 90 s, $40 per shard plus a $250 sweep, repeatable) |
| Progression | Sequential unlocks, cash rewards, per-mission best times, best Glow Run score, discovered landmarks, five ranks (Newcomer → Coast Legend) |
| Persistence | Versioned save under `neonrift:game:neon-coast:save`; version, cash, completed ids, best times, glow score, discovered ids, tutorial flag and sound flag validated on load; corrupt or blocked storage falls back to defaults |
| Presentation | Canvas 2D with a cached 0.5-scale district layer, dynamic actors, mission overlay and a 300-second day/night tint; compact 132×110 minimap; 10 Hz HUD pump |
| Controls | Desktop WASD/arrows, Shift sprint, E interact, Escape pause; touch drag joystick plus hold pedals with ≥44 px targets and separate on-foot/driving layouts; fullscreen and resize handling; no page scrolling during play |
| Access | Tutorial coach marks, accessible dialog roles, labelled buttons, reduced-motion respect, clear objective text readable within 15 seconds |

## 4. Files

New module `src/games/neon-coast/`:

| File | Responsibility |
|---|---|
| `engine.ts` | Fixed-step loop, phases, HUD pump, input queue, mission lifecycle |
| `simulation.ts` | Step orchestration, day/night clock, catch-up clamping |
| `world.ts` | District geometry, roads, blocks, landmarks, shared obstacle rectangles |
| `player.ts` | On-foot movement and collision resolution |
| `vehicle.ts` | Arcade car physics, enter/exit |
| `traffic.ts` | Seeded traffic and pedestrian behaviour |
| `missions.ts` | Mission definitions, objective markers, completion and rewards |
| `persistence.ts` | Versioned save validation and fallback |
| `random.ts` | Seeded `mulberry32` generator |
| `render.ts` | Canvas 2D district, actors, overlay and tint |
| `audio.ts` | Procedural Web Audio cues and engine hum |
| `controls.tsx` | Touch joystick and pedals |
| `NeonCoastGame.tsx` | React shell, dialogs, tutorial, toolbar, minimap |

Tests: `engine.test.ts`, `simulation.test.ts`, `world.test.ts`, `player.test.ts`,
`vehicle.test.ts`, `traffic.test.ts`, `missions.test.ts`, `persistence.test.ts`,
`NeonCoastGame.test.tsx` — 9 files, 86 tests.

Platform changes:

| File | Change |
|---|---|
| `src/games3d/shared/animationLoop.ts` (new) | Shared start/stop loop with dispose, adopted by the 3D games |
| `src/games3d/shared/hud.ts` (new) | `HudPump`: 10 Hz deduplicating HUD emitter, reused by Neon Coast |
| `src/games3d/driving/progress.ts` (new) | `advanceCheckpoint` used by Neon City Drive |
| Driving, racing, time-trial, football, rally and cricket engines | Loop and finish-path lifecycle wired to the shared helpers |
| `src/games/registry.ts`, `src/data/games.json` | `neon-coast` registration, catalogue record (rank 39, adventure/racing/casual, featured) |
| `public/art/neon-coast.svg` (new) | Original key art |
| `e2e/neon-coast.spec.ts` (new) | Ten browser scenarios |
| `e2e/gameplay3d.spec.ts` (new) | Real-input coverage for Apex Time Trial, Neon City Drive and Riftfall |
| `e2e/navigation.spec.ts`, `e2e/gameplay.spec.ts` | Count updated 38 → 39; Neon Coast case added |
| `vitest`/Playwright config | Local e2e workers capped at 4 |

Documentation: `docs/games/neon-coast.md` (new), `README.md`,
`docs/games/1000-game-expansion-program.md`, `docs/research/ARCHITECTURE.md`,
`docs/research/ROADMAP.md`, `docs/research/README.md`, and a superseded-snapshot note on
`docs/audits/2026-11-09-final-report.md`.

## 5. Tests actually run

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | Clean |
| Unit | `npm test` | **136 files, 1176 tests passed** (73.73 s) |
| Neon Coast unit subset | `npx vitest run src/games/neon-coast` | 9 files, 86 tests passed (6.19 s) |
| Production build | `npm run build` | Succeeded in 3.31 s. Neon Coast chunk 55.24 kB raw / 17.89 kB gzip; shared Three.js chunk 567.22 kB raw / 140.83 kB gzip, lazy-loaded |
| Bundle budget | `npm run check:bundle` | Entry 128.7 kB gzip, 8 initial assets, 39 lazy game chunks, Three.js 553.9 kB raw — budgets met (170 kB initial gzip, 600 kB per chunk) |
| Browser, CI concurrency | `npx playwright test --workers=2` | **212 passed** (13.5 min) |

Neon Coast browser scenarios (ten): launch and a 15-second objective read; walking with
real key events; entering, driving and exiting the Vela car; a complete Tideglass Courier
run with the results dialog, persistence, reload and unlock; pause, resume and restart
with the clock frozen while paused; corrupt-save recovery; window resize; the game's own
fullscreen toggle; route-away cleanup; mobile layout at 390×844 with a joystick and six
driving controls all at least 44 px and a pointer-held accelerator.

**Disclosed failure mode:** at the local default of 4 Playwright workers the full suite
was **208 passed / 4 failed**; Street Cricket and Rift Rally gameplay tests hit the 45 s
timeout under CPU contention (each needs ~49 s) and the Neon Coast completion test failed
for the walk-past-freeze reason in §2. At the repository's CI concurrency of 2 workers the
entire suite passes with no retries and no skips. The 2-worker result is the gate result;
the 4-worker flake is real and is not hidden.

## 6. Manual play and the harness finding

A full Tideglass Courier run was played in Chromium using only keyboard events — no
teleports, no debug hooks, no injected state. The minimap was read to navigate, the
mission card was nudged into view, and the drop-off was reached from the pickup:

- First pass: **40.0 s** wall clock inside the 100 s mission limit; results showed
  `+450`, rank `Local`, and a personal best; the save held
  `{version:1,cash:450,completed:['tideglass-courier']}`; after reload the HUD showed
  `$450`, `Local`, `1/4` and Lantern Circuit was unlocked.
- A later isolated run failed with
  `Waypoint 1160,950 not reached; last {"player":{"x":1173.995,"y":904.255},…}`. A
  temporary `vite-node` probe (deleted afterwards) walked the same segment and confirmed
  there is no physical obstacle. Playwright's failure snapshot showed the
  "Mission results" dialog already open — the mission had completed mid-walk and frozen
  the world, so the waypoint could never register. The helper now stops when the results
  dialog appears; the rerun passed in **24.0 s**.

No human player was available. "Manually played" here means a scripted session using real
browser input and observable UI state, not a human on the keyboard. The mission was
completed start to finish; Lantern Circuit, Landmark Trail and Glow Run were not played
end to end in a browser.

## 7. Performance measurements

| Measurement | Value | Evidence |
|---|---|---|
| HUD emissions | ≤10 per second, identical payloads skipped | Unit assertion: 60 frames produce 10 callbacks; a change every frame produces at most 10 in 0.6 s |
| Simulation step | Fixed 1/60 s, at most 5 catch-up steps, frame delta clamped to 0.25 s | `simulation.test.ts` |
| Neon Coast payload | 55.24 kB raw / 17.89 kB gzip | `npm run build` |
| Initial gzip | 128.7 kB against a 170 kB budget | `npm run check:bundle` |
| Shared Three.js | 567.22 kB raw / 140.83 kB gzip, absent from the initial bundle | Build output; guard reports 553.9 kB raw |

**No frame-rate claim is made.** Frame rate was not instrumented in a profiled browser
session, so no FPS figure is reported.

## 8. Limitations

- One district only. Vela ships; the other Solara Bay districts are documented designs,
  not features.
- Progress, best times and Glow Run scores are stored in this browser. There is no
  account, cloud save, global leaderboard, multiplayer or real player statistic.
- Missions are handcrafted and finite. Three are one-time completions; Glow Run is the
  only repeatable activity.
- The Neon Coast browser suite exercises launch, movement, vehicle use, one full mission,
  persistence, pause/resume/restart, resize, fullscreen, cleanup and mobile layout. Lantern
  Circuit, Landmark Trail and Glow Run are covered by unit tests only.
- The Neon City Drive browser case drives to the first gate; it does not finish a race.
- The full e2e suite needs CI concurrency (2 workers) to pass reliably on this machine.
- The Content-Security-Policy is still report-only. No ads or analytics are enabled.
- No proprietary assets, characters, maps, vehicles, scripts, logos or music are used.
  Solara Bay, Vela, the car and every mission are original to this project.

## 9. Commit and push status

Branch `feat/neon-coast`, based on `feat/games-wave2` at `e48d50d`. Cycle commits:

```
8344c38 docs: add Neon Coast design spec and 14-task implementation plan
79b3bd8 fix(3d): stop rendering and background audio when a run finishes
e0912db perf(3d): throttle HUD emission and skip identical React updates
2d45294 test(3d): prove checkpoint reach and mute persistence across restarts
1f8ca8f test(3d): assert real movement, checkpoint progression and mute persistence
0efec95 feat(neon-coast): model the Vela District world
dc4adaf feat(neon-coast): add on-foot movement and arcade driving
ca03e53 feat(neon-coast): add traffic and pedestrian behaviours
4309f89 fix(neon-coast): drop the unused traffic count constant
c3eb82d feat(neon-coast): add missions, rewards and progression
43885cb feat(neon-coast): add deterministic simulation and versioned saves
b8a93f3 feat(neon-coast): add the Canvas 2D engine, renderer and audio
e92931e feat(neon-coast): add the playable shell, tutorial and touch controls
100d570 feat(neon-coast): register and catalogue the Solara Bay slice
5bed7c7 test(neon-coast): cover movement, missions, persistence and mobile
```

Every commit on this list was pushed to `origin/feat/neon-coast` and the remote head was
verified after each push. The e2e harness fix and the documentation commit that follow
this report are pushed in the same cycle; the verified remote head is recorded in the
task ledger at `.superpowers/sdd/2026-11-09-neon-coast/progress.md`.

No deployment was performed. `feat/neon-coast` is not merged. No existing game was
removed and no test was deleted or weakened to make a gate pass.
