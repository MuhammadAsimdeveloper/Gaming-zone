# Rift Chess

Rift Chess is the original browser chess game in Wave 1.

## Play modes
- Local two-player pass-and-play.
- A five-level local computer opponent. Search runs in a dedicated Web Worker.
- Free analysis board with legal chess moves.

## Chess rules
The game delegates legal move validation, castling, en passant, promotion, check, checkmate and draw rules to the pinned `chess.js` rules library. The board adds keyboard navigation, accessible square names, legal-destination markers and a focus-managed promotion chooser.

## Clock and save behaviour
Optional 5+0, 10+0 and 10+5 clocks use monotonic timestamps, pause when the page loses visibility/focus, and preserve move increments. Local and computer games autosave in this browser using a versioned localStorage record. Saved positions are restored by replaying the move list from the saved starting FEN and verifying the final FEN. No account or cloud storage is used.

## Verification status
Source-level rules, board, AI, clock, persistence and browser tests are included. The GitHub Actions runner was locked by an account billing issue during the current PR, so no successful CI, production build, or Playwright result is currently available. Do not treat catalogue registration in this branch as a production release until CI and desktop/mobile QA pass.
