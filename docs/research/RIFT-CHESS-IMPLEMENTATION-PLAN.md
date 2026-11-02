# Rift Chess — Implementation Plan

> Prepared 2026-11-02 after the platform hardening and quality gates passed.
> **Status:** plan only. No Rift Chess code has been written and no catalogue entry exists.
> Source design: [GDD/01-rift-chess.md](GDD/01-rift-chess.md).

---

## 1. Gate status

The GDD requires platform hardening and the baseline quality gates to pass before implementation. On 2026-11-02:

| Gate | Result |
|---|---|
| `npm run typecheck` | Passed, no output |
| `npm test` | 49 tests passed in 5 files |
| `npm run build` | Passed; 2,143 modules; only the existing >500 kB Three.js chunk warning |
| `npx playwright test` | 37 tests passed in 2.4 minutes with 2 workers |

Rift Chess implementation may start. Planned platform work that is **not** complete (CSP, automated full-match 3D QA) does not block a React DOM game.

---

## 2. Decisions

### Rules library: `chess.js`

| Check | Result |
|---|---|
| Version reviewed | 1.4.0 |
| Licence | BSD-2-Clause |
| Source | npm registry metadata and package README, 2026-11-02 |
| Why | Mature legal move generation, check/checkmate/stalemate, repetition, fifty-move and insufficient-material detection, SAN history. Headless, TypeScript, browser ESM. |

Add it as a runtime dependency only when M1 starts. Copy the BSD-2-Clause notice into `THIRD_PARTY_NOTICES.md` (created at M1 if absent). Re-verify the version and licence at install time; do not assume this snapshot is current.

### Bot: in-house Web Worker minimax

The GDD suggested `js-chess-engine` (MIT). Registry check on 2026-11-02 shows **v2.4.6 requires Node.js ≥24**, while this project documents and tests on Node 20+. Rather than raise the platform baseline for one game or pin an old major, M3 will use a small alpha-beta minimax worker:

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

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| **M0 — Dependency gate** | `chess.js` installed and noticed | Licence re-verified; notice added; licence file included in build/credits; typecheck/build green |
| **M1 — Rules spine** | `rules.ts` + `rules.test.ts` | ≥30 FEN fixtures: legal counts, check, mate, stalemate, castling rights, en passant window, promotion, repetition, fifty-move, insufficient material; all reasons exact |
| **M2 — Playable board** | Board, selection, promotion, move list, undo, restart | Full local two-player game by mouse and keyboard; illegal moves rejected; SAN history correct |
| **M3 — Computer opponent** | Worker AI + five levels + cancellation | Bot always returns a legal move; 10 s timeout fallback; worker terminates on restart/unmount; UI never blocks |
| **M4 — Modes and persistence** | Clocks, save/resume, puzzles, local records | Reload restores an AI game; hidden tab freezes clocks; puzzle fixtures accept only intended solutions; record math tested |
| **M5 — Polish** | Themes, audio, accessibility, responsive layout | Keyboard-only full game; screen-reader labels reviewed; 320 px layout verified; audio mute and cleanup verified |
| **M6 — Integration and QA** | Registry, catalogue, thumbnail, docs, E2E | New unit tests + existing 49 pass; Playwright covers launch, move, promotion, undo, restart, save/resume, 320 px and route-away cleanup; typecheck/test/build green; docs updated |

Order is strict. M2 must not start until M1 is green; M3 must not start until a full local game works.

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
