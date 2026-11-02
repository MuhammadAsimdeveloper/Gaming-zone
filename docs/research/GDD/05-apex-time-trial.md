# 05 — Apex Time Trial

> **Reference genre:** Trackmania (precision time trial, ghosts, track authoring).
> **Shortlist rank:** 5 · **Engine:** Three.js (reuse Neon Apex foundation) · **Complexity:** M · **Wave:** 1
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A solo precision-driving mode built on the Neon Apex vehicle and track systems. There are no opponents and no traffic: only the clock, a personal ghost and a track that rewards a clean line. It is the competitive heart of the racing category without needing servers.

Working tagline: *“One car. One line. One clock.”*

### Design pillars

1. **The clock is the opponent.** Every run is comparable to the last.
2. **Restart is instant.** No countdown longer than 1.2 s; no loading between attempts.
3. **Ghosts tell the truth.** The replay is recorded from the actual simulation, not approximated.
4. **Authoring is light.** A modular track builder with a small piece set, not a full level editor.
5. **Reuse, not duplicate.** Share the vehicle physics and track materials with Neon Apex; this is a distinct mode with its own UI and rules.

### Target session

- 30 s to 4 minutes per attempt; 10–30 minutes per session.
- Desktop-first; mobile supported with tilt/buttons.
- Player intent: mastery, personal bests, medal chasing.

### Core loop

```
Select track → countdown → drive → cross finish
  → split comparison vs PB and author ghost
  → medal result → instant retry or next track
```

### Modes

| Mode | Rules |
|---|---|
| Time Trial | Solo, unlimited attempts, personal best and ghost |
| Author Challenge | Fixed target times, three medals per track |
| Custom Track | Player-built track, validated, local leaderboard of one |

---

## 2. Feature list

### Essential

- Three authored tracks (Rift Loop, Glass Cut, Terminal Spiral) with distinct surfaces and corners.
- Three vehicles with different acceleration/grip/top speed.
- Checkpoint order enforcement and anti-cut validation.
- Lap timer with millisecond display, sector splits.
- Ghost recording at 20 Hz (position, rotation, speed) and playback.
- Personal best per track + vehicle.
- Restart, respawn at last checkpoint, quit.
- Medal thresholds per track (bronze/silver/gold/author).
- Camera modes: chase, hood, cinematic.
- Quality presets and DPR cap.
- Keyboard and gamepad; touch steering/throttle/brake.
- Audio: engine synth tied to RPM, tyre slip, checkpoint chime, finish sting.

### Advanced

- Modular track builder: 12 piece types (straight, wide/narrow turns, chicane, hill, banked turn, gap, tunnel, boost pad, start/finish, checkpoint, scenery block).
- Validation: start/finish present, every checkpoint reachable, no overlapping invalid geometry, maximum length.
- Track save/load/export as a compact JSON string in LocalStorage.
- Ghost delta HUD (+/- seconds) against PB.
- Five additional “ghost ladder” targets per track (local, no server).

### Optional

- Daily seeded track generated from pieces.
- Replay export as a JSON ghost file.
- Photo mode (pause + hide HUD, capture canvas PNG).
- Weather/lighting presets that do not affect physics.

### Explicitly cut

- Opponent AI or live multiplayer.
- Licensed cars, brands, music or real track names.
- Full freeform terrain sculpting.
- Online leaderboards, accounts, cloud ghosts.
- Trackmania-specific blocks, media or UI.

---

## 3. Gameplay architecture

```
src/games/apex-time-trial/
  ApexTimeTrialGame.tsx  React shell, menus, results, HUD
  engine.ts              Scene, vehicle sim, timers
  vehicle.ts             Arcade car physics (shared with Neon Apex where possible)
  track.ts               Authored track definitions + geometry build
  checkpoints.ts         Order, respawn, cut detection
  ghost.ts               Record/playback, interpolation
  editor.ts              Piece placement, validation, serialization
  audio.ts               Engine and tyre synthesis
  persistence.ts         PBs, medals, custom tracks
  *.test.ts              Timing, checkpoint, ghost, validation
```

### Vehicle model

Reuse the Neon Apex arcade model:

- Forward/lateral velocity decomposed each step.
- Engine force curve by gear/RPM band, drag, rolling resistance.
- Steering angle scaled down with speed.
- Lateral grip with a slip threshold; handbrake reduces rear grip.
- Surface multiplier per track section (asphalt 1.0, glass 0.82 grip, metal 0.92).
- Fixed step 1/120 s for stable high-speed collision, rendered at display rate.

### Timing rules

- Timer starts when the vehicle crosses the start line after the countdown.
- Checkpoints must be crossed in order; crossing out of order does not advance.
- Finish only counts when all checkpoints are collected.
- Cut detection: if the car’s path misses a checkpoint trigger volume, the run is invalidated with a clear message.
- Respawn resets the current sector timer but keeps the run alive; the final time includes the respawn penalty naturally.

### Ghost model

- Sample every 50 ms: `{ t, x, y, z, qx, qy, qz, qw }`.
- Playback interpolates between samples using the run clock.
- Ghost is rendered as a translucent, unlit car silhouette; no collision.
- Store the best run per track and vehicle; cap at 3 minutes (~3,600 samples, compressed).

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | Three.js | Existing track/vehicle pipeline |
| Physics | Custom arcade | Proven in Neon Apex; no rigid-body dependency |
| Track geometry | Generated from spline/piece data | Small, editable, no downloaded models |
| Ghost | Plain typed arrays | Cheap and deterministic |
| Editor UI | React DOM | Menus and piece palette |
| Persistence | LocalStorage | Tracks and PBs are small JSON |

No new dependency. If the existing vehicle code is too coupled to Neon Apex, extract a shared `vehicle.ts` only after the second use is proven.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Tracks | Procedural ribbons, barriers, tunnels from spline data |
| Vehicles | Existing Neon Apex low-poly cars, optionally re-skinned |
| Environment | Instanced pylons, gantries, fog, emissive strips |
| Ghost | Same vehicle mesh with transparent unlit material |
| UI | DOM + inline SVG |
| Audio | Engine oscillator stack + noise tyres |
| Thumbnail | Scene render with time-trial HUD treatment |

No licensed vehicle shapes, logos or music.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Track spine | One track, vehicle, checkpoints, timer | Clean lap recorded in milliseconds |
| M2 — Ghost | Record, save, replay | Ghost matches the recorded run visually |
| M3 — Tracks/vehicles | 3 tracks, 3 vehicles, medals | All combinations complete without geometry bugs |
| M4 — Builder | Piece palette, placement, validation, save | A player-built track is drivable and rejects invalid layouts |
| M5 — Feel/polish | Cameras, audio, splits, results | Split HUD accurate; retry under 1.2 s |
| M6 — Mobile/QA | Touch controls, performance, docs | 45+ fps mobile; QA checklist complete |

---

## 7. Estimated complexity

**M.** ~3,500–4,500 lines including the editor. Reuse reduces risk substantially. The editor is the largest unknown; it can ship after the three authored tracks and still leave a complete game.

---

## 8. Testing plan

### Unit

- Timer formatting and sector split math.
- Checkpoint order enforcement and invalid-run detection.
- Respawn position equals last checkpoint transform.
- Ghost sampling/interpolation roundtrip.
- Track validation: missing start, unreachable checkpoint, overlapping pieces, excessive length.
- PB only updates on a valid faster run.

### Integration

- Complete all three tracks with each vehicle.
- Deliberately cut a checkpoint; run is invalidated.
- Restart during ghost playback; no duplicate ghost meshes.
- Build, save, reload and drive a custom track.
- Tab hidden mid-run; timer pauses and resumes correctly.
- Route change disposes renderer, audio, RAF.

### Performance

- 60 fps desktop, ≥ 45 fps mobile at DPR 1.75.
- Draw calls ≤ 140; triangles ≤ 120k.
- Ghost playback adds no per-frame allocations.

---

## 9. Integration plan

1. Add `apex-time-trial` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `racing`, secondary `casual`.
3. Lazy registry entry.
4. Share vehicle/track helpers with `games3d/racing` **only if** extraction is clean; otherwise duplicate the small physics module and document it.
5. `onComplete` with finish time and medal.
6. Thumbnail + `docs/games/apex-time-trial.md`.

---

## 10. Known limitations

- No online ghosts or leaderboards; competition is against your own records and authored targets.
- The track builder uses a fixed piece set; it cannot express arbitrary terrain.
- Physics is arcade, not a tyre simulation.
- Custom tracks are stored locally and can be lost when site data is cleared.
- Three authored tracks is a content-bounded product; more tracks are future work, not a promise.
