# NeonRift 1000-Game Expansion Program

**Status:** program definition, 2026-11-06; Wave 1 complete 2026-11-07; Wave 2A (Neon Craft) shipped 2026-11-07; Wave 2B (Rift Rally, Neon Duel) shipped 2026-11-08. The catalogue currently ships **35 original games**.
This document defines how the library grows to **1000 playable, tested games** without
fabricating entries, cloning proprietary content, or diluting quality.

**Related documents**

- [Games Wave 2 design spec](../superpowers/specs/2026-11-04-games-wave2-design.md)
- [Research package index](../research/README.md)
- [Enhancement report 2026-11-05](../ENHANCEMENT-REPORT-2026-11-05.md)

---

## 1. Honesty rules

These rules are not negotiable, and they override any "ship faster" pressure.

1. A catalogue record exists only for a game that boots, accepts input and has automated
   coverage. Draft and playtest variants live in kit manifests, never in `src/data/games.json`.
2. Variants must differ in **rules, content, scenario or opponent**, not only in palette,
   copy or icon. A palette swap is not a game.
3. No invented multiplayer, real opponents, global leaderboards, player counts, ratings,
   rankings or cloud saves. Records are labelled browser-local.
4. No proprietary game code, characters, artwork, maps, logos, sounds or exact level layouts.
   Open-source references are studied and re-implemented; licence compatibility is recorded
   before any reference code is read.
5. Test counts, game counts and verification claims in this document and the README are
   updated from actual command output, never estimated.

---

## 2. Current state (baseline for the program)

| Metric | Value |
|---|---|
| Published games | 35 |
| Simulation suites (pure rules) | Included in the 114 Vitest files |
| Unit tests | 985 passing |
| Dedicated browser suites | Penalty Protocol, Hoop Circuit, Neon Rush, Rift Chess, Lawn Protocol, Apex Time Trial, Street Cricket, Neon Craft, plus the shared gameplay matrix (which covers Rift Rally and Neon Duel too) |
| Catalogue boot matrix | All 35 slugs boot, start, unmount and leave no console errors |

Current category distribution is concentrated in simulation (13) and thin in sports,
board, card, trivia, racing and action. The program's first phases deliberately correct
that imbalance.

**Shipped today (35):** Neon Snake, Tic-Tac-Toe, Memory Match, Rock Paper Scissors,
Reaction Time Challenge, Rift Breaker, Math Sprint, Neon Apex, Rift Striker, Neon City Drive,
Neon Harvest, Rift Transit, Grid Supply, Rift Colony, Orbit Market, Neon Diner, Skyport,
Rift Hospital, Park Pulse, Factory Line, Cargo Ring, Aqua Grid, Signal Stack, Rift Runner,
Rift Tactics, Rift Chess, Neon Rush, Penalty Protocol, Hoop Circuit, Lawn Protocol,
Apex Time Trial, Street Cricket, Neon Craft, Rift Rally, Neon Duel.

---

## 3. Architecture: kits and variants

The only way to reach 1000 games with honest quality is to stop treating every title as a
standalone project. NeonRift moves to a **kit + variant** model. A kit is a reusable engine
family; a variant is a real game built on it.

### 3.1 Kit anatomy

```text
src/games/kits/<kit>/
  simulation.ts          pure rules, deterministic, seeded RNG injected
  renderer.ts            Canvas or DOM presentation for the kit
  shell.tsx              menu, HUD, pause, results, records, audio (shared per kit)
  persistence.ts         versioned browser-local records and settings
  variants/
    <variant>.ts         content packs, rule deltas, scenarios, AI profiles
  manifest.ts            kit metadata + variant registry for the build script
  *.test.ts(x)           rules and shell coverage
```

A variant may only add:

- **Rules deltas** — e.g. a solitaire draw size, a match-3 objective type, a racing
  surface model.
- **Content packs** — word lists, board sets, question packs, scenario definitions.
- **Scenarios / level sets** — at least 12 hand-authored levels for puzzle and action kits.
- **Opponent profiles** — deterministic AI personalities with distinct strategies.
- **Presentation tokens** — palette, typography accents and original SVG scene composition.

### 3.2 Variant contract (definition of done)

A variant is publishable only when all of these are true:

- [ ] Distinct rules/content/scenario from its nearest sibling, documented in the manifest.
- [ ] Pure simulation with ≥ 8 meaningful automated tests, including a determinism test.
- [ ] Shared shell wiring: start, pause/resume, mute, back, results, `onStart`/`onComplete`.
- [ ] Keyboard **and** touch controls; no pointer-only interaction.
- [ ] Versioned records/settings with malformed-data rejection tests.
- [ ] Original thumbnail and in-game visual identity; no copied asset.
- [ ] Component test for the shell and variant-specific UI.
- [ ] Catalogue record, registry entry, type key and a boot test inclusion.
- [ ] Accessibility pass: named controls, live status text, visible focus, no colour-only state.

### 3.3 What a variant may **not** be

- A colour or copy swap of an existing game.
- A stub with a "coming soon" overlay.
- A variant whose only test asserts that it renders.
- A clone of a commercial game's level layout, character roster or asset set.

---

## 4. Portfolio allocation to 1000

35 games ship today. The remaining **965** are allocated across 27 kit families. Counts are
deliberate: puzzle and board families scale with authored content, simulation scales with
scenario packs, and action families stay smaller because each variant needs bespoke tuning.

| # | Kit family | New variants | Example variants (original) | Phase |
|---|---|---:|---|---|
| 1 | Solitaire | 29 | Klondike, Spider, FreeCell, Pyramid, TriPeaks, Golf, Yukon, Scorpion | 3 |
| 2 | Match-3 | 32 | timed, moves, ice-break, gravity, honey-lock, cascade, dual-board | 3 |
| 3 | Word puzzles | 45 | word search, anagram, word ladder, hangman, letter grid, cryptogram | 3 |
| 4 | Number puzzles | 38 | sudoku sizes, killer, calcudoku, kakuro, nonogram, futoshiki, hitori | 3 |
| 5 | Tile & merge puzzles | 33 | 2048-family, merge chains, sokoban sets, rush-hour traffic, path tiles | 3 |
| 6 | Brain & memory | 29 | memory sets, n-back, stroop, sequence, speed matching, focus drills | 3 |
| 7 | Board classics | 50 | checkers, reversi, gomoku, connect four, mancala, backgammon, morris, ludo | 4 |
| 8 | Single-player card | 38 | blackjack, video poker, baccarat solo, war, rummy drills, patience variants | 4 |
| 9 | Trivia & quiz | 57 | topic packs × timed/streak/true-false/image-free formats | 4 |
| 10 | Arcade shooters | 43 | lane shooters, twin-stick, bullet-dodge, boss rush, turret defense | 5 |
| 11 | Endless runners | 24 | lane, jump, slide, hover, wall-run, gravity-flip, speed-pad | 5 |
| 12 | Rhythm | 19 | beat tap, drum lanes, piano tiles, sequencer challenges | 5 |
| 13 | Party & microgames | 39 | 60-second microgame collections, reaction duels vs CPU, quiz rush | 5 |
| 14 | Racing | 38 | time trial, circuit, drift, drag, rally, hover, bike, boat | 6 |
| 15 | Sports | 55 | football, basketball, tennis, cricket, golf, baseball, hockey, darts, pool, bowling, archery | 6 |
| 16 | Fighting | 24 | 2D duel kits with original rosters, move sets and AI profiles | 7 |
| 17 | Action | 38 | dungeon crawler, stealth, arena survival, wave defense, heist | 7 |
| 18 | Horror & survival | 14 | candle-lit escape, signal static, nightwatch, resource dread | 7 |
| 19 | Puzzle platformers | 24 | gravity puzzles, switch rooms, escort puzzles, one-screen challenges | 7 |
| 20 | Roleplay | 33 | life sim, shopkeeper, tavern, guild, dungeon master, farming | 8 |
| 21 | Simulation & management | 80 | city, farm, hospital, park, factory, cargo, aqua, diner, hotel, zoo, rail, airport, vehicle sims | 8 |
| 22 | Strategy & tower defense | 49 | TD themes, turn-based tactics, auto-battler, RTS-lite skirmish | 8 |
| 23 | Physics puzzles | 34 | launch puzzles, bridge builder, rope cuts, ragdoll, catapult, balance | 9 |
| 24 | Educational | 49 | math, language, science, typing, geography, music theory | 9 |
| 25 | Sandbox & creative | 18 | Neon Craft worlds, drawing, music maker, level editor challenges | 9 |
| 26 | Idle & incremental | 25 | neon factory, space mining, diner rush, garden growth | 9 |
| 27 | Hidden object & detective | 10 | scene search, clue deduction, alibi logic | 9 |
| | **Total new** | **965** | | |
| | **Shipped** | **35** | | |
| | **Grand total** | **1000** | | |

### 4.1 Family scaling rules

- A kit may not add variants until its first three variants pass every gate in §3.2.
- A family's variant count is capped until its kit core is under the bundle budget (§7).
- Trivia packs count only when each pack has ≥ 40 verified questions and an answer
  explanation; a 10-question pack is a draft, not a variant.
- Simulation scenario packs count only when each scenario has a distinct win condition,
  starting state and balance pass.

---

## 5. Phase roadmap

Each phase ends with the full verification suite plus a phase-specific review. A phase does
not start until the previous phase's published count is verified against
`src/data/games.json`.

| Phase | Scope | Adds | Cumulative | Exit gate |
|---|---|---:|---:|---|
| 0 | Platform + current library | 35 | 35 | Full suite green (current baseline) |
| 1 | Scale foundation (no games) | 0 | 35 | Catalogue split, manifest generator, generated boot sweep, search pagination |
| 2 | Finish Wave 2 + sports flagships | 5 | 40 | Three remaining Wave 2 titles, two sports flagships |
| 3 | Puzzle families 1–6 | 206 | 246 | 206 variants; kit cores under budget; sampled e2e green |
| 4 | Board, card and trivia | 145 | 391 | 391 |
| 5 | Arcade, runners, rhythm, party | 125 | 516 | 516 |
| 6 | Racing and sports depth | 85 | 601 | 601 |
| 7 | Action, fighting, horror, platformers | 100 | 701 | 701 |
| 8 | Roleplay, simulation, strategy | 162 | 863 | 863 |
| 9 | Physics, educational, sandbox, idle, detective | 137 | 1000 | 1000 published, every slug boot-tested |

Phase 2's five remaining titles are drawn from the family counts in §4, so the 965 future
variants and the 965 added by phases 2–9 are the same titles, counted once each.

### 5.1 Realistic cadence

This is a multi-quarter program. A credible cadence with the current single-maintainer
workflow is **10–20 published variants per month**, and less during kit construction
(a new kit typically takes 2–4 weeks before its first variant ships). At 15/month, the
remaining 965 take roughly five years. The roadmap is honest about that: the alternative —
fast catalogue inflation — is explicitly rejected in §1.

---

## 6. Catalogue architecture at 1000 records

The current single `src/data/games.json` (35 records) is fine now and will not be at 1000.
The Phase 1 foundation replaces it with a generated, chunked catalogue.

### 6.1 Data split

```text
public/catalogue/index.json          compact list: id, slug, title, category, tags,
                                     thumbnail, accent, popularityRank
public/catalogue/games/<slug>.json   full detail: description, instructions, controls
public/catalogue/categories.json     per-category counts
```

- The index carries only what cards, search and filters need. Target ≤ 250 kB gzip at
  1000 records.
- Detail records load on the game route, keeping the catalogue route fast.
- The build script (`scripts/build-catalogue.mjs`) derives all three from kit manifests and
  fails on duplicate slugs, unpublished status, missing thumbnails or missing test files.
- `src/data/games.json` remains the authored source during the transition; the provider
  switches to the generated index behind the existing `CatalogueProvider` API.

### 6.2 Browsing at scale

- Category tabs plus search still work locally over the compact index.
- Grid pagination or windowing (48 cards per page) with stable sort and URL state.
- Curated collections (Editor's picks, 60-second games, two-player local) replace reliance
  on a raw 1000-item list.
- Search ranks title matches above tag matches; keyboard combobox behaviour is preserved.
- A "recently played" and "favourites" rail remain local-only.

### 6.3 Thumbnail pipeline

- 12 original SVG scene compositions per kit (parameterized by variant tokens) rather than
  1000 bespoke illustrations.
- A build check rejects duplicate thumbnails within a category.
- Every variant still gets an authored title, tagline and readable 640×400 scene.

---

## 7. Quality, testing and performance gates

### 7.1 Test pyramid at scale

| Tier | Runs | Scope | Cost control |
|---|---|---|---|
| Rules | Every variant, Vitest | ≥ 8 tests per variant, determinism, edge cases | Pure modules, fast |
| Shell | Every kit + variant-specific cases | Menu, pause, mute, results, records | One shared shell test per kit |
| Boot matrix | Generated from the catalogue | Every published slug boots, starts, unmounts | Nightly, sharded across workers |
| PR smoke | Every pull request | 1 variant per touched kit + all flagship specs | Rotating sample, ~10 minutes |
| Flagship | Every PR | Dedicated suites for complex games | Chess, runners, sports, 3D |

### 7.2 Bundle budget

| Artifact | Budget (gzip) |
|---|---|
| App shell (initial route) | ≤ 200 kB |
| Kit core chunk | ≤ 40 kB |
| Variant delta chunk | ≤ 10 kB |
| Shared 3D scenery | Existing exception, tracked and documented |

Every variant is lazy-loaded through the registry. A kit core is shared by all its variants
so adding a variant does not duplicate engine code. The build fails if a variant chunk
exceeds budget without an explicit, documented exception.

### 7.3 Accessibility and mobile

- Every control reachable by keyboard; arrows/Enter/Space conventions per genre.
- Live status regions for score, timer and turn changes.
- Touch targets ≥ 44 px on coarse pointers, tested at 390×844.
- Pause on tab hide for anything time-sensitive.
- Reduced-motion preference respected for camera shake and large transitions.

### 7.4 Performance

- Canvas games: device-pixel-ratio capped at 2, RAF loop with clamped delta, no React
  re-render per frame.
- 3D games: shared renderer, capped pixel ratio, disposal on unmount.
- Target 60 fps on mid-range hardware; sustained < 45 fps blocks publication.

---

## 8. Content and licensing policy

- All code, art text and audio are original or generated in-house. Audio uses the shared
  Web Audio tone system.
- Open-source engines and references are limited to permissive licences
  (MIT, BSD-2/3, Apache-2.0, CC0) and recorded in `THIRD_PARTY_NOTICES.md` plus the
  research licence audit.
- Game mechanics are not copyrightable; expression is. Variants implement mechanics with
  original visuals, names, level layouts and sound.
- Trivia content is written from verifiable public facts, with sources retained in the
  content pack and no copied question banks.
- No third-party trademarks in titles, thumbnails or copy.

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Variant inflation produces shallow games | Trust and quality collapse | §3.2 contract, no palette swaps, phase review can reject a kit |
| Catalogue payload slows browsing | Bad first impression | Index split, windowing, payload budget in CI |
| Test suite time explodes | Slow delivery | Rules tests stay pure/fast; e2e generated nightly and sharded |
| Single-maintainer throughput | Roadmap slips | Honest cadence; phases are independently shippable |
| Art becomes the bottleneck | Variants blocked | 12 parameterized compositions per kit; originality checks |
| Open-source licence contamination | Legal risk | Licence audit before reading reference code |
| Scope drifts into online features | Dishonest product claims | Explicit non-goals in §1 and §10 |

---

## 10. Non-goals

- Real-time online multiplayer, matchmaking or chat.
- Accounts, cloud saves, cross-device sync or payments.
- Global leaderboards, player counts, ratings or revenue dashboards.
- Emulation or re-hosting of commercial games.
- A catalogue of placeholders to reach a number.

---

## 11. Immediate next work (after this document)

1. **Phase 1 foundation:** catalogue split + manifest generator + generated boot sweep.
2. **Phase 2 Wave 2:** Neon Craft and its five companion designs, one sub-wave at a time.
   Wave 1 is complete as of 2026-11-07 (Rift Chess, Neon Rush, Lawn Protocol, Apex Time
   Trial, Street Cricket).
3. **Kit 1 pilot:** solitaire core with three variants (Klondike, FreeCell, Spider) proving the
   kit pipeline end to end before scaling the puzzle phase.

Progress against this roadmap is tracked only by published, tested catalogue records. The
README's game count and verification table are updated from actual command output at the end
of each phase.
