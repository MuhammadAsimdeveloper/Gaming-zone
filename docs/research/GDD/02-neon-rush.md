# 02 — Neon Rush

> **Reference genre:** Subway Surfers (endless three-lane runner).
> **Shortlist rank:** 2 · **Engine:** Three.js · **Complexity:** S–M · **Wave:** 1
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A three-lane endless runner through a neon transit rift. The player rides a magnetic board down a decaying maglev corridor, switching lanes, jumping barriers and sliding under gates while a security drone closes in. The world is original: no city named after a real place, no graffiti imitations, no licensed characters.

Working tagline: *“Outrun the grid.”*

### Design pillars

1. **Readable at speed.** Every obstacle is colour-coded and telegraphed at least 0.8 s before impact.
2. **Fair generation.** No spawn pattern may require an impossible sequence of inputs; the generator validates every chunk.
3. **One-more-run.** Restart is instant and the first 20 seconds are always safe.
4. **Touch-first.** Swipes and two on-screen buttons are equally viable.
5. **Visible progression.** Coins unlock boards and trails, with no purchases.

### Target session

- 45 seconds to 4 minutes per run.
- Phone portrait and desktop landscape.
- Player intent: reflex distraction, score chase, mission completion.

### Core loop

```
Menu → run starts at low speed
  → collect energy shards, dodge trains/barriers/gates
  → speed rises on a curve; power-ups appear
  → crash or finish a timed run
  → results: distance, shards, multiplier, missions
  → spend shards on cosmetic unlocks → run again
```

### Modes

| Mode | Rules |
|---|---|
| Endless | Speed ramps until crash; score = distance × multiplier + shards |
| Time Attack | Fixed 120 s; crashes cost 2 s, not the run |
| Mission Run | Three rotating objectives (e.g. “slide 12 times”, “collect 150 shards”) |

### What this game is not

- Not an open-world runner. The corridor is procedural, not a city.
- Not a multiplayer race. There are no ghosts or live opponents in v1.
- Not a monetised game. No ads, no currency purchase, no energy timers.

---

## 2. Feature list

### Essential

- Three lanes at fixed x positions with smooth interpolation.
- Jump, slide/roll, and lane switch with input buffering.
- Collision with trains (full block), low barriers (jump), high gates (slide), and side walls.
- Speed curve: 12 → 28 units/s over 150 s, capped.
- Chunk-based track generation with seeded RNG and fairness validation.
- Shard pickups, combo multiplier that decays after 4 s without a pickup.
- Three power-ups: Shield (one hit), Magnet (8 s), Overdrive (6 s speed + invulnerability).
- Drone pursuer: visual and audio pressure, rubber-banded; caught only after two crashes.
- HUD: distance, shards, multiplier, power-up timers, pause.
- Pause/resume, restart, results, local best.
- Audio: engine hum, pickup arpeggio, warning cues, impact, music loop.
- Touch swipe plus optional buttons; keyboard arrows/WASD/Space.
- Quality setting: auto/low/high, controlling shadows, DPR and scenery density.

### Advanced

- Cosmetic unlocks: 6 boards, 6 trails, 4 rider palettes.
- Daily seed run (same layout for everyone that day, no server).
- Mission system with 12 missions and local progress.
- Near-miss slow-motion pulse (subtle, ≤80 ms).
- Photo-finish results panel with a generated run summary card (canvas export).
- Reduced-motion and colour-blind modes.

### Optional

- Ghost of personal best as a translucent silhouette.
- Endless “zone” themes that swap palette and scenery every 1,000 m.
- Controller support via Gamepad API.

### Explicitly cut

- Anything resembling Subway Surfers’ characters, guard, dog, hoverboard designs or map.
- Real brands, real transit systems, real city names.
- Online leaderboards, accounts, cloud saves.
- In-app purchases or ad-gated revives.

---

## 3. Gameplay architecture

### Module layout

```
src/games/neon-rush/
  NeonRushGame.tsx   React shell, HUD, menus, results
  engine.ts          Scene, simulation, pooling, render
  chunks.ts          Track chunk definitions + fairness validator
  player.ts          Lane interpolation, jump/roll state machine
  obstacles.ts       Spawn/pool/collision
  audio.ts           Procedural SFX + music
  persistence.ts     Best score, shards, unlocks
  rules.test.ts      Chunk validation, scoring, collision tests
```

### Track model

- World moves toward the player; the player stays near `z = 0`.
- A chunk is 30 m long and defines obstacle slots by lane and distance.
- The generator picks chunks from a weighted pool, then validates the next 3 chunks against a reachability rule set:
  - never block all three lanes at the same distance;
  - leave at least one lane free for 12 m after a full-lane gate;
  - never place a slide gate immediately after a jump barrier in the same lane;
  - guarantee at least 8 m between consecutive required actions.
- Invalid sequences are re-rolled up to 20 times, then replaced with a known-safe chunk.

### Player state machine

```
RUNNING → JUMPING → RUNNING
RUNNING → ROLLING → RUNNING
any → HIT (if shield: SHIELD_BREAK → RUNNING; else CRASH)
```

- Lane switch: 0.12 s interpolation with a small overshoot; input buffered 0.15 s.
- Jump: impulse 9.5, gravity 30; air control allows one lane switch.
- Roll: 0.55 s, hitbox height reduced to 0.6.
- Invulnerability window after shield break: 0.8 s with flicker.

### Collision

- Player AABB: 0.8 × 1.6 × 0.8.
- Obstacle AABBs precomputed at spawn.
- Swept check against the player’s `z` range to prevent tunnelling at high speed.
- Pickups use a slightly larger radius (1.0) for forgiveness.

### Scoring

```
score = floor(distance) + shards * 10 * multiplier
multiplier = 1 + min(combo, 20) * 0.25
combo increments per shard; resets after 4 s or a crash
```

### Rendering

- Scene: fog, emissive track strips, instanced pylons, trains as pooled meshes.
- Shadows only for the player and nearest obstacles; otherwise baked gradient blobs.
- Camera at `(0, 4.2, 7.5)` looking ahead, with FOV 65 and subtle speed-based FOV kick.
- All geometry procedural: boxes, extruded rails, emissive quads, particle shards.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | Three.js 0.187 | Already installed; reuse lifecycle and audio patterns from Neon Apex |
| Simulation | Custom fixed-step logic | Small state space; deterministic and testable |
| Physics | None (kinematic) | Runner needs authored arcs, not rigid bodies |
| Audio | Web Audio synthesis | Zero assets; matches existing games |
| UI | React DOM overlay | HUD and menus stay outside the canvas |

Do **not** add a physics engine. Collision is AABB against a small set.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Track, rails, pylons | Procedural boxes/extrusions with emissive materials |
| Trains | Low-poly box assemblies with window emissive strips |
| Rider and board | Low-poly figure (~600 triangles) built from primitives; no rigged character download |
| Obstacles | Six authored procedural prefabs |
| Shards | Instanced octahedra with additive glow |
| Skyline | Instanced silhouette slabs + fog |
| Audio | Oscillator/noise synthesis |
| Thumbnail | Render from the scene + original logo treatment |

No downloaded models, textures or music. Target total art payload < 150 KB beyond code.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Track spine | Moving track, player lane control, camera | Player can switch lanes at 60 fps on desktop |
| M2 — Obstacles | Pooled obstacles, jump/roll, collisions | All four obstacle types behave correctly |
| M3 — Generation | Chunk system + fairness validator | 1,000 generated chunks pass validation; no impossible walls |
| M4 — Game loop | Speed curve, score, crashes, results, restart | Complete run from menu to results and back |
| M5 — Content and feel | Power-ups, missions, unlocks, audio, effects | Every power-up tested; music/SFX mix balanced |
| M6 — Mobile and QA | Touch controls, quality settings, performance pass | 45+ fps on mid mobile; full QA checklist |

---

## 7. Estimated complexity

**S–M.** ~2,000–2,800 lines. The 3D lifecycle is already proven; the novel work is chunk fairness and mobile feel. Art is procedural, so the schedule risk is tuning, not asset production.

---

## 8. Testing plan

### Unit

- Fairness validator rejects triple blocks and impossible action spacing.
- Seeded generator is deterministic for the same seed.
- Score formula and multiplier decay.
- Power-up timers, stacking rules and expiry.
- Collision helpers: sweep at max speed, roll hitbox, pickup radius.
- Persistence: best score only increases; unlock costs deduct exactly once.

### Integration

- Keyboard-only run, touch-only run, hybrid run.
- Pause during jump and during Overdrive; resume state is correct.
- Tab hidden for 30 s; no catch-up teleport or instant death.
- Restart 20 times; object pools do not grow.
- Route change mid-run; renderer, audio and RAF are disposed.
- Quality setting persists and takes effect without reload.

### Performance

- Draw calls ≤ 120, visible triangles ≤ 60k.
- No allocation spikes in the spawn loop (inspect with DevTools memory).
- 60 fps desktop, ≥ 45 fps mid mobile, DPR capped at 1.75.

---

## 9. Integration plan

1. Add `neon-rush` to `INTERNAL_GAME_KEYS`.
2. Catalogue: category `arcade`, secondary `action`/`casual`; honest instructions.
3. Lazy registry entry so Three.js loads only on this route.
4. Reuse the player shell for fullscreen/restart; the engine honours `restart()`.
5. `onComplete` reports score and outcome.
6. Add thumbnail and `docs/games/neon-rush.md`.
7. Reuse `GameAudio` patterns but keep a game-specific audio class.

---

## 10. Known limitations

- Endless generation can still produce monotonous stretches; a human curation pass over chunk weights is required.
- No online leaderboards; “best” is local to the browser.
- The rider is a stylised low-poly figure, not a character with animation sets.
- Time Attack crashes cost time rather than ending the run; this is a design choice, not a simulation of the reference game.
- Very low-end devices may need the “low” quality preset to hold 30 fps.
