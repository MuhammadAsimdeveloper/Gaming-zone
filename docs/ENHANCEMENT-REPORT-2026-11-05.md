# NeonRift — 25-Game Enhancement Report (+ Rift Chess, Wave 1)

**Date:** 6 November 2026  
**Branch:** `feat/games-wave2` (base commit `0456c2c`)  
**Scope:** the 25 previously shipped internal games, the shared game frame/HUD primitives, the 3D engine layer, and the new Wave 1 game Rift Chess.  
**Mode:** read the implementation and existing tests, reproduced defects with failing tests before fixing, then re-ran the full verification suite. No game was deleted, no test was removed to make the build pass, and no dependency was added beyond chess.js (BSD-2-Clause) for Rift Chess.

This report is the Phase A deliverable requested in the master development prompt. It records what was verified, what changed, and what remains. Rift Chess (Wave 1) is now shipped; the other 15-game shortlist titles and the six-game Wave 2 spec remain designs only and have no catalogue entries.

---

## 1. Verification snapshot

| Command | Result |
|---|---|
| `npm run typecheck` | **Pass** — no output |
| `npm test` | **407 tests passed in 45 files** |
| `npm run build` | **Pass** — Rift Chess chunk 77.37 kB raw / 24.96 kB gzip; Three.js scenery 561.42 kB raw / 140.60 kB gzip still triggers the existing >500 kB warning |
| `npx playwright test --workers=2` | **76 tests passed in 6 files** |

Unit coverage relevant to this pass:

- 14 simulation shells (Rift Transit, Grid Supply, Rift Colony, Orbit Market, Neon Diner, Skyport, Rift Hospital, Park Pulse, Factory Line, Cargo Ring, Aqua Grid, Signal Stack, Rift Runner, Rift Tactics) each assert that the start action leaves the ready state, that timers/frames tick, and that no `console.error` is emitted.
- Pure-simulation suites for diner economy, colony outcome, harvest upkeep, signal-stack completion, drive checkpoints, insolvency and best-score persistence.
- Shared primitives: visibility pause (6), keyboard guarding (4), overlay dialog focus (2), button touch targets (3), best score (3), WebGL context loss (2), Rift Runner rendering (2), Rift Tactics log announcements (1).
- Rift Chess: rules adapter, clock, puzzle data, AI worker protocol, persistence, audio (10 tests) and 18 component tests covering keyboard play, drag-and-drop, promotion, undo, puzzles, mute and 320px layout.

The browser suite numbers are recorded in the README. Unit tests mock the canvas and WebGL boundaries; they do not replace a real-browser frame render.

---

## 2. Ranked highest-impact fixes

Ordered by player impact. Every item below was reproduced with a failing test (or, for the audio/WebGL items, a missing behaviour confirmed in code) before the fix.

| Rank | Priority | Defect | Fix |
|---|---|---|---|
| 1 | P1 | **Neon Diner price gouging dominated every strategy.** Maxing prices beat a balanced menu over a full season. | Demand now falls super-linearly with menu price, and reputation tracks fairness, so gouging loses regulars and ends below the reputation floor. |
| 2 | P1 | **Neon City Drive started the first checkpoint on the spawn point.** A gate at the player's starting position made the opening route ambiguous. | Spawn and checkpoint radius are exported constants; the first gate sits outside the spawn radius; tests assert every gate is on a road junction and no gates repeat back-to-back. |
| 3 | P1 | **Rift Colony ignored its own morale floor.** A colony with collapsing morale could still be reported as a win. | `colonyOutcome` requires both the score target and morale ≥ 50; the result overlay and completion payload use it. |
| 4 | P1 | **Neon Harvest charged water and energy for mature crops.** Already-grown plots kept consuming upkeep every day. | Mature plots are skipped by watering and daily upkeep; tests assert no water, moisture or energy is spent on them. |
| 5 | P1 | **Signal Stack had no end state.** A perfect player could stack forever, and the marker forced a React re-render every frame. | A 20-block target ends the run as a win; the marker is moved through a DOM ref inside the animation frame; the drop hotkey no longer fires while a button is focused. |
| 6 | P1 | **Rift Runner re-rendered the whole frame and reset the canvas bitmap every frame.** | The simulation runs in a ref, the canvas is painted directly from the loop, and the HUD updates at 10 Hz. A regression test proves the canvas is sized once and the HUD still advances. |
| 7 | P1 | **Rift Hospital, Factory Line and Aqua Grid allowed unbounded negative credits.** Insolvency had no consequence until the season ended. | Each simulation closes early when the day's result leaves credits below zero, with an explicit "Insolvent" log entry. |
| 8 | P1 | **Shared best-score persistence mishandled values.** Negative scores were clamped to zero, and a stale tab could overwrite a better score. | `useBestScore` stores exact scores and merges the stored value with the in-memory best per tab before writing. |
| 9 | P1 | **WebGL context loss left the 3D games silently frozen.** | New `useWebGLContextLoss` hook and a polite status notice; Neon Apex, Rift Striker and Neon City Drive pause on loss and resume on restore. |
| 10 | P1 | **Pausing ignored tab blur and page hide.** Games kept simulating behind other windows on browsers that do not fire `visibilitychange` first. | Shared `useVisibilityPause` now listens to `blur` and `pagehide` as well as `visibilitychange`. |
| 11 | P1 | **Game hotkeys hijacked focused controls.** Space/arrow handlers ran even when a button inside the game had focus. | Shared `isInteractiveTarget` guard used by Signal Stack and Rift Runner. |
| 12 | P2 | **Overlays were visually modal but semantically invisible.** Screen readers were not told a dialog opened, and focus stayed behind it. | `GameOverlay` is a labelled dialog, receives focus on mount, and returns focus to the game frame on close. |
| 13 | P2 | **Small and icon buttons missed the 44px touch target on touch devices.** | `GameButton` `sm` and `icon` sizes grow to 44px under `pointer: coarse`. |
| 14 | P2 | **The Rift Tactics battle log was silent to assistive technology.** | The log is `role="log"`, `aria-live="polite"`, `aria-relevant="additions"`. |
| 15 | P2 | **The Neon Apex engine drone kept playing after the finish line.** | Engine volume is set to near-silence before the finish chime. |
| 16 | P2 | **The smoke suite asserted only that the game title was present before the click.** | Fourteen shells now prove the start action, timer/frame ticks and error-free runtime. |

---

## 3. Per-game status

| # | Game | Technology | This pass |
|---|---|---|---|
| 1 | Neon Snake | Canvas 2D | Audited; no gameplay defect reproduced. Existing browser tests cover launch, input and game over. A deferred finding (over-broad `preventDefault`) is listed in the backlog. |
| 2 | Tic-Tac-Toe | React | Audited; no defect reproduced. Covered by browser tests. |
| 3 | Memory Match | React | Audited; no defect reproduced. Covered by browser tests. |
| 4 | Rock Paper Scissors | React | Audited; no defect reproduced. Hidden-tab timer behaviour remains a backlog item. |
| 5 | Reaction Time Challenge | React | Audited; no defect reproduced. Covered by browser tests. |
| 6 | Rift Breaker | Canvas 2D | Audited; no defect reproduced. Covered by browser tests. |
| 7 | Math Sprint | React | Audited; live-region and tick-cadence improvements remain backlog items. |
| 8 | Neon Apex | Three.js | Engine audio now stops at the finish; WebGL loss notice wired. Browser QA of the finish sequence is pending. |
| 9 | Rift Striker | Three.js | WebGL loss notice wired. Keyboard capture was repaired in the preceding remediation; no new defect reproduced. |
| 10 | Neon City Drive | Three.js | Spawn/gate constants fixed; first gate moved off the spawn; WebGL loss notice wired. |
| 11 | Neon Harvest | React | Mature-crop upkeep fixed with tests. |
| 12 | Rift Transit | React | Smoke-tested start/tick. No defect reproduced. |
| 13 | Grid Supply | React | Smoke-tested start/tick. No defect reproduced. |
| 14 | Rift Colony | React | Morale floor now enforced in the outcome. |
| 15 | Orbit Market | React | Smoke-tested start/tick. No defect reproduced. |
| 16 | Neon Diner | React | Pricing and reputation model fixed with tests. |
| 17 | Skyport | React | Smoke-tested start/tick. No defect reproduced. |
| 18 | Rift Hospital | React | Insolvency now ends the season early. Target tuning remains open. |
| 19 | Park Pulse | React | Smoke-tested start/tick. Target tuning remains open. |
| 20 | Factory Line | React | Insolvency now ends the season early. Target tuning remains open. |
| 21 | Cargo Ring | React | Smoke-tested start/tick. Target and starting-reserve copy remain open. |
| 22 | Aqua Grid | React | Insolvency now ends the season early. |
| 23 | Signal Stack | React + DOM | Completion target, per-frame re-render and hotkey scope fixed. |
| 24 | Rift Runner | Canvas 2D | Per-frame React state and per-frame canvas resize fixed with a regression test. |
| 25 | Rift Tactics | React | Battle log now announces additions. |
| 26 | Rift Chess | React DOM + chess.js | **New (Wave 1).** Complete chess rules via the chess.js adapter, five computer levels in an in-house Web Worker, two-player mode with optional local clocks, save/resume, 40 original puzzles, procedural sound with mute, drag-and-drop plus keyboard play, and an accessible 8×8 grid that holds at 320 px. Registered, catalogued, thumbnailed and documented. |

"Smoke-tested" means the shell was rendered, started, ticked under fake timers/controlled frames, and checked for runtime errors. It does not mean the full season or match was played to completion.

---

## 4. Prioritized file-specific backlog

### P1 — correctness and player-facing quality

| Area | Files | Work |
|---|---|---|
| 3D mute persistence | `src/games3d/shared/audio.ts`, each `*Game.tsx` | Persist the mute choice in a versioned browser-local record so it survives reloads and applies to all three 3D games. *Resolved 2026-11-07 — see §6.* |
| Neon Apex countdown | `src/games3d/racing/engine.ts` | The starting countdown can display one extra step; make the sequence start at 3 and add a browser assertion. *Resolved 2026-11-07 — see §6.* |
| Hidden-tab timers | `src/games/rock-paper-scissors/RockPaperScissorsGame.tsx` | Stop the round timer while the tab is hidden, as the simulation games already do. *Resolved 2026-11-07 — see §6.* |
| Snake key scope | `src/games/snake/SnakeGame.tsx` | Call `preventDefault` only for keys the game consumes, so page scrolling and browser shortcuts still work outside the board. *Resolved 2026-11-07 — see §6.* |
| Math Sprint | `src/games/math-sprint/MathSprintGame.tsx` | Announce each new problem through a polite live region and verify the one-second tick against fake timers. *Resolved 2026-11-07 — see §6.* |
| Difficulty targets | `src/games/rift-hospital/simulation.ts`, `park-pulse/simulation.ts`, `factory-line/simulation.ts`, `cargo-ring/simulation.ts` | The audited final scores sit far above the advertised targets (hospital 1,120 vs 1,000; Park Pulse 28,852 vs 5,000; factory 3,868 vs 1,500; cargo 6,940 vs 2,000). Tune with simulation-first tests rather than guesses. |
| Cargo Ring onboarding | `src/games/cargo-ring/CargoRingGame.tsx`, `simulation.ts` | The instructions imply a starting reserve that the state does not hold; align copy and state. |
| Reduced motion | `src/games/snake/SnakeGame.tsx`, `signal-stack/SignalStackGame.tsx`, `rift-runner/*` | Respect `prefers-reduced-motion` for decorative motion without removing gameplay. |

### P2 — verification and polish

- Browser QA of the three 3D changes (context-loss notice, finish audio, drive gates) with a real WebGL context. Unit tests can only assert the wiring.
- Balance tests for Rift Tactics AI turns and for the tuned simulation targets.
- `useSimulationClock` tick-rate review: intervals shorter than 250 ms are clamped silently; document or surface that floor.
- Rift Runner and Signal Stack: add a screenshot/visual regression gate for the canvas and marker positions.

---

## 5. Limitations and honesty notes

- Unit tests use jsdom with a stubbed canvas context; they verify state, markup and wiring, not pixels.
- No online multiplayer, real opponents, global leaderboards, cloud saves or engagement metrics are implied anywhere in this report. All scores are browser-local.
- The three 3D games are verified for loading, pause/resume, restart, mute and route-away cleanliness by the browser suite; a complete race or match is not automated.
- Rift Chess is verified for rules, AI, clocks, persistence, puzzles, audio, keyboard and touch input by unit and browser tests. There is no online play, no Elo rating, no PGN export and no account; all records stay in the browser. The five level labels are internal difficulty names, not ratings.
- The remaining 15 shortlisted games and the six Wave 2 designs are not implemented.
- Changes are committed and pushed to `feat/games-wave2` under the repository owner's explicit standing instruction for this task.

---

## 6. Phase C fix log (7 November 2026)

The master directive's Phase C names ten game defects. Each completed item records its reproduction, the failing test and the correction.

| # | Defect | Reproduction and failing test | Correction | Verification |
|---|---|---|---|---|
| 1 | 3D mute was forgotten on reload and each game kept its own choice | New `src/games3d/shared/mutePreference.test.ts`: defaults to unmuted, reads back a stored choice, ignores malformed JSON, and `GameAudio` starts muted from the stored value and persists toggles | `mutePreference.ts` wraps the shared storage helpers over the `neonrift:3d-muted` key; both audio engines seed from it and write on toggle, and the three 3D screens seed their mute state from it | 4 unit tests pass |
| 2 | Neon Apex could display a leading `4` in the starting countdown | `e2e/gameplay.spec.ts` "countdown starts at three" received `4` before the fix | The engine starts its countdown at exactly 3.00 s while `lastCountdownBeep` stays at 4, so the first `3` beep still fires | Targeted Playwright test passes |
| 3 | Rock Paper Scissors settled the round while the tab was hidden | `e2e/gameplay.spec.ts` "rock paper scissors holds the round while the tab is hidden" failed: after 1.2 s hidden the round had already been played | The countdown and result hold are deadline-driven; the 50 ms ticker skips while `document.visibilityState` is `hidden`, and the visibility handler pushes both deadlines forward by the hidden duration | All three RPS Playwright tests pass (boot, hidden tab, first-to-three rematch) |
| 4 | Snake captured Space and the arrow keys even when a toolbar button held focus | `e2e/gameplay.spec.ts` "snake leaves focused controls their own keys" failed: the board never claimed focus, and Space on the focused Restart button paused the run instead of restarting it | The window handler now ignores events aimed at a button or link via the shared `isInteractiveTarget`, arrows only consume and `preventDefault` while the run is idle or running, and the focusable board receives focus on `pointerdown` and whenever the run becomes active (after the overlay's focus-return cleanup) | All five Snake Playwright tests pass, including the existing keyboard steering and Space pause coverage |
| 5 | Math Sprint announced the clock every second and never announced the next problem | New `src/games/math-sprint/MathSprintGame.test.tsx` failed: the polite region read "1 seconds left. Streak 0." instead of the problem | The ticking clock moved to a non-live visually-hidden line; the polite status now carries the problem ("Problem: 7 + 5."), the answer feedback and the completion summary, changing only when one of those does | 3 unit tests pass (fake timers verify 59 s, 58 s and the finish at 60 s); all three Math Sprint browser tests pass |

Items 6–10 remain open.
