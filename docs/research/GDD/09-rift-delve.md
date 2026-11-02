# 09 — Rift Delve

> **Reference genre:** Minecraft Dungeons (isometric action RPG).
> **Shortlist rank:** 9 · **Engine:** Three.js · **Complexity:** L · **Wave:** 2
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A short, replayable isometric dungeon crawl through five procedurally assembled floors of a collapsing rift. Three original classes, loot with meaningful trade-offs, and a boss that tests positioning rather than raw stats. No block building, no crafting tree, no open world.

Working tagline: *“Five floors. One way out.”*

### Design pillars

1. **Positioning first.** Telegraphs, cones and zones matter more than damage numbers.
2. **Loot changes play.** Every weapon has a behaviour, not just a bigger number.
3. **Rooms are readable.** Procedural assembly from authored room templates, not noise.
4. **A run is 15–25 minutes.** Short enough to retry, deep enough to build around.
5. **Original world and classes.** No Minecraft branding, mobs, items or art.

### Target session

- 15–25 minutes per run.
- Desktop-first; controller and touch supported.
- Player intent: loot-driven action with a clear endpoint.

### Core loop

```
Choose class → enter floor 1
  → clear rooms, collect loot, choose upgrades
  → defeat floor guardian → descend
  → floor 5 boss → run result → keep meta currency → new run
```

### Classes

| Class | Weapon | Ability 1 | Ability 2 | Ultimate |
|---|---|---|---|---|
| Blade | Greatsword, slow arcs | Whirlwind | Dash strike | Rift cleave |
| Bolt | Repeater, ranged | Volley | Blink | Storm lattice |
| Ward | Mace + shield | Barrier | Ground slam | Sanctuary |

---

## 2. Feature list

### Essential

- Five floors, each with 8–12 rooms assembled from templates.
- Three classes with distinct basic attacks and three abilities.
- Enemy roster: 8 types (melee, ranged, charger, bomber, shielded, summoner, elite, boss).
- Loot: 20 weapons/armour pieces across 3 rarities, with one affix each.
- Upgrade choice after each guardian: 3 options from a pool of 12.
- Health, stamina/dash, cooldown abilities, potion with charges.
- Floor guardian + final boss with phases.
- Meta currency (“shards”) for permanent minor upgrades.
- Run summary, retry, class switch.
- Pause, restart, quit; audio toggles.
- Keyboard/mouse, gamepad, touch joystick + buttons.

### Advanced

- Room templates with multiple variants per floor theme.
- Elite modifiers (shielded, hasted, splitting).
- Loot comparison tooltip with stat deltas.
- Difficulty tiers unlocked after first clear.
- Codex of enemies and items.
- Local best run time and deepest floor.

### Optional

- Daily seeded run.
- Two additional weapons per class.
- Cosmetic class palettes.

### Explicitly cut

- Block building, mining, crafting.
- Online co-op or matchmaking.
- Seasons, battle passes, paid currency.
- Copied Minecraft Dungeons items, mobs, icons or level layouts.

---

## 3. Gameplay architecture

```
src/games/rift-delve/
  RiftDelveGame.tsx  React shell, menus, loot UI, results
  engine.ts          Scene, camera, fixed-step sim, render
  floorgen.ts        Room graph generation and template placement
  rooms.ts           Authored room templates per theme
  classes.ts         Class stats and ability definitions
  enemies.ts         Enemy types and AI
  combat.ts          Hitboxes, damage, status, telegraphs
  loot.ts            Item rolls, affixes, comparison
  meta.ts            Permanent upgrades
  audio.ts           Procedural combat cues and ambience
  persistence.ts     Meta progress, records, settings
  *.test.ts          Floor connectivity, loot rolls, combat math
```

### Floor generation

- Each floor is a graph of 10 nodes: entrance, 6 combat, 1 shop, 1 shrine, 1 guardian.
- Templates are authored 3D room shells with spawn points and door sockets.
- Generation picks a spanning tree, then adds one loop for optional routes.
- Doors align by socket type; invalid rotations are rejected.
- Deterministic per run seed; the seed is shown in the results screen.

### Camera and movement

- Fixed isometric camera at 35° with slight follow and zoom on boss rooms.
- Eight-direction movement relative to camera; dash in movement direction.
- No jump; verticality is visual only.
- Click-to-move is **not** supported in v1; movement is direct.

### Combat

- Melee: sector hitbox with wind-up, active frames and recovery.
- Ranged: pooled projectiles with pierce/ricochet affixes.
- Telegraphs: ground decals with fill time matching the wind-up.
- Damage = `base * (1 + power/100) * crit * elemental`, rounded once.
- Invulnerability frames after hit (0.35 s) and during dash (0.2 s).

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | Three.js | Isometric 3D rooms, existing lifecycle |
| Physics | Custom 2D-on-plane collision | No vertical physics needed |
| Generation | Custom graph + templates | Authored quality with procedural variety |
| UI | React DOM | Loot, menus, results |
| Audio | Web Audio synthesis | Zero assets |
| Persistence | LocalStorage | Meta progress and records only |

No physics engine, no navmesh library. Enemies use simple steering with obstacle avoidance against room colliders.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Rooms | Modular wall/floor kits built from procedural geometry, three themes |
| Classes | Low-poly humanoids (~1,200 triangles) with 6–8 animation clips authored as procedural transforms |
| Enemies | Low-poly original creatures with 2–4 clips |
| Weapons | Procedural meshes with emissive accents |
| UI | Inline SVG icons and DOM loot cards |
| Audio | Synth impacts, casts, ambience |
| Thumbnail | Party key art in a rift room |

No downloaded models or copied designs. Animation may start as procedural bob/swing and be replaced by authored keyframes if time allows.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Room spine | One room, camera, movement, collision | Player moves and collides correctly |
| M2 — Combat | One class, two enemies, telegraphs | Hits, damage, death and i-frames work |
| M3 — Generation | Floor graph, templates, doors | 100 generated floors are connected and completable |
| M4 — Loot/classes | 3 classes, items, affixes, upgrades | Every class clears floor 1 with starter gear |
| M5 — Content | 5 floors, 8 enemies, bosses | Full run completable; boss phases work |
| M6 — Meta/polish | Shards, difficulty, codex, audio | Meta persists; results accurate |
| M7 — QA | Controller/touch, performance, docs | 45+ fps mobile; QA complete |

---

## 7. Estimated complexity

**L.** ~6,000–8,000 lines. Generation and combat are tractable; content authoring (rooms, enemies, loot) is the schedule driver. The camera and readability need early prototyping.

---

## 8. Testing plan

### Unit

- Floor graph is connected; every guardian is reachable.
- Door socket compatibility and rotation rules.
- Damage formula, crit, elemental modifiers.
- Loot rarity weights and affix legality per slot.
- Upgrade pool excludes duplicates.
- Meta currency arithmetic and caps.
- Enemy telegraph timing equals active-frame timing.

### Integration

- Full run with each class on normal difficulty.
- Guardian defeat opens the descent; floor counter increments.
- Death returns to camp with meta currency retained.
- Loot equip/unequip updates stats and UI.
- Pause during boss; resume without phase skip.
- Route change disposes renderer, geometries, audio.

### Performance

- 25 enemies + 40 projectiles at 60 fps desktop, ≥ 45 fps mobile.
- Draw calls ≤ 150; triangles ≤ 150k.
- Room load hitch < 150 ms; preload next room shell.

---

## 9. Integration plan

1. Add `rift-delve` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `action`, secondary `adventure`.
3. Lazy registry entry; Three.js only on this route.
4. Thumbnail + `docs/games/rift-delve.md`.
5. `onComplete` on final boss defeat or run end, with floor reached.
6. Reuse Three.js lifecycle; share isometric camera helper if a second game needs it.

---

## 10. Known limitations

- Five floors and eight enemy types is a bounded campaign.
- Procedural assembly varies room order, not room geometry; layouts can feel familiar.
- No co-op or online play.
- Animation is stylised and limited compared with a commercial action RPG.
- Balance is tuned for solo play; difficulty tiers are modifiers, not new content.
