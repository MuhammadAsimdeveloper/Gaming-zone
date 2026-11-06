# Street Cricket

Street Cricket is NeonRift's 3D rooftop cricket game. It is built around timing,
placement and shot choice rather than spreadsheets: read the delivery, pick a
gap, choose block, drive or loft, and swing as the ball arrives. Then bowl the
same over back with line, length and variation.

- Route: `/game/street-cricket`
- Category: sports (secondary: arcade, casual)
- Modes: Super Over, Rooftop Chase, Nets
- Rendering: Three.js rooftop ground with a DOM HUD and timing meter
- Storage: browser-local only

The districts, ground, skyline, players, stumps, palette, names and audio cues
are original to this repository. The game reuses the shared WebGL lifecycle
helpers and the stadium audio synthesiser from Rift Striker; no commercial
stadium, team, player, logo, sound or exact layout is used.

## What is included

### Formats

| Format | Balls | Wickets | Flow |
|---|---:|---:|---|
| Super Over | 6 | 2 | Player bats, then bowls the chase; ties replay up to three times |
| Rooftop Chase | 30 | 6 | Player chases a generated target in a single innings |
| Nets | 18 | 3 | Batting-only session, no fielders and no target |

A Rooftop Chase target is rolled in the band 48–69. A Super Over tie advances
to a new pair of innings with a fresh target, and three level super overs end in
a draw. Innings also close on the wicket limit, the ball limit, or the target
being reached.

### Timing and contact

The timing window is measured around the visual arrival of the ball, not the
physical simulation. Contact is graded by the absolute timing offset:

| Grade | Window (seconds) | Effect |
|---|---:|---|
| Perfect | ≤ 0.035 | Full timing factor, best gap-finding |
| Good | ≤ 0.09 | Strong control, slightly reduced power |
| Ok | ≤ 0.17 | Half timing factor, loose placement |
| Edge | ≤ 0.28 | Weak contact, high catch risk |
| Miss | > 0.28 | Beaten; can be bowled |

Contact quality combines the timing factor, how close the chosen direction is
to the natural answer for the delivery's line, and whether the shot type suits
the length. That quality drives launch angle and power, which in turn drive
carry, roll and the fielding outcome.

### Deliveries

A delivery is a combination of line, length and variation:

| Axis | Values | Effect |
|---|---|---|
| Line | Off, Middle, Leg | Lateral offset of ±0.18 m at the crease |
| Length | Short, Good, Full | Pitch point 8.2 m, 4.8 m or 2.6 m from the stumps |
| Variation | Stock, Pace, Spin | 124, 139 or 91 km/h with different swing ranges |

Swing is capped at 0.35 m. Spin swings the most, pace slightly more than stock.
Arrival time is derived from the air distance and the reduced post-bounce speed,
so short balls take longer to reach the batter than full balls.

### Shots

Six directions — Fine, Point, Cover, Straight, Midwicket, Leg — mapped to
angles of −70° to +50°. Three shot types answer the length differently:

| Shot | Best length | Character |
|---|---|---|
| Block | Good | Low power, low loft, safe |
| Drive | Full | Grounded, best four-hitting option |
| Loft | Short | High carry, six or catch |

Each line has a natural direction: off → cover, middle → straight,
leg → midwicket. Playing with the line keeps placement tight; fighting it costs
quality.

### Fielding

Nine fielders are positioned around the rooftop — keeper, slip, point, cover,
mid-off, mid-on, midwicket, square leg and deep mid. The boundary sits at 34 m.
A lofted ball that carries the rope is a six; a grounded ball that beats it is
a four. A lofted ball that lands near a fielder inside the rope can be caught,
and edges can be taken behind. Otherwise the distance to the nearest fielder
determines the runs: under 7 m is no run, then one, two or three.

Nets removes fielders: contact still produces runs, sixes and fours, but no
catches are taken.

### Bowling

When the player bowls, they choose line, length and variation, then release.
The delivery is created with a small deterministic swing and seam deviation, and
the same batting and fielding model resolves the outcome. The HUD announces the
delivery ("good length, off stump, spin") so the choice can be read back.

### Districts

| District | Tagline | Power | Control |
|---|---|---:|---:|
| Harbour Row | Salt air, tight ropes, loud crowds | 0.56 | 0.50 |
| Mint Terrace | Rooftop gardens and patient batting | 0.48 | 0.58 |
| Cinder Yard | Foundry heat and heavy hitting | 0.62 | 0.42 |
| Lantern Hill | Festival lights and fearless running | 0.52 | 0.52 |
| Glass Quarter | Tower shadows and precise bowling | 0.46 | 0.60 |
| Tidewalk | Sea breeze, late swing, quick singles | 0.55 | 0.50 |

Power feeds a modest batting modifier (0.95–1.012); control is displayed as a
confidence label. The opponent is drawn from the other five districts.

### Persistence

All records are browser-local and versioned:

| Key | Shape |
|---|---|
| `neonrift:game:street-cricket:records:v1` | `{ version: 1, games, wins, bestSuperOver, bestChase, bestNets, sixes, fours }` |
| `neonrift:game:street-cricket:settings:v1` | `{ version: 1, format, districtId, muted }` |

Malformed records and settings fall back to defaults instead of crashing the
menu. A completed match increments `games`, counts a win for `win`, updates the
format's best score only when improved, and adds the player's sixes and fours.

## Controls

| Action | Keyboard | Pointer |
|---|---|---|
| Swing / bowl | `Space` | Swing or Bowl buttons |
| Aim shot / bowling line | `A` `D` / `←` `→` | Six aim chips or line chips |
| Shot type / bowling length | `W` `S` / `↑` `↓` | Block, Drive, Loft or length chips |
| Bowling variation | `Q` `E` | Variation chips |
| Pause | `P` / `Escape` | Pause button |
| Mute | `M` | Speaker button |

On touch layouts the aim, shot, line, length, variation, swing and bowl controls
are all on-screen. The timing bar has four coloured bands — perfect, good, ok
and edge — with a marker driven by the engine callback without a React render
per frame.

## Accessibility and lifecycle

- The canvas has a descriptive `aria-label` covering the scene and controls.
- Pause, mute and back-to-setup controls are labelled buttons.
- The live match message is mirrored in an `sr-only` polite status region.
- `useVisibilityPause` pauses the engine when the tab is hidden.
- `useWebGLContextLoss` shows a restore notice and pauses the loop if the WebGL
  context is lost.
- Leaving the route disposes the renderer, animation loop, input listeners,
  audio graph and the React timing callbacks.

## Testing

- `rules.test.ts` — innings, targets, boundary and wicket limits, super-over
  ties and the three-round draw, chase and nets results.
- `delivery.test.ts` — line and length geometry, bounce distances, arrival
  ordering, speed and swing caps, labels and timing grades.
- `batting.test.ts` — timing, placement, shot-length fit, edges, misses and
  direction angles.
- `fielding.test.ts` — fielded runs, boundaries, sixes, skied catches, edges,
  bowled dismissals and the no-fielder nets mode.
- `teams.test.ts` — six districts, fallback lookup, batting modifier and
  deterministic opponent selection.
- `persistence.test.ts` — record parsing, best-score updates, wins and totals,
  settings validation and malformed storage.
- `cpu.test.ts` — CPU timing error, shot weights by length and natural
  direction bias.
- `session.test.ts` — control handover, innings-change messages, match end,
  super-over re-bat and nets without fielders.
- `StreetCricketGame.test.tsx` — menu formats, district selection, persisted
  settings, saved records, malformed storage and the WebGL-unavailable path.
- The broader Playwright suite boots the game, starts a match, checks the
  canvas, toggles mute and pauses/resumes; navigation specs assert all 32
  published games are listed.

## Known limitations

- No online play, accounts, global leaderboards or player counts. Records are
  browser-local.
- Bowling is an authored line/length/variation model, not a physics simulation.
- There is no run-out, stumping or free-hit system; dismissals are bowled and
  caught.
- Fielders are positioned for the rooftop ground; there is no field editor.
- Super Over and Rooftop Chase are the two competitive formats; Nets is a
  practice session without an opponent.
