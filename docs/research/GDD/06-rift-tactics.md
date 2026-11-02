# 06 — Rift Tactics

> **Reference genre:** Clash Royale (lane arena, deck, elixir).
> **Shortlist rank:** 6 · **Engine:** Canvas 2D fixed-tick · **Complexity:** M · **Wave:** 2
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A three-minute lane battle between two rift harvesters. The player builds an eight-card deck from a pool of original units, spells and structures, spends regenerating **charge**, and tries to break the enemy core before the clock runs out. Bots provide a complete single-player ladder; the simulation is deterministic enough to add human play later without rewriting it.

Working tagline: *“Eight cards. Three minutes. One core.”*

### Design pillars

1. **Every card has a counter.** No card is dominant; the deck is a set of answers.
2. **Three minutes, decided by decisions.** Matches are short and losses are explainable.
3. **Readable lanes.** Two lanes, two bridges, clear target priority.
4. **Bots that play the game.** Not aimbots — opponents that manage charge, defend, and commit.
5. **No collection trap.** All 16 cards are unlockable through play; no packs, no purchases.

### Target session

- 3 minutes per match; 10–25 minutes per session.
- Portrait and landscape phone; desktop.
- Player intent: quick competitive puzzle with deck expression.

### Core loop

```
Choose deck → match starts at 1× charge
  → deploy units/spells, defend lanes, counter pushes
  → destroy towers → break core or win on towers at time-out
  → crowns/trophies update → edit deck → next match
```

### Match rules

- Two lanes, each with a side tower; one core tower behind them.
- Destroying a side tower opens that lane toward the core.
- Win by destroying the core, or by having more towers when 3:00 expires.
- 60 s sudden death if towers are tied.
- Charge regenerates at 1 per 2.8 s, doubled in the last minute.
- Deck of 8; a 4-card hand with a visible next card; deployed cards cycle.

---

## 2. Feature list

### Essential

- Fixed-tick simulation at 30 Hz (rendered at 60).
- Two lanes, bridge chokepoints, side towers, core tower.
- 16 cards: 9 units, 4 spells, 3 structures.
- Charge economy, hand cycling, deployment zones.
- Unit targeting rules: buildings-only, any ground, air, nearest.
- Projectiles, splash, slows, shields, healing, spawners.
- Bot opponent with three difficulty profiles.
- 3-minute matches, sudden death, crowns, result screen.
- Deck builder with 16-card collection and unlock costs.
- Local trophy progress and win/loss record.
- Pause in bot matches; restart; surrender.
- Touch drag-to-deploy with valid-zone highlight.
- Audio: deploy, impact, tower destruction, match sting.

### Advanced

- 8 arenas with different bridge layouts and one hazard each.
- Card levels 1–5 earned by copies from wins (no purchase).
- Replay of the last match as a deterministic input log.
- Training mode with an open board and damage numbers.
- Daily challenge: fixed deck, fixed bot seed.

### Optional

- 2v2 against two bots (player + bot ally).
- Spectator-style “ghost” of a stored match.
- Cosmetic card backs.

### Explicitly cut

- Real-time PvP, matchmaking, servers, anti-cheat.
- Loot boxes, chests, gems, card packs, energy timers.
- Copied Clash Royale card names, art, arenas or UI.
- Clan systems, chat, tournaments.

---

## 3. Gameplay architecture

```
src/games/rift-tactics/
  RiftTacticsGame.tsx  React shell, deck builder, HUD, results
  engine.ts            Fixed-tick sim + canvas render
  cards.ts             Card definitions and spawn logic
  units.ts             Unit stats, state machines, targeting
  combat.ts            Damage, projectiles, splash, status
  arena.ts             Lane geometry, bridges, deploy zones
  bot.ts               Bot policy and difficulty profiles
  deck.ts              Deck validation, hand cycling
  replay.ts            Input-log recording/playback
  audio.ts             Procedural cues
  persistence.ts       Collection, trophies, records
  *.test.ts            Targeting, economy, win conditions, bot legality
```

### Simulation contract

- Pure `step(state, commandsA, commandsB) -> state`.
- All randomness from a seeded PRNG stored in state.
- Units identified by stable ids; no object references in saved state.
- Same seed + same commands = same result, verified by a test.

### Unit update order

```
status timers → movement/pathing → target acquisition → attacks
→ projectile spawn/move → damage resolution → deaths → tower state
```

### Targeting priority

| Type | Priority |
|---|---|
| Ground unit | Enemy units in aggro radius → buildings → towers |
| Building-targeter | Buildings/towers only |
| Air unit | Air-capable attackers → any unit → towers |
| Structure | Attacks whatever enters range; no chase |

### Bot design

- Evaluates threat per lane every 0.5 s.
- Holds charge for a counter when a threat exceeds a threshold.
- Difficulty changes reaction delay, charge discipline, counter knowledge and spell accuracy.
- Never cheats: same hand, same charge, same vision as the player.
- A legality test runs the bot for 10,000 ticks and asserts every command is valid.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed 30 Hz | Determinism, replay, testability |
| Rendering | Canvas 2D | Small unit counts, cheap effects |
| HUD/deck | React DOM | Drag-and-drop and accessible buttons |
| Audio | Web Audio synthesis | Zero assets |
| Persistence | LocalStorage | Collection and records |

No physics engine, no server, no netcode in v1. The deterministic command log is the future-multiplayer seam.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Units | Original vector silhouettes with 2–4 frame idle/attack |
| Spells | Canvas particle effects |
| Arenas | Procedural tile floors, bridges, core structures |
| Cards | DOM cards with SVG frames and unit portraits |
| Audio | Synth impacts, chimes, low horns |
| Thumbnail | Arena key art with two cards |

Palette: rift violet, oxidised gold, bone, deep navy. No copied card frames or character designs.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Sim spine | State, tick, movement, one unit type | Deterministic 10,000-tick test passes |
| M2 — Combat | Targeting, damage, towers, win/loss | A scripted match completes correctly |
| M3 — Economy/deck | Charge, hand, deck builder, 16 cards | Every card deployable and legal |
| M4 — Bot | Three profiles, threat evaluation | Bot wins/loses plausibly; no illegal commands |
| M5 — Content | 8 arenas, progression, results | Full ladder loop from match to deck edit |
| M6 — Polish/QA | Effects, audio, replay, mobile | Touch deployment, 60 fps, QA complete |

---

## 7. Estimated complexity

**M.** ~4,000–5,000 lines. The simulation is modest; balance and bot quality consume the most time. Determinism makes regressions cheap to catch.

---

## 8. Testing plan

### Unit

- Charge regeneration and cap, including the final-minute multiplier.
- Hand cycling with duplicate cards.
- Deployment legality (own half, not on towers, not on occupied cells).
- Target priority for every unit class.
- Splash falloff, shields, slow stacking rules.
- Tower/core destruction and crown count.
- Time-out and sudden-death resolution.
- Bot legality across 10,000 ticks.

### Integration

- Complete a match with each difficulty.
- Win by core destruction, by towers at time-out, and by sudden death.
- Deck builder rejects fewer/more than 8 cards and duplicates over the limit.
- Reload mid-match: bot match is paused/lost per documented rule.
- Replay reproduces the recorded result exactly.
- Route change disposes RAF and audio.

### Performance

- 40 units + 60 projectiles at 60 fps desktop, ≥ 45 fps mobile.
- No per-frame React renders; HUD updates at 10 Hz.

---

## 9. Integration plan

1. Add `rift-tactics` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `strategy`, secondary `action`/`casual`.
3. Lazy registry entry; Canvas 2D only.
4. Thumbnail + `docs/games/rift-tactics.md`.
5. `onComplete` with win/loss and crowns.
6. Reuse shared2d loop/input/rng helpers.

---

## 10. Known limitations

- Single-player only. Bots are competent but not a substitute for human opponents.
- Card pool is 16, not a live-service catalogue.
- Balance is tuned against bots; human play may reveal different dominant strategies.
- Replays are local and tied to the game version.
- No clan, chat or social features.
