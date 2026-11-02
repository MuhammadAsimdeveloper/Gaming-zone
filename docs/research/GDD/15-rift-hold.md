# 15 — Rift Hold

> **Reference genre:** Clash of Clans (base building and asynchronous raids).
> **Shortlist rank:** 15 · **Engine:** Canvas 2D isometric + DOM UI · **Complexity:** L · **Wave:** 3
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

An asynchronous base-building game on a rift-carved plateau. The player lays out a hold, upgrades extractors and defences, trains a small roster of units and raids procedurally generated rival holds for resources. There are no real players, no timers measured in real days and no purchases.

Working tagline: *“Build the hold. Break the rift.”*

### Design pillars

1. **Layout is the strategy.** Wall shape, compartmentalisation and defence coverage matter.
2. **Raids are readable and short.** 90 seconds, visible pathing, clear loot.
3. **No waiting walls.** Upgrades complete instantly for resources; the cost is the gate.
4. **A finite tech arc.** Hold levels 1–4, eight buildings, six units, one campaign.
5. **Original world.** No copied Clash of Clans buildings, troops, art, names or layout.

### Target session

- 5–15 minutes per session; 4–8 hours to finish the campaign.
- Portrait phone and desktop.
- Player intent: base design, short raids, steady unlocks.

### Core loop

```
Collect resources → upgrade buildings / train units
  → scout a generated rival hold → deploy units → raid
  → loot resources → repair/rearrange base
  → next hold level → new buildings/units → repeat
```

### Structure

| Hold level | Unlocks | Raid difficulty |
|---|---|---|
| 1 | Core, extractors, storage, wall, arrow tower | 1 |
| 2 | Cannon, barracks, second unit | 2 |
| 3 | Mortar, shield generator, third/fourth units | 3 |
| 4 | Tesla coil, air unit, final campaign raids | 4 |

---

## 2. Feature list

### Essential

- 24 × 24 isometric build grid.
- 8 buildings: Core, two extractors, storage, wall, arrow tower, cannon, mortar.
- 6 units: Runner, Brute, Sapper, Archer, Shieldbearer, Drifter (air).
- Resource economy: alloy and cores; instant build costs.
- Grid placement, rotation, move, sell (50% refund).
- Raid flow: scout, deploy, 90 s timer, loot, stars, result.
- Pathfinding around walls; units target defences then loot buildings.
- Defence AI: towers acquire nearest/priority targets with range and cooldown.
- Procedurally generated rival holds at four difficulty tiers.
- Campaign of 16 raids with unlock progression.
- Base save/load and raid history (last 10).
- Pause during build; no pause during raid.
- Touch drag placement and deployment; desktop mouse/keyboard.

### Advanced

- Wall compartment testing overlay (shows coverage gaps).
- Replay of the last raid.
- Defence test mode: spawn a wave against your own base.
- Two additional tower types at hold level 4.
- Cosmetic banners and plateau palettes.

### Optional

- Endless raid ladder with escalating generated holds.
- Base export/import as a local string.
- Daily seeded challenge hold.

### Explicitly cut

- Real players, matchmaking, clans, chat, donations.
- Real-time build timers, gems, shields bought with currency, loot boxes.
- Copied Clash of Clans buildings, troops, heroes, art or sound.
- Server-authoritative anything.

---

## 3. Gameplay architecture

```
src/games/rift-hold/
  RiftHoldGame.tsx   React shell, build UI, army panel, raid HUD
  engine.ts          Isometric render + fixed-step raid sim
  base.ts            Grid, buildings, walls, placement rules
  economy.ts         Resources, costs, production, loot
  units.ts           Unit stats and state machines
  pathing.ts         Grid A* with wall breaking costs
  defence.ts         Tower targeting and projectiles
  raids.ts           Rival base generation and campaign data
  combat.ts          Damage, targeting priority, destruction
  audio.ts           Procedural impacts, alarms, victory
  persistence.ts     Base save, campaign progress, history
  *.test.ts          Placement, pathing, economy, raid result
```

### Base model

- Grid cells can hold one building; walls occupy cells and block movement.
- Buildings have HP, footprint, cost, build time 0 (instant), and a level.
- Core destruction or 100% destruction ends a raid; stars for 50%/75%/100% and Core.
- Placement rules: inside plateau bounds, no overlap, walls connect by edge.

### Pathing

- A* over walkable cells with a high cost for wall cells.
- Units prefer the cheapest path; if a wall is on the path, they attack it when adjacent.
- Flying units ignore walls but are targeted only by air-capable towers.
- Path is recomputed when a wall is destroyed or a building blocks a route.
- Cap: 30 units per raid; one path query per unit per 0.5 s, staggered.

### Raid simulation

- Fixed 30 Hz; 90-second limit.
- Deployment zone: the outer two rings of the plateau.
- Units spawn with a short drop animation and no collision for 0.5 s.
- Loot is awarded proportionally to destroyed resource buildings, then a star bonus.
- Defence towers use range circles, projectile travel and target priority (air > healer > nearest).

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed-step | Deterministic raids and testable pathing |
| Rendering | Canvas 2D isometric | Hundreds of sprites; no 3D asset cost |
| UI | React DOM | Build catalogue, army panel, results |
| Pathing | Custom A* | Small grid, wall costs |
| Audio | Web Audio synthesis | Zero assets |
| Persistence | LocalStorage | Base and progress JSON |

No server, no real-time multiplayer, no physics engine.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Buildings | Original isometric vector structures, 4 levels each |
| Units | Original 4-direction sprites with walk/attack frames |
| Terrain | Procedural plateau tiles, rift edges, props |
| UI | Inline SVG icons and DOM panels |
| Audio | Synth impacts, alarms, loot chime |
| Thumbnail | Hold cutaway with a raid in progress |

No copied building silhouettes, troop designs, colour schemes tied to the reference, or UI layout.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Grid | Isometric grid, placement, walls | Valid/invalid placement is correct |
| M2 — Economy | Resources, costs, production, upgrade | Hold level 1 loop works without raids |
| M3 — Raid | Deployment, pathing, one tower, one unit | A raid can reach and destroy a building |
| M4 — Defence | 4 tower types, targeting, projectiles | Towers kill units; air rules correct |
| M5 — Content | 8 buildings, 6 units, 16 raids | Campaign completable |
| M6 — Meta/polish | Hold levels, history, replay, audio | Progress persists; results accurate |
| M7 — QA | Touch, performance, docs | 45+ fps mobile with 30 units; QA complete |

---

## 7. Estimated complexity

**L.** ~6,000–8,000 lines. Pathing and base layout validation are the technical risks; content is bounded. The absence of timers and servers simplifies the product substantially.

---

## 8. Testing plan

### Unit

- Placement overlap/bounds/wall-connection rules.
- Sell refund and upgrade cost math.
- A* returns the cheapest route and respects wall costs.
- Flying units ignore walls; ground units do not.
- Tower targeting priority and range.
- Loot proportional to destroyed buildings.
- Star calculation and raid end conditions.
- Generated rival holds are always valid and reachable.

### Integration

- Complete the 16-raid campaign.
- Destroy a wall mid-raid; path recalculates.
- Deploy 30 units; no stuck units or pathfinding spikes.
- Save/reload base with buildings mid-upgrade (instant upgrades make this trivial).
- Defence test mode completes without affecting campaign.
- Route change disposes RAF/audio.

### Performance

- 30 units + 8 towers + 6 buildings at 60 fps desktop, ≥ 45 fps mobile.
- Path queries staggered; no frame > 33 ms during a raid.
- ≤ 200 draw ops; cached isometric tile layer.

---

## 9. Integration plan

1. Add `rift-hold` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `strategy`, secondary `casual`.
3. Lazy registry entry; Canvas 2D + DOM only.
4. Thumbnail + `docs/games/rift-hold.md` with honest “no real players” note.
5. `onComplete` on campaign raid result.
6. Reuse shared2d loop/input/rng/storage helpers.

---

## 10. Known limitations

- No real players, clans or PvP. All rivals are generated.
- Instant upgrades remove the long-term pacing of the reference genre; progression is campaign-bounded.
- Base layouts are limited to a 24 × 24 grid and eight building types.
- No server means no cloud saves; clearing browser data loses the base.
- Generated rival holds are valid and beatable but not authored with human cunning.
