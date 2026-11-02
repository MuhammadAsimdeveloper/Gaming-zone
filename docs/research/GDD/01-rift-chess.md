# 01 — Rift Chess

> **Reference genre:** Chess.com (rules, not brand or UI).
> **Shortlist rank:** 1 · **Engine:** React DOM + SVG/CSS · **Complexity:** S · **Wave:** 1
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A fast, accessible chess client for people who want to play a real game of chess in the browser without an account, an install or a subscription. The visual identity is **Rift Chess**: a dark, calm board with luminous accent lines and an original geometric piece set. It is a chess game first and a neon-themed product second.

Working tagline: *“The oldest game, in the newest room.”*

### Design pillars

1. **Real rules, not an approximation.** Full legal move generation, check, checkmate, stalemate, draws, castling, en passant and promotion.
2. **Zero friction.** Open the page, choose a side, play. No sign-up, no modal stack, no forced tutorial.
3. **Honest strength labels.** AI levels are named Novice → Master and described as internal difficulty levels, not as published Elo ratings.
4. **Accessible by default.** Keyboard play, screen-reader labels, high-contrast mode and a board that works at 320 px wide.
5. **Local and private.** No account, no server, no telemetry. Games are saved only in this browser.

### Target session

- 5–20 minutes.
- Primary device: phone in portrait, then desktop.
- Player intent: a quick game, a puzzle, or practice against a bot.

### Core loop

```
Choose mode → choose colour / level → play moves
   → receive legal-move feedback and check warnings
   → game ends (mate / draw / resign)
   → review move list, rematch or return to menu
```

### Modes

| Mode | Description | Persistence |
|---|---|---|
| vs Computer | Five difficulty levels; choose white, black or random | Resume saved locally |
| Local two-player | Pass-and-play on one device; optional clocks | None (session only) |
| Puzzle set | 40 curated mate-in-1/2 and tactic positions, original compositions | Progress saved |
| Free board | Sandbox board for analysis; no clock, no result recording | None |

### What this game is not

- Not a chess server. There is no online play, no matchmaking, no rating pool.
- Not a chess engine clone. It uses a small open-source engine for bot moves.
- Not a teaching course. Hints are limited and explained as hints, not instruction.

---

## 2. Feature list

### Essential (must ship)

- Full legal move generation and validation.
- Check, checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material.
- Castling, en passant, promotion with a four-piece chooser.
- Drag-and-drop, click-click and keyboard move entry.
- Legal-move dots and capture rings.
- Last-move highlight, check highlight, coordinates.
- Move list in SAN with scroll and current-move marker.
- vs Computer at five levels, thinking indicator, cancel/restart.
- Local two-player with optional 5/10/30-minute clocks.
- Resign, draw offer (local mode), new game, flip board.
- Result overlay with reason and rematch.
- Sound on/off; move, capture, check and game-end cues synthesised with Web Audio.
- Responsive layout from 320 px; landscape board sizing.
- Save/resume a vs-Computer game after reload.
- 40 original puzzles with progress.

### Advanced (ship if the essentials are stable)

- Hint button: suggests one legal move per game, limited to three per game, clearly labelled.
- Evaluation-free “threat” toggle that highlights attacked pieces.
- PGN export of the current game (download as text).
- Board themes (Rift, Slate, Paper) and piece-set toggle (geometric, outline).
- Keyboard move notation entry (`e2e4`, `Nf3`).
- Accessibility: ARIA grid, row/column announcements, focus ring, reduced-motion support.

### Optional (post-launch)

- PGN import for analysis.
- Additional puzzle packs.
- “Continue from here” setup editor.
- Local game archive of the last 20 finished games.

### Explicitly cut

- Online multiplayer, accounts, ratings, leaderboards.
- Engine analysis, evaluation bars, blunder detection.
- Opening explorer, lessons, videos.
- Chess variants (960, bughouse, 4-player).
- Any copied chess.com layout, board art, piece art, sounds or branding.

---

## 3. Gameplay architecture

### Module layout

```
src/games/rift-chess/
  RiftChessGame.tsx    React shell: menu, board, HUD, dialogs
  board.tsx            Accessible board grid + pieces
  pieces.tsx           Original SVG piece set
  rules.ts             Thin wrapper over chess.js + draw detection
  ai.ts                js-chess-engine adapter, runs in a Web Worker
  ai.worker.ts         Worker entry point
  puzzles.ts           Original puzzle data + validation
  persistence.ts       Versioned local save/load
  audio.ts             Procedural move/capture/check cues
  rules.test.ts        Vitest suite
```

### State model

- `Chess` instance from `chess.js` is the single source of truth for position, history and legal moves.
- React state holds: selected square, legal targets, orientation, mode, clock state, UI flags.
- The board renders from `chess.board()`; it never keeps a second piece model.
- The AI runs in a Web Worker. The main thread sends `{ fen, level }` and receives `{ from, to, promotion }`. A timeout guard (10 s) falls back to a random legal move and tells the player the engine timed out.

### Turn flow

```
pointer/keyboard input
  → resolve square
  → if own piece: select, compute legal targets
  → if target: attempt move
      → legal: apply, play sound, update clocks, check end state
      → illegal: shake, keep selection
  → if vs Computer and game not over: enqueue AI request
```

### Draw detection

`chess.js` covers checkmate, stalemate, threefold repetition, insufficient material and the fifty-move rule. The UI must display the specific reason, not a generic “draw”.

### Clock model

- Local mode only; AI mode is untimed by default with an optional “casual clock”.
- Use `performance.now()` deltas, not `setInterval` accumulation.
- Clocks pause when the tab is hidden and when the pause overlay is open.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | React DOM + inline SVG | Board is 64 focusable cells; DOM gives accessibility and crisp scaling for free |
| Rules | `chess.js` (BSD-2-Clause) | Mature, small, well-tested legal move generation |
| Bot | `js-chess-engine` (MIT) | Zero dependencies, browser-friendly, configurable levels |
| AI threading | Web Worker | Keeps the board responsive while the bot thinks |
| Audio | Web Audio API | No asset files; tiny payload |
| Persistence | LocalStorage | Fits the platform; no backend |

**Dependency gate:** both libraries must be added with a NOTICE entry and verified licences before use. If either fails review, the fallback is a hand-written move generator plus a shallow minimax bot, at higher cost.

---

## 5. Asset requirements

All assets are original and generated in-repo.

| Asset | Format | Notes |
|---|---|---|
| Piece set | Inline SVG components | Geometric silhouettes; two themes; no copied Staunton artwork |
| Board | CSS + SVG | 8×8 grid, subtle rift-line texture drawn with CSS gradients |
| App icon / thumbnail | SVG → PNG | Original mark: a board corner dissolving into a rift line |
| Sound cues | Web Audio synthesis | Short oscillator/noise envelopes; no sampled audio |
| Fonts | System stack | No paid or remote font |

No external images, no icon fonts, no downloaded sound packs.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Rules spine | `rules.ts` + tests | 30 FEN fixtures pass: mate, stalemate, castling, en passant, promotion, repetition |
| M2 — Playable board | Board, selection, moves, promotion, result | Full game can be played by mouse and keyboard |
| M3 — Computer opponent | Worker AI, five levels, thinking state | Bot always returns a legal move; UI never blocks |
| M4 — Modes and persistence | Local 2P, clocks, save/resume, puzzles | Reload restores an AI game; clocks survive pause |
| M5 — Polish | Themes, sounds, accessibility, responsive layout | Keyboard-only game completed; 320 px layout verified |
| M6 — QA and integration | Catalogue entry, thumbnail, tests, docs | Typecheck, tests and build pass; browser QA signed off |

---

## 7. Estimated complexity

**S.** Roughly 1,200–1,600 lines including tests. The rules are delegated to a proven library; the real work is board interaction, accessibility and mode plumbing. Main risk is accessibility quality, not game logic.

---

## 8. Testing plan

### Unit (Vitest)

- Legal move counts from known positions.
- Checkmate and stalemate detection with reason strings.
- Castling rights lost after king/rook move.
- En passant window expires correctly.
- Promotion produces the chosen piece.
- Threefold repetition and fifty-move draws.
- Puzzle solutions accept only the intended move sequence.
- Save payload version mismatch resets cleanly.

### Integration (manual browser)

- Play a full game to mate using only the keyboard.
- Play a full game using only touch.
- Reload mid-game and resume.
- Route away and back; no leaked workers or audio contexts.
- Tab hidden mid-clock; clocks pause.
- Screen-reader pass on NVDA or VoiceOver for the board grid.

### Regression

- `npm run typecheck`, `npm test`, `npm run build`.

---

## 9. Integration plan

1. Add `rift-chess` to `INTERNAL_GAME_KEYS`.
2. Add catalogue record with category `strategy`, secondary `puzzle`/`casual`, honest instructions and controls.
3. Add lazy registry entry.
4. Add thumbnail under `public/art/`.
5. Mount inside the existing player shell; no shell changes expected.
6. Emit `onStart` on the first move and `onComplete` with `win`/`loss`/`draw` for AI games.
7. Add a `docs/games/rift-chess.md` page with rules, controls and limitations.

---

## 10. Known limitations

- No online play. The game cannot provide human opponents or ratings.
- Bot strength is “good casual”, not engine-grade. It is not suitable for tournament training.
- Puzzles are a small curated set, not a rated puzzle database.
- Progress is per browser and is lost if site data is cleared.
- Accessibility is designed for keyboard and screen readers but has not been certified against a formal standard until tested.
