# 03 — Strata

> **Reference genre:** Terraria (2D mining, crafting and exploration sandbox).
> **Shortlist rank:** 3 · **Engine:** Canvas 2D · **Complexity:** L · **Wave:** 3
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A compact 2D sandbox about descending through layered ruins. The player arrives at a fractured surface, mines through three strata, builds a base, crafts tools and fights the things that live between the layers. The world is hand-seeded, finite in width, and readable in a single session — a sandbox you can finish, not an infinite content treadmill.

Working tagline: *“Dig down. Find the signal.”*

### Design pillars

1. **Every layer changes the rules.** Surface, root layer and glass layer each introduce a resource, a hazard and an enemy behaviour.
2. **Building is a tool, not decoration.** Platforms, doors and light sources solve traversal and defence problems.
3. **A finite, authored world.** 900 × 320 tiles, one screen map, three bosses. Completion is possible.
4. **Cheap to run.** A tile world rendered to cached chunks; no physics engine, no downloaded art.
5. **Honest scope.** One world, not infinite generation; documented as such.

### Target session

- 30–90 minutes to first boss; 3–5 hours to finish.
- Desktop-first; mobile supported with simplified controls.
- Player intent: explore, collect, build, improve.

### Core loop

```
Explore surface → gather wood/stone → craft pickaxe/workbench
  → dig to root layer → find ore → craft better gear
  → build shelter and light → survive night enemies
  → defeat layer guardian → unlock next layer
  → final boss at the rift core → ending + free play
```

### World structure

| Layer | Depth (tiles) | Resource | Hazard | Guardian |
|---|---|---|---|---|
| Surface | 0–60 | Timber, fibre, stone | Night spawns | — |
| Root layer | 60–170 | Iron, resin, amber | Toxic spores, caves | Root Warden |
| Glass layer | 170–280 | Prism shard, crystal | Heat vents, collapsing floors | Prism Sentinel |
| Rift core | 280–320 | Null ore | Darkness, final arena | The Hollow Engine |

---

## 2. Feature list

### Essential

- Tile world 900 × 320 with three biomes and caves.
- Mining and placing with a reach limit (5 tiles) and tool tiers.
- 25 block types with correct drop rules.
- Inventory: 30 slots, stack size 99, hotbar of 9.
- Crafting: 24 recipes across workbench, forge and alchemist table.
- Tools: pickaxe, axe, hammer, blade, lantern; four tiers each for pickaxe/blade.
- Survival meters: health, stamina (mining/sprinting), light radius.
- Day/night cycle (8 min) with night enemies and surface danger.
- 8 enemy types with three AI behaviours (walker, flyer, burrower).
- 2 mini-bosses + 1 final boss with phase patterns.
- Base pieces: platform, wall, door, torch, storage chest.
- Save/load of world deltas and inventory, versioned.
- Pause, restart, controls help, audio toggles.
- Touch controls: virtual stick, jump, mine/place, inventory.

### Advanced

- Simple liquid simulation for water in caves (cellular, capped cells).
- NPC “surveyor” at the surface who gives three objectives and trades.
- Map screen with explored-tile fog.
- Ore detector consumable.
- Boss rematch portal.
- 6 cosmetic base banners unlocked by achievements.

### Optional

- World seed input and shareable seed string.
- Hardcore mode (one life, no manual save).
- Second world size (1,400 × 360) for high-end devices.

### Explicitly cut

- Infinite world generation, multiplayer, mods, wiring/logic circuits.
- Hundreds of items, NPC housing happiness system, corruption spread.
- Copied Terraria sprites, item names, boss designs or world biomes.
- Steam/cloud integration.

---

## 3. Gameplay architecture

```
src/games/strata/
  StrataGame.tsx    React shell, inventory/crafting DOM, menus
  engine.ts         World simulation, camera, render loop
  world.ts          Tile data, chunk storage, worldgen
  worldgen.ts       Seeded generation (surface, caves, ore)
  tiles.ts          Tile definitions, drop tables, hardness
  entities.ts       Enemies, drops, projectiles, NPCs
  player.ts         Movement, mining, placing, inventory
  crafting.ts       Pure recipe matching
  liquids.ts        Capped cellular water
  save.ts           RLE-compressed world deltas
  audio.ts          Procedural ambience and cues
  *.test.ts         Rules, worldgen, save roundtrip
```

### Tile and chunk model

- World stored as `Uint16Array` of tile ids, 900 × 320 = 288,000 cells (~576 KB).
- Render chunks of 32 × 32 tiles to offscreen canvases; redraw only when dirty.
- Only visible chunks plus a one-chunk margin are blitted per frame.
- Background walls and foreground tiles are separate layers.
- Lighting: 16 × 16 tile light grid, flood-filled at 5 Hz, bilinearly upscaled. Torches and lava emit light; daylight is a vertical gradient.

### Player physics

- AABB 0.8 × 1.8 tiles.
- Gravity 32 tiles/s², jump velocity 11.5, coyote time 0.08 s, jump buffer 0.1 s.
- Horizontal speed 6.2, sprint 9.0 with stamina drain.
- Step-up of 1 tile; no auto-jump.
- Mining uses a reach raycast and a per-tile progress timer based on tool tier and hardness.

### Save model

- Persist only deltas from the generated world: `{ index, tile }` pairs, RLE-compressed.
- Inventory, player position, flags and defeated bosses saved alongside.
- Payload target < 1.5 MB. If storage is blocked or full, the game warns and continues in memory-only mode.
- Version field; unknown version resets the save with explicit confirmation.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | Canvas 2D with cached chunks | Tile worlds are cheap to draw and easy to debug |
| World storage | Typed arrays | Memory-efficient and fast |
| Physics | Custom AABB | Tile collision does not need a physics engine |
| Lighting | Custom low-res flood fill | Cheap and stylistically appropriate |
| Audio | Web Audio synthesis | No licensed sounds |
| Persistence | LocalStorage (compressed deltas) | No backend; IndexedDB only if payload proves too large |

If save size exceeds LocalStorage limits in testing, switch **only the world delta** to IndexedDB and document it. Do not add a server.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Tiles | 16 × 16 procedural pixel-art generated from palettes and edge rules |
| Player | 12-frame procedural sprite sheet drawn on canvas at build time? No — drawn from primitives each frame with limb offsets |
| Enemies | Original vector/pixel shapes, 4–8 frames each |
| Backgrounds | Layered gradients + parallax silhouettes |
| UI icons | Inline SVG |
| Audio | Oscillator/noise synthesis |
| Thumbnail | Composed scene render |

No downloaded tilesets or sprites. Palette: deep teal, amber, bone, violet.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — World | Tile storage, worldgen, chunk rendering | Deterministic 900×320 world renders at 60 fps |
| M2 — Player | Movement, mining, placing, inventory | Can dig a tunnel and build a platform |
| M3 — Crafting | Recipes, stations, tool tiers | Progression from timber to iron verified |
| M4 — Danger | Enemies, day/night, health, bosses | Full combat loop and one boss defeat |
| M5 — Persistence | Save/load, map, settings | Reload restores world edits exactly |
| M6 — Content | 3 layers, final boss, NPC, polish | Game completable from start to ending |
| M7 — QA | Mobile controls, performance, docs | Typecheck/tests/build pass; QA signed off |

---

## 7. Estimated complexity

**L.** ~6,000–8,000 lines. The simulation is tractable; content volume (tiles, recipes, enemies, bosses) dominates. This is the first game where a content budget must be enforced.

---

## 8. Testing plan

### Unit

- Worldgen determinism for a fixed seed.
- Tile hardness and tool-tier gating.
- Recipe matching with multiple valid layouts.
- Inventory stack add/remove/overflow.
- Save roundtrip: apply deltas to a fresh world equals original.
- Liquid cell rules: conservation cap, no infinite spread.
- Boss phase thresholds and defeat flags.

### Integration

- New game → mine → craft → save → reload → continue.
- Place and break 500 blocks; dirty-chunk redraw stays bounded.
- Night transition while underground and on surface.
- Defeat each boss; flags persist.
- Storage blocked (private mode) presents a warning, not a crash.
- Route change disposes RAF, audio and offscreen canvases.

### Performance

- 60 fps desktop; ≥ 45 fps mobile with 900×320 world.
- Visible chunk blits ≤ 30 per frame.
- No per-frame world scans; entity updates bounded to active radius.

---

## 9. Integration plan

1. Add `strata` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `adventure`, secondary `strategy`/`casual`.
3. Lazy registry entry; no Three.js loaded.
4. Thumbnail + `docs/games/strata.md` with controls and save caveats.
5. Emit `onComplete` when the final boss is defeated; save remains available.
6. Share `shared2d` loop/input/canvas/rng helpers.

---

## 10. Known limitations

- The world is finite and authored; it is not an infinite Terraria-like sandbox.
- Liquid simulation is capped and simplified; large water bodies may settle imperfectly.
- No multiplayer, mods or wiring.
- Mobile inventory management is functional but slower than desktop.
- Save size depends on how much the player builds; extreme builds may hit storage limits, which the game reports honestly.
