# 07 — Neon Arena

> **Reference genre:** Brawl Stars (top-down arena shooter with short matches).
> **Shortlist rank:** 7 · **Engine:** Canvas 2D · **Complexity:** M · **Wave:** 2
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A three-versus-three top-down arena game with bots, six original fighters and three short modes. Matches last under three minutes. Cover, bushes and a charged super create the same readability and swing moments as the reference genre, with entirely original characters, maps and names.

Working tagline: *“Three minutes of light.”*

### Design pillars

1. **Short, decisive matches.** No match exceeds 180 seconds.
2. **Readable duels.** Every attack has a clear range, cadence and counter.
3. **Cover matters.** Walls and bushes create approach routes, not decoration.
4. **Bots complete the game.** Single-player is a full product, not a placeholder for PvP.
5. **No grind wall.** All six fighters are available from the start for local play.

### Target session

- 2–3 minutes per match; 10–20 minutes per session.
- Landscape phone primary; desktop supported.
- Player intent: fast, skill-expressive arena action.

### Core loop

```
Pick fighter and mode → 3v3 match vs bots
  → fight, collect/hold objective, use super
  → win/lose → results → rematch or switch fighter
```

### Modes

| Mode | Rules |
|---|---|
| Shard Hold | Collect 10 shards from the centre; hold the lead for 15 s to win |
| Signal Hunt | First team to 12 takedowns, or highest score at 2:30 |
| Last Light | Solo survival against 5 bots; last standing wins |

### Fighters

| Fighter | Role | Attack | Super |
|---|---|---|---|
| Volt | Mid-range skirmisher | Three-shot burst | Chain arc to two targets |
| Ember | Close-range bruiser | Cone flame | Burning dash |
| Kestrel | Long-range marksman | Charged bolt | Recon sweep + piercing shot |
| Mica | Support | Healing pulse projectile | Shield dome |
| Thorn | Area denial | Lobbed seed pod | Root field |
| Rook | Tank | Short-range shockwave | Wall slam / knockback |

---

## 2. Feature list

### Essential

- 3v3 bot matches with teammate and enemy AI.
- Six fighters with distinct stats, attack and super.
- Twin-stick movement/aim; tap-to-auto-aim fallback.
- Bush stealth (hidden until attacking or within 2 m).
- Destructible cover crates; indestructible walls.
- Health, respawn (5 s), super charge from damage dealt.
- Three modes with clear win conditions.
- Four original arenas with symmetric layouts.
- Match timer, scoreboard, results, rematch.
- Bot difficulty selection.
- Pause, restart, quit; audio toggles.
- Touch: left stick move, right drag aim + release fire; super button.
- Keyboard/mouse: WASD, mouse aim, click fire, Space super.

### Advanced

- Six arenas including one asymmetric “Rift” arena.
- Fighter mastery tracks (local): 10 wins unlocks a cosmetic palette.
- Training range with static targets and damage readout.
- Colour-blind enemy outlines and damage-number toggle.
- Match replay from deterministic input log.

### Optional

- 1v1 duel mode.
- Endless survival wave mode.
- Cosmetic trails and victory poses.

### Explicitly cut

- Real-time PvP and matchmaking.
- Loot boxes, skins economy, battle pass.
- Copied Brawl Stars characters, maps, UI or sounds.
- Clubs, chat, spectating.

---

## 3. Gameplay architecture

```
src/games/neon-arena/
  NeonArenaGame.tsx  React shell, menus, HUD, results
  engine.ts          Fixed-step sim + canvas render
  fighters.ts        Fighter definitions and ability hooks
  combat.ts          Projectiles, melee arcs, damage, status
  bots.ts            Team AI: roles, engagement, objective play
  arenas.ts          Arena layouts, bushes, cover, spawn points
  modes.ts           Mode rules and win conditions
  stealth.ts         Bush visibility and reveal rules
  audio.ts           Procedural cues
  persistence.ts     Mastery, settings, records
  *.test.ts          Combat, modes, bot legality, stealth
```

### Simulation

- Fixed 30 Hz; render at display rate with interpolation.
- Entity cap: 6 fighters, 40 projectiles, 12 crates, 8 shards.
- Collision: circles for fighters, AABBs for walls/crates.
- Line-of-sight raycast for bushes and projectiles.
- Deterministic seeded spawns and crate drops.

### Bot AI

- Each bot has a role: engage, support, objective.
- Utility scoring each 0.25 s: distance to target, health, cover, objective value, ally support.
- Aim uses predicted target position with per-difficulty error.
- Bots respect bush stealth (they cannot see hidden players).
- Bots never fire through walls and never exceed ability ranges.
- Difficulty changes reaction time (350/220/120 ms) and aim error, not damage.

### Mode rules

- Shard Hold: centre spawns one shard every 2.5 s, cap 10 carried per team; 15 s hold at 10.
- Signal Hunt: takedowns score 1; assist 0.5 (rounded at display only); 12 to win.
- Last Light: shrinking safe zone after 90 s; 6 combatants; last alive wins.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed-step | Small entity count; determinism |
| Rendering | Canvas 2D | Top-down sprites, cheap effects |
| UI | React DOM | Menus and results only |
| Audio | Web Audio synthesis | No asset licensing |
| Persistence | LocalStorage | Mastery and settings |

No physics engine, no server. A future PvP version would require authoritative servers and is explicitly out of scope.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Fighters | Original vector characters, 8-direction or rotating top-down body + weapon |
| Arenas | Procedural tiles, walls, bushes, crates |
| Projectiles | Pooled shapes with trails |
| UI | Inline SVG portraits and mode icons |
| Audio | Synth shots, impacts, super cues |
| Thumbnail | Three-fighter key art |

No copied character silhouettes, colour schemes tied to the reference roster, or map layouts.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Movement/combat | One fighter, one arena, projectiles | Hit detection and respawn work |
| M2 — Bots | Ally and enemy AI | Bots fight, retreat and contest objectives |
| M3 — Modes | Three win conditions | Each mode completes end-to-end |
| M4 — Roster | Six fighters with supers | Every ability implemented and balanced |
| M5 — Content | Four arenas, mastery, results | Full loop from menu to rematch |
| M6 — Mobile/QA | Twin-stick touch, performance | 45+ fps mobile with 6 fighters + 40 projectiles |

---

## 7. Estimated complexity

**M.** ~4,000–5,000 lines. The combat is simple; bot quality and arena readability are the real work. Content is bounded at six fighters and four arenas.

---

## 8. Testing plan

### Unit

- Projectile collision and wall blocking.
- Damage, shields, healing and super charge.
- Bush stealth: hidden, revealed by attack, revealed by proximity.
- Respawn timing and spawn protection.
- Mode win conditions and timer transitions.
- Bot command legality and line-of-sight respect.
- Determinism: same seed and inputs produce the same result.

### Integration

- Win each mode with each fighter at least once.
- Ally bot does not block the player or idle permanently.
- Pause during super; resume state is intact.
- Touch twin-stick on a 360 px viewport.
- Route change disposes RAF/audio.
- 20 consecutive matches; no entity or listener leaks.

### Performance

- 60 fps desktop, ≥ 45 fps mobile.
- ≤ 120 draw ops per frame; pooled projectiles.
- No GC spikes from per-frame vector allocation.

---

## 9. Integration plan

1. Add `neon-arena` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `action`, secondary `arcade`/`multiplayer`? **No** — do not label it multiplayer; it is single-player vs bots.
3. Lazy registry entry.
4. Thumbnail + `docs/games/neon-arena.md` with honest “bots only” note.
5. `onComplete` with win/loss and mode.
6. Reuse shared2d helpers.

---

## 10. Known limitations

- No human multiplayer. All opponents and teammates are bots.
- Six fighters and four arenas is a bounded roster.
- Bot behaviour is competent but predictable at high skill.
- Balance is tuned against bots, not a human meta.
- The game is not affiliated with, endorsed by, or derived from Brawl Stars assets.
