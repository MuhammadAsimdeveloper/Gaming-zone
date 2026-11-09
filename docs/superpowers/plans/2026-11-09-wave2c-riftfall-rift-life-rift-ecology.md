# Wave 2C: Riftfall, Rift Life and Rift Ecology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship three original games — a top-down neon wave-survival action game (Riftfall), a 21-day roleplay life-sim (Rift Life) and a 60-day ecosystem simulation (Rift Ecology) — as games 36–38 of the NeonRift catalogue.

**Architecture:** Each game keeps deterministic rules in pure TypeScript modules with no DOM access, and a thin presentation layer (Canvas 2D or React) that owns only rendering, menus and 10 Hz HUD snapshots. Randomness comes from a seeded PRNG; simulations run on fixed steps; React never holds per-frame simulation state.

**Tech Stack:** React 19, TypeScript 5.9 strict, Vite 8, Canvas 2D for Riftfall and Rift Life scenes, SVG charts for Rift Ecology, Vitest 5 (node), Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-11-04-games-wave2-design.md` (§ Sub-wave 2C).

## Global Constraints

- No new runtime dependency.
- Original names, art, sounds, code and layouts. No proprietary game code, characters, artwork, maps, logos, sounds or exact level layouts.
- Single-player only. No fake opponents, accounts, multiplayer, cloud saves or leaderboards.
- No `any` in new public APIs. No `@ts-ignore`.
- Every game is lazy-loaded; each lazy chunk stays under 150 kB gzip and main-bundle growth stays under 10 kB.
- Deterministic simulation: seeded RNG and fixed time steps for every rule test; no wall-clock or `Math.random` inside pure modules.
- React state updates at most 10 times per second during play; simulation state lives in refs.
- Touch controls are part of the definition of done.
- No resource leaks: render loops, listeners and audio contexts are disposed on unmount.
- Claim a suite passed only after running it. Never weaken an assertion to make a build pass.
- Work lands as one commit per game on `feat/games-wave2`; the standing user instruction authorizes pushing that branch. No merge to `main`, no deploy.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/games/riftfall/simulation.ts` | Arena state, player movement/dash/parry, enemies, projectiles, combo, wave composition, boss phases, win/lose. |
| `src/games/riftfall/upgrades.ts` | Weapon definitions, nine stacking upgrades, seeded three-choice offers, stat application. |
| `src/games/riftfall/render.ts` | Canvas 2D arena, entities, telegraphs, particles, HUD chrome. |
| `src/games/riftfall/audio.ts` | Procedural WebAudio cues over the shared mute preference. |
| `src/games/riftfall/RiftfallGame.tsx` | React shell: menu, run loop, HUD, pause, results, touch, upgrade picks. |
| `src/games/rift-life/simulation.ts` | Calendar, energy and time slots, activities, job progress, community stat, weather, save of run state. |
| `src/games/rift-life/npcs.ts` | Five NPCs, relationship deltas per activity and choice, scene gates. |
| `src/games/rift-life/endings.ts` | Six-ending resolution table plus gallery persistence helpers. |
| `src/games/rift-life/render.ts` | Canvas scene cards for the current day/location. |
| `src/games/rift-life/RiftLifeGame.tsx` | React shell: day planner, conversations, journal, ending screen and gallery. |
| `src/games/rift-ecology/species.ts` | Six species definitions and their interaction rates. |
| `src/games/rift-ecology/scenarios.ts` | Three scenarios, targets, seasonal curves and starting populations. |
| `src/games/rift-ecology/simulation.ts` | Population step, interventions, extinction/collapse detection, scoring and grades. |
| `src/games/rift-ecology/render.ts` | SVG population chart helpers and habitat layout primitives. |
| `src/games/rift-ecology/RiftEcologyGame.tsx` | React shell: scenario briefing, day loop, charts, event log, debrief. |
| `public/art/{riftfall,rift-life,rift-ecology}.svg` | Original catalogue key art. |

---

### Task 1: Riftfall simulation rules

**Files:**
- Create: `src/games/riftfall/simulation.ts`
- Test: `src/games/riftfall/simulation.test.ts`

**Interfaces:**
- Produces:
  - `type WeaponId = 'blade' | 'arc' | 'rail' | 'bloom'`
  - `interface RunConfig { seed: number; weapon: WeaponId }`
  - `interface RunInput { moveX: number; moveY: number; dash: boolean; parry: boolean }`
  - `interface RunState` with `status: 'fighting' | 'betweenWaves' | 'won' | 'lost'`, `wave`, `tick`, `player`, `enemies`, `projectiles`, `score`, `combo`
  - `createRun(config: RunConfig): RunState`
  - `stepRun(state: RunState, input: RunInput, ticks: number): void`
  - `startNextWave(state: RunState): void`
  - `nearestEnemy(state: RunState): Enemy | null`
  - `WAVE_COUNT = 12`

- [x] **Step 1: Write failing tests** covering: seeded wave composition is identical for the same seed and differs across seeds; wave 1 starts with the documented enemy count and waves grow; boss waves are 6 and 12; player movement is clamped to the arena; dash grants 12 ticks of invulnerability and a 36-tick cooldown; parry within its window reflects the next hostile projectile and stuns a melee enemy; attacks only hit enemies inside their range; damage reduces health and awards score with the combo multiplier; combo decays after 180 idle ticks; a wave clears only when every enemy is removed; clearing wave 12 sets `won`; health reaching zero sets `lost`; `stepRun` is deterministic for identical inputs.

- [x] **Step 2: Run** `npx vitest run src/games/riftfall/simulation.test.ts` and confirm failure.

- [x] **Step 3: Implement** a fixed 1/60 tick model. Arena is 960×600 with a 28-unit player radius. Spawn tables per wave use a seeded mulberry32 PRNG stored on the state. Enemy kinds: `grunt` (chase), `runner` (fast, low health), `brute` (slow, high health), `elite` (telegraphed charge), `boss` (two phases at 60% and 30% health, radial and aimed projectile patterns). Projectiles carry `hostile` and are removed on arena exit or life expiry. Score: `10 × kindValue × comboMultiplier`, multiplier `1 + min(4, floor(combo / 5) * 0.5)`.

- [x] **Step 4: Run tests** and `npm run typecheck`.

- [x] **Step 5: Commit** `feat(riftfall): add deterministic arena simulation`.

---

### Task 2: Riftfall upgrades and weapons

**Files:**
- Create: `src/games/riftfall/upgrades.ts`
- Test: `src/games/riftfall/upgrades.test.ts`

**Interfaces:**
- Consumes: `RunState`, `WeaponId` from `./simulation`.
- Produces:
  - `interface WeaponStats { damage: number; cooldownTicks: number; range: number; projectileSpeed: number; area: number }`
  - `interface Upgrade { id: string; name: string; description: string; maxStacks: number; apply(stats: Record<WeaponId, WeaponStats>, state: RunState): void }`
  - `WEAPONS: Record<WeaponId, WeaponStats>`
  - `UPGRADES: readonly Upgrade[]`
  - `rollOffers(run: RunState, count?: number): Upgrade[]`
  - `applyUpgrade(run: RunState, upgradeId: string): boolean`

- [x] **Step 1: Write failing tests**: each weapon has distinct damage/cooldown/range; offers contain three unique upgrades; offers never repeat a maxed upgrade; the same seed and state produce identical offers; applying an upgrade raises the relevant stat; stacking two damage upgrades compounds as documented; an unknown id returns `false` and changes nothing; applying past `maxStacks` is rejected.

- [x] **Step 2: Run** and confirm failure.

- [x] **Step 3: Implement** four weapons and nine upgrades: `edge-oil` (+damage), `quick-hands` (−cooldown), `long-reach` (+range), `split-shot` (+area), `kinetic-boots` (dash cooldown), `rift-heart` (max health), `combo-core` (slower decay), `parry-focus` (longer parry window), `overcharge` (score multiplier). Offers draw with the run's seeded RNG, three unique entries, skipping maxed stacks.

- [x] **Step 4: Run tests** and typecheck.

- [x] **Step 5: Commit** `feat(riftfall): add weapons and upgrade picks`.

---

### Task 3: Riftfall presentation and shell

**Files:**
- Create: `src/games/riftfall/render.ts`, `src/games/riftfall/audio.ts`, `src/games/riftfall/RiftfallGame.tsx`
- Test: `src/games/riftfall/RiftfallGame.test.tsx`, `src/games/riftfall/render.test.ts`
- Modify: `src/games/simulation-smoke.test.tsx` (register the component)

**Interfaces:**
- Consumes: Task 1 and 2 APIs, `GameFrame`, `GameOverlay`, `GameButton`, `GameStat`, `useVisibilityPause`, `GameAudio` conventions.
- Produces: default `RiftfallGame({ onStart, onComplete })`; `drawRiftfall(ctx, canvas, view, options)`; `class RiftfallAudio` with `hit`, `parry`, `dash`, `wave`, `boss`, `ko`, `setMuted`, `dispose`.

- [x] **Step 1: Write failing shell test**: menu shows four weapons and a Start button; Start calls `onStart`; the loop steps the simulation; pause freezes it; between-wave upgrade offers pause play and applying a pick resumes; losing calls `onComplete` once with `outcome: 'loss'`; clearing the run calls it with `outcome: 'win'`; unmount cancels the loop. Render test: fake canvas records draws and handles a zero-size canvas.

- [x] **Step 2: Implement renderer and audio.** Neon grid arena, vector enemies per kind, boss telegraph rings, additive particles, weapon trails, impact shake disabled under reduced motion, HUD chrome.

- [x] **Step 3: Implement the shell.** Phases `menu | fighting | upgrades | paused | finished`; fixed accumulator at 1/60; HUD at 10 Hz; WASD/arrows move, Space dash, Shift parry, J/K/L weapons; touch pad plus Dash, Parry and weapon buttons; pause/restart; mute; run summary with wave, score and kills.

- [x] **Step 4: Run** shell and render tests, typecheck and build.

- [x] **Step 5: Commit** `feat(riftfall): ship neon wave-survival arena`.

---

### Task 4: Rift Life rules

**Files:**
- Create: `src/games/rift-life/simulation.ts`, `src/games/rift-life/npcs.ts`, `src/games/rift-life/endings.ts`
- Test: `src/games/rift-life/simulation.test.ts`, `src/games/rift-life/endings.test.ts`

**Interfaces:**
- Produces:
  - `type NpcId = 'mara' | 'ilo' | 'sena' | 'tovan' | 'juno'`
  - `type ActivityId = 'work' | 'rest' | 'community' | NpcId`
  - `type Weather = 'clear' | 'rain' | 'storm'`
  - `interface LifeState { day; slot; energy; jobProgress; community; relationships: Record<NpcId, number>; flags: string[]; weather; status: 'playing' | 'finished'; endingId: string | null }`
  - `createLife(seed: number): LifeState`
  - `activitiesFor(state: LifeState): ActivityOption[]`
  - `performActivity(state: LifeState, activity: ActivityId): LifeEvent[]`
  - `advanceDay(state: LifeState): LifeEvent[]`
  - `resolveEnding(state: LifeState): EndingId`
  - `NPCS: readonly Npc[]`, `ENDING_TABLE: readonly EndingRule[]`

- [x] **Step 1: Write failing tests**: a day has three slots and the fourth advance rolls the calendar; energy is spent and clamped; resting restores energy but advances time; work raises job progress; visiting an NPC raises that relationship only; conversation choices apply their deltas; a relationship scene unlocks at 25 and fires once; weather is deterministic for the seed; day 21 finishes the run; energy zero blocks activities until rest; every NPC can reach a 75 arc.

- [x] **Step 2: Run** and confirm failure.

- [x] **Step 3: Implement** the day/slot model, five NPC definitions with two conversation choices each and scene gates, a fixed calendar event on days 7, 14 and 21, and seeded weather.

- [x] **Step 4: Write failing ending tests**: the resolution table covers all six endings; each ending is reachable from a documented state; tie-breaking is deterministic; no state returns `null` before day 21.

- [x] **Step 5: Implement the ending table and run tests + typecheck.**

- [x] **Step 6: Commit** `feat(rift-life): add calendar, relationships and endings`.

---

### Task 5: Rift Life presentation and shell

**Files:**
- Create: `src/games/rift-life/render.ts`, `src/games/rift-life/RiftLifeGame.tsx`
- Test: `src/games/rift-life/RiftLifeGame.test.tsx`
- Modify: `src/games/simulation-smoke.test.tsx`

**Interfaces:**
- Consumes: Task 4 APIs plus shared UI.
- Produces: default `RiftLifeGame({ onStart, onComplete })`; `drawTown(ctx, canvas, view, options)`; ending gallery storage key `neonrift:game:rift-life:endings`.

- [x] **Step 1: Write failing shell test**: opening the game calls nothing; Start calls `onStart`; activities spend slots and update meters; a conversation choice updates the relationship; the day advance shows the next day; reaching day 21 shows an ending, persists it to the gallery and calls `onComplete` once with `outcome: 'complete'`; restart resets the run; unmount is clean.

- [x] **Step 2: Implement** the canvas town scene, portrait cards in CSS/SVG, planner, conversation panel, journal, ending screen and gallery.

- [x] **Step 3: Run** shell test, typecheck and build.

- [x] **Step 4: Commit** `feat(rift-life): ship 21-day roleplay life-sim`.

---

### Task 6: Rift Ecology rules

**Files:**
- Create: `src/games/rift-ecology/species.ts`, `src/games/rift-ecology/scenarios.ts`, `src/games/rift-ecology/simulation.ts`
- Test: `src/games/rift-ecology/simulation.test.ts`

**Interfaces:**
- Produces:
  - `type SpeciesId = 'kelp' | 'glowmoss' | 'grazer' | 'burrower' | 'skimmer' | 'reef-hunter'`
  - `type InterventionId = 'plant' | 'cull' | 'protect' | 'flow'`
  - `interface EcologyState { scenarioId; day; populations: Record<SpeciesId, number>; budget; log: string[]; status: 'running' | 'crashed' | 'finished' }`
  - `createEcology(scenarioId: ScenarioId): EcologyState`
  - `stepDay(state: EcologyState, intervention?: InterventionId, species?: SpeciesId): void`
  - `scoreRun(state: EcologyState): EcologyScore`
  - `SPECIES: readonly Species[]`, `SCENARIOS: readonly Scenario[]`, `DAYS = 60`

- [x] **Step 1: Write failing tests**: populations follow the logistic growth step without predation; predators reduce prey; starvation reduces predators when prey is scarce; carrying capacity caps producers; seasonal multipliers follow the scenario curve; planting raises producers and spends budget; culling reduces a species; protection halves predation for a day; flow raises carrying capacity; a species hitting zero is extinct and flagged; a full collapse ends the run; scores reward biodiversity, stability and remaining budget; grades map to documented thresholds; identical runs are deterministic.

- [x] **Step 2: Run** and confirm failure.

- [x] **Step 3: Implement** the discrete daily step with explicit interaction terms, three scenarios, three budget costs, extinction/collapse detection and the score model.

- [x] **Step 4: Run tests** and typecheck; commit `feat(rift-ecology): add ecosystem population model`.

---

### Task 7: Rift Ecology presentation and shell

**Files:**
- Create: `src/games/rift-ecology/render.ts`, `src/games/rift-ecology/RiftEcologyGame.tsx`
- Test: `src/games/rift-ecology/RiftEcologyGame.test.tsx`

**Interfaces:**
- Consumes: Task 6 APIs plus shared UI.
- Produces: default `RiftEcologyGame({ onStart, onComplete })`; `buildLinePath(values, width, height): string`; `buildHabitatLayout(scenario)`.

- [x] **Step 1: Write failing shell test**: scenario briefing lists all three scenarios; Start calls `onStart`; advancing a day updates populations and the log; an intervention spends budget; finishing day 60 shows a debrief, calls `onComplete` once with `outcome: 'complete'` and the score; collapse shows the crash debrief; unmount is clean.

- [x] **Step 2: Implement** the SVG population chart, habitat view, intervention toolbar, event log, debrief and assumptions panel.

- [x] **Step 3: Run** shell test, typecheck and build; commit `feat(rift-ecology): ship ecosystem simulation`.

---

### Task 8: Catalogue, art, browser tests and docs

**Files:**
- Modify: `src/types/game.ts`, `src/games/registry.ts`, `src/data/games.json`, `e2e/helpers.ts`, `e2e/gameplay.spec.ts`, `e2e/navigation.spec.ts`, `e2e/a11y.spec.ts`, `README.md`, `docs/research/README.md`, `docs/research/ROADMAP.md`, the Wave 2 spec status line, `docs/games/1000-game-expansion-program.md`.
- Create: `public/art/riftfall.svg`, `public/art/rift-life.svg`, `public/art/rift-ecology.svg`.

- [x] **Step 1:** Add three keys, lazy registry entries and catalogue records (`action`; `adventure`; `simulation`) with instructions and controls matching the real inputs; ranks 36–38.
- [x] **Step 2:** Update every literal count from 35 to 38 and the shipped-game lists.
- [x] **Step 3:** Extend the Playwright boot, catalogue and axe matrices to the three routes.
- [x] **Step 4:** Run `npm run typecheck`, `npm test`, `npm run build`, `npx playwright test --workers=2`; fix every failure at the root.
- [x] **Step 5:** Update documentation with real test counts and the verification date; list the games as shipped in the Wave 2 spec and roadmap.
- [x] **Step 6: Commit** `feat(riftfall,rift-life,rift-ecology): register Wave 2C games and update docs`.

## Verification commands

```
npm run typecheck
npm test
npm run build
npx playwright test --workers=2
```

## Risks

- Canvas loop performance: fixed-step simulation with at most four catch-up steps and a capped entity count.
- Balance drift: tune only through simulation tests with explicit targets; never weaken assertions.
- Flaky browser tests: assert states and HUD text, not pixels or timing-sensitive animation frames.
- Roleplay scope: the day model is deliberately small; every ending must be reachable by a test.
- Ecology honesty: the info panel states that the model is a stylised teaching model, not a scientific simulation.
