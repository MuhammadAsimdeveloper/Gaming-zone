# Apex Time Trial

Apex Time Trial is NeonRift's solo 3D precision racer: three original circuits,
two laps each, ordered checkpoints and a clock that starts when you cross the
start line. Personal bests are stored per circuit and car, and each new best
saves a translucent ghost that replays beside you on the next attempt.

- Route: `/game/apex-time-trial`
- Category: racing (secondary: casual, arcade)
- Modes: solo time trial with per-track medal targets
- Rendering: Three.js scene with a Canvas-free DOM HUD
- Storage: browser-local only

The circuits, vehicle models, gantries, checkpoint pylons, palette, names and
audio are original to this repository. The game reuses the shared Neon Apex low-
poly car meshes and the procedural road/city helpers under `src/games3d/shared`
and `src/games3d/racing`; no commercial track, vehicle, logo, sound or exact
layout is used.

## What is included

### Circuits

| Circuit | Width | Length | Character | Surfaces |
|---|---:|---:|---|---|
| Rift Loop | 21 m | 1,637 m | Wide sweepers and a long final straight | All asphalt |
| Glass Cut | 18 m | 1,986 m | Tight walls and late apexes | Glass 38–62% of the lap |
| Terminal Spiral | 19 m | 2,445 m | Long metal blasts into tightening corners | Metal 25–50% and 78–100% |

Every circuit is a closed Catmull-Rom spline sampled to 420 points. Two laps,
two checkpoints per lap, and a start/finish line at index 0. A geometry test
confirms that no sampled ribbon self-intersects.

### Surfaces and grip

| Surface | Grip multiplier |
|---|---:|
| Asphalt | 1.00 |
| Metal | 0.92 |
| Glass | 0.82 |

The multiplier caps top speed and scales steering authority, so glass sections
punish a late brake and metal rewards a committed line.

### Timing rules

- A 1.2-second countdown arms the run; the clock starts on the first crossing
  of the start/finish line, not when the countdown ends.
- Checkpoints must be taken in order. Crossing a later checkpoint first
  invalidates the run with the message `Missed checkpoint N`.
- The finish only counts after both checkpoints of the final lap.
- A lap split is recorded at every checkpoint and at each lap line. Six splits
  complete a two-lap run and the last split is the final time.
- Leaving the course for more than 1.5 seconds invalidates the run. Kurbs and
  small excursions are tolerated; deliberate cuts are not.
- A respawn returns the car to the last crossed checkpoint, increments the
  respawn counter and keeps the clock running, so the cost is visible in the
  final time.
- The simulation runs at a fixed 1/120-second step with at most eight steps per
  rendered frame.

### Medals

Medal targets are derived from each circuit's measured length, lap count and an
authored pace value, then rounded to a tenth of a second. Faster is better.

| Circuit | Author | Gold | Silver | Bronze |
|---|---:|---:|---:|---:|
| Rift Loop | 1:00.50 | 1:06.70 | 1:12.90 | 1:20.70 |
| Glass Cut | 1:28.50 | 1:37.60 | 1:46.70 | 1:58.00 |
| Terminal Spiral | 1:37.90 | 1:47.90 | 1:57.90 | 2:10.50 |

`author`, `gold`, `silver`, `bronze` and `none` are the five result tiers. The
author target is the fastest; the UI labels it explicitly so nobody mistakes it
for a shipped worldwide record.

### Ghosts

- Sampling runs at 20 Hz (every 50 ms) while the clock is live, capped at 180
  seconds of recording.
- Each sample stores time, position, heading and speed.
- Playback interpolates position and speed linearly and heading along the
  shortest wrap-normalized path.
- The ghost is a translucent version of the selected car with shadows disabled.
- Only a faster personal best replaces the stored ghost. Clearing site data
  removes it permanently.
- Ghosts are keyed by circuit and car, so each combination has its own replay.
- The ghost disappears once the player's run clock passes the recorded finish
  time.

### Persistence

All records are browser-local and versioned:

| Key | Shape |
|---|---|
| `neonrift:game:apex-time-trial:records:v1` | `{ version: 1, runs, best: { "trackId:carId": { time, medal, splits, setAt } } }` |
| `neonrift:game:apex-time-trial:ghost:v1:<track>:<car>` | `{ version: 1, trackId, carId, time, splits, samples[] }` |

Malformed records are dropped on read rather than crashing the menu. Every
completed valid run increments `runs`; only a faster time replaces the personal
best.

## Controls

| Action | Keyboard | Pointer |
|---|---|---|
| Accelerate | `W` / `↑` | Accelerator pedal |
| Brake / reverse | `S` / `↓` | Brake pedal |
| Steer | `A` `D` / `←` `→` | Steering buttons |
| Handbrake | `Space` | Drift button |
| Respawn | `R` | Respawn button in the HUD |
| Camera | `C` | Camera button |
| Pause | `P` / `Escape` | Pause button |
| Mute | `M` | Speaker button |

Touch controls appear below the small breakpoint. Changing camera cycles chase,
wide and hood views; the camera field of view widens with speed.

## Accessibility and lifecycle

- The canvas has a descriptive `aria-label` covering the key bindings.
- Pause, mute, camera and respawn controls are labelled buttons, not icon-only
  mysteries.
- Off-track and split-delta notices use `role="status"`.
- `useVisibilityPause` pauses the engine when the tab is hidden or the window
  loses focus; the clock cannot run while the player is not looking.
- `useWebGLContextLoss` shows a restore notice and pauses the loop if the WebGL
  context is lost.
- Leaving the route disposes the renderer, animation loop, input listeners and
  audio graph.

## Testing

- `rules.test.ts` — clock start, checkpoint order, skipped checkpoints, repeat
  crossings, lap completion, final finish, off-track invalidation and reset,
  respawn counting, medal boundaries and split formatting.
- `ghost.test.ts` — sampling cadence, clamping, interpolation, heading wrap and
  recording validation.
- `tracks.test.ts` — three sampled circuits, checkpoint order, contiguous
  surface zones, medal ordering and no self-intersecting ribbon.
- `persistence.test.ts` — round-trip, faster-only personal bests, per-track and
  per-car keys, malformed records, ghost round-trip and clearing.
- `ApexTimeTrialGame.test.tsx` — menu slate, circuit switching, per-car personal
  bests, saved-ghost status and clearing, malformed storage.
- `e2e/apex-time-trial.spec.ts` — boot, clock-armed state, pause/resume,
  browser-local records and ghost display, mobile controls.

The broader Playwright suite also boots every catalogue game and unmounts it
cleanly, and the catalogue/navigation specs assert that all published games are
listed.

## Known limitations

- No online ghosts, accounts or leaderboards. Competition is against your own
  records and the authored medal targets.
- The modular track builder and custom-track export described in the design
  document are not shipped. The three authored circuits are the content.
- Physics is arcade, not a tyre simulation.
- There is no gamepad mapping yet; keyboard and touch are supported.
- Three circuits is a content-bounded product; additional circuits are future
  work, not a promise.
