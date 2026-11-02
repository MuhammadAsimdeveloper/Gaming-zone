# 04 — Lawn Protocol

> **Reference genre:** Plants vs. Zombies (lane tower defence).
> **Shortlist rank:** 4 · **Engine:** Canvas 2D + DOM UI · **Complexity:** M · **Wave:** 1
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A lane-defence game where a rooftop garden powers a district’s last solar core. The player plants bio-modules on a 5 × 9 grid while rust swarms advance down the lanes. The tone is dry, bright and mechanical — a maintenance manual that came alive, not a horror comedy.

Working tagline: *“Grow the grid. Hold the line.”*

### Design pillars

1. **Readable pressure.** Every enemy telegraphs its lane, speed and special behaviour before it matters.
2. **Economy is the puzzle.** Light income, module cost and cooldown create the real decisions.
3. **No filler waves.** Every level introduces or combines a mechanic; no wave exists only to pad time.
4. **Touch parity.** The whole game is playable with one finger.
5. **Original world.** No zombies, no lawns copied from the reference, no reused plant names or art.

### Target session

- 4–9 minutes per level.
- Portrait phone and desktop.
- Player intent: short tactical session with a clear win/lose.

### Core loop

```
Pick level → preview lanes and enemy mix
  → collect light, plant modules on the grid
  → react to wave telegraphs, shovel/rebuild
  → survive the final wave → stars/reward
  → unlock next level or retry for a better result
```

### Modes

| Mode | Description |
|---|---|
| Campaign | 12 authored levels across 3 rooftops, each with a fixed enemy deck |
| Endless | Escalating waves, one life, local high score |
| Daily Seed | One generated loadout per day, same for every player locally |

### What this game is not

- Not a real-time strategy game with unit selection.
- Not a multiplayer defence game.
- Not a monetised mobile game with energy, ads or card packs.

---

## 2. Feature list

### Essential

- 5 lanes × 9 columns; modules placed on empty cells.
- Light economy: sky drops + collector modules; starting light per level.
- 8 modules:
  - **Photofern** — generates light.
  - **Needle Pod** — single-target shooter.
  - **Burst Bloom** — short-range splash.
  - **Rind Wall** — high-health blocker.
  - **Frost Cap** — slows a lane.
  - **Ember Vine** — burns a lane tile over time.
  - **Mortar Moss** — lobbed area damage, cannot hit close targets.
  - **Purge Reed** — one-use lane clear, long cooldown.
- 10 enemies with distinct behaviours: walker, runner, armoured, shielded, jumper, burrower, splitter, healer, ranged, boss.
- Cooldowns and costs shown on seed cards.
- Shovel with refund rules (50% of cost, rounded down).
- Lawn-purge equivalent: one per lane per level, triggers when an enemy crosses the threshold.
- Wave director with telegraphs, flags and a final-wave warning.
- Win/loss, star rating (no damage / ≤2 purges / win), retry.
- Pause, restart, speed toggle (1×/2× after level 3).
- Local progress and unlocks.
- Audio: light pickup, shot, impact, wave horn, defeat sting.
- Touch drag-to-plant, tap-to-select, tap-to-shovel.

### Advanced

- 12 campaign levels with three rooftop themes and weather modifiers (rain reduces light, wind shifts mortar).
- Endless mode with a local best.
- Codex of enemies and modules (unlocked as encountered).
- Colour-blind palette and reduced-flash mode.
- “Preview next wave” panel.

### Optional

- Challenge modifiers (no collectors, double speed).
- Cosmetic garden skins.
- Level editor with shareable seed string (not a server).

### Explicitly cut

- Real-money currency, card levelling, gacha.
- Online PvP or co-op.
- Copied plant/zombie names, designs, sounds or level layouts.
- Story cutscenes with voice acting.

---

## 3. Gameplay architecture

```
src/games/lawn-protocol/
  LawnProtocolGame.tsx  React shell, seed cards, HUD, menus
  engine.ts             Fixed-step grid simulation + canvas render
  modules.ts            Module definitions and behaviours
  enemies.ts            Enemy definitions and state machines
  waves.ts              Wave data, director, level definitions
  grid.ts               Placement, occupancy, lane helpers
  economy.ts            Light, costs, cooldowns, refunds
  audio.ts              Procedural cues
  persistence.ts        Progress, stars, best endless score
  *.test.ts             Waves, economy, collision, win/loss
```

### Grid and coordinates

- Logical grid 9 columns × 5 lanes, cell 80 × 96 logical units.
- Canvas scales to fit; pointer mapping converts to cell indices.
- Each cell holds `{ moduleId, health, cooldown }` or empty.
- Enemies occupy a continuous `x` within a lane; collision uses lane + x overlap.

### Simulation

- Fixed step 1/60 s; render interpolation optional.
- Update order: light income → cooldowns → module actions → projectiles → enemies → collisions → purge checks → wave director.
- Projectiles are pooled; hitscan modules resolve instantly with a visual tracer.
- Enemy eating: when an enemy overlaps a module, it stops and deals damage per second until the module is destroyed.

### Wave director

- Level data: `{ time, lane, enemyId, count, spacing, telegraph }`.
- Director spawns from a queue sorted by time; pauses spawning during the pre-wave banner.
- Final wave sets `isFinal`; victory when all spawned enemies are dead and the queue is empty.
- Loss when an enemy crosses column 0 and the lane purge has already been used.

### Balance levers

- Light drop interval (7–10 s), starting light (50–150), module costs (25–175).
- Enemy HP/speed multipliers per level.
- Cooldown ratios kept in a single data table so tests can assert monotonic difficulty.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed-step | Grid logic is simple and must be deterministic |
| Rendering | Canvas 2D | Hundreds of sprites, cheap effects, small bundle |
| HUD/cards | React DOM | Accessible buttons and keyboard selection |
| Audio | Web Audio synthesis | No asset licensing |
| Persistence | LocalStorage | Progress only |

No physics engine. Collision is lane and x-overlap checks.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Modules | Original vector sprites drawn to offscreen canvases from shape recipes |
| Enemies | Original vector sprites with 4-frame walk cycles |
| Rooftop backgrounds | Three parallax layers, procedural gradients and silhouettes |
| Projectiles/effects | Pooled circles, arcs and particles |
| UI | Inline SVG icons + Tailwind-styled DOM |
| Audio | Synthesised plucks, thumps, horn |
| Thumbnail | Composed key art from the game scene |

Palette: solar yellow, oxidised copper, deep green, charcoal. No photographic assets.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Grid | Placement, occupancy, shovel, pointer mapping | Modules place and remove correctly on all cells |
| M2 — Combat | One shooter, one walker, projectiles, eating | Enemy dies, module takes damage, loss triggers |
| M3 — Economy | Light, costs, cooldowns, collector | A full level can be won with the starter set |
| M4 — Content | 8 modules, 10 enemies, 12 levels | All levels completable; no soft-locks |
| M5 — Modes | Endless, daily seed, stars, codex | Progress persists; endless score records |
| M6 — Polish/QA | Audio, effects, mobile, performance | Touch-only completion; 60 fps with 120 entities |

---

## 7. Estimated complexity

**M.** ~3,000–4,000 lines. Systems are small; content and balance are the schedule risk. The deterministic simulation makes regression testing practical.

---

## 8. Testing plan

### Unit

- Placement rejects occupied cells, out-of-bounds and insufficient light.
- Cooldown gating and refund math.
- Projectile collision with the first enemy in a lane.
- Eating damage and module destruction.
- Wave completion and loss conditions.
- Star calculation.
- Level data validation: every level has a final wave and reachable enemy mix.

### Integration

- Complete each of the 12 levels with a scripted build order.
- Trigger every purge once; verify it cannot be reused.
- Pause during a wave; resume without time skip.
- 2× speed does not alter simulation outcomes for the same inputs.
- Reload restores level progress and endless best.
- Touch drag-to-plant on a 360 px-wide viewport.

### Performance

- 120 active enemies + 200 projectiles at 60 fps desktop, ≥ 45 fps mobile.
- No per-frame DOM updates except HUD at 10 Hz.

---

## 9. Integration plan

1. Add `lawn-protocol` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `strategy`, secondary `casual`/`puzzle`.
3. Lazy registry entry; Canvas 2D only.
4. Thumbnail and `docs/games/lawn-protocol.md`.
5. `onComplete` on level win/loss with score.
6. Reuse shared2d loop/input/rng/canvas helpers.

---

## 10. Known limitations

- The campaign is 12 levels, not a long live-service progression.
- Enemy and module variety is deliberately bounded; there is no card collection meta.
- Endless mode is local-only and can be gamed by editing storage.
- Difficulty tuning is authored, not adaptive.
- Daily Seed is deterministic by local date, not fetched from a server.
