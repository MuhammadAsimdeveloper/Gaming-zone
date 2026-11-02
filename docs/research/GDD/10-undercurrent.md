# 10 — Undercurrent

> **Reference genre:** Hades (run-based roguelite with drafted boons).
> **Shortlist rank:** 10 · **Engine:** Canvas 2D · **Complexity:** L · **Wave:** 2
> **Status:** Design only. No implementation has started.

---

## 1. Game design document

### Identity

A top-down roguelite about escaping a drowned signal station. Each run descends through four currents, drafting upgrades from rival entities, fighting room by room, and dying to return stronger. The story is delivered in short original text exchanges between runs, not cutscenes.

Working tagline: *“The current remembers.”*

### Design pillars

1. **Build variance per run.** Four upgrade families create materially different playstyles.
2. **Readable, fast combat.** Dash, attack, special and cast, each with a clear role.
3. **Death is progress.** Meta currency and story advance even on a failed run.
4. **Authored rooms, shuffled order.** Not procedural noise.
5. **Original mythos.** No Greek gods, no copied characters, boons, art or dialogue.

### Target session

- 20–30 minutes per run; 8–15 runs to a first clear.
- Desktop-first; mobile supported.
- Player intent: action mastery with build experimentation.

### Core loop

```
Start run at the Hub → choose a weapon
  → clear 4 currents × 5 rooms
  → choose boons, spend currency, fight elites
  → defeat the Warden of the Deep or die
  → return to Hub, spend residue on permanent upgrades
  → new run
```

### Currents (biomes)

| Current | Theme | Hazard | Elite |
|---|---|---|---|
| Ember | Boiler ruins | Vents | Cinder Hound |
| Tide | Flooded galleries | Rising water | Brine Choir |
| Static | Signal arrays | Arc fields | Null Operator |
| Verdant | Overgrown core | Spores | Root Matron |

### Weapons

| Weapon | Style | Attack | Special | Cast |
|---|---|---|---|---|
| Cutlass | Fast melee | 3-hit combo | Dash slash | Throwing hook |
| Hammer | Slow heavy | Wide arc | Ground pound | Shock mine |
| Coil | Ranged | Bolt volley | Chain lightning | Static orb |

---

## 2. Feature list

### Essential

- Four currents, five rooms each, one final boss.
- Three weapons with distinct move sets.
- Dash with i-frames; attack, special, cast.
- Boon drafting: 3 choices after each room, from 4 families (Ember, Tide, Static, Verdant).
- 24 boons across families; rarity tiers (common/rare/epic).
- 8 enemy types + 4 elites + 1 boss with two phases.
- Health, residue currency, meta upgrades (8 nodes).
- Room reward types: boon, residue, heal, shop.
- Death and victory results; run summary.
- Pause, restart, quit; audio toggles.
- Keyboard/mouse, gamepad, touch.

### Advanced

- Duo boons (specific pairs produce a combined effect).
- Weapon aspects (one alternate mode per weapon).
- Heat-like “Pressure” modifiers after first clear.
- Codex and relationship snippets in the Hub.
- Local best time and clear count.

### Optional

- Daily seeded run.
- Two additional boss variants.
- Cosmetic Hub decorations.

### Explicitly cut

- Voice acting, animated portraits, full narrative branches.
- Online leaderboards or social features.
- Copied Hades gods, boons, weapons, lines or art.
- Live-service seasons or paid currency.

---

## 3. Gameplay architecture

```
src/games/undercurrent/
  UndercurrentGame.tsx  React shell, Hub, boon draft, results
  engine.ts             Fixed-step sim + canvas render
  player.ts             Movement, dash, attack state machine
  weapons.ts            Weapon move sets and hitboxes
  boons.ts              Boon definitions, stacking, synergies
  enemies.ts            Enemy AI and attack patterns
  rooms.ts              Room templates and encounter director
  currents.ts           Biome data and hazards
  meta.ts               Permanent upgrades and residue
  narrative.ts          Original text snippets
  audio.ts              Procedural combat and ambience
  persistence.ts        Meta, codex, records
  *.test.ts             Boon stacking, combat, room completion
```

### Simulation

- Fixed 60 Hz for combat precision.
- Entity cap: player, 20 enemies, 60 projectiles, 30 particles groups.
- Arena is a single screen per room plus door transitions.
- Collision: circles and AABBs; walls from room polygons.
- Determinism for room order, boon offers and enemy spawns via seeded RNG.

### Boon model

```
Boon = {
  id, family, name, rarity, description,
  apply(stats): void,
  onEvent?: (event, state) => void
}
```

- Boons are data + small effect hooks, not arbitrary code from saves.
- Stacking rules: additive for stats, multiplicative for rare damage amps, capped at 3 copies per boon.
- Duo boons require one boon from each of two families and are offered only once.

### Room flow

```
enter → doors lock → spawn waves → clear → reward choice → doors unlock
```

- Encounter director spawns 2–4 waves per room, with a budget based on current power.
- Shop rooms sell heal, boon, or residue conversion.
- Elite rooms guarantee a rare boon.

---

## 4. Engine recommendation

| Concern | Choice | Reason |
|---|---|---|
| Simulation | Custom fixed-step | Tight action needs deterministic timing |
| Rendering | Canvas 2D | Top-down sprites, particles, cheap |
| UI | React DOM | Boon cards, Hub, results |
| Audio | Web Audio synthesis | Zero assets |
| Persistence | LocalStorage | Meta progress and records |

No physics engine. The arena is flat; collision shapes are simple.

---

## 5. Asset requirements

| Asset | How it is made |
|---|---|
| Player/weapons | Original vector sprites with 6–8 frame attacks |
| Enemies | 8 original designs, 4-frame cycles, telegraph flashes |
| Rooms | Tile floors/walls, 4 palettes, props as vector shapes |
| Boons | Inline SVG symbols per family |
| UI | DOM cards with rarity frames |
| Audio | Synth hits, casts, ambience beds |
| Thumbnail | Player vs boss key art |

No copied god portraits, weapon designs or UI frames.

---

## 6. Development milestones

| Milestone | Deliverable | Exit criteria |
|---|---|---|
| M1 — Combat spine | Player, dash, one weapon, one enemy | Attack/dash/i-frames feel correct at 60 fps |
| M2 — Rooms | Room templates, doors, encounters | A five-room current completes |
| M3 — Boons | Draft UI, 12 boons, stacking | Builds materially change damage/survival |
| M4 — Content | 4 currents, 8 enemies, elites | Each current playable end-to-end |
| M5 — Meta/boss | Residue, upgrades, final boss | Death and victory both advance the Hub |
| M6 — Polish/QA | Audio, effects, narrative, mobile | 60 fps desktop, 45+ mobile; QA complete |

---

## 7. Estimated complexity

**L.** ~6,000–7,500 lines. Combat is the core risk; boons multiply test cases. Content is bounded but must be tuned as a system, not level by level.

---

## 8. Testing plan

### Unit

- Boon stacking caps and multiplicative rules.
- Duo boon eligibility and one-time offer.
- Damage and i-frame math.
- Room reward generation excludes invalid options.
- Meta upgrade costs and effects.
- Seeded run determinism for room order and offers.
- Boss phase thresholds.

### Integration

- Complete a run with each weapon.
- Die on each current; meta currency is awarded.
- Draft 20 boons in one run; no duplicate invalid states.
- Shop transactions cannot go negative.
- Pause during boss; no phase skip.
- Route change disposes RAF/audio.

### Performance

- 20 enemies + 60 projectiles at 60 fps desktop, ≥ 45 fps mobile.
- Particle pool capped; no per-frame allocations in combat.

---

## 9. Integration plan

1. Add `undercurrent` to `INTERNAL_GAME_KEYS`.
2. Catalogue: `action`, secondary `adventure`/`casual`.
3. Lazy registry entry; Canvas 2D only.
4. Thumbnail + `docs/games/undercurrent.md`.
5. `onComplete` on run end with clear/failure and current reached.
6. Reuse shared2d loop/input/rng/audio helpers.

---

## 10. Known limitations

- Narrative is short text, not a fully voiced story.
- Four currents and one boss is a compact roguelite, not a 30-hour game.
- Boon combinations are tuned but not exhaustively balanced.
- No online leaderboards; records are local.
- Mobile controls are functional but the game is designed desktop-first.
