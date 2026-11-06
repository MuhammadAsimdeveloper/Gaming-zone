# Rift Chess

Rift Chess is NeonRift's original chess game. It is a complete, local board:
legal move generation, castling, en passant, promotion, checkmate, stalemate and
the standard draw rules come from the bundled `chess.js` engine. The board,
pieces, puzzle set, computer opponent, sound cues and interface are original to
this repository.

- Route: `/game/rift-chess`
- Category: strategy (secondary: puzzle, casual)
- Modes: vs computer, two players on one device, puzzles, free board
- Storage: browser-local only

## What is included

### Rules

- Full legal move validation for both sides.
- Castling rights, en passant windows and pawn promotion to queen, rook, bishop
  or knight.
- End states are reported by their exact reason: checkmate, stalemate,
  insufficient material, fifty-move rule and threefold repetition.
- Draw and resign actions are explicit confirmations, not silent endings.

### Modes

| Mode | Clock | Opponent | Saved |
| --- | --- | --- | --- |
| Vs computer | None (the bot is never timed) | In-browser worker at five internal levels | Yes, resumes after reload |
| 2 players | Optional 5, 10 or 30 minutes | Shared device | No |
| Puzzles | None | Fixed solution line | Solved count persists |
| Free board | None | Both sides move freely | No |

### Computer levels

| Label | Search | Behaviour |
| --- | --- | --- |
| Novice | Depth 1 | Plays a random legal move about half the time |
| Casual | Depth 2 | Occasional random legal move |
| Club | Depth 2 | No deliberate slips |
| Expert | Depth 3 | Searches further ahead |
| Master | Depth 4 | Up to ten seconds per move |

The labels are internal strength presets, not Elo ratings. The engine runs in a
module Web Worker, always returns a legal move, and falls back to a random legal
move if it exceeds the ten-second cap so the interface never blocks. The worker
is terminated on restart, resignation, game end, mode change and unmount.

### Clocks

Local two-player clocks use `performance.now()` deltas rather than interval
accumulation. They pause when the tab is hidden, the window loses focus, or a
promotion/draw/resign dialog is open. A flag falls only when the opponent still
has mating material; otherwise the position is reported as an insufficient
material draw.

### Puzzles

Forty original compositions ship with the game: twenty mate-in-one and twenty
mate-in-two. Every line is validated in the test suite: White is to move, the key
move is legal, no mate-in-one exists inside the mate-in-two set, and every black
reply in a mate-in-two still loses to mate. The solution set is stored in the
repository, not fetched from an external database.

### Sound

Move, capture, check, game-end and solved cues are synthesised with the Web Audio
API. No audio files are bundled or downloaded. The speaker button mutes all cues
for the session, and the audio context is closed when the game unmounts.

## Controls

| Action | Pointer | Keyboard |
| --- | --- | --- |
| Select a piece | Click or tap | Arrow keys move focus, Enter or Space selects |
| Move | Click/tap a highlighted square or drag the piece | Focus the target square and press Enter or Space |
| Clear selection | Click an empty area / Escape | Escape |
| Promotion | Choose from the overlay | Tab and Enter |
| Undo | Undo button (not in puzzles) | Tab to the button |
| Flip board | Flip board button | Tab to the button |
| Mute | Speaker button | Tab to the button |
| Restart | Restart button | Tab to the button |

Drag-and-drop is an enhancement. Tap-to-move and keyboard selection are always
available and are the primary paths on touch and assistive technology.

## Accessibility

- The board is an ARIA grid with 64 gridcell buttons and names such as
  "e4, white pawn".
- Arrow keys, Home, End, Page Up and Page Down move focus; Escape clears the
  selection.
- Selection, legal target counts, check, illegal moves and results are announced
  through a polite live region.
- The board keeps a square aspect ratio from 320 px upward; setup controls,
  clock HUD and move list stack below in portrait.
- Visible focus outlines, 44 px touch targets, `prefers-contrast: more` board
  colours and `prefers-reduced-motion` transitions are supported.

## Persistence

Three versioned LocalStorage keys are used:

| Key | Content |
| --- | --- |
| `neonrift:game:rift-chess:save:v1` | Computer game in progress (SAN moves, level, colour) |
| `neonrift:game:rift-chess:puzzles:v1` | IDs of solved puzzles |
| `neonrift:game:rift-chess:records:v1` | Win/loss/draw counts per computer level |

A saved game is restored only if replaying its SAN move list reproduces the
stored FEN; otherwise the invalid record is removed and a fresh game starts.
Malformed JSON and unknown versions are cleared safely. No names, accounts,
tokens or telemetry are stored.

## Honest limitations

- No online multiplayer, matchmaking, accounts, cloud saves, leaderboards, Elo
  or rating system. Records are labelled "in this browser".
- No opening book or endgame tablebase. The opponent is a straightforward
  alpha-beta search with material, piece-square and mobility evaluation.
- No PGN/FEN import or export in the interface.
- Browsers may require a tap or click before audio can start.
- Puzzle progress measures how many original puzzles were solved; it is not a
  puzzle rating.

## Credits

- Rules engine: [chess.js](https://github.com/jhlywa/chess.js) 1.4.0,
  BSD-2-Clause. Full notice in `THIRD_PARTY_NOTICES.md`.
- Board, geometric piece set, puzzle compositions, AI search, clock model,
  persistence and audio cues: NeonRift original work.
- No chess artwork, piece art, board textures, sounds, databases or level
  layouts were copied from another product.

## Verification

```bash
npx vitest run src/games/rift-chess
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The Rift Chess unit suite covers rules and draw reasons, clock arithmetic,
persistence validation, puzzle force-mate checks, the worker contract and audio
scheduling. Playwright covers launch, movement, promotion, undo, restart,
save/resume, the 320 px layout and route-away cleanup.
