# 08 — Voxel Rift

> **Reference genre:** Minecraft (creative block sandbox).
> **Shortlist rank:** 8 · **Engine:** Three.js + Web Worker · **Complexity:** XL · **Wave:** 3
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A creative voxel building space with a fixed, finite island. The player flies, places and breaks twelve original block types, and can save multiple builds locally. There is no survival mode, no crafting tree and no combat — the product is expression, not progression.

Working tagline: *“A small world, entirely yours.”*

### Design pillars

1. **Building feels immediate.** Place and break at pointer speed with no inventory friction.
2. **A finite, composed island.** 8 × 8 chunks, hand-shaped terrain, not an infinite world.
3. **Runs on modest hardware.** Chunk meshing off the main thread and a hard render-distance cap.
4. **Your build persists.** Named local saves, exportable as a compact file.
5. **No borrowed identity.** Original block palette, world name, UI and textures.

### Target session

- 10–60 minutes of building.
- Desktop-first; mobile with a simplified place/break control.
- Player intent: relaxed creation.

### Core loop

```
Enter island → choose block from palette
  → fly/walk, place and break blocks
  → shape terrain, structures, lighting
  → save build with a name → continue or export
```

### World

- 8 × 8 chunks, each 16 × 16 columns, height 64. Total 128 × 128 × 64.
- Fixed sea level at y = 20; a central rift canyon splits the island.
- Four surface bands: meadow, ash flats, crystal shore, rift wall.
- No mobs, no weather, no survival meters.

---

## 2. Feature list

### Essential

- First-person movement: walk, sprint, jump, fly toggle.
- Place/break blocks with a reach of 6 m and a block highlight.
- 12 block types: grass, soil, stone, basalt, sand, glass, plank, leaf, brick, lamp, crystal, water (non-flowing).
- Hotbar of 9 with scroll/1–9 selection and a full palette panel.
- AABB player collision and step-up.
- Chunk meshing in a Web Worker with face culling.
- Ambient occlusion (vertex-based) and simple directional light + fog.
- Save/load up to 5 named builds in IndexedDB.
- Export/import a build as a compressed JSON file.
- Undo/redo for the last 50 edits.
- Day/night toggle and three sky palettes.
- Pause, settings, controls help, audio toggles.
- Touch: left stick, look drag, place/break buttons, fly toggle.

### Advanced

- Greedy meshing for flat surfaces (reduces triangles substantially).
- Screenshot to PNG.
- Structure templates (small prefabs: arch, tower, bridge) placed as a group.
- Build statistics (blocks placed, unique types).
- Render distance selector (2/3/4 chunks).

### Optional

- Simple redstone-like “signal lamp” that toggles neighbouring lamps.
- Orbit/photo camera mode.
- Shareable seed for terrain regeneration.

### Explicitly cut

- Survival, health, hunger, crafting, tools, durability.
- Mobs, combat, nether/end dimensions.
- Infinite terrain, cave systems generated at runtime, ore distribution.
- Multiplayer servers, skins marketplace, mods.
- Any Minecraft textures, block names, sounds, UI or world seeds.

---

## 3. Gameplay architecture

```
src/games/voxel-rift/
  VoxelRiftGame.tsx   React shell, palette, save UI, HUD
  engine.ts           Scene, camera, input, render loop
  world.ts            Voxel storage, get/set, dirty chunks
  terrain.ts          Deterministic island generation
  mesher.worker.ts    Chunk face-culling/greedy meshing
  mesher.ts           Worker protocol and mesh application
  player.ts           Movement, collision, fly mode
  blocks.ts           Block definitions, colours, texture atlas
  saves.ts            IndexedDB build storage + export/import
  audio.ts            Footsteps, place/break clicks
  *.test.ts           Meshing counts, collision, save roundtrip
```

### Voxel storage

- Chunk: `Uint8Array(16 * 64 * 16)` = 16,384 bytes.
- World: 64 chunks = ~1 MB in memory.
- Edits stored as a sparse overlay during play, baked into chunks on save.
- Dirty chunks are queued for the worker; at most 2 jobs in flight.

### Meshing

- Worker receives a chunk copy plus neighbour edge slices.
- Face culling first: emit only faces adjacent to air.
- Greedy merge on the three axis planes for same block and same AO.
- Output transferable arrays: positions, normals, colours, indices.
- Main thread builds `BufferGeometry` and replaces the old mesh.
- Budget: a full 8 × 8 world should mesh in under 1.5 s total, with visible chunks prioritized.

### Player physics

- Capsule approximated by AABB 0.6 × 1.8.
- Gravity 28, walk 4.5, sprint 7, jump 8.5, fly 12.
- Axis-separated collision resolution against solid voxels.
- Step-up 1 block; no auto-jump.

### Save format

- `{ v: 1, name, seed, palette, edits: RLE(base64), createdAt, updatedAt }`.
- IndexedDB database `neonrift-voxel`, object store `builds`.
- Export produces a `.json` download; import validates size (< 8 MB) and version.
- IndexedDB is used **only here**, because LocalStorage cannot hold multiple builds. This is a browser API, not a backend.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | Three.js | Already installed; standard BufferGeometry pipeline |
| Meshing | Web Worker | Keeps interaction responsive |
| Physics | Custom AABB | Voxel collision is simpler than a physics engine |
| UI | React DOM | Palette and save dialogs |
| Persistence | IndexedDB + file export | Size and multiple saves |
| Audio | Web Audio synthesis | No assets |

No voxel engine dependency. A library would add weight and reduce control over the meshing budget.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Block textures | 16 × 16 procedural texture atlas generated at runtime (noise + palette) |
| Sky | Gradient shader or vertex-coloured dome |
| Block highlight | Wireframe box |
| UI icons | Inline SVG |
| Audio | Synth clicks, footsteps, ambient pad |
| Thumbnail | Render of a small original build |

No Minecraft textures, no downloaded texture packs. Texture atlas generation is deterministic and cached.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Voxel core | Storage, terrain, single-chunk mesh | 8×8 world renders with correct faces |
| M2 — Interaction | Raycast pick, place/break, highlight | Edits update the correct chunk |
| M3 — Player | Walk/fly, collision, step-up | No falling through terrain; fly toggle stable |
| M4 — Worker meshing | Off-thread meshing, dirty queue | No main-thread stalls > 50 ms |
| M5 — Persistence | IndexedDB saves, export/import | Save/reload reproduces the build exactly |
| M6 — Content/polish | 12 blocks, sky palettes, undo, templates | All blocks usable; undo/redo correct |
| M7 — Mobile/QA | Touch controls, render distance, performance | 30+ fps mobile at distance 2; QA complete |

---

## 7. Estimated complexity

**XL.** ~7,000–10,000 lines. Meshing, collision and save integrity are the technical risks. This game ships last for a reason: it needs the shared helpers and QA process to be mature.

---

## 8. Testing plan

### Unit

- Face-culling count on known voxel arrangements.
- Greedy meshing produces correct geometry for flat planes.
- Chunk boundary faces are emitted only when the neighbour is air.
- Player collision against a single block and a corner.
- Save RLE roundtrip equals the original edit set.
- Import rejects oversized, malformed and future-version files.

### Integration

- Build a 20 × 20 platform, save, reload, compare screenshots.
- Break a block in each of the 12 types; mesh updates.
- Fly to world edge; no out-of-bounds reads.
- Toggle day/night; no material leaks.
- Route change terminates the worker and disposes geometries.
- Mobile: place 50 blocks with touch controls.

### Performance

- Initial mesh of visible chunks ≤ 1.5 s.
- Frame time ≤ 16.6 ms desktop at render distance 4.
- ≤ 150 draw calls; triangles ≤ 150k visible.
- Memory ≤ 200 MB mobile; no unbounded geometry growth.

---

## 9. Integration plan

1. Add `voxel-rift` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `adventure`/`casual`, secondary `strategy`? Choose `casual` + `adventure`.
3. Lazy registry entry; Three.js and worker load only here.
4. Thumbnail + `docs/games/voxel-rift.md` with save/export instructions.
5. `onComplete` is **not** used; creative mode has no win state. Document this honestly.
6. Reuse the Three.js lifecycle and audio patterns.

---

## 10. Known limitations

- Creative mode only; there is no survival, crafting or combat.
- Finite island; no infinite exploration.
- No multiplayer or sharing service. Builds are local files only.
- Water is static, not simulated.
- Mobile performance depends on render distance; the lowest setting is visually sparse.
- IndexedDB can be cleared by the browser; exports are the durable backup.
