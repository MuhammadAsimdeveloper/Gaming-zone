# Lawn Protocol

Lawn Protocol is NeonRift's original lane-defence game. A rooftop garden powers a
district's solar core while rust swarms advance down five lanes. The player
plants bio-modules on a 5 × 9 grid, collects light and holds twelve authored
roofs — or an endless escalation.

- Route: `/game/lawn-protocol`
- Category: strategy (secondary: puzzle, casual)
- Modes: twelve-level campaign, endless defence
- Rendering: Canvas 2D playfield with a DOM seed-card strip and an accessible
  45-cell interaction grid
- Storage: browser-local only

The world, module names, enemy names, level layouts, art and audio are original
to this repository. No plants-versus-zombies assets, names, layouts or sounds are
used.

## What is included

### Grid and planting

- Five lanes × nine columns (45 cells).
- Select a seed card, then tap or click an empty cell to plant.
- Placement is rejected with a specific reason: out of bounds, occupied cell,
  not enough light, module still recharging, or the run is not running.
- Shovel mode removes a module and refunds half its cost, rounded down.
- Pointer input and the keyboard share one action path; the playfield exposes a
  button per cell with a descriptive label for screen readers.

### Eight modules

| Module | Cost | Recharge | Health | Behaviour |
|---|---:|---:|---:|---|
| Photofern | 50 | 5 s | 120 | Drops a 25-light token every 8 seconds |
| Needle Pod | 100 | 5 s | 150 | Fires a 20-damage needle at the nearest target ahead |
| Burst Bloom | 125 | 12 s | 130 | Short-range splash burst |
| Rind Wall | 50 | 8 s | 420 | Tough blocker that enemies must chew through |
| Frost Cap | 100 | 18 s | 130 | Periodically slows every enemy in its lane |
| Ember Vine | 125 | 15 s | 140 | Burns enemies lingering on its tile |
| Mortar Moss | 150 | 18 s | 140 | Lobs splash damage at distant targets; blind up close |
| Purge Reed | 175 | 30 s | 100 | One-shot lane clear after a short arming delay |

### Ten enemy types

| Enemy | Health | Shield | Speed | Behaviour |
|---|---:|---:|---:|---|
| Rust Walker | 110 | 0 | 0.16 | Steady, cheap line unit |
| Rust Runner | 70 | 0 | 0.36 | Fast and fragile |
| Plateback | 300 | 0 | 0.11 | Heavy plating that soaks sustained fire |
| Bulwark | 110 | 90 | 0.15 | Shield absorbs damage before the body |
| Hoplet | 100 | 0 | 0.24 | Leaps over the first blocker it meets |
| Burrower | 100 | 0 | 0.20 | Tunnels under the first blocker |
| Splitter | 170 | 0 | 0.14 | Breaks into two walkers when destroyed |
| Patchwright | 160 | 0 | 0.13 | Repairs nearby rust every two seconds |
| Spitter | 120 | 0 | 0.15 | Stops at range and shoots modules |
| Siege Core | 1400 | 0 | 0.08 | Slow armoured boss |

Telecast chevrons show queued spawns about three seconds before they arrive, so
lane pressure is readable before it matters.

### Light economy

- Each level starts with authored light (150 for the first roof).
- Sky tokens drift down on the level's interval and are collected by tapping
  their cell.
- Each Photofern adds a light token on its own timer. Tokens expire after a
  while, so banking light is a decision, not a free action.
- Shovel refunds, costs and recharges are all visible on the seed strip.

### Lanes, purges and defeat

- Every lane has one emergency purge per level. It clears that lane after a
  short arming delay and cannot be reused.
- A rust unit that reaches the core with no purge left ends the run.
- Campaign victory requires the spawn queue to empty with no rust left alive
  while every wave start time has passed.

### Stars and progression

- Three stars: no core damage and no purges used.
- Two stars: at most two purges used.
- One star: survived.
- Clearing a roof unlocks the next one. Only the next roof in order unlocks;
  there is no skipping.
- Stars, unlocks, the endless best wave and the endless best score persist in
  `localStorage` under versioned keys.

### Campaign roofs

| # | Level | Theme |
|---:|---|---|
| 1 | First Light | Solar |
| 2 | Sidewalk Shuffle | Solar |
| 3 | Copper Line | Copper |
| 4 | Gutter Run | Copper |
| 5 | Undercroft | Copper |
| 6 | Split Decision | Copper |
| 7 | Field Clinic | Glass |
| 8 | Crossfire | Glass |
| 9 | Hot Asphalt | Glass |
| 10 | Glasshouse | Glass |
| 11 | Final Approach | Glass |
| 12 | Core Defense | Glass |

Each roof introduces one pressure or combination and is validated by the level
data tests: a final wave exists, lanes are in range, counts are positive and the
spawn schedule is ordered.

### Endless defence

Endless mode reuses the first roof's layout and escalates wave health, speed and
composition without a terminal victory. It records a browser-local best wave and
best score, and reports the wave reached on the result card.

## Controls

| Action | Keyboard | Pointer |
|---|---|---|
| Select seed | `1`–`8` | Tap a seed card |
| Plant | Select a seed, then `Enter`/click a cell | Tap an empty cell |
| Shovel | `X`, then click a module | Shovel button, then tap a module |
| Pause | `P` or `Escape` | Toolbar pause |
| Speed | `F` | Toolbar speed toggle |
| Mute | `M` | Toolbar mute |

## Architecture

```
src/games/lawn-protocol/
  content.ts          Module, enemy, theme and level data plus validation
  simulation.ts       Fixed-step deterministic game state and rules
  renderer.ts         Canvas 2D playfield rendering
  audio.ts            Synthesised Web Audio cues
  persistence.ts      Versioned progress and settings with validators
  LawnProtocolGame.tsx  React shell, seed strip, HUD, menus, loop
  simulation.test.ts  Rules, combat, waves, economy, determinism
  persistence.test.ts Storage validation and record math
  LawnProtocolGame.test.tsx  Component behaviour in jsdom
```

- The simulation advances in fixed 1/60 s steps and is seeded with a small
  deterministic RNG, so the same seed and inputs produce the same run.
- Rendering reads mutable state from a ref on requestAnimationFrame and draws
  through the shared DPR-capped canvas pattern. React snapshots the HUD at about
  8 Hz rather than every frame.
- The component owns the loop, pause/speed state, audio lifecycle and
  `onComplete` reporting; the simulation never touches the DOM or storage.
- The playfield is not canvas-only: a transparent 45-cell button grid over the
  canvas keeps planting keyboard- and screen-reader-accessible.

## Testing

- `simulation.test.ts`: 30 tests covering content validation, placement
  rejection reasons, light tokens and expiry, every module behaviour, every
  enemy ability, purges, loss, victory, star math, wave telegraphs,
  determinism and endless escalation.
- `persistence.test.ts`: 10 tests covering malformed-storage fallbacks,
  unknown-level filtering, record improvement rules and unlock order.
- `LawnProtocolGame.test.tsx`: 7 tests covering the mount menu, lock state,
  stored stars, deploy and plant, unaffordable seeds, shovel refund, pause,
  speed and endless start.
- `e2e/lawn-protocol.spec.ts` plus the shared boot matrix cover the route in a
  real browser.
- `npm run typecheck`, `npm test`, `npm run build` and the Playwright suite are
  the acceptance gates; results are recorded in the README verification
  snapshot.

## Known limitations

- The campaign is twelve authored roofs, not a live-service progression.
- Daily seeded runs, an enemy/module codex, challenge modifiers and cosmetic
  skins are design ideas that are **not implemented**.
- Endless mode is local-only and can be edited by anyone with storage access.
- Difficulty is authored, not adaptive.
- Touch input is drag-free: select a seed, then tap a cell.
- The renderer is canvas art, not a sprite atlas; it favours readability over
  animation density.
