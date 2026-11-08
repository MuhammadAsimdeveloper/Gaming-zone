# Rift Chess — Implementation Plan

> Prepared 2026-11-02 after the platform hardening and quality gates passed.
> **Status (2026-11-08):** M0 dependency/licence work and M1 rules source/tests are present. M2 board source and tests, M3 worker AI/five levels, and M4 clocks plus browser-local save/resume are also implemented in `fix/platform-hardening-2026-11`. The Rift Chess thumbnail, docs, public catalogue entry and lazy registry route have been added in the same PR. These later milestones were authored ahead of CI verification: **M2–M6 are not accepted as passed** until current-branch tests, build, browser QA and manual review succeed. The PR is open and unmerged. Puzzles/local records and the remaining M5 polish are still outstanding.
> Source design: [GDD/01-rift-chess.md](GDD/01-rift-chess.md).
---

## 1. Gate status

The 4 November platform results below are a **historical baseline**, not verification of this PR:

| Gate | Historical baseline | Current PR branch |
|---|---|---|
| `npm run typecheck` | Passed on 2026-11-04 | Not run |
| `npm test` | 234 tests in 27 files on 2026-11-04 | New chess rules, board, AI, clock, persistence and platform tests are authored but not executed |
| `npm run build` | Passed on 2026-11-04; 2,143 modules and the existing Three.js chunk warning | Not run |
| `npx playwright test` | 66 tests on 2026-11-04 | Rift Chess catalogue launch, 320 px board, AI response, save/resume and blur-clock persistence tests are authored but not executed |

The latest Actions attempts on 8 November terminate before any job steps or downloadable logs are available. An earlier job annotation explicitly identified an account billing lock. This is an infrastructure/access blocker, **not evidence of a TypeScript or test failure**. Do not mark a gate green until it has actually run on the current branch.

M2 board, M3 AI, M4 clock/persistence and M6 catalogue integration code now exist, but source presence is not QA sign-off. M4 still lacks the planned puzzle fixtures and local-record work, and M5 polish/manual accessibility review remains open. Do not merge or release while the CI and manual QA gates are unresolved.
---

## 2. Decisions

### Rules library: `chess.js`

| Check | Result |
|---|---|
| Version reviewed | 1.4.0 |
| Licence | BSD-2-Clause |
| Source | npm registry metadata and package README, 2026-11-02 |
| Why | Mature legal move generation, check/checkmate/stalemate, repetition, fifty-move and insufficient-material detection, SAN history. Headless, TypeScript, browser ESM. |

`chess.js@1.4.0` is pinned as a runtime dependency. Its BSD-2-Clause licence text is recorded in `THIRD_PARTY_NOTICES.md`; package integrity is pinned in `package-lock.json`.

### Bot: in-house Web Worker minimax

The GDD suggested `js-chess-engine` (MIT). The bot remains an in-house alpha-beta minimax worker; chess.js supplies legal move generation. Node 24 is now the CI baseline for the Vitest 5 toolchain:

- Legal moves come from `chess.js` inside the worker, so the bot cannot generate an illegal move.
- Evaluation: material + piece-square tables + mobility. No endgame tablebases.
- Difficulty = search depth, move-selection noise and a small blunder chance:
  - Novice: depth 1 with frequent random legal moves.
  - Casual: depth 2 with occasional random moves.
  - Club: depth 2, no deliberate blunders.
  - Expert: depth 3.
  - Master: depth 4 with alpha-beta and move ordering.
- Hard cap: 10 seconds. On timeout, terminate the worker, return a random legal move and label the move as an engine timeout.
- Worker is created on demand, one per active AI game, and terminated on restart, resign, game end, mode change and unmount.

If the measured Master move time or strength is unacceptable, evaluate `js-chess-engine` behind the same `ai.ts` interface after raising the Node baseline deliberately. Do not add it silently.

### Board: custom React DOM + inline SVG

No `chessboardjs`. The board is an accessible 8×8 ARIA grid with original geometric SVG pieces. No copied Staunton artwork, board texture, sound or branding.

---

## 3. Module layout

```
src/games/rift-chess/
  RiftChessGame.tsx   React shell: mode menu, HUD, clocks, move list, dialogs
  board.tsx           Accessible grid, selection, legal targets, drag/tap/keyboard
  pieces.tsx          Original inline-SVG piece set (two themes)
  rules.ts            chess.js adapter: legal moves, SAN, end-state reasons
  ai.ts               Worker client, timeout, cancellation, difficulty mapping
  ai.worker.ts        Alpha-beta search and evaluation
  puzzles.ts          Original puzzle fixtures + solution validation
  persistence.ts      Versioned save, puzzle progress, local records
  audio.ts            Web Audio move/capture/check/end cues
  rules.test.ts       Rules and draw-reason tests
  ai.test.ts          Worker contract, timeout fallback, legal-move guarantee
  persistence.test.ts Save validation and version reset
```

Integration files:

- `src/types/game.ts` — add `rift-chess` to `INTERNAL_GAME_KEYS`.
- `src/data/games.ts` — catalogue record: category `strategy`, secondary `puzzle`/`casual`, honest controls and instructions.
- `src/games/registry.ts` — lazy entry.
- `public/art/` — original thumbnail generated from the repo's SVG source.
- `docs/games/rift-chess.md` — rules, controls, difficulty labels and limitations.

No player-shell change is planned.

---

## 4. Rules scope

`rules.ts` owns a single `Chess` instance and returns plain view models; React never keeps a second piece model.

| Capability | Implementation |
|---|---|
| Legal moves and validation | `chess.moves({ square, verbose: true })`, `chess.move({ from, to, promotion })` |
| Check | `chess.inCheck()` / `isCheck()` per installed version; expose `checkedKing` |
| Checkmate | `chess.isCheckmate()` → reason `checkmate` |
| Stalemate | `chess.isStalemate()` → reason `stalemate` |
| Threefold repetition | `chess.isThreefoldRepetition()` → reason `repetition` |
| Fifty-move rule | `chess.isDrawByFiftyMoves()` (verify exact API at install) → reason `fifty-move` |
| Insufficient material | `chess.isInsufficientMaterial()` → reason `insufficient-material` |
| Castling | Native chess.js castling rights and rook movement |
| En passant | Native chess.js target square and capture removal |
| Promotion | UI chooser (queen, rook, bishop, knight); move not applied until chosen |
| Undo | `chess.undo()`; one ply in local mode, two plies (player + reply) vs AI; forbidden while AI is thinking |
| Move history | `chess.history({ verbose: true })`, SAN list with ply numbers |
| Reset | New `Chess()` instance, versioned state reset, clocks reset |

End-state precedence must be explicit: checkmate → stalemate → insufficient material → fifty-move → threefold. Display the specific reason, never a generic “draw”.

---

## 5. Modes and flow

| Mode | Rules | Clock | Persistence |
|---|---|---|---|
| vs Computer | Standard; player chooses white, black or random | Untimed by default; optional casual 10-minute clock | Resume saved after every completed ply |
| Local two-player | Standard pass-and-play | Off, 5, 10 or 30 minutes | Session only |
| Puzzle set | Original mate-in-1/2 and tactic positions | None | Progress saved |
| Free board | Standard legal moves; no result recorded | None | None |

Turn flow:

```
pointer / keyboard input
  → resolve square
  → own piece: select, compute legal targets
  → target: validate, apply, play cue, update clocks, check end state
  → illegal: keep selection, announce the reason
  → vs AI and not over: mark thinking, post { fen, level } to worker
      → legal reply: apply
      → timeout / worker error: random legal reply + labelled timeout notice
```

`onStart` fires on the first applied move. `onComplete` fires once for vs-Computer games with `win`, `loss` or `draw`, and never for free board or puzzles.

---

## 6. Clocks, pause and visibility

- Use `performance.now()` deltas per side; no interval accumulation.
- One 250 ms UI tick reads the active side’s remaining time.
- Pause when: the player opens the pause overlay, the tab is hidden, or a promotion/dialog has focus and the game is flagged as paused.
- On resume, reset the active side’s start timestamp; do not subtract hidden time.
- Flag fall ends the game with reason `timeout`; the opponent must have mating material (otherwise draw by insufficient material is reported).
- Timed mode is local only. AI games are untimed by default to avoid punishing the player during engine thinking.

---

## 7. Accessibility and mobile

- Board is `role="grid"` with 64 `role="gridcell"` buttons; each has an accessible name such as “e4, white pawn”.
- Arrow keys move focus; Enter/Space selects or confirms; Escape clears selection.
- Announce selection, legal target count, check, illegal move and game result via a polite live region.
- Visible focus ring, 44 px minimum touch targets, high-contrast theme, reduced-motion support.
- Board stays square from 320 px up; HUD and move list stack below on portrait phones.
- Tap-to-move is the primary touch path; drag is an enhancement, never the only path.
- Promotion chooser is a modal with focus trap and keyboard support.
- No scroll trapping outside the board; touch-action is limited to the board only.

---

## 8. Persistence and local records

| Key | Payload |
|---|---|
| `neonrift:game:rift-chess:save:v1` | `{ v: 1, fen, history, mode, playerColor, level, clocks, savedAt }` |
| `neonrift:game:rift-chess:puzzles:v1` | `{ v: 1, solved: string[] }` |
| `neonrift:game:rift-chess:records:v1` | `{ v: 1, byLevel: { [level]: { wins, losses, draws, fewestMovesWin } } }` |

Rules:

- Validate shape and version on read; on mismatch clear only the Rift Chess key and start clean.
- Never store names, accounts, tokens or telemetry.
- Wrap all access in `try/catch`; private browsing must still allow a session.
- Records are local and labelled “This browser only”. No leaderboard, Elo, online opponent or invented statistic.
- Puzzle progress is the count of solved original puzzles, not a rated puzzle rating.

---

## 9. Milestones

| Milestone | Source status on the PR branch | Acceptance status |
|---|---|---|
| **M0 — Dependency gate** | `chess.js@1.4.0` pinned; BSD-2-Clause notice and lockfile integrity recorded | Source/licence work complete; current-branch typecheck/build not verified |
| **M1 — Rules spine** | `rules.ts` and tests include legal moves, check/mate/stalemate, castling, en passant, promotion, repetition, fifty-move and insufficient-material cases with 30 FEN fixtures | Authored; test suite not executed on this branch |
| **M2 — Playable board** | Accessible 8×8 board, local two-player/free modes, promotion, SAN history, undo/restart, keyboard focus and Escape behaviour | Prototype and unit/E2E coverage authored; full local mouse/keyboard playthrough and responsive QA still pending |
| **M3 — Computer opponent** | Five-level alpha-beta AI in a dedicated Web Worker, 10-second UI fallback, worker termination on restart/unmount | Source implemented; tactical quality, real worker bundling, cancellation and browser behaviour not verified |
| **M4 — Modes and persistence** | 5+0, 10+0 and 10+5 clocks; save/resume replays moves from the saved FEN; clock pauses on blur/hidden/pagehide and persists the paused snapshot | Core source implemented; clock/persistence tests authored. Puzzle fixtures and local records are outstanding; reload/hidden-tab QA not run |
| **M5 — Polish** | Original SVG pieces, keyboard board navigation, labelled squares and focus-managed promotion chooser | Partial; complete screen-reader/manual accessibility, full mobile/device and audio review remain |
| **M6 — Integration and QA** | Catalogue JSON entry, lazy registry route, thumbnail, game documentation and Playwright coverage | Integration is present on the open PR only. Typecheck/test/build/E2E and manual QA have not passed; not released |

The intended order remains strict: M1 must pass before accepting M2; M2 must pass before accepting M3; and all gameplay, responsive and release checks must pass before M6 is accepted. Some later source work has been authored in this branch, but it does not waive earlier gates.
---

## 10. Testing plan

### Unit (Vitest)

- Starting legal move count and perft-lite fixtures (depth 1–2, small set).
- Fool’s mate and scholar’s mate detection with exact reason.
- Stalemate fixture, insufficient material fixtures, fifty-move fixture, threefold fixture.
- Castling allowed, blocked and lost after king/rook move.
- En passant available for one ply only; capture removes the correct pawn.
- Promotion requires a piece choice and creates the chosen piece.
- Undo restores turn, castling rights, en passant target and clocks exactly.
- AI worker contract with a mocked worker: legal reply, timeout → random legal move, cancellation.
- Persistence: valid round-trip, malformed JSON, unknown version, blocked storage.

### Browser (Playwright, extends `e2e/`)

- Launch from catalogue; board renders 64 accessible cells.
- Keyboard-only sequence of legal moves updates the move list.
- Illegal move keeps the selection and announces an error.
- Promotion chooser appears and applies the chosen piece.
- Undo and restart work; clocks freeze when paused and while hidden.
- Reload mid-AI-game restores the position; “New game” clears it.
- Route away and back: no console errors, no leaked worker, no audio context error.
- 320 px viewport: board remains square and interactive.
- Puzzle solution accepts the intended line and rejects a wrong first move.

### Manual-only

- Full screen-reader pass with NVDA or VoiceOver.
- A real mid-range phone touch game and thermal check.
- A complete vs-Master game for perceived strength rating. Until played, describe the bot as “casual-strength” and do not claim Elo.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| chess.js API names differ by version | Pin the installed version; verify methods in M1; wrap all calls in `rules.ts` so UI never imports the library directly |
| Bundle size | Lazy-load the game; measure the chunk at M1/M6 against the 120 KB gzip 2D budget |
| Worker lifecycle leaks | One worker per game, explicit terminate in `dispose()`, restart, resign and mode change; E2E route-away test |
| AI blocks or hangs | Worker + 10 s timeout + random legal fallback; thinking state is cancellable |
| Accessibility regressions | ARIA grid fixture test plus manual screen-reader pass; keyboard-only E2E path |
| Clock drift | `performance.now()` deltas; pause timestamps; unit tests for hidden/pause behavior |
| Local save corruption | Versioned payload, shape validation, key-scoped reset, try/catch storage |
| Scope creep (online, ratings, engine analysis) | Explicitly out of scope; no UI affordance for unavailable features |

---

## 12. Out of scope

- Online multiplayer, accounts, ratings, leaderboards or matchmaking.
- Engine analysis, evaluation bars, blunder detection or opening books.
- Chess variants (960, bughouse, four-player).
- PGN import (export may be considered after M6; import is optional).
- Tournament clocks, increment/delay beyond the documented fixed-time modes.
- Any commercial chess asset, board layout, sound or brand.

---

## 13. Definition of done

- Essential GDD features implemented; advanced features either implemented or clearly absent from the UI.
- All milestones M0–M6 meet their exit criteria.
- `npm run typecheck`, `npm test`, `npm run build` and `npx playwright test` pass.
- Catalogue copy, controls and limitations are accurate.
- No fake online status, rating, player count or monetization.
- Rift Chess is lazily loaded through the existing registry and disposes cleanly on route change.
