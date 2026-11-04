# NeonRift Wave 2 — six original games ("go bigger and deeper")

- Date: 2026-11-04
- Status: Draft — awaiting user spec review
- Branch: `feat/games-wave2`
- Scope owner: NeonRift platform
- Revises: the six-game slate and Neon Craft scope discussed in chat on 2026-11-04

## Context

The catalogue currently ships 25 games: seven 2D originals, three Three.js games, and fifteen
React/Canvas simulation games. The game registry (`src/games/registry.ts`) maps internal keys
to lazy-loaded components, and `src/data/games.json` holds the catalogue records. The platform
shell uses the Editorial Arcade theme, with a dark `night` palette on `/game/*`.

The user asked for more games in the simulation, racing, fighting, action and roleplay
categories, plus a Minecraft-like survival sandbox called Neon Craft, with the best visuals the
current stack can produce. The user also asked to use open-source repositories and "clone"
Minecraft completely.

This spec keeps the genre ambition but not the copying. Voxel mining, crafting and survival are
genre conventions and can be built originally; Minecraft's code, art, names, sounds and other
expressive assets are not copied, and no GPL/AGPL/unlicensed repository is copied or vendored.
The approved policy for this wave is **original code and original art only, with open-source
repositories used as reading references**.

## Goal

Ship six original games in three verified sub-waves on one feature branch:

1. **Neon Craft** — a deep first-person voxel survival sandbox (flagship).
2. **Rift Rally** — a Three.js arcade racer with drift, ghosts and weather.
3. **Neon Duel** — a 2D fixed-timestep fighting game with a five-opponent arcade ladder.
4. **Riftfall** — a top-down action wave-survival game with bosses and upgrades.
5. **Rift Life** — a 21-day roleplay life-sim with five NPCs and six endings.
6. **Rift Ecology** — an ecosystem simulation with interventions, scenarios and scoring.

Each game must be playable to its stated win/lose condition, covered by tests, verified in a
real browser at desktop and mobile widths, and integrated into the catalogue, registry, search,
categories and E2E coverage.

## Non-goals

- No multiplayer, backend, accounts, cloud saves or online leaderboards.
- No Minecraft code, textures, models, sounds, names, UI copy or world data. No one-to-one
  recreation of Minecraft's art or content.
- No copying, vendoring or close translation of code from GPL, AGPL or unlicensed repositories.
  Open-source reading references are recorded, never imported.
- No new runtime dependencies and no paid services. Three.js is already a dependency.
- No refactor of the 25 existing games, the registry shape, the catalogue shape or the theme.
- No public deployment, no force-push, and no merge to `main` before the user reviews each
  sub-wave.
- Neon Craft v1 excludes redstone-like logic, portals, alternate dimensions, mod loading,
  multiplayer, villagers, and more than two hostile creature types.
- The words "complete Minecraft clone" are not used in product copy.

## IP, licensing and open-source policy

This wave follows `docs/research/LICENSE-AUDIT.md`:

- **Written from scratch:** all game code, procedural textures, meshes, SVG thumbnails, names,
  copy and audio synthesis.
- **Algorithms, not code:** greedy meshing, ambient occlusion, DDA voxel picking, value noise,
  AABB collision and similar techniques are public, well-documented algorithms. They are
  implemented independently from first principles.
- **Reference-only repositories:** read for vocabulary and technique, never copied, vendored or
  translated. The provenance note records what was consulted and confirms no code was used.

| Reference | Licence | How it is used |
|---|---|---|
| three.js (and its examples) | MIT | Already a dependency; API and rendering-technique reference only |
| Luanti / Minetest | LGPL-2.1 | Read for voxel-survival conventions; no code or assets used |
| Veloren | GPL-3.0 | Read for gameplay inspiration; no code or assets used |
| Voxel Tools for Godot | MIT | Read for chunk-meshing vocabulary; no code copied |

`docs/research/WAVE2-TECHNIQUES.md` is a deliverable of sub-wave 2A and lists the references
actually consulted, their licences, and the original approach taken for each system.

## Approved decisions

| Decision | Choice |
|---|---|
| Neon Craft scope | Original survival sandbox with caves, four biomes, farming and night creatures |
| Wave size | Six games, decomposed into three sub-waves |
| Open-source policy | Reference only, original code |
| Architecture | Self-contained engine for Neon Craft; companions use existing platform patterns |
| Visual direction | "Neon Rift: after dark" — consistent neon accents inside the Editorial Arcade system |
| Revision direction | Bigger Neon Craft, higher visual targets, stronger companions, longer multi-wave build |

## Program decomposition

Each sub-wave ends with a playable, tested, committed state. Sub-wave order is fixed because
Neon Craft establishes shared input and quality-tier patterns that the later games reuse.

| Sub-wave | Games | Primary categories | Engine |
|---|---|---|---|
| **2A** | Neon Craft | simulation (adventure, action) | New self-contained Three.js voxel engine |
| **2B** | Rift Rally, Neon Duel | racing (arcade, action); action (arcade) | Three.js for Rally; Canvas 2D + React for Duel |
| **2C** | Riftfall, Rift Life, Rift Ecology | action (arcade); adventure (simulation, casual); simulation (educational, strategy) | Canvas 2D + React for all three |

### Sub-wave gates

- **2A gate:** Neon Craft is playable end to end — new world, mine, build, craft, farm, fight,
  survive a night, save, reload — with its unit suites, typecheck, build and browser verification
  green. Its catalogue entry is published only at this point.
- **2B gate:** both companions reach their full win/lose loops and are verified at 1440px and
  390px. Their catalogue entries are published only at this point.
- **2C gate:** all three reach their full loops, and the whole 31-game catalogue passes the
  boot, console-error, accessibility and catalogue-count checks.
- **Program gate:** the full suite (typecheck, unit, build, Playwright) passes, docs show real
  counts, and the user reviews the branch. Nothing is merged or deployed before that review.

## Visual direction — "Neon Rift: after dark"

The theme does not change; the craft level rises.

- **Palette:** existing Editorial Arcade day tokens for browsing; night tokens for every game
  route. Game accents stay teal/amber/coral and are always paired with ink-safe contrast.
- **3D look:** cool ambient shadow, warm key light, emissive neon props as the only strong
  glow, fog that ties distant geometry to the sky, and restrained bloom-free materials. No
  post-processing dependency.
- **2D look:** layered parallax, hand-drawn vector shapes rendered in Canvas, additive particle
  sparks, screen shake on impact, and HUD typography from the Editorial Arcade system.
- **Motion:** all animation respects `prefers-reduced-motion`; games offer a reduced-effects
  setting that disables camera bob, shake and heavy particles.
- **Audio:** procedural WebAudio only, mixed under the existing mute control.

## Neon Craft — design

### World model

- Chunk footprint **16 × 64 × 16** blocks; world height y = 0 (bedrock) to y = 63.
- Chunks are streamed around the player. Render distance is a setting: desktop default 6
  chunks (range 4–8), mobile default 3 (range 2–4). Fog begins at 70% of the render distance.
- Blocks live in a `Uint8Array(16 * 64 * 16)` per chunk. Light lives in two parallel
  `Uint8Array`s per chunk: skylight and blocklight.
- The world seed is a string hashed to 32 bits with a documented hash, then expanded with a
  seeded PRNG. The same seed always produces the same terrain, caves, ores, flora and spawn.
- Edits are stored as sparse block deltas over the seeded world, so saves stay small.

### Biomes

Biome selection uses temperature and humidity noise plus continent noise. Blends are 8 blocks
wide so borders do not produce hard seams.

| Biome | Character | Signature blocks and features |
|---|---|---|
| Verdant Plains | Rolling grass hills, open build space | grass, dirt, stone, riftwood trees, glowberry bushes, flowers |
| Ember Ridge | Terraced mesas, exposed rock, lava pockets | emberstone bands, ash, gravel, lava below y = 10 |
| Glowwood | Dense canopy and bioluminescent floor | glowwood logs and leaves, glowcap mushrooms, moss |
| Rift Marsh | Shallow water, mud flats, reeds | mud, clay, reeds, glow kelp, scattered dead trees |

### Terrain pipeline

1. Continent noise (scale 1/160) sets base elevation.
2. Temperature (1/220) and humidity (1/180) choose the biome.
3. Four-octave fBm detail (1/48) adds relief.
4. Height = 26 + continent × 18 + detail × 10, clamped to 8–56. Sea level is y = 32.
5. Surface material and subsurface depth follow the biome.
6. Caves: two 3D noise fields carve tunnels where both fall inside narrow bands; a third
   threshold carves caverns below y = 28. Bedrock is never carved.
7. Ore veins replace stone inside depth bands, with vein sizes 3–8.
8. Flora is placed on valid surfaces with density per biome; spawn is the first safe surface
   column near the origin with at least three air blocks above it.

### Blocks and items

About 30 block IDs including air, water and lava; every other ID is placeable:

- **Natural:** bedrock, stone, cobblestone, dirt, grass, sand, gravel, clay, mud, emberstone,
  ash, moss.
- **Wood and plants:** riftwood log, riftwood leaves, glowwood log, glowwood leaves, glowcap,
  reeds, glow kelp, flowers.
- **Ores:** coal, iron, gold, rift crystal.
- **Crafted:** planks, workbench, kiln, torch, lantern, glass, gilded block, bricks.
- **Fluids:** water, lava.

Block properties: display name, solid, opaque, cutout, liquid, light emission, hardness,
required tool tier, drops, and texture layers per face. Leaves and plants render in the cutout
pass; water and glass render in the transparent pass; glass does not cull neighbour faces.

Items also include wood/stone/iron/crystal pickaxes, axes, shovels and swords; wood/stone/iron
hoes; glowberry, roasted glowberry, riftroot, roasted riftroot; glowberry seeds and riftroot
seeds. Tools have durability (60 / 130 / 250 / 500 uses). Stack limit is 64; tools stack to 1.

### Player and survival

- AABB 0.6 × 1.8 × 0.6, eye height 1.62. Gravity and axis-separated collision resolution
  against solid blocks; swimming in water with reduced gravity and a capped ascent speed;
  sprinting and sneaking (sneaking prevents ledge falls).
- Fall damage above 3 blocks. Health 20; hunger 20. Hunger drains 1 per 45 s walking, 1 per
  20 s sprinting, 1 per 15 s mining. At hunger 0 health drains steadily. Health regenerates
  when hunger is at least 16.
- Mining reach 5.5 blocks. Break progress depends on hardness and tool tier; wrong-tier tools
  mine slowly and do not drop gated ores. Placement is rejected inside the player AABB or on
  non-replaceable blocks.
- Melee: 0.5 s cooldown, 3 damage unarmed and 5–10 by sword tier, 4 m/s knockback, 0.4 s
  invulnerability after being hit.
- Death shows a summary and respawns at the world spawn with hunger and health reset; inventory
  is kept in v1 so a first session cannot dead-end.

### Farming

- Hoe tills grass or dirt into farmland. Farmland needs water within 4 blocks to stay moist.
- Glowberry grows in 2 days and riftroot in 3 days, one stage per dawn, with 4 visible stages.
- Growth requires light 8 or higher. Harvest yields 2–3 produce plus 1–2 seeds.
- Produce can be eaten raw or roasted in a kiln for better hunger restoration.

### Creatures

Two original hostile creatures, no borrowed names or designs:

| Creature | Behaviour | Spawn rules | Drops | Counterplay |
|---|---|---|---|---|
| **Gloomling** | Melee chaser: wander → chase within 12 blocks → attack with 0.9 s wind-up; flees in daylight | Night, light level below 4, 16–40 blocks from the player, on solid ground | 0–2 glow dust | Torches, height, sword timing |
| **Cinder Wisp** | Floating ranged attacker: keeps 5–8 blocks, fires a slow ember every 2.5 s | Night or deep caves, Ember Ridge bias, light level below 4 | 0–2 ember shards | Cover, closing distance, ranged avoidance |

Glow dust plus iron crafts a lantern; ember shards plus rift crystal craft a rift lantern. Both
creatures despawn beyond 64 blocks or at dawn. A cap of 12 hostiles near the player limits
pressure. Torches and lanterns create safe zones by raising blocklight, and spawn attempts
inside lit areas fail.

### Day/night cycle

A 12-minute full cycle: 6 minutes day, 1.5 minutes dusk, 3 minutes night, 1.5 minutes dawn.
The HUD shows a clock, day number and phase icon. Lighting, sky palette, cloud tint, creature
spawning and ambient audio follow the phase.

### Crafting

Three station tiers: hand, workbench, kiln. The UI is a filterable recipe list rather than a
drag-and-drop grid, so it stays keyboard and touch friendly.

- **Hand:** planks, sticks, workbench, torches, basic wooden tools.
- **Workbench:** stone and iron tools, hoe, lantern, bricks, gilded block, glass panes.
- **Kiln:** iron ingots, glass, charcoal, roasted glowberry, roasted riftroot, rift lantern.

At least 24 recipes ship in v1. Each recipe declares ingredients and counts, station tier,
output count, and whether it unlocks a tool tier. The UI shows craftable, missing-ingredient
and wrong-station states separately. The kiln is a station only: v1 does not simulate fuel.

### Lighting and rendering

- Skylight propagates from open sky downward and spreads horizontally; blocklight from torches
  and lanterns floods up to radius 15. Relighting is queued per dirty chunk with neighbour
  propagation at chunk borders.
- The mesher builds greedy quads per block and face group, culls hidden faces, and bakes
  ambient occlusion plus combined light into vertex colors. Quads only merge when all merged
  cells share the same block, face direction, light and AO signature, capped at 16 × 16.
- Three geometry buckets per chunk: opaque, cutout, transparent. Water is its own transparent
  material with a slow animated surface.
- Sky: shader gradient with time-of-day palette, sun and moon discs, 600 stars, and two
  scrolling procedural cloud layers.
- Desktop quality tier adds a 2048 directional shadow map covering a 64-block box around the
  player and PCF soft shadows. Balanced uses 1024. Mobile disables shadows and lowers DPR.
- Effects: instanced block-break particles, footstep dust, torch ember motes, leaves swaying
  in the Glowwood, and a first-person hand viewmodel with swing, place and hit animations.
- DPR is capped at 2 on desktop and 1.5 on mobile.

### Audio

A procedural WebAudio graph, created after the first user gesture and torn down on unmount:
surface-specific footsteps (grass, stone, sand, wood, water), break and place sounds, tool
swings, hurt and death cues, Gloomling and Cinder Wisp vocalisations, daytime birds and wind,
night insects and low drone. Master mute persists in `localStorage`.

### Saves

- IndexedDB database `neonrift-craft`, object store `worlds`, key path `slot` (1–3).
- Each record stores schema version, name, seed, timestamps, elapsed play time, day and time of
  day, player state (position, orientation, health, hunger, inventory, hotbar index), sparse
  block edits, and cumulative stats.
- Autosave every 60 seconds and on pause, save-and-quit, and page hide. Writes replace the whole
  slot record atomically.
- A corrupt or unreadable record is surfaced as "unreadable slot" with an explicit delete
  action; it is never silently overwritten.
- Serialisation and deserialisation are pure functions with a schema version; IndexedDB access
  sits behind a small adapter so the codec is tested without a database dependency.

### UI, controls and accessibility

- Screens: world select (three slots, optional seed, delete with confirmation), loading, HUD,
  inventory, crafting, pause, settings, death summary, WebGL-unsupported fallback.
- HUD: crosshair, hotbar with selected slot and item counts, health and hunger bars, clock and
  day, interaction prompt, and a transient block/item toast.
- Desktop controls: WASD move, Space jump, Shift sprint, Ctrl sneak, mouse look, left click
  mine/attack, right click place/use, 1–9 hotbar, E inventory, Q drop, Esc pause. The shared
  input helper gains `KeyE`, `KeyQ`, `Digit1`–`Digit9`, and pointer-lock handling.
- Mobile controls: left virtual stick, right look area, jump, sneak, mine and place buttons,
  hotbar taps, and full inventory/crafting access. Mobile uses the low quality tier by default.
- All menus, slots and recipe rows are reachable by keyboard and expose accessible names.
  Pointer lock is required for first-person play; this limitation is stated in the controls
  panel rather than hidden.
- Settings: render distance, FOV 60–90, sensitivity, shadows, reduced effects, mute.

### Performance budgets

- Chunk mesh build ≤ 4 ms per chunk on a mid-range desktop; at most 2 meshes built per frame.
- 60 fps target on a mid-range desktop at render distance 6; 30 fps target on mobile at
  render distance 3.
- ≤ 500k rendered triangles at distance 6 and ≤ 400 draw calls per frame.
- Memory: chunk data plus meshes stays bounded by the render distance; unloading disposes
  geometry and materials through the existing disposal traversal pattern.

## Rift Rally — design

- **Platform:** Three.js, following the patterns in `src/games3d/racing/NeonApexGame.tsx`.
- **Content:** three seeded circuits (coastal ring, elevated interchange, night market loop),
  three car classes (grip, balanced, drift), three AI difficulty tiers, three laps, clear/rain
  weather.
- **Driving model:** fixed-step arcade physics with acceleration, braking, steering falloff,
  handbrake drift, drift-charge boost, off-track slowdown, and weather grip multipliers.
- **Race systems:** ordered checkpoint gates, lap validation, split times, position against
  three AI rivals, countdown start, finish state, pause/restart, best lap via `useBestScore`.
- **Ghost replay:** records player transform at 20 Hz, plays back the best lap as a translucent
  car; playback is deterministic from the recorded samples.
- **Presentation:** procedural neon scenery, minimap, speed and drift meters, camera views,
  rain particles and wet-road tint, engine and skid audio.
- **Testing:** track sampling and checkpoint order, lap counting rejection for missed gates,
  deterministic vehicle step, drift charge and boost, ghost record/playback round-trip, weather
  grip, minimap projection. Component shell boots and disposes cleanly.

## Neon Duel — design

- **Platform:** Canvas 2D rendering with React HUD, fixed 60 Hz simulation.
- **Content:** four original fighters (Volt, Kestrel, Mako, Sable) with distinct speed, health,
  reach and special moves; five-opponent arcade ladder; best-of-three rounds with a 60-second
  timer; training mode against a dummy.
- **Combat model:** light, heavy, special (meter), block, dash and jump; startup/active/recovery
  frames; hitboxes and hurtboxes resolved per tick; hitstop, knockback, chip damage on block,
  meter gain on hit and on being hit; light-to-heavy cancel window; throw-free v1.
- **AI:** difficulty-scaled reaction delay, approach/retreat spacing, block probability and
  special usage; deterministic under a seeded RNG.
- **Presentation:** vector-drawn fighters with pose interpolation, parallax arena, hit sparks,
  screen shake, round banners, move list in the pause panel, and an optional reduced-flash
  setting.
- **Testing:** frame-window resolution, hitbox overlap and trade handling, block and chip
  values, hitstop timing, round and match state machine, AI decision determinism, meter caps,
  timer expiry. Component shell boots and disposes cleanly.

## Riftfall — design

- **Platform:** Canvas 2D top-down arena with React HUD.
- **Content:** 12 waves, bosses at waves 6 and 12, four weapons (blade, arc, rail, bloom), nine
  stacking upgrades offered three at a time between waves, three arena hazard types.
- **Combat:** movement, dash with invulnerability frames, timed parry that reflects projectiles,
  combo multiplier with decay, health pickups, and elite variants.
- **Structure:** seeded wave composition, boss patterns with telegraphed phases, run summary,
  win on wave 12 clear, loss on health reaching zero.
- **Presentation:** neon arena grid, additive particles, impact shake, weapon trails, boss
  telegraph rings, and procedural audio.
- **Testing:** deterministic wave spawns, boss phase transitions, upgrade pool without duplicate
  offers, weapon stat application, dash invulnerability, parry reflection, combo decay,
  win/lose transitions. Component shell boots and disposes cleanly.

## Rift Life — design

- **Platform:** React UI with a lightweight Canvas scene layer.
- **Content:** 21 in-game days, five NPCs with relationship arcs, one job minigame, daily energy
  and time slots, calendar events, weather, and six endings.
- **Loop:** each day the player chooses activities (work, visit an NPC, rest, community task),
  spends energy, advances the calendar, and sees relationship and job-progress changes. Choices
  in conversations modify relationship meters and unlock short scenes.
- **Endings:** determined by relationship thresholds, job performance and a community stat,
  resolved by an explicit table so every ending is reachable and testable.
- **Presentation:** illustrated scene cards, character portraits drawn in SVG/CSS, day
  transition cards, relationship meters, journal, and ending gallery stored in `localStorage`.
- **Testing:** day advance and energy spend, relationship deltas, job scoring, event schedule,
  ending resolution table coverage for all six endings, and save/load of the gallery. Component
  shell boots cleanly.

## Rift Ecology — design

- **Platform:** React UI with SVG charts and a Canvas habitat view.
- **Content:** three scenarios (kelp forest, rift marsh, ember ridge), six species across two
  producers, two herbivores and two predators, four intervention tools (plant, cull, protect,
  adjust flow), and 60-day runs.
- **Model:** discrete population step with growth, predation, carrying capacity, seasonal
  modifiers and intervention effects; extinctions and collapses are detected explicitly.
- **Scoring:** survival of all species, biodiversity index, stability and intervention cost;
  scenario-specific targets and a final grade.
- **Presentation:** habitat view, population charts, event log, scenario briefing and debrief,
  with honest model assumptions in an info panel.
- **Testing:** population step math, carrying capacity, predation and starvation, intervention
  effects, extinction detection, scoring, seeded determinism, scenario targets. Component shell
  boots cleanly.

## Platform integration

### Registry and types

Add six keys to `INTERNAL_GAME_KEYS` in `src/types/game.ts` and six lazy entries in
`src/games/registry.ts`:

| Key | Component | Module |
|---|---|---|
| `neon-craft` | `NeonCraftGame` | `src/games3d/craft/NeonCraftGame.tsx` |
| `rift-rally` | `RiftRallyGame` | `src/games3d/rally/RiftRallyGame.tsx` |
| `neon-duel` | `NeonDuelGame` | `src/games/neon-duel/NeonDuelGame.tsx` |
| `riftfall` | `RiftfallGame` | `src/games/riftfall/RiftfallGame.tsx` |
| `rift-life` | `RiftLifeGame` | `src/games/rift-life/RiftLifeGame.tsx` |
| `rift-ecology` | `RiftEcologyGame` | `src/games/rift-ecology/RiftEcologyGame.tsx` |

### Catalogue records

Six new records in `src/data/games.json`, all `type: "internal"`, `published: true` at the
corresponding sub-wave gate, `createdAt: "2026-11-04T09:00:00.000Z"` with one-minute increments,
and new popularity ranks 26–31 so existing ranks are untouched.

| Slug | Title | Category | Secondary | Accent | Thumbnail |
|---|---|---|---|---|---|
| `neon-craft` | Neon Craft | simulation | adventure, action | `#2dd4bf` | `/art/neon-craft.svg` |
| `rift-rally` | Rift Rally | racing | arcade, action | `#ff8a3d` | `/art/rift-rally.svg` |
| `neon-duel` | Neon Duel | action | arcade | `#ff6b81` | `/art/neon-duel.svg` |
| `riftfall` | Riftfall | action | arcade, strategy | `#a06bff` | `/art/riftfall.svg` |
| `rift-life` | Rift Life | adventure | simulation, casual | `#22d3ee` | `/art/rift-life.svg` |
| `rift-ecology` | Rift Ecology | simulation | educational, strategy | `#4ade9d` | `/art/rift-ecology.svg` |

Neon Craft is `featured: true`. Each record carries real instructions and controls matching the
implemented scheme, with no aspirational copy.

### Thumbnails

Six original SVG thumbnails in `public/art/`, matching the existing 4:3 card composition and
palette conventions: voxel landscape for Neon Craft, rally car and checkpoint gate for Rift
Rally, two facing fighters for Neon Duel, arena and boss silhouette for Riftfall, day/evening
town scene for Rift Life, and species/chart motif for Rift Ecology. No external assets.

### Copy and counts

- Catalogue count copy moves from 25 to 31 where it is literal, including the home page hero
  and the E2E assertion for "31 original games".
- `e2e/helpers.ts` `GAMES` gains the six new slug/title pairs.
- README, ARCHITECTURE, ROADMAP and the research index are updated with real game and test
  counts only after the suites have been run.

## File plan

### Sub-wave 2A — Neon Craft

- `src/games3d/craft/blocks.ts` — block and item definitions, tiers, drops, texture keys.
- `src/games3d/craft/noise.ts` — seed hash, PRNG, 2D/3D value noise and fBm.
- `src/games3d/craft/terrain.ts` — biome selection, height field, caves, ores, flora, spawn.
- `src/games3d/craft/world.ts` — chunk storage, get/set, dirty tracking, delta edits, clock.
- `src/games3d/craft/light.ts` — skylight and blocklight propagation and relight queues.
- `src/games3d/craft/mesher.ts` — greedy meshing, AO, light baking, geometry buckets.
- `src/games3d/craft/atlas.ts` — procedural 16×16 texture atlas generation.
- `src/games3d/craft/raycast.ts` — DDA block picking with face normal and reach.
- `src/games3d/craft/player.ts` — movement, collision, health, hunger, fall damage.
- `src/games3d/craft/inventory.ts` — hotbar and storage, stacks, add/remove/split.
- `src/games3d/craft/recipes.ts` — recipe table, station tiers, availability checks.
- `src/games3d/craft/farming.ts` — tilling, irrigation, growth stages, harvest.
- `src/games3d/craft/creatures.ts` — creature definitions, FSM, spawn and despawn rules.
- `src/games3d/craft/save.ts` — pure save codec plus IndexedDB adapter.
- `src/games3d/craft/audio.ts` — procedural WebAudio sound bank and mixer.
- `src/games3d/craft/engine.ts` — scene, streaming, sky, water, shadows, particles, tuning.
- `src/games3d/craft/NeonCraftGame.tsx` — React shell, menus, HUD, inventory and settings.
- `src/games3d/craft/*.test.ts` — unit suites for the pure modules above.
- `src/games3d/shared/input.ts` — add `KeyE`, `KeyQ`, `Digit1`–`Digit9` and pointer-lock support.

### Sub-wave 2B — Rift Rally and Neon Duel

- `src/games3d/rally/RiftRallyGame.tsx`, `engine.ts`, `track.ts`, `physics.ts`, `ghost.ts`,
  `audio.ts`, plus `*.test.ts`.
- `src/games/neon-duel/NeonDuelGame.tsx`, `fighters.ts`, `combat.ts`, `match.ts`, `ai.ts`,
  `render.ts`, `audio.ts`, plus `*.test.ts`.

### Sub-wave 2C — Riftfall, Rift Life and Rift Ecology

- `src/games/riftfall/RiftfallGame.tsx`, `simulation.ts`, `upgrades.ts`, `render.ts`,
  `audio.ts`, plus `*.test.ts`.
- `src/games/rift-life/RiftLifeGame.tsx`, `simulation.ts`, `npcs.ts`, `endings.ts`, `render.ts`,
  plus `*.test.ts`.
- `src/games/rift-ecology/RiftEcologyGame.tsx`, `simulation.ts`, `species.ts`, `scenarios.ts`,
  `render.ts`, plus `*.test.ts`.

### Shared integration per sub-wave

- `src/types/game.ts`, `src/games/registry.ts`, `src/data/games.json`.
- `public/art/<slug>.svg` thumbnails.
- `e2e/helpers.ts`, the boot and catalogue specs, the axe spec, and the home-page count copy.
- `src/games/simulation-smoke.test.tsx` extended where the game shell is React/Canvas.
- `docs/research/WAVE2-TECHNIQUES.md` (2A), `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`.

## Testing strategy

### Unit tests

- Existing baseline: 234 unit tests across 27 files, all must keep passing.
- Neon Craft: at least 35 new tests covering noise determinism, terrain and caves, biome
  distribution, spawn validity, ore depth bands, chunk edits and dirty propagation, lighting
  propagation, mesher face culling/AO/bucket separation, raycast hit and reach, collision, fall
  damage, hunger, inventory stacks, recipe availability and crafting, farming stages and
  irrigation, combat cooldowns, creature FSM and spawn rules, day/night phases, and the save
  codec including corrupt records.
- Rift Rally: at least 10 tests; Neon Duel: at least 10; Riftfall: at least 8; Rift Life: at
  least 8; Rift Ecology: at least 8.
- Target: at least 75 new unit tests, bringing the suite to roughly 310 tests.

### Browser and component tests

- Extend `e2e/helpers.ts` and the catalogue/boot specs so all 31 games render, start and leave
  no console errors or page errors.
- The catalogue test loads every page of the listing and finds all 31 titles.
- The home-page test asserts the real hero and the updated count copy.
- Add axe scans for the six new game routes at desktop and mobile; zero critical or serious
  violations.
- Add component smoke coverage for the React/Canvas shells and the Neon Craft WebGL-unsupported
  fallback and menu flow (the engine is injected or stubbed in jsdom).
- Target: at least 72 Playwright tests passing.

### Manual verification

For each game, a real browser pass at 1440px and 390px: start from the catalogue, reach the
win/lose state or a representative mid-run state, use the documented controls, check pause and
restart, check mute, watch the console, and confirm layout without horizontal overflow. Neon
Craft gets a longer session covering mining, building, crafting, farming, combat, a full night,
death and respawn, save, reload and slot deletion. Results are recorded honestly; anything not
played is reported as not manually verified.

### Commands

```
npm run typecheck
npm test
npm run build
npx playwright test --workers=2
```

## Risks and mitigations

- **Voxel performance:** greedy meshing, capped merge sizes, chunk streaming budget, quality
  tiers, and measured triangle/draw-call budgets before adding more effects.
- **Scope creep in Neon Craft:** the non-goals list is binding for v1; extra systems require a
  new spec revision.
- **Save corruption or data loss:** versioned pure codec, atomic slot writes, explicit
  unreadable-slot handling, and tests for malformed records.
- **Input conflicts:** extend the shared capture list once, centralise pointer lock, ignore
  events from form fields, and remove listeners on dispose.
- **Mobile playability:** touch controls are part of the definition of done, not a follow-up.
- **IP risk:** original names, art, sounds and code; references recorded; no repository code
  imported; no Minecraft terminology in product copy.
- **Test flakiness:** deterministic seeds and fixed-step simulations for logic tests; browser
  tests assert states, not timing-sensitive pixels.
- **Bundle growth:** all six games are lazy-loaded; main-bundle growth must stay under 10 kB, and
  each lazy game chunk should stay under 150 kB gzip.
- **Scope honesty:** no game is marked complete until its sub-wave gate is verified and the
  user has reviewed it.

## Limitations to state in product copy

- Neon Craft is an original survival sandbox, not Minecraft, and has no multiplayer, redstone,
  portals, alternate dimensions or mod support.
- Neon Craft has two hostile creature types, no villagers, and no weather system.
- Fighting and action games are single-player against AI only.
- Rift Life stores ending-gallery progress locally; there are no accounts or cloud saves.
- Rift Ecology is a stylised teaching model, not a scientific simulation.

## Definition of done

### Per sub-wave

- Every listed game is playable to its documented win/lose or session end state.
- Its catalogue entry, registry entry and thumbnail are live, with accurate instructions and
  controls.
- Its unit suites pass, the game boots in Playwright without console or page errors, and axe
  finds no critical or serious violations on its route.
- Desktop and mobile browser passes are completed and recorded, including anything not verified.
- Typecheck, the full unit suite and the production build pass.
- One squashed commit per sub-wave on `feat/games-wave2`; nothing pushed or deployed.

### Program

- 31 games in the catalogue, registry, search and category pages.
- At least 309 unit tests and at least 72 browser tests passing.
- Docs show real counts and real verification dates, with no planned feature marked complete.
- No new runtime dependency, no copied IP, no secret, no fake metric.
- The user has reviewed the branch; merge and push happen only with explicit approval.

## Open questions

None. All decisions needed for sub-wave 2A are fixed above; later sub-waves may refine their
internal content within the boundaries set here.
