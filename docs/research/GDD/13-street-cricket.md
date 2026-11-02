# 13 — Street Cricket

> **Reference genre:** Cricket 24 (arcade cricket, not a licensed simulation).
> **Shortlist rank:** 13 · **Engine:** Three.js + DOM timing UI · **Complexity:** M · **Wave:** 1
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A floodlit street-cricket game played on a compact rooftop pitch between fictional city districts. Batting is timing and placement; bowling is line, length and variation. Matches are short, scores are readable, and no real teams, players, kits or broadcast assets appear.

Working tagline: *“Six balls. One rooftop.”*

### Design pillars

1. **Timing over statistics.** A well-timed shot beats a high-rated team.
2. **Readable ball flight.** The player can see length and line early enough to react.
3. **Short formats.** Super Over (6 balls) and a 5-over chase fit a browser session.
4. **Original cricket world.** Fictional districts, invented players, original kits and stadium.
5. **Honest physics.** Simplified but consistent bounce, swing and spin; documented as arcade.

### Target session

- 3–8 minutes per match.
- Desktop-first; mobile supported with large timing targets.
- Player intent: quick sports challenge with a clear result.

### Core loop

```
Choose format and district → coin toss
  → bat: read delivery, time shot, place gap, run
  → bowl: choose line/length/variation, set field
  → innings ends → result → rematch
```

### Formats

| Format | Rules |
|---|---|
| Super Over | One innings each, 6 balls, 2 wickets; tie → second super over |
| Rooftop Chase | 5 overs, chase a generated target |
| Nets | Endless batting practice, no fielders |

### Teams

Six fictional districts with palette and kit identity; all player names invented. Teams differ by two modest modifiers (power vs control), never by licensed likeness.

---

## 2. Feature list

### Essential

- Batting: timing window, shot direction (6 zones), loft toggle, run/decline.
- Bowling: line (off/middle/leg), length (short/good/full), pace/spin variation.
- Ball physics: gravity, bounce, seam deviation, swing, boundary detection.
- Wicket types: bowled, caught, stumped (simplified), run-out (simplified).
- Fielding AI: 9 fielders, chase, catch, throw, backup.
- Field placement presets and manual drag within limits.
- Scoring: runs, fours, sixes, extras (wide/no-ball), wickets, overs.
- Super Over and 5-over chase; target generation.
- Result screen with scorecard.
- Pause, restart, quit; audio toggles.
- Keyboard/mouse and touch timing UI.

### Advanced

- Six districts with distinct pitch tint and crowd palette.
- Weather presets (clear, humid) that slightly affect swing.
- Replay of the last ball (deterministic ghost).
- Local best chase and best score.
- Commentary-style text feed (original lines, no audio impersonation).

### Optional

- Two-player local pass-and-play.
- Tournament of 4 districts.
- Unlockable bats with cosmetic trails.

### Explicitly cut

- Licensed teams, players, stadiums, kits, broadcast overlays or commentary.
- Full 50-over simulation, career mode, transfers.
- Online multiplayer.
- Exact reproduction of Cricket 24 mechanics or UI.

---

## 3. Gameplay architecture

```
src/games/street-cricket/
  StreetCricketGame.tsx  React shell, HUD, timing meter, scorecard
  engine.ts              Scene, ball sim, fielders, render
  delivery.ts            Bowling input → ball state
  batting.ts             Timing, direction, contact quality
  ball.ts                Flight, bounce, swing, spin
  fielding.ts            Fielder AI and catching
  rules.ts               Scoring, wickets, overs, result
  teams.ts               District/team data
  audio.ts               Bat crack, crowd, stump cue
  persistence.ts         Records
  *.test.ts              Scoring, wicket, ball flight, result
```

### Ball simulation

- Fixed 120 Hz for the ball; rendered at display rate.
- State: position, velocity, spin axis/rate, bounce count.
- Gravity −9.81 scaled to pitch units; drag small.
- Bounce: restitution 0.55, friction 0.35; deviation proportional to seam angle and pitch roughness.
- Swing: lateral acceleration applied before first bounce, capped.
- Boundary: 4 if it crosses the rope after touching the ground, 6 if it crosses in the air.

### Batting model

- Delivery is visible from release; the timing meter has a “perfect” window of 70 ms.
- Contact quality = timing × placement × shot-type match.
- Direction is chosen at contact via pointer/stick; late input reduces accuracy.
- Loft increases launch angle and risk.
- Miss → possible bowled/stumped; edge → catch chance based on quality.

### Fielding AI

- Fielders assigned zones; react when the ball enters their radius.
- Intercept target = predicted ball position at time `t`, capped by speed.
- Catch if the ball is airborne and within reach; otherwise ground pickup and throw.
- Throw accuracy decreases with distance; backup fielders cover the throw line.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Rendering | Three.js | 3D pitch, camera, ball flight |
| Ball physics | Custom | Deterministic and tunable; no rigid-body engine |
| Fielding AI | Custom steering | Small agent count |
| UI | React DOM | Timing meter and scorecard |
| Audio | Web Audio synthesis | Crowd noise and impacts without assets |
| Persistence | LocalStorage | Records only |

No physics engine. Cricket needs authored bounce behaviour, not general rigid-body simulation.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Pitch/stadium | Procedural ground, stands, floodlights, rooftop skyline |
| Players | Low-poly original figures with 5–6 animation clips |
| Ball/bat | Simple meshes with emissive accents |
| UI | DOM scorecard + inline SVG |
| Audio | Synth bat crack, crowd bed, whistle |
| Thumbnail | Batter silhouette at floodlit pitch |

No real kits, logos, player likenesses, stadium reproductions or broadcast graphics.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Ball spine | Delivery, flight, bounce, boundary | Ball behaves consistently at 120 Hz |
| M2 — Batting | Timing, direction, contact, runs | A ball can be hit for 1/4/6 |
| M3 — Wickets | Bowled, caught, stumped, run-out | Each wicket type triggers correctly |
| M4 — Fielding | 9 fielders, catch, throw, backup | No fielder stuck or passing through ball |
| M5 — Match | Overs, scoring, result, scorecard | Full Super Over and chase complete |
| M6 — Content/polish | 6 districts, weather, replay, audio | Content-complete match experience |
| M7 — QA | Touch timing, performance, docs | 45+ fps mobile; QA complete |

---

## 7. Estimated complexity

**M.** ~4,000–5,000 lines. Ball and fielding behaviour need iteration; rules are well understood and highly testable. Art is procedural and bounded.

---

## 8. Testing plan

### Unit

- Bounce restitution and deviation ranges.
- Boundary 4 vs 6 detection.
- Wide/no-ball and extras.
- Wicket conditions for each type.
- Over completion and innings end.
- Chase result and tie handling.
- Deterministic delivery for a fixed input and seed.

### Integration

- Complete a Super Over batting and bowling.
- Complete a 5-over chase, win and lose.
- Fielders catch, throw and back up without deadlocks.
- Pause mid-delivery; resume without ball teleport.
- Touch timing on a 360 px viewport.
- Route change disposes renderer/audio.

### Performance

- 60 fps desktop, ≥ 45 fps mobile.
- Draw calls ≤ 120; triangles ≤ 80k.
- Ball simulation stable at high speed (no tunnelling through bat/rope).

---

## 9. Integration plan

1. Add `street-cricket` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `sports`, secondary `arcade`.
3. Lazy registry entry; Three.js only here.
4. Thumbnail + `docs/games/street-cricket.md` with controls and format rules.
5. `onComplete` with result and score.
6. Reuse Three.js lifecycle; no shared code with Rift Striker unless clean.

---

## 10. Known limitations

- Arcade physics, not a simulation-grade cricket model.
- Simplified fielding and wicket rules (no DRS, no detailed run-out physics).
- No licensed teams, players, stadiums or commentary.
- Three formats, not a career or tournament mode in v1.
- Mobile timing is playable but harder than with a mouse.
