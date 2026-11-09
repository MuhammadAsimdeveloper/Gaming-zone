# Neon Coast: After Hours

Neon Coast is NeonRift's original top-down open-district adventure. You walk the
streets of the fictional Vela district in Solara Bay, take on handcrafted
missions, unlock your coupe, and chase better times and shard scores. The loop
is Mission → Exploration → Challenge → Reward → Unlock → New Mission, entirely
in one browser session with no account and no server.

- Route: `/game/neon-coast`
- Category: adventure (secondary: racing, casual)
- Rendering: Canvas 2D playfield with a DOM HUD and a second Canvas minimap
- Simulation: fixed 1/60 s steps, seeded determinism, engine independent of React
- Storage: browser-local only (`neonrift:game:neon-coast:save`)

Solara Bay, Vela district, the Vela coupe, the landmark names, mission briefs,
palette and audio cues are original to this repository. No commercial game's
map, vehicles, characters, mission scripts, interface, assets or music are used
or referenced.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Walk or steer | WASD or arrow keys | Drag the walk joystick |
| Sprint or drift | Shift (walk), Space (drift in the car) | Sprint button, Drift button |
| Enter or exit the Vela | E | Car icon / step-out icon |
| Pause and resume | Escape (P toggles too) | Pause button in the game toolbar |
| Mute audio | M | Speaker button |
| Fullscreen | Game toolbar button | Game toolbar button |

Every on-screen control is a real button with an accessible label; touch
targets are at least 44 px. Gameplay keys are ignored while a form control has
focus. The playfield swallows touch gestures so the page never scrolls while
driving.

## The district

Vela is a 2400 × 2000 unit grid with four north–south streets, four east–west
streets, nine blocks, buildings along the block edges, and street props that
block movement. The garage forecourt is paved so the car can pull out onto the
coast road.

| Landmark | Purpose |
|---|---|
| Vela Garage | Spawn point and the coupe's parking bay |
| Tideglass Market | Courier pickup |
| Coral Radio Tower | Courier drop-off |
| Lantern Pier | Southern waterfront landmark |
| Sunset Steps | North-east plaza |
| Solara Arcade | Neon frontage east of the tower |
| Meridian Tram Depot | North avenue landmark |
| Marigold Park | Green shortcut west of the tower |

The clock cycles dawn → day → dusk → night over 300 seconds, starting mid-day.
Lighting, window glow and lamp colour follow the phase; the HUD names it. There
is no weather system by design.

### Movement and driving

| Value | Walk | Vela coupe |
|---|---:|---:|
| Top speed | 120 (175 sprinting) | 430 |
| Acceleration | 900 | 260 |
| Braking | near-instant stop | 480 |
| Reverse | — | 160 |
| Collision radius | 14 | 26 |

The car is arcade-tuned rather than a simulation: steering scales with speed,
the handbrake sheds speed at 420 units/s² and adds a visual shake above
150 km/h displayed. Buildings and props are solid rectangles; a circle-vs-rect
resolution pushes the walker or car out of every overlap and stops it entering
geometry. Traffic keeps to six block loops at 80–140, brakes when the player is
within 150 units ahead of it, and is ambient: it does not damage the player.
Nine pedestrians walk, pause and turn on seeded sidewalk loops, also ambient.
Both systems take an injected seeded generator, so a given seed always yields
the same layout and wander.

Displayed speed is world units converted to km/h with a 0.25 factor. The HUD is
emitted at most ten times per second, and the minimap redraws at the renderer's
frame rate; simulation ticks do not force React renders per frame.

### On foot vs. in the car

Press E within 110 units of the coupe to get in; the camera follows the car and
the objective arrow tracks wherever the car is. Press E again to step out on the
side opposite the driver's door, and the exit point is collision-resolved so you
never spawn inside a wall.

## Missions

| Mission | Kind | Goal | Limit | Reward | Unlocks |
|---|---|---|---:|---:|---|
| Tideglass Courier | delivery | Pick up at Tideglass Market, deliver to Coral Radio Tower | 100 s | 450 | Lantern Circuit |
| Lantern Circuit | circuit | Drive eight ordered gates around the district | 100 s | 800 | Landmark Trail |
| Landmark Trail | exploration | Reach 5 of the 8 landmarks | 180 s | 600 | Glow Run |
| Glow Run | collect | Sweep 8 seeded tide shards with the car | 90 s | 40/shard + 250 sweep | — |

Missions unlock in order. Glow Run is repeatable once unlocked, keeps the best
shard score, and pays only what was collected. Each mission ends in a results
panel that shows the reward, elapsed time, the rank change and a personal-best
badge when the time improves. Paid cash and the mission list are applied through
one pure `applyEvent` reducer.

Ranks are `Newcomer`, `Local`, `Runner`, `Insider` and `Coast Legend`, derived
from the number of distinct missions completed. They are local titles, not
online rankings.

A briefing card appears on the mission-select screen for about fifteen seconds
on first run and stays available in the mission log. The active objective is
always named in the HUD's objective strip (for example "Collect the tideglass
at Tideglass Market"), with a distance in metres and a coral marker on both the
world and the minimap.

## Persistence

`neonrift:game:neon-coast:save` holds one versioned JSON record:

```json
{
  "version": 1,
  "cash": 450,
  "completed": ["tideglass-courier"],
  "bestTimes": { "tideglass-courier": 63.4 },
  "bestGlowScore": 0,
  "discovered": ["tideglass-market"],
  "tutorialSeen": true,
  "soundOn": true
}
```

`parseSave` rejects anything that is not version 1, negative or non-finite cash,
unknown mission or landmark identifiers, and glow scores outside 0–8. A bad
record is discarded and the game starts from the default save instead of
crashing. Writes are best-effort LocalStorage writes; the game continues to play
when storage is unavailable.

Cash, ranks, best times, discovered landmarks and the tutorial flag never leave
the browser. There are no cloud saves, accounts, global leaderboards, real
player statistics or multiplayer.

## Tested behaviour

Unit tests (`src/games/neon-coast/*.test.ts`) cover:

- walking, sprinting and collision push-out, including being ejected from
  inside a rectangle;
- vehicle acceleration, braking, reverse cap, steering and handbrake;
- enter/exit placement and door-side resolution;
- every mission's pickup, gate ordering, discovery counting, shard collection,
  timeout failure, reward and unlock chain;
- deterministic traffic and pedestrian stepping for a fixed seed;
- the fixed-step accumulator (delta clamp, at most five steps), pause behaviour,
  HUD cadence (ten hertz, at most seven callbacks per 0.6 s), day/night phases
  and disposal;
- save parsing (valid, unknown fields rejected, corrupt records replaced),
  best-time and glow-score retention, and the event reducer;
- the React shell: mission select, briefing, HUD labels, pause overlay, results,
  restart, mute persistence and keyboard guards.

The Playwright suite (`e2e/neon-coast.spec.ts`, ten tests) drives the real build:

- launch, briefing and the first objective visible inside fifteen seconds;
- walking with real key holds while the minimap marker moves and distance falls;
- entering the Vela with E, accelerating to a non-zero speed, then stepping out;
- the full Tideglass Courier route on foot using the minimap and HUD only — no
  debug hooks or teleports — ending in the results panel, +450, rank Local, a
  new personal best, and a save that survives a reload with Lantern Circuit
  enabled;
- pause, resume and restart resetting the timer to 1:40;
- a corrupt save starting at $0 and Newcomer while the mission still runs;
- viewport resize preserving the canvas backing size;
- the game's own fullscreen toggle, tolerating headless refusal;
- route-away cleanup and a clean return;
- a 390 × 844 touch viewport with joystick and pedal targets at least 44 px and
  a held Accelerate control producing motion.

The full Courier run completed inside a 100-second limit during the automated
browser test, which took 40.0 seconds of wall clock including setup and the
save reload. No frame-rate figure is claimed: the simulation decouples from the
render clock, and the tests assert behaviour, not FPS.

## Measured size

From `npm run build` and `npm run check:bundle` on the cycle branch:

- Neon Coast chunk: 55.24 kB raw / 17.89 kB gzip, well inside the bundle
  guard's 600 kB per-chunk limit;
- initial assets: 128.7 kB gzip against the 170 kB initial budget;
- 39 lazy game chunks; shared Three.js chunk 567.22 kB raw / 140.83 kB gzip,
  neither preloaded nor in the initial bundle (the bundle guard reports
  553.9 kB raw for its measured copy).

## Known limits

- One district. Vela is complete and playable; further districts are data, not
  shipped content.
- Traffic and pedestrians are ambient and non-lethal; there is no wanted system,
  combat, damage model or police pursuit.
- No weather, interiors, on-foot combat, or car customisation.
- No backend features of any kind; progress is per browser profile and is lost
  with site data.
- Fullscreen depends on browser policy; headless Chromium can refuse it and the
  game remains playable.
- The mobile layout is responsive in portrait and landscape; orientation is not
  forced.

## Future districts and expansions

The district is a plain data structure (`District` in `world.ts`): size, roads,
blocks with building rectangles, props, landmarks, spawn and car spawn. The
simulation, renderer, minimap and missions consume those fields, so a new
district is added by authoring another `District`, pointing missions at its
landmark ids, and letting the shell choose one. Planned directions:

- a second district with a tram line and a waterfront circuit;
- mission scripting from data (objective lists, dialogue-free briefs);
- time-of-day–specific events such as night markets;
- shard routes seeded per district rather than per save;
- accessibility options for high-contrast markers and reduced traffic.

None of these is implemented, and none is announced anywhere as shipped.
