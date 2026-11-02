# Game Design Documents — the 15-game shortlist

> Generated 2026-11-02. **Design only. No game code has been written for these 15.**
>
> Every GDD is a clean-room design: original names, original art direction, original layouts and mechanics implemented from general genre concepts. No commercial assets, code, maps, characters or branding are used.

---

## Index

| # | Game | Genre | Engine | Complexity | Wave | GDD |
|---|---|---|---|---|---|---|
| 1 | Rift Chess | Board / strategy | React DOM + SVG | S | 1 | [01-rift-chess.md](01-rift-chess.md) |
| 2 | Neon Rush | Endless runner | Three.js | S–M | 1 | [02-neon-rush.md](02-neon-rush.md) |
| 3 | Strata | 2D sandbox / crafting | Canvas 2D | L | 3 | [03-strata.md](03-strata.md) |
| 4 | Lawn Protocol | Lane tower defence | Canvas 2D + DOM | M | 1 | [04-lawn-protocol.md](04-lawn-protocol.md) |
| 5 | Apex Time Trial | Precision time trial | Three.js | M | 1 | [05-apex-time-trial.md](05-apex-time-trial.md) |
| 6 | Rift Tactics | Deck / lane arena | Canvas 2D | M | 2 | [06-rift-tactics.md](06-rift-tactics.md) |
| 7 | Neon Arena | Top-down arena shooter | Canvas 2D | M | 2 | [07-neon-arena.md](07-neon-arena.md) |
| 8 | Voxel Rift | 3D creative sandbox | Three.js + Worker | XL | 3 | [08-voxel-rift.md](08-voxel-rift.md) |
| 9 | Rift Delve | Isometric action RPG | Three.js | L | 2 | [09-rift-delve.md](09-rift-delve.md) |
| 10 | Undercurrent | Run-based roguelite | Canvas 2D | L | 2 | [10-undercurrent.md](10-undercurrent.md) |
| 11 | Hollow Signal | 2D action platformer | Canvas 2D | L | 3 | [11-hollow-signal.md](11-hollow-signal.md) |
| 12 | Habitat | Life / agent simulation | Canvas 2D isometric + DOM | L | 3 | [12-habitat.md](12-habitat.md) |
| 13 | Street Cricket | Arcade cricket | Three.js + DOM | M | 1 | [13-street-cricket.md](13-street-cricket.md) |
| 14 | Nightfall | Survival | Canvas 2D | M–L | 2 | [14-nightfall.md](14-nightfall.md) |
| 15 | Rift Hold | Base building / async raid | Canvas 2D isometric + DOM | L | 3 | [15-rift-hold.md](15-rift-hold.md) |

---

## What every GDD contains

Each document follows the master-prompt deliverable list:

1. Game design document (identity, pillars, core loop, modes, scope boundary).
2. Feature list split into essential / advanced / optional / explicitly cut.
3. Gameplay architecture (module layout, simulation contract, state flow).
4. Engine recommendation with a reason and a dependency gate.
5. Asset requirements — all procedural or original.
6. Development milestones with exit criteria.
7. Estimated complexity.
8. Testing plan (unit, integration, performance).
9. Integration plan into the NeonRift catalogue and player shell.
10. Known limitations, stated honestly.

---

## Cross-document rules

- **No new engine dependency** is required for any of the 15.
- **No backend** is required. Persistence is LocalStorage, except Voxel Rift, which uses IndexedDB for multiple builds (a browser API, not a server).
- **No real-time multiplayer.** Games with arena or raid formats use bots or generated rivals and say so in their catalogue copy.
- **No fake completion.** A game is only marked complete when its essential feature list, QA gates and integration checks pass.
- **No licensed assets.** All art, audio and level data is generated in-repo or built from original shapes.

---

## Build order

Waves are sequential. Finish and QA each game before starting the next.

- **Wave 1:** Rift Chess → Neon Rush → Lawn Protocol → Apex Time Trial → Street Cricket.
- **Wave 2:** Rift Tactics → Neon Arena → Rift Delve → Undercurrent → Nightfall.
- **Wave 3:** Strata → Habitat → Hollow Signal → Voxel Rift → Rift Hold.

See [../ROADMAP.md](../ROADMAP.md) for the phase plan and [../SHORTLIST-15.md](../SHORTLIST-15.md) for the scoring rationale.
