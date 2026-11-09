# Neon Coast: After Hours — Game Design Spec

**Status:** approved by the 2026-11-09 development directive; implemented in this cycle.
**Platform contract:** [ARCHITECTURE.md](../../research/ARCHITECTURE.md) and the game module rules in that document.
**Originality:** Solara Bay, its district, characters, vehicle, missions and dialogue are original to NeonRift. The only external references are genre-level design principles; no map, character, vehicle, script, logo, sound or asset is reproduced from another game.

## 1. Pitch

A top-down open-district adventure in Solara Bay. The player walks the streets of **Vela District**, drives one original car, meets people at handcrafted locations, and builds a small local reputation through three jobs and one repeatable night activity.

Progression loop: **Mission → Exploration → Challenge → Reward → Unlock → New Mission**.

The first-time objective must be readable within 15 seconds: the opening screen names the next job and the HUD points at its pin.

## 2. The district

Vela District is a 2400 × 2000 world unit coastal block of Solara Bay, bounded by water on the south edge.

| Landmark | Position | Role |
|---|---|---|
| Vela Garage | (1160, 1560) | Player and car spawn, safe start |
| Tideglass Market | (560, 510) | Courier pickup, vendor stalls |
| Coral Radio Tower | (1160, 1010) | Courier drop-off, skyline landmark |
| Lantern Pier | (560, 1900) | Waterfront boardwalk, night lights |
| Sunset Steps | (1760, 510) | Terraced plaza, street musicians |
| Solara Arcade | (1760, 1010) | Neon frontage, evening crowd |
| Meridian Tram Depot | (1160, 510) | Tram shed and crossing |
| Marigold Park | (560, 1010) | Green shortcut with paths |

Roads form a four-by-four grid (horizontal y = 260, 760, 1260, 1760; vertical x = 260, 860, 1460, 2060, half-width 70). Sidewalks line every block, buildings sit inside blocks, and park paths provide on-foot shortcuts. The map is deliberately dense rather than large: every block has a name, a purpose or a visual signature.

Architecture keeps future districts data-only: a district is a `DistrictDefinition` (roads, blocks, landmarks, spawns). Harbor Market, Neon Avenue and Mangrove Loop are documented follow-ups, not built in this slice.

## 3. Player and vehicle

- **On foot:** 120 units/s walk, 175 sprint, circle collision against buildings and props, camera follows smoothly.
- **Vehicle:** one original car, the **Solstice Vela** — balanced arcade courier car. 430 units/s top speed, 260 acceleration, 480 braking, 160 reverse, speed-scaled steering, handbrake drift.
- Entering and exiting happens with `E` when close to the car. On foot the player can interact with mission pins and landmarks; driving is required for the time trial.
- Traffic uses six deterministic cars on looping road routes and brakes for the player. Pedestrians use a small walk/pause/turn state machine on sidewalk loops.

## 4. Missions and activity

| Id | Name | Type | Rules | Reward |
|---|---|---|---|---|
| `tideglass-courier` | Tideglass Courier | Timed delivery | Collect at Tideglass Market, deliver to Coral Radio Tower within 100 s. On foot or by car. | ₡450, unlocks Lantern Circuit |
| `lantern-circuit` | Lantern Circuit | Driving time trial | Pass eight ordered gates around Vela District in a car within 100 s. Best time stored. | ₡800, unlocks Landmark Trail |
| `landmark-trail` | Landmark Trail | Exploration | Discover any five of the eight landmarks within 180 s. | ₡600, unlocks Glow Run |
| `glow-run` | Glow Run | Repeatable activity | Collect eight seeded tide shards around the district within 90 s. Repeatable for cash and a personal best. | ₡40 per shard + ₡250 for a clean sweep |

Ranks derive from completed missions: Newcomer (0), Local (1), Runner (2), Insider (3), Coast Legend (4+ including a completed Glow Run).

Rewards and records are **browser-local**. There is no backend, no cloud save, no leaderboard and no simulated other players.

## 5. Presentation

Original visual identity: deep teal water, coral-and-amber street lighting, mint signage, sun-bleached plaza stone. A 300-second day/night cycle tints the whole scene and turns on lamps at dusk. Weather is intentionally omitted in this slice because it adds cost without changing a decision.

Rendering is Canvas 2D: a pre-rendered static district layer plus per-frame dynamic entities, capped DPR, no post-processing. The React layer owns HUD, tutorial, menus, overlays and the minimap.

## 6. Controls

Desktop: `WASD`/arrows move or drive, `Shift` sprint, `E` interact/enter/exit, `Space` handbrake, `M` mission log, `P`/`Escape` pause, `R` restart run.

Touch: a drag joystick on foot; dedicated left/right steer, accelerate, brake and drift buttons while driving; large interact, missions, pause and fullscreen controls. All targets are at least 44 px. Landscape and portrait both keep the HUD readable. Reduced motion disables camera shake and decorative pulses.

## 7. Persistence

Key `neonrift:game:neon-coast:save`, versioned `{ version: 1, ... }`. Fields: cash, completed missions, best times, best Glow Run score, discovered landmarks, tutorial seen, sound on/off. Unknown versions and malformed payloads reset safely. Run state itself is not saved; the save stores progression only.

## 8. Out of scope for this slice

Additional districts, more vehicles, a second playable character, vehicle customisation, dynamic events, weather, seeded daily challenges, online features and analytics. All are documented as future work, not advertised as present.
