# 12 — Habitat

> **Reference genre:** The Sims 4 (life / agent simulation).
> **Shortlist rank:** 12 · **Engine:** Canvas 2D isometric + DOM UI · **Complexity:** L · **Wave:** 3
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A small life-simulation about four people sharing a converted signal station. The player builds rooms, buys furniture, sets routines and watches needs, moods and relationships unfold. The scale is deliberately domestic: one home, four residents, no open world.

Working tagline: *“A small life, in detail.”*

### Design pillars

1. **Needs create stories.** Simple meters produce emergent routines and conflicts.
2. **Building is legible.** Grid rooms, clear costs, no hidden placement rules.
3. **Agents are readable.** Mood, intent and path are visible at a glance.
4. **A session is a day or two.** Time controls from pause to 3×.
5. **Original world.** No copied Sims names, UI, furniture, sounds or neighbourhoods.

### Target session

- 20–60 minutes.
- Desktop-first; mobile supported with larger touch targets.
- Player intent: creative domestic play and light simulation.

### Core loop

```
Build/edit home → move in residents → set routines
  → watch needs decay, autonomy, relationships
  → intervene: direct actions, buy objects, redesign
  → end of day → summary → continue
```

### Simulation scope

- One lot: 24 × 24 build grid, two floors optional (v1: one floor).
- Up to four residents.
- Needs: energy, hunger, hygiene, social, fun, focus.
- Mood derived from needs + recent events + traits.
- Careers: three part-time tracks (signal repair, garden lab, archive) with shifts.
- Relationships: acquaintance → friend → close; conflict events.
- Time: 1 in-game minute = 2 real seconds at 1×.

---

## 2. Feature list

### Essential

- Isometric canvas lot with grid placement.
- Build mode: floors, walls, doors, windows; buy mode: 30 objects.
- Four residents with traits, needs, moods and autonomy.
- Needs decay, object interactions, routing and queueing.
- Direct control: select resident → choose action/object.
- Careers with shifts, pay and performance.
- Relationship values and social interactions.
- Day/night cycle and time controls (pause, 1×, 2×, 3×).
- Save/load household and lot, versioned.
- Pause, settings, audio toggles.
- Keyboard/mouse and touch.

### Advanced

- Routines: schedule sleep/work/meals per resident.
- Event log and daily summary.
- 12 traits with behavioural modifiers.
- Object states: dirty, broken, needs repair/cleaning.
- Room scoring (comfort, light, decor) affecting mood.
- Photo mode.

### Optional

- Second floor.
- Two additional careers.
- Pet.
- Household visitors.

### Explicitly cut

- Open neighbourhood, multiple lots, story progression.
- Online gallery, share codes, mods.
- Copied Sims UI (plumbob, needs panel layout), furniture, animations or sounds.
- Paid expansions or currency.

---

## 3. Gameplay architecture

```
src/games/habitat/
  HabitatGame.tsx    React shell, build/buy UI, resident panel
  engine.ts          Simulation tick + isometric render
  lot.ts             Grid, walls, floors, object placement
  agents.ts          Residents, needs, moods, autonomy
  routing.ts         Grid A* with door/wall costs
  objects.ts         Object definitions and interactions
  careers.ts         Shifts, pay, performance
  relationships.ts   Social values and events
  time.ts            Clock, speed, day rollover
  audio.ts           Procedural ambience and cues
  persistence.ts     Household/lot save
  *.test.ts          Needs, routing, placement, save
```

### Grid and routing

- 24 × 24 cells, 1 cell = 1 m.
- Walls occupy edges, not cells; doors are edge openings.
- A* over cells with wall-edge costs; diagonal movement disallowed indoors.
- Agents reserve destinations to avoid stacking; if unreachable, the action cancels with a toast.
- Object footprints are rectangles; rotation in 90° steps.

### Needs and autonomy

- Each need decays at a base rate modified by traits and object use.
- Autonomy scores available interactions every 0.5 s: `needGain * preference - distancePenalty`.
- The highest-scoring action is queued if the resident is idle.
- Player directives override autonomy until complete or cancelled.
- Mood = weighted average of needs plus active modifiers, mapped to five labels.

### Simulation tick

- Fixed 10 Hz logic tick; rendering interpolates agent positions.
- Time speed multiplies ticks per real second (1× = 2 ticks/s? No — 10 Hz logic remains; in-game minutes advance by speed).
- Off-screen agents continue simulation.
- Cap: 4 agents, 60 objects, 20 queued interactions.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed tick | Needs/routing are simple and testable |
| Rendering | Canvas 2D isometric | Cheap, controllable, no 3D asset cost |
| UI | React DOM | Build/buy catalogues, resident panels |
| Routing | Custom A* | Grid is small; no navmesh library |
| Audio | Web Audio synthesis | Zero assets |
| Persistence | LocalStorage | Household is small JSON |

No 3D engine required. Isometric projection keeps the art cost low and the UI readable.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Floors/walls | Procedural isometric tiles with palette variants |
| Furniture | 30 original vector/isometric objects drawn from shape recipes |
| Residents | 4-layer paper-doll sprites with 4-direction walk cycles |
| UI | DOM + inline SVG need icons |
| Audio | Synth ambience, clicks, soft cues |
| Thumbnail | Cutaway room with residents |

No copied furniture designs, plumbob-like icons, or Sims UI layout.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Lot | Grid, isometric render, walls/doors | A room renders and a test agent routes through it |
| M2 — Agents | Needs, autonomy, one object interaction | Agent satisfies hunger and energy without input |
| M3 — Build/buy | Placement, rotation, costs, removal | Invalid placements rejected; furniture usable |
| M4 — Life systems | Careers, relationships, routines | A full in-game day resolves correctly |
| M5 — Save/UI | Household save, panels, event log | Reload restores lot, agents and needs |
| M6 — Content/polish | 30 objects, traits, room scoring, audio | Content-complete household |
| M7 — QA | Mobile, performance, docs | 60 fps desktop, 45+ mobile; QA complete |

---

## 7. Estimated complexity

**L.** ~6,000–8,000 lines. The simulation is approachable; content (objects, interactions, trait combinations) and UI clarity are the cost. Pathfinding edge cases are the main technical risk.

---

## 8. Testing plan

### Unit

- Needs decay and clamp at 0/100.
- Autonomy scoring chooses the expected interaction.
- A* reaches every reachable cell; unreachable returns null.
- Object footprint/rotation validation.
- Career shift pay and performance math.
- Relationship thresholds and event triggers.
- Save roundtrip with agents mid-action.

### Integration

- Build a two-room home and route an agent between them.
- Run 24 in-game hours at 3×; no need underflows or stuck agents.
- Cancel a player directive; autonomy resumes.
- Reload mid-day; state matches.
- Route change disposes RAF/audio.

### Performance

- 4 agents + 60 objects at 60 fps desktop, ≥ 45 fps mobile.
- Routing queries < 2 ms on the 24 × 24 grid.
- No per-frame DOM updates except at 5 Hz.

---

## 9. Integration plan

1. Add `habitat` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `casual`, secondary `strategy`.
3. Lazy registry entry; Canvas 2D + DOM only.
4. Thumbnail + `docs/games/habitat.md`.
5. No `onComplete`; it is an open-ended sim. Document that honestly.
6. Reuse shared2d loop/input/rng/storage helpers.

---

## 10. Known limitations

- One lot and four residents; not a neighbourhood simulation.
- Object and trait content is bounded; emergent stories are simpler than a full life sim.
- Agents use grid routing and simple autonomy, not utility AI with long-term planning.
- No online sharing or gallery.
- Mobile build mode is functional but desktop is the intended experience.
