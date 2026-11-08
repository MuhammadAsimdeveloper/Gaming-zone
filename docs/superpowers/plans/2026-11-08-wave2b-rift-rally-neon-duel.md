# Wave 2B: Rift Rally and Neon Duel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two original, fully playable games — a three-circuit 3D arcade racer (Rift Rally) and a four-fighter Canvas 2D arcade fighter (Neon Duel) — as games 34 and 35 of the NeonRift catalogue.

**Architecture:** Each game separates deterministic rule modules (pure TypeScript, no DOM) from a thin presentation layer. Rift Rally uses Three.js for rendering and a fixed 1/60 s vehicle simulation; Neon Duel uses Canvas 2D for rendering and a fixed 60 Hz combat simulation. React owns only menus, phase transitions and 10 Hz HUD snapshots — never per-frame simulation state.

**Tech Stack:** React 19, TypeScript 5.9 strict, Vite 8, Three.js 0.187 (Rift Rally only), Canvas 2D (Neon Duel), Vitest 5 (node), Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-04-games-wave2-design.md` (§ Sub-wave 2B).

**Status:** Shipped 2026-11-08. Both games are in the catalogue, covered by unit and browser
tests, and verified against the full suite on `feat/games-wave2`.

## Global Constraints

- No new runtime dependency. Use only packages already in `package.json`.
- Original names, art, sounds, code and layouts. No Minecraft, Smash, Mario Kart or real-manufacturer terminology in product copy.
- Single-player versus AI only. No fake accounts, online opponents, multiplayer, cloud saves or leaderboards.
- No `any` in new public APIs. No `@ts-ignore`.
- Every game is lazy-loaded; main-bundle growth stays under 10 kB and each lazy chunk under 150 kB gzip.
- Deterministic simulation: seeded RNG and fixed time steps for every rule test; no wall-clock or `Math.random` inside pure modules.
- React state is updated at most 10 times per second during play; simulation state lives in refs.
- Touch controls are part of the definition of done, not a follow-up.
- No resource leaks: engines, audio contexts, listeners, RAF loops and Three.js geometries are disposed on unmount.
- Claim a suite passed only after running it. Never weaken an assertion to make a build pass.
- Work lands as one commit per game on `feat/games-wave2`; the standing user instruction authorizes pushing that branch. No merge to `main`, no deploy.

## File Structure

### Rift Rally

| File | Responsibility |
| --- | --- |
| `src/games3d/rally/track.ts` | Seeded circuit generation, frames, nearest sample, on-track test, checkpoints, lap validation, minimap projection. |
| `src/games3d/rally/physics.ts` | Car classes, weather grip, fixed-step vehicle integration, drift charge/boost, AI drive input. |
| `src/games3d/rally/ghost.ts` | 20 Hz recorder, codec, interpolated sampling. |
| `src/games3d/rally/audio.ts` | Procedural engine/skid/impact sounds over the shared mute preference. |
| `src/games3d/rally/engine.ts` | Three.js scene, road, scenery, rivals, rain, cameras, fixed-step loop, HUD snapshots, dispose. |
| `src/games3d/rally/RiftRallyGame.tsx` | React shell: menu, car/weather/camera selection, countdown, HUD, pause, results, touch, best lap. |
| `src/games3d/rally/*.test.ts` | `track`, `physics`, `ghost` unit suites. |

### Neon Duel

| File | Responsibility |
| --- | --- |
| `src/games/neon-duel/fighters.ts` | Four fighter specs, move frame data, ladder definition. |
| `src/games/neon-duel/combat.ts` | Fighter state machine, movement, attacks, hitboxes, block/chip, hitstop, meter, trades, arena bounds. |
| `src/games/neon-duel/match.ts` | Best-of-three round machine, 60 s timer, timeout resolution, ladder progression. |
| `src/games/neon-duel/ai.ts` | Seeded deterministic opponent input with reaction delay, spacing, blocking, specials. |
| `src/games/neon-duel/render.ts` | Canvas 2D arena, vector fighters, poses, effects, banners. |
| `src/games/neon-duel/audio.ts` | Procedural hit/block/ko/countdown sounds. |
| `src/games/neon-duel/NeonDuelGame.tsx` | React shell: menu, fighter select, ladder, training, HUD, pause, results, touch. |
| `src/games/neon-duel/*.test.ts` | `fighters`, `combat`, `match`, `ai` unit suites. |

### Integration

- `src/types/game.ts` — add `rift-rally`, `neon-duel` to `INTERNAL_GAME_KEYS`.
- `src/games/registry.ts` — lazy imports for both games.
- `src/data/games.json` — two catalogue records.
- `public/art/rift-rally.svg`, `public/art/neon-duel.svg` — original vector thumbnails.
- `e2e/helpers.ts` — add both slug/title pairs.
- Count copy, ARIA/axe route lists, README, ARCHITECTURE, ROADMAP, research index — updated after verification with real numbers.

---

## Task 1: Rift Rally track rules

**Files:**
- Create: `src/games3d/rally/track.ts`
- Test: `src/games3d/rally/track.test.ts`

**Interfaces:**
- Produces:
  - `RallyTrackId = 'coastal-ring' | 'interchange' | 'night-market'`
  - `interface RallyPoint { x: number; z: number; y: number }`
  - `interface RallyTrack { id; name; tagline; description; width; points; checkpoints; length; skyColor; fogColor; accent; curbColors: [string,string]; minimap: string; seed: number }`
  - `RALLY_TRACKS: RallyTrack[]`, `getRallyTrack(id): RallyTrack`
  - `sampleCircuit(waypoints, seed, samples): RallyPoint[]`
  - `trackFrame(points, index): { point; tangent; normal; index }`
  - `nearestTrackIndex(points, x, z, hint?): number`
  - `isOnRallyTrack(track, x, z, index?): boolean`
  - `interface LapProgress { lap: number; nextGate: number; splits: number[]; gateCount: number }`
  - `createLapProgress(gateCount): LapProgress`
  - `registerGatePass(track, progress, trackIndex, elapsed): LapProgress`
  - `projectToMinimap(track, x, z): { x: number; y: number }`

- [x] **Step 1: Write failing tests** covering: every track has ≥ 360 samples; sampling is deterministic for a seed; three distinct circuits; checkpoint indices are strictly increasing and evenly spaced; `nearestTrackIndex` respects a hint; on-track is true at a sample and false far outside the width; a gate pass advances the expected gate; passing a later gate out of order does not advance; a lap increments only after every gate; minimap points stay inside the 100×100 box.
- [x] **Step 2: Run** `npx vitest run src/games3d/rally/track.test.ts` and confirm failure.
- [x] **Step 3: Implement.** Use a pure Catmull-Rom sampler (no Three.js) with a seeded offset that perturbs waypoints by at most 3 units, `getSpacedPoints` equivalent via arc-length resampling, and six checkpoints at evenly spaced sample indices. `registerGatePass` accepts a gate only when the nearest sample is within 5 samples *after* the expected gate index, and only `nextGate` advances; when `nextGate` wraps past the last gate back to `0`, increment `lap` and clear `splits`.
- [x] **Step 4: Run tests** and `npm run typecheck`.
- [x] **Step 5: Commit** `feat(rally): add seeded circuits and lap validation`.

## Task 2: Rift Rally physics

**Files:**
- Create: `src/games3d/rally/physics.ts`
- Test: `src/games3d/rally/physics.test.ts`

**Interfaces:**
- Produces:
  - `CarClassId = 'grip' | 'balanced' | 'drift'`
  - `interface CarClass { id; name; tagline; maxSpeed; accel; brake; steerRate; grip; driftGrip; boostAccel; mass }`
  - `CAR_CLASSES: Record<CarClassId, CarClass>`
  - `Weather = 'clear' | 'rain'`
  - `interface RallyVehicle { x; z; heading; vx; vz; driftCharge; boostTime }`
  - `interface DriveInput { throttle: boolean; brake: boolean; steer: number; handbrake: boolean }`
  - `createVehicle(x, z, heading): RallyVehicle`
  - `stepVehicle(vehicle, carClass, input, world: { weather; onTrack }, dt): RallyVehicle`
  - `speedOf(vehicle): number`
  - `aiDriveInput(self, target, carClass, tier, rng): DriveInput`
  - `AiTier = 'rookie' | 'pro' | 'elite'`

- [x] **Step 1: Write failing tests** covering: throttle increases speed and never exceeds class max; brake reduces speed; zero input coasts down; steering changes heading only while moving; rain reduces achievable cornering grip relative to clear (same input, lower lateral speed after a turn); handbrake plus steering builds drift charge; releasing handbrake with charge awards boost time; boost raises top speed above class max; off-track limits speed; identical inputs and dt produce identical states; AI aims at a far target and slows for a near turn.
- [x] **Step 2: Run** the suite and confirm failure.
- [x] **Step 3: Implement** a fixed-step arcade model: transform velocity into forward/lateral components; engine/brake along forward; lateral damping by `grip * weatherGrip * (handbrake ? driftGrip : 1)`; steering scaled by speed and weather; handbrake accumulates `driftCharge` from lateral slip; when handbrake is released above 0.5 charge, set `boostTime` proportional to charge and clear charge; boost adds `boostAccel` and a 15% speed ceiling; off-track multiplies engine force by 0.55 and adds drag. Clamp `dt` to 0.05.
- [x] **Step 4: Run tests and typecheck.**
- [x] **Step 5: Commit** `feat(rally): add fixed-step vehicle physics and AI inputs`.

## Task 3: Rift Rally ghost codec

**Files:**
- Create: `src/games3d/rally/ghost.ts`
- Test: `src/games3d/rally/ghost.test.ts`

**Interfaces:**
- Produces:
  - `interface GhostSample { t: number; x: number; z: number; heading: number }`
  - `class GhostRecorder { constructor(interval?: number); push(elapsed, x, z, heading): boolean; readonly samples: GhostSample[] }`
  - `encodeGhost(samples): string`, `decodeGhost(raw): GhostSample[] | null`
  - `sampleGhost(samples, t): GhostSample | null`

- [x] **Step 1: Write failing tests**: recorder stores at most one sample per 0.05 s; a 1 s recording yields 21 samples; encode/decode round-trips exactly; corrupt, empty and wrong-version payloads return `null`; sampling between two samples interpolates position and takes the shortest heading arc; sampling before the first or after the last sample returns the nearest endpoint.
- [x] **Step 2: Run** and confirm failure.
- [x] **Step 3: Implement** a versioned payload `{ v: 1, s: [[t,x,z,h], ...] }`, values rounded to 3 decimals to keep saves small. Guard every parse with `Array.isArray` and finite-number checks.
- [x] **Step 4: Run tests and typecheck.**
- [x] **Step 5: Commit** `feat(rally): add ghost replay codec`.

## Task 4: Rift Rally engine and shell

**Files:**
- Create: `src/games3d/rally/audio.ts`, `src/games3d/rally/engine.ts`, `src/games3d/rally/RiftRallyGame.tsx`
- Test: `src/games3d/rally/RiftRallyGame.test.tsx` (jsdom shell boot, engine injected/stubbed)

**Interfaces:**
- Consumes: Tasks 1–3; `GameAudio`; `createRoad`, `createCity`, `createTrackLights`, `createCar`, `createStartGate`, `disposeObject`; `GameFrame`, `GameStat`, `GameButton`, `GameOverlay`, `GameSegmented`, `Kbd`; `useBestScore`; `useVisibilityPause`; `readMutedPreference`/`writeMutedPreference`; `WebGLContextNotice`, `useWebGLContextLoss`.
- Produces:
  - `interface RallyHud { speed; gear; lap; totalLaps; position; racers; raceTime; lastLap; bestLap; countdown; phase; offTrack; driftCharge; boostTime; weather; minimapPlayer; minimapRivals }`
  - `interface RallyResult { position; raceTime; bestLap; trackId; carId; weather }`
  - `class RallyEngine` with `constructor(canvas, setup)`, `start()`, `pause()`, `resume()`, `restart()`, `setCamera(mode)`, `setMuted(muted)`, `dispose()` and callbacks `onHud`, `onFinish`.
  - `default RiftRallyGame({ onStart, onComplete })`.

- [x] **Step 1: Write failing shell test**: with `RallyEngine` mocked, the menu renders three circuits, three cars and both weathers; starting calls `onStart`; a finished result shows position and calls `onComplete` once; unmount disposes the engine.
- [x] **Step 2: Implement `audio.ts`** as a small `RallyAudio` wrapper around `GameAudio` exposing `engine(ratio)`, `skid(amount)`, `impact(strength)`, `countdown(final)`, `lap(record)`, `setMuted`, `dispose`.
- [x] **Step 3: Implement `engine.ts`**: scene with fog and horizon; `createRoad` for the circuit; `createCity`/`createTrackLights` for scenery; player car and three rivals; rain Points when weather is rain; chase/wide/hood camera; fixed-step accumulator at 1/60 with at most 4 catch-up steps; rival AI from `aiDriveInput` with tiered max-speed scaling; lap progress from `registerGatePass`; position from lap + gate + distance to next gate; ghost recorder for the player; ghost car playback from the best stored ghost; countdown 3-2-1-GO; finish after three laps; HUD snapshot every 100 ms; `dispose()` removes RAF/listeners and disposes geometries/materials.
- [x] **Step 4: Implement `RiftRallyGame.tsx`**: `menu | countdown | racing | paused | finished` phases, car/track/weather/camera segmented controls, mute, best lap via `useBestScore('neonrift:game:rift-rally:best-lap', true)`, touch steering/throttle/brake/handbrake, pause on visibility change, results panel, and an error/WebGL notice fallback.
- [x] **Step 5: Run** the shell test, typecheck, and a production build to confirm the lazy chunk size.
- [x] **Step 6: Commit** `feat(rally): ship Rift Rally circuit racer`.

## Task 5: Neon Duel fighter data

**Files:**
- Create: `src/games/neon-duel/fighters.ts`
- Test: `src/games/neon-duel/fighters.test.ts`

**Interfaces:**
- Produces:
  - `FighterId = 'volt' | 'kestrel' | 'mako' | 'sable'`
  - `MoveId = 'light' | 'heavy' | 'special'`
  - `interface MoveSpec { startup; active; recovery; damage; chip; reach; hitstop; knockback; meterCost; meterGainHit; meterGainBlock; cancelInto: MoveId[] }`
  - `interface FighterSpec { id; name; tagline; description; color; accent; maxHealth; walkSpeed; jumpSpeed; dashSpeed; hurtboxWidth; hurtboxHeight; specialName; moves: Record<MoveId, MoveSpec> }`
  - `FIGHTERS: Record<FighterId, FighterSpec>`, `FIGHTER_ORDER: FighterId[]`
  - `interface LadderRung { fighter: FighterId; tier: AiTier; name: string }`
  - `DUEL_LADDER: LadderRung[]` (five entries)

- [x] **Step 1: Write failing tests**: all four fighters exist with distinct speed/health/reach profiles; every move has positive startup/active/recovery and damage; only specials cost meter; light can cancel into heavy; the ladder has five rungs and ends with Sable.
- [x] **Step 2: Implement** four profiles: Volt (balanced), Kestrel (fast, low health, long reach), Mako (heavy, slow, high damage), Sable (technical, strong special). Frame data stays in ticks at 60 Hz.
- [x] **Step 3: Run tests and typecheck; commit** `feat(duel): add fighter roster and frame data`.

## Task 6: Neon Duel combat engine

**Files:**
- Create: `src/games/neon-duel/combat.ts`
- Test: `src/games/neon-duel/combat.test.ts`

**Interfaces:**
- Produces:
  - `interface CombatInput { left; right; jump; block; dash; light; heavy; special }`, `neutralInput()`
  - `type FighterAction = { kind:'idle' } | { kind:'move' } | { kind:'jump' } | { kind:'block' } | { kind:'dash' } | { kind:'attack'; move: MoveId; frame: number; hasHit: boolean }`
  - `interface FighterState { id; x; y; facing; health; meter; action; vx; vy; onGround; hitstop; blockStun; hitstun; invuln; dashCooldown; comboHits }`
  - `createFighterState(spec, x, facing): FighterState`
  - `interface CombatEvent { type: 'hit' | 'block' | 'ko' | 'special' | 'land'; x; y; amount }`
  - `stepCombat(a, b, inputA, inputB, arena: { minX; maxX }): { a; b; events }`
  - `MAX_METER`, `SPECIAL_COST`

- [x] **Step 1: Write failing tests**: attack produces no hit before startup and a hit during the active frames; hitbox range produces hits at reach and misses beyond it; simultaneous active attacks trade; blocking converts damage to chip and applies blockstun without hitstun; hitstop prevents action-frame advancement for both fighters; meter gains on hit and caps at 100; special does nothing below cost and consumes 50; jumping over a grounded attack avoids it; a landed light can cancel into heavy during the cancel window; fighters cannot leave arena bounds; KO emits a `ko` event once health reaches zero.
- [x] **Step 2: Implement** a tick-based state machine. Timers decrement first; if `hitstop > 0`, decrement and return without advancing actions. Movement respects block (no walk), hitstun (knockback only), and jump arcs. Attack frame advances each non-frozen tick; when `frame` enters `[startup, startup+active)` and `hasHit` is false, build a 1-D hitbox in front of the attacker with the reach, and compare it with the defender's hurtbox; a defender whose `y > 0.9` evades grounded mid attacks. Resolve both attacks after movement so trades are possible.
- [x] **Step 3: Run tests and typecheck; commit** `feat(duel): add deterministic combat engine`.

## Task 7: Neon Duel match and AI

**Files:**
- Create: `src/games/neon-duel/match.ts`, `src/games/neon-duel/ai.ts`
- Test: `src/games/neon-duel/match.test.ts`, `src/games/neon-duel/ai.test.ts`

**Interfaces:**
- Produces:
  - `type Side = 'player' | 'rival'`
  - `interface MatchState { round; wins: Record<Side, number>; timerTicks; phase: 'intro' | 'fight' | 'roundOver' | 'matchOver'; roundWinner: Side | null; winner: Side | null; bannerTicks: number }`
  - `createMatchState(roundSeconds?): MatchState`, `startRound(state, resetTimer?): MatchState`
  - `tickTimer(state): MatchState` (one tick per simulated frame)
  - `finishRound(state, winner: Side | null): MatchState` (first to two wins ends the match)
  - `timeoutWinner(healthA, healthB): Side | null`
  - `type AiTier = 'rookie' | 'standard' | 'rival'`, `interface AiProfile { reactionTicks; blockChance; aggression; spacing; specialUse; moveChance }`
  - `AI_PROFILES: Record<AiTier, AiProfile>`
  - `interface AiMemory { queue: boolean[]; decideAt: number; held: CombatInput }`
  - `chooseAiInput(memory, self, opponent, profile, tick, rng): { input; memory }`
  - `mulberry32(seed): () => number`

- [x] **Step 1: Write failing tests**: timer counts down from 3600; timeout awards the higher health and returns `null` on a tie; first to two rounds ends the match; the ladder advances only after a win; AI with the same seed and state produces identical input; AI blocks a telegraphed attack when `blockChance` is forced to 1; AI approaches when out of spacing and attacks when in range; AI spends meter on a special only when affordable.
- [x] **Step 2: Implement.** `chooseAiInput` only re-decides every `reactionTicks`, sampling the opponent's action at decision time; held inputs persist between decisions. Approach/retreat uses the horizontal distance versus `spacing`; blocking is chosen when the opponent is in an attack's startup and the RNG passes `blockChance`; attacks mix light/heavy by `aggression`; specials require meter ≥ 50 and an RNG pass.
- [x] **Step 3: Run tests and typecheck; commit** `feat(duel): add best-of-three match flow and seeded AI`.

## Task 8: Neon Duel renderer, audio and shell

**Files:**
- Create: `src/games/neon-duel/render.ts`, `src/games/neon-duel/audio.ts`, `src/games/neon-duel/NeonDuelGame.tsx`
- Test: `src/games/neon-duel/NeonDuelGame.test.tsx`

**Interfaces:**
- Consumes: Tasks 5–7; `GameFrame`, `GameStat`, `GameButton`, `GameOverlay`, `GameSegmented`, `Kbd`; `useBestScore`; `useVisibilityPause`; `isInteractiveTarget`; `useReducedMotion`; mute preference; `formatRaceTime`-style timer formatting.
- Produces:
  - `drawDuelScene(ctx, canvas, view: DuelView, options): void` where `DuelView` carries both fighter states, timer, round pips, banner, shake and effect list.
  - `class DuelAudio` with `hit(strength)`, `block()`, `whoosh()`, `ko()`, `countdown(final)`, `setMuted`, `dispose`.
  - `default NeonDuelGame({ onStart, onComplete })`.

- [x] **Step 1: Write failing shell test**: menu shows four fighters and five ladder rungs; selecting a fighter and starting calls `onStart`; pause freezes the loop; a match win advances the ladder; a loss ends the run and calls `onComplete` once; unmount cancels the loop.
- [x] **Step 2: Implement renderer** with parallax arena layers, vector fighters drawn from pose keyframes per action frame, attack arcs for active frames, block shields, sparks from the effect list, screen shake (disabled by reduced motion), round banners and a training dummy.
- [x] **Step 3: Implement shell** with phases `menu | select | intro | fight | roundOver | matchOver | runOver`, fixed accumulator at 1/60, HUD at 10 Hz, keyboard A/D/W/S + J/K/L + Shift, touch buttons, pause/restart, a move list, reduced-flash toggle, ladder persistence of the furthest rung via `localStorage`, and a training mode that resets the dummy.
- [x] **Step 4: Run** shell test, typecheck and build.
- [x] **Step 5: Commit** `feat(duel): ship Neon Duel arcade fighter`.

## Task 9: Catalogue, thumbnails, browser tests and docs

**Files:**
- Modify: `src/types/game.ts`, `src/games/registry.ts`, `src/data/games.json`, `e2e/helpers.ts`, count copy in the home page and catalogue specs, axe route lists, `src/games/simulation-smoke.test.tsx` (if it enumerates every game), `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `docs/research/README.md`, `docs/research/ROADMAP.md`, the Wave 2 spec status line, `docs/games/1000-game-expansion-program.md`.
- Create: `public/art/rift-rally.svg`, `public/art/neon-duel.svg`.

- [x] **Step 1:** Add both keys, registry entries, catalogue records (category `racing` / `action`, published, instructions and controls matching the real inputs), and original SVG thumbnails.
- [x] **Step 2:** Update every literal count from 33 to 35 and "33 original games" copy.
- [x] **Step 3:** Extend the Playwright boot/catalogue matrices and axe scans to both routes.
- [x] **Step 4:** Run `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test --workers=2`; fix every failure at the root rather than relaxing assertions.
- [x] **Step 5:** Update documentation with real test counts and verification date; list the games as shipped in the Wave 2 spec and roadmap.
- [x] **Step 6: Commit** `feat(rally,duel): register Wave 2B games and update docs`.

## Verification commands

```
npm run typecheck
npm test
npm run build
npx playwright test --workers=2
```

## Manual verification checklist

- Rift Rally at 1440 px and 390 px: menu → countdown → three laps on each circuit → finish; pause/resume; restart; weather switch; camera switch; mute; touch steering; no horizontal overflow; console clean.
- Neon Duel at 1440 px and 390 px: menu → fighter select → best-of-three round → win and lose paths; pause; restart; training dummy; touch controls; reduce-flash toggle; console clean.

## Risks

- Three.js chunk growth: keep the engine lean, reuse shared scenery, and check the gzip size after the build.
- Fighting-game feel: frame data is deterministic and testable; tune only through simulation tests, never by weakening assertions.
- Input conflicts: ignore form fields, prevent default only for game keys, clear held keys on blur and pause.
- Flaky browser tests: assert states and HUD text, not pixels or timing-sensitive animation frames.
