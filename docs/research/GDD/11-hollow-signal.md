# 11 — Hollow Signal

> **Reference genre:** Hollow Knight (2D action platformer / metroidvania).
> **Shortlist rank:** 11 · **Engine:** Canvas 2D · **Complexity:** L · **Wave:** 3
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A hand-built 2D action platformer through a buried transmission network. The player is a signal-runner descending into six connected zones, gaining movement abilities that reopen earlier routes, and fighting five bosses. The art direction is original: bone-white architecture, cyan signal light, deep ink backgrounds.

Working tagline: *“Follow the signal down.”*

### Design pillars

1. **Movement is the reward.** Every ability changes how the map is traversed, not just a stat.
2. **Precise, fair combat.** Telegraphs, hitstop and knockback are tuned; no random damage.
3. **One connected map.** Six zones, ~40 rooms, no procedural generation.
4. **Readable at 320 px.** Silhouettes and contrast carry the art.
5. **Honest scope.** One ending, five bosses, no endless content.

### Target session

- 2–4 hours to finish.
- Desktop-first; controller recommended; mobile supported.
- Player intent: exploration, mastery, atmosphere.

### Core loop

```
Explore → fight → find ability → unlock shortcut/route
  → return to earlier zone → defeat boss → descend
  → final zone → ending
```

### Zones

| Zone | Theme | Ability gained | Boss |
|---|---|---|---|
| Relay Surface | Wind-bent antennae | Dash | Warden of Wires |
| Ossuary | Bone catacombs | Wall cling | The Choir |
| Capacitor | Flooded cells | Double jump | Arc Bishop |
| Weave | Signal threads | Phase dash | The Loom |
| Dead Air | Silent void | — | Twin Nulls |
| Core | Final transmission | — | The Carrier |

---

## 2. Feature list

### Essential

- Six zones, ~40 authored rooms, one connected map.
- Tight platforming: coyote time, jump buffer, variable jump height.
- Melee nail-like attack in four directions; ranged “pulse” with cooldown.
- Dash, wall cling/jump, double jump, phase dash as gates.
- Health (masks), soul-like charge from hits, heal spend.
- Five bosses with 2–3 phases and telegraphed patterns.
- Checkpoints (benches), currency drop on death and recovery.
- Map with fog and room discovery.
- Five equippable “signals” (charms) with trade-offs.
- Pause, restart from checkpoint, quit; audio toggles.
- Keyboard, gamepad and touch controls.

### Advanced

- Secret rooms (6) and a hidden final upgrade.
- Boss rematch gate.
- Lore fragments (original text) and a completion percentage.
- Assist options: damage reduction, slower projectiles, longer coyote time.
- Speedrun timer toggle.

### Optional

- Additional signal slots via a late upgrade.
- Two optional mini-bosses.
- Photo mode.

### Explicitly cut

- Procedural maps, infinite content, online play.
- Copied Hollow Knight characters, zones, charms, art, music or map layouts.
- Voice acting and cinematic cutscenes.
- Multiple endings beyond the hidden upgrade variant.

---

## 3. Gameplay architecture

```
src/games/hollow-signal/
  HollowSignalGame.tsx  React shell, menus, map, inventory
  engine.ts             Fixed-step physics + canvas render
  player.ts             Movement, abilities, attack state machine
  combat.ts             Hitboxes, damage, knockback, hitstop
  enemies.ts            Enemy types and AI
  bosses.ts             Boss patterns and phase scripts
  rooms.ts              Authored room data and transitions
  map.ts                Room graph and fog-of-war
  signals.ts            Equippable modifiers
  audio.ts              Procedural ambience and combat cues
  persistence.ts        Save, currency, discovered rooms
  *.test.ts             Physics, combat, gates, save
```

### Platformer physics

- Fixed 60 Hz; render interpolation.
- Player AABB 0.7 × 1.5 tiles; tile 32 px.
- Gravity 2,200 px/s²; jump velocity 720; variable jump cut at 0.45.
- Coyote time 0.09 s; jump buffer 0.12 s.
- Dash: 0.18 s, 620 px/s, i-frames 0.12 s, cooldown 0.5 s.
- Wall cling: slide 120 px/s; wall jump 520 px/s horizontal.
- Hitstop: 60 ms on player hit, 40 ms on enemy hit.

### Room model

- Each room is a tile collision grid plus spawn/trigger entities.
- Doors connect by id; transitions fade and reposition the player.
- Camera clamps to room bounds in small rooms, follows with look-ahead in large rooms.
- Rooms are authored data, not generated.

### Save

- Checkpoint id, health upgrades, abilities, signals, currency, defeated bosses, discovered rooms, lore flags.
- Versioned payload; unknown version resets with confirmation.
- Death drops currency at the death room; one recovery run.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Physics | Custom fixed-step AABB | Precision platforming needs authored constants |
| Rendering | Canvas 2D | Crisp silhouettes, parallax, cheap effects |
| UI | React DOM | Menus and map |
| Audio | Web Audio synthesis | No licensed music |
| Persistence | LocalStorage | Small save |

No physics engine. A general engine would obscure the exact feel constants this genre depends on.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Player | Original 12-frame sprite set drawn procedurally from vector shapes |
| Enemies | 10 original designs, 4–6 frames each |
| Tiles | 4 tilesets (surface, bone, capacitor, weave), 16 × 16 source scaled ×2 |
| Backgrounds | 3 parallax layers per zone |
| Bosses | Large vector sprites with phase colour shifts |
| UI | Inline SVG |
| Audio | Synth drones, hits, pulses |
| Thumbnail | Player silhouette before a boss |

No copied Knight, bugs, charms, zone art or music. Palette: bone, ink, cyan, amber.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Movement | Run, jump, attack, collision | Feel constants tuned; no wall clipping |
| M2 — Rooms | Tile rooms, doors, camera, transitions | Three connected rooms traverse correctly |
| M3 — Combat | Enemies, health, soul, heal | Combat loop and death/respawn work |
| M4 — Abilities | Dash, wall cling, double jump, phase dash | Each ability unlocks a gated route |
| M5 — Content | 6 zones, 40 rooms, 5 bosses | Game completable start to ending |
| M6 — Meta/polish | Map, signals, lore, assist options | Save persists all flags |
| M7 — QA | Controller/touch, performance, balance | 60 fps desktop, 45+ mobile; QA complete |

---

## 7. Estimated complexity

**L.** ~8,000–10,000 lines and the largest hand-authored content load before Strata. Room authoring and boss tuning dominate. The technical foundation is small.

---

## 8. Testing plan

### Unit

- Jump apex/time under fixed step.
- Coyote time and jump buffer windows.
- Dash i-frames and cooldown.
- Wall cling/jump conditions.
- Hitbox overlap and knockback direction.
- Ability gates: a route is impossible without the ability.
- Save roundtrip with all flags.

### Integration

- Traverse each zone and defeat each boss.
- Die, recover currency, and confirm the drop disappears after recovery.
- Map reveals rooms in the correct shape.
- Assist options change the documented values.
- Pause during boss; no pattern skip.
- Route change disposes RAF/audio.

### Performance

- 60 fps desktop, ≥ 45 fps mobile.
- Parallax layers pre-rendered; no per-frame allocation in the physics loop.
- Room transition < 120 ms.

---

## 9. Integration plan

1. Add `hollow-signal` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `adventure`, secondary `action`.
3. Lazy registry entry; Canvas 2D only.
4. Thumbnail + `docs/games/hollow-signal.md` with a spoiler-free map note.
5. `onComplete` on final boss defeat.
6. Reuse shared2d loop/input/canvas helpers.

---

## 10. Known limitations

- One large hand-authored map; no procedural replay.
- Five bosses and ten enemy types is a compact metroidvania.
- Art is stylised vector work, not hand-painted animation.
- No online features or leaderboards.
- Mobile controls are supported but a controller is recommended for bosses.
- Assist options are documented as accessibility aids, not a difficulty guarantee.
