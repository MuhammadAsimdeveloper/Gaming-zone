# 14 — Nightfall

> **Reference genre:** Don't Starve (survival with day/night pressure).
> **Shortlist rank:** 14 · **Engine:** Canvas 2D · **Complexity:** M–L · **Wave:** 2
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A top-down survival game on a dark, wind-scoured plateau. The player gathers, crafts, builds a shelter and survives twelve days while the nights grow longer and more hostile. Death is permanent for the run; recipes discovered are recorded in a field journal that persists.

Working tagline: *“The dark is not empty.”*

### Design pillars

1. **Light is life.** Darkness drains resolve and eventually health; every trip is a light-budget decision.
2. **Preparation beats reflexes.** A stocked shelter trivialises a night that kills an unprepared player.
3. **Readable scarcity.** Resources are visible, finite per region and respawn slowly.
4. **Twelve days, one arc.** A run has a beginning, a crisis and an ending.
5. **Original survival world.** No copied characters, creatures, art, names or sanity system presentation.

### Target session

- 20–40 minutes per run; 3–8 runs to first survival.
- Desktop-first; mobile supported.
- Player intent: tense resource management with a clear goal.

### Core loop

```
Wake at dawn → scout/gather → craft tools → build/upgrade shelter
  → prepare light and food → survive night creatures
  → repeat; nights lengthen → day 12 finale → rescue signal or death
```

### Survival meters

| Meter | Drain | Restored by |
|---|---|---|
| Health | Damage, starvation, darkness | Food, bandage, sleep |
| Hunger | Slow constant | Cooked food, rations |
| Warmth | Night, wind, rain | Fire, shelter, coat |
| Resolve | Darkness, monsters, isolation | Light, music, warm food |

---

## 2. Feature list

### Essential

- One plateau map (~120 × 120 tiles) with four regions.
- Day/night cycle; night length grows from 2 to 5 in-game minutes.
- Gathering: wood, fibre, stone, flint, berries, mushrooms, water.
- Crafting: 20 recipes across tools, light, food, shelter, medicine.
- Tools: axe, pickaxe, spear, torch, lantern; durability.
- Base building: fire pit, shelter, chest, drying rack, signal tower.
- 8 creatures: passive, nocturnal predator, swarm, ranged, burrower, thief, elite, final threat.
- Darkness damage and resolve effects.
- Hunger, warmth, health and resolve systems.
- Day 12 finale: complete the signal tower and survive the final night.
- Permadeath with a persistent field journal (recipes + map knowledge).
- Save-and-quit at dawn only; resume restores the day start.
- Pause, restart, settings, audio toggles.
- Keyboard/mouse and touch.

### Advanced

- Weather: rain (warmth drain, fire risk), fog (vision), clear.
- Region-specific resources and hazards.
- Creature tracking cues (footprints, sounds).
- Field journal with creature notes.
- Two difficulty presets (Drifter, Veteran).

### Optional

- Endless mode after first survival.
- Second map layout.
- Cosmetic shelter banners.

### Explicitly cut

- Multiplayer/co-op.
- Procedural infinite worlds, seasons beyond the 12-day arc.
- Copied Don't Starve characters, creatures, sanity effects, art or UI.
- Online persistence or leaderboards.

---

## 3. Gameplay architecture

```
src/games/nightfall/
  NightfallGame.tsx  React shell, inventory, crafting, journal
  engine.ts          Fixed-step sim + canvas render
  world.ts           Tile map, resources, regions
  daynight.ts        Clock, light levels, night length curve
  survival.ts        Meters, damage, death
  crafting.ts        Recipes and station rules
  creatures.ts       AI behaviours and spawn director
  building.ts        Placement, shelter validation
  audio.ts           Procedural wind, fire, creature cues
  persistence.ts     Journal, records, dawn save
  *.test.ts          Meters, crafting, darkness, day progression
```

### Time and light

- One day = 8 real minutes at 1×: 4 min day, 2 min dusk, 2 min night (night grows to 5 by day 12).
- Light level per tile: 0–100, from daylight, fires, torches and lanterns.
- Below 25 light, resolve drains; below 10, health drains after a grace period.
- Fires consume fuel; fuel is a resource decision, not a timer trap.

### Creature director

- Spawn budget scales with night index and player light.
- Nocturnal predators spawn outside the light radius and approach.
- A “pressure” meter prevents more than N active threats; if the player is safe, pressure decays.
- Thieves target dropped resources, not inventory.
- Final night spawns a coordinated wave against the signal tower.

### Save model

- Save at dawn only, with an explicit “quit and resume at dawn” action.
- Journal (recipes, creature notes, map regions) persists across deaths.
- Versioned payload; corrupt save resets with a warning.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed-step | Meters, day clock and AI are straightforward |
| Rendering | Canvas 2D | Top-down tiles and a dynamic light mask |
| Lighting | Radial gradients + composite mask | Cheap and atmospheric |
| UI | React DOM | Inventory, crafting, journal |
| Audio | Web Audio synthesis | Wind, fire, creature calls without assets |
| Persistence | LocalStorage | Journal and dawn save |

No physics engine. Movement is tile/AABB with simple collision.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Terrain | Procedural tiles with four regional palettes |
| Player | Original 4-direction sprite, 4-frame walk |
| Creatures | 8 original silhouettes with 2–4 frames |
| Props | Procedural trees, rocks, ruins, resource nodes |
| Lighting | Canvas gradients and a darkness mask |
| UI | Inline SVG meters and recipe icons |
| Audio | Synth wind, fire crackle, creature cues |
| Thumbnail | Campfire circle in darkness |

No copied characters, creature designs, sanity visuals or art.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — World/time | Map, movement, day/night light | Light mask and clock run correctly |
| M2 — Survival | Meters, food, darkness damage | A player can starve or freeze and die |
| M3 — Gathering/crafting | Resources, tools, 20 recipes | Progression from flint to lantern works |
| M4 — Base/night | Building, fire fuel, creature director | Survive nights 1–3 with a basic base |
| M5 — Arc | 12-day curve, finale, journal | Full run can be won or lost |
| M6 — Polish/QA | Weather, audio, touch, performance | 60 fps desktop, 45+ mobile; QA complete |

---

## 7. Estimated complexity

**M–L.** ~5,000–7,000 lines. Systems are simple individually; balancing the 12-day curve and night pressure is the main work. Lighting and readability need early prototypes.

---

## 8. Testing plan

### Unit

- Meter decay and clamp.
- Darkness damage thresholds and grace period.
- Recipe matching and station requirements.
- Tool durability and breakage.
- Day length curve by day index.
- Creature spawn budget caps.
- Dawn save roundtrip and version handling.

### Integration

- Survive to day 12 with a scripted route.
- Die to starvation, cold and darkness separately.
- Build and fuel a fire through a full night.
- Complete the signal tower and trigger the finale.
- Journal persists after death.
- Route change disposes RAF/audio.

### Performance

- 60 fps desktop, ≥ 45 fps mobile with the light mask.
- ≤ 300 active entities; pooled particles.
- No per-frame full-map redraws; cache static layers.

---

## 9. Integration plan

1. Add `nightfall` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `adventure`, secondary `strategy`.
3. Lazy registry entry; Canvas 2D only.
4. Thumbnail + `docs/games/nightfall.md` with survival rules and permadeath note.
5. `onComplete` on survival or death with day reached.
6. Reuse shared2d loop/input/rng/storage/audio helpers.

---

## 10. Known limitations

- One map and a twelve-day arc; not an endless survival sandbox.
- Creature AI is behavioural, not a deep ecology simulation.
- Permadeath is real; the journal softens it but does not remove loss.
- Save-and-quit at dawn is intentional and limits save-scumming.
- Mobile lighting and inventory are playable but desktop is the intended experience.
