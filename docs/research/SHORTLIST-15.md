# The 15-Game Shortlist

> Generated 2026-11-02. **Awaiting approval. No implementation has started.**
>
> This document scores all 50 research targets, applies explicit dependency and portfolio filters, and recommends the 15 games to build next. Scores are judgements for planning, not measured benchmarks.

---

## 1. Scoring model

Each game is scored 1–10 on ten criteria. The weighted total is out of 100.

| Criterion | Weight | What a 10 means |
|---|---:|---|
| Browser feasibility | 20 | Runs well in a modern browser on mid-range mobile without a backend |
| Build ease | 15 | A small team can reach a complete vertical slice quickly |
| Core-loop quality | 15 | The moment-to-moment loop is proven and readable |
| Visual potential | 10 | Strong original visuals are achievable with procedural/original art |
| Mobile compatibility | 10 | Touch controls and small screens are natural |
| Performance headroom | 5 | Stable frame rate with modest assets and no heavy simulation |
| Zero-budget fit | 5 | No licensing, paid assets, servers or paid services |
| Replayability | 10 | High session-to-session variance or score chase |
| Audience appeal | 8 | Broad, durable audience on a general games portal |
| Legal/asset safety | 2 | Fully implementable with original names, art and layouts |

**Raw score** is the weighted total. **Adjustment** captures two things the ten criteria do not fully express:

- **Dependency penalty** — the design's core fun needs real-time humans or a backend the static site does not have.
- **Portfolio penalty** — the game duplicates a category NeonRift already ships.

Adjustments are deliberately small except where the dependency changes the product (Among Us) or the game is a near-duplicate (Temple Run).

---

## 2. Full 50-game matrix

Legend: **BF** browser feasibility, **Ease** build ease, **Loop** core loop, **Vis** visual potential, **Mob** mobile, **Perf** performance headroom, **Cost** zero-budget fit, **Rep** replayability, **Aud** audience, **Legal** asset/legal safety.

| Rank | Game | BF | Ease | Loop | Vis | Mob | Perf | Cost | Rep | Aud | Legal | Raw | Adj | Final |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Chess.com | 10 | 9 | 9 | 8 | 10 | 10 | 10 | 10 | 10 | 9 | 94.8 | 0 | 94.8 |
| 2 | Subway Surfers | 9 | 7 | 8 | 8 | 10 | 8 | 8 | 9 | 9 | 8 | 84.3 | 0 | 84.3 |
| 3 | Terraria | 9 | 7 | 10 | 7 | 7 | 7 | 7 | 10 | 9 | 9 | 83.5 | 0 | 83.5 |
| 4 | Plants vs. Zombies | 8 | 7 | 9 | 8 | 9 | 9 | 8 | 9 | 9 | 8 | 83.3 | 0 | 83.3 |
| 5 | Trackmania | 8 | 7 | 9 | 8 | 7 | 7 | 7 | 10 | 8 | 9 | 80.2 | 0 | 80.2 |
| 6 | Clash Royale | 8 | 6 | 9 | 8 | 9 | 8 | 7 | 10 | 9 | 7 | 81.6 | −2 | 79.6 |
| 7 | Brawl Stars | 8 | 6 | 9 | 8 | 9 | 8 | 7 | 9 | 9 | 7 | 80.6 | −2 | 78.6 |
| 8 | Minecraft | 8 | 6 | 10 | 7 | 6 | 5 | 6 | 10 | 10 | 8 | 78.1 | 0 | 78.1 |
| 9 | Minecraft Dungeons | 8 | 6 | 8 | 7 | 7 | 6 | 6 | 9 | 9 | 7 | 74.6 | 0 | 74.6 |
| 10 | Hades | 6 | 5 | 10 | 9 | 6 | 6 | 5 | 10 | 9 | 8 | 73.8 | 0 | 73.8 |
| 11 | Hollow Knight | 6 | 5 | 10 | 9 | 6 | 6 | 5 | 9 | 9 | 8 | 72.8 | 0 | 72.8 |
| 12 | The Sims 4 | 7 | 5 | 8 | 7 | 6 | 6 | 6 | 9 | 9 | 5 | 69.7 | 0 | 69.7 |
| 13 | Temple Run | 8 | 7 | 7 | 7 | 9 | 8 | 8 | 8 | 8 | 8 | 77.0 | −8 | 69.0 |
| 14 | Cricket 24 | 7 | 5 | 7 | 7 | 7 | 6 | 6 | 8 | 9 | 8 | 68.8 | 0 | 68.8 |
| 15 | Don't Starve | 6 | 5 | 8 | 8 | 6 | 6 | 5 | 9 | 8 | 8 | 68.0 | 0 | 68.0 |
| 16 | Free Fire | 6 | 5 | 8 | 7 | 10 | 5 | 5 | 9 | 9 | 4 | 70.5 | −6 | 64.5 |
| 17 | Clash of Clans | 5 | 4 | 8 | 7 | 10 | 6 | 3 | 9 | 9 | 4 | 66.5 | −2 | 64.5 |
| 18 | Stardew Valley | 5 | 4 | 8 | 7 | 7 | 6 | 4 | 9 | 8 | 8 | 64.0 | 0 | 64.0 |
| 19 | Rocket League | 6 | 4 | 10 | 8 | 4 | 3 | 3 | 9 | 10 | 7 | 66.4 | −4 | 62.4 |
| 20 | Genshin Impact | 6 | 3 | 8 | 9 | 8 | 4 | 2 | 8 | 9 | 3 | 64.3 | −3 | 61.3 |
| 21 | Left 4 Dead 2 | 6 | 5 | 9 | 8 | 3 | 3 | 3 | 9 | 8 | 4 | 63.2 | −3 | 60.2 |
| 22 | Cities: Skylines | 6 | 4 | 8 | 7 | 4 | 4 | 4 | 8 | 7 | 6 | 59.8 | 0 | 59.8 |
| 23 | Counter-Strike 2 | 5 | 4 | 10 | 8 | 2 | 3 | 3 | 9 | 10 | 3 | 61.6 | −3 | 58.6 |
| 24 | Euro Truck Simulator 2 | 6 | 5 | 7 | 7 | 3 | 5 | 5 | 7 | 6 | 8 | 58.4 | 0 | 58.4 |
| 25 | Among Us | 4 | 7 | 8 | 6 | 8 | 7 | 7 | 8 | 9 | 7 | 68.1 | −10 | 58.1 |
| 26 | Elden Ring | 4 | 2 | 10 | 9 | 2 | 3 | 2 | 9 | 10 | 3 | 57.1 | 0 | 57.1 |
| 27 | Roblox | 4 | 1 | 8 | 6 | 9 | 5 | 2 | 10 | 10 | 3 | 58.6 | −2 | 56.6 |
| 28 | VALORANT | 5 | 3 | 9 | 9 | 2 | 3 | 3 | 9 | 10 | 3 | 59.6 | −4 | 55.6 |
| 29 | Apex Legends | 5 | 3 | 9 | 9 | 2 | 3 | 3 | 9 | 9 | 3 | 58.8 | −4 | 54.8 |
| 30 | Fall Guys | 4 | 3 | 9 | 9 | 3 | 3 | 2 | 8 | 9 | 6 | 56.9 | −3 | 53.9 |
| 31 | DOOM Eternal | 4 | 3 | 9 | 8 | 2 | 3 | 2 | 7 | 8 | 3 | 52.5 | 0 | 52.5 |
| 32 | Farming Simulator | 4 | 3 | 7 | 7 | 4 | 4 | 3 | 8 | 7 | 6 | 52.3 | 0 | 52.3 |
| 33 | NBA 2K | 4 | 3 | 8 | 8 | 4 | 3 | 1 | 8 | 9 | 2 | 54.1 | −2 | 52.1 |
| 34 | eFootball | 3 | 3 | 8 | 8 | 6 | 3 | 1 | 8 | 9 | 1 | 53.9 | −2 | 51.9 |
| 35 | Civilization VI | 3 | 2 | 9 | 8 | 3 | 3 | 1 | 9 | 8 | 5 | 51.9 | 0 | 51.9 |
| 36 | Need for Speed Heat | 4 | 3 | 8 | 8 | 3 | 3 | 2 | 8 | 9 | 2 | 53.6 | −2 | 51.6 |
| 37 | Age of Empires II | 3 | 2 | 9 | 8 | 2 | 3 | 1 | 9 | 8 | 5 | 50.9 | 0 | 50.9 |
| 38 | Teardown | 4 | 3 | 8 | 6 | 2 | 2 | 3 | 8 | 7 | 8 | 50.2 | 0 | 50.2 |
| 39 | BeamNG.drive | 5 | 3 | 7 | 6 | 2 | 2 | 3 | 7 | 7 | 8 | 49.7 | 0 | 49.7 |
| 40 | Breath of the Wild | 2 | 1 | 10 | 9 | 2 | 2 | 1 | 8 | 10 | 2 | 49.4 | 0 | 49.4 |
| 41 | Forza Horizon 5 | 2 | 2 | 10 | 10 | 2 | 2 | 1 | 9 | 10 | 2 | 52.9 | −4 | 48.9 |
| 42 | Subnautica | 2 | 2 | 9 | 9 | 2 | 2 | 1 | 8 | 8 | 6 | 48.6 | 0 | 48.6 |
| 43 | The Witcher 3 | 2 | 1 | 10 | 9 | 1 | 2 | 1 | 8 | 9 | 3 | 47.8 | 0 | 47.8 |
| 44 | Grand Theft Auto V | 2 | 1 | 10 | 10 | 2 | 1 | 1 | 8 | 10 | 2 | 49.9 | −4 | 45.9 |
| 45 | Fortnite | 2 | 1 | 9 | 9 | 4 | 2 | 1 | 8 | 10 | 2 | 49.9 | −4 | 45.9 |
| 46 | Red Dead Redemption 2 | 1 | 1 | 10 | 10 | 1 | 1 | 1 | 7 | 9 | 2 | 45.1 | 0 | 45.1 |
| 47 | PUBG | 2 | 1 | 9 | 9 | 2 | 1 | 1 | 9 | 10 | 2 | 48.4 | −4 | 44.4 |
| 48 | EA Sports FC | 2 | 2 | 9 | 9 | 3 | 2 | 1 | 8 | 10 | 1 | 50.2 | −6 | 44.2 |
| 49 | Call of Duty: Warzone | 2 | 1 | 9 | 9 | 2 | 1 | 1 | 8 | 9 | 2 | 46.6 | −4 | 42.6 |
| 50 | Assetto Corsa | 2 | 1 | 9 | 9 | 1 | 2 | 1 | 8 | 7 | 2 | 44.5 | −2 | 42.5 |

### Adjustment rationale

| Game | Adj | Reason |
|---|---:|---|
| Clash Royale, Brawl Stars | −2 | Real PvP needs authoritative servers; bots make a complete single-player version, so the penalty is small |
| Temple Run | −8 | Near-duplicate of Subway Surfers; portfolio redundancy |
| Free Fire | −6 | Battle-royale netcode is the product; bot-only play degrades it |
| Among Us | −10 | Core fun requires 4+ humans; AI crewmates change the game |
| Clash of Clans | −2 | Async raids work, but content volume across Town Hall tiers is large |
| Rocket League | −4 | Overlaps Rift Striker; high-tick car-ball netcode |
| Genshin Impact | −3 | Live-service/gacha economy has no zero-budget equivalent |
| Left 4 Dead 2, CS2, VALORANT, Apex | −3/−4 | Netcode and content volume |
| Fall Guys | −3 | 60-player networked physics; AI slice is smaller |
| Forza, NFS, GTA, Fortnite, PUBG, Warzone, EA FC | −2 to −6 | Licensed/scale plus overlap with existing NeonRift 3D games |
| Cricket 24 | 0 | Scored as an **original arcade cricket game with fictional teams**, not a licensed sim; that removes the licensing penalty |
| Clash Royale Clone etc. | — | OSS availability affects build confidence, already reflected in Ease |

---

## 3. Selection filters

The adjusted ranking is not the final list. Four filters remove games that score well but are wrong for this portfolio:

1. **No direct duplicates.** Temple Run (#13) is removed because Subway Surfers (#2) covers the same endless-runner loop. One runner is enough.
2. **No core human dependency.** Among Us (#25) is removed. Its rules are cheap; its fun is not. Without persistent servers and 4+ players, it becomes a weaker single-player game. Fall Guys (#30) is also excluded for the same reason.
3. **No real-time netcode as the core product.** Free Fire (#16) is removed. Clash Royale and Brawl Stars stay because a bot-driven single-player version is a genuinely complete game, and the architecture can later support human matches.
4. **No category duplication with existing NeonRift games.** Rocket League (#19) is removed (Rift Striker), and Forza/NFS are not selected (Neon Apex). Trackmania stays because time trial + ghost + track editor is a different loop from street racing with AI opponents.

Applying these filters promotes **Clash of Clans (#17)** into the final 15.

---

## 4. The recommended 15

Ordered by final score after filters. This is a **rank**, not the build sequence — the actual build order follows the waves in section 5, so several lower-ranked, smaller games ship before Strata.

| # | Original reference | NeonRift concept (working name) | Genre | Final | Complexity | Engine |
|---|---|---|---:|---|---|---|
| 1 | Chess.com | **Rift Chess** | Board / strategy | 94.8 | S | React DOM + chess.js + js-chess-engine |
| 2 | Subway Surfers | **Neon Rush** | Endless runner | 84.3 | S–M | Three.js (reuse existing 3D foundation) |
| 3 | Terraria | **Strata** | 2D sandbox / crafting | 83.5 | L | Canvas 2D tile engine |
| 4 | Plants vs. Zombies | **Lawn Protocol** | Lane tower defence | 83.3 | M | Canvas 2D + DOM UI |
| 5 | Trackmania | **Apex Time Trial** | Precision time trial | 80.2 | M | Three.js (reuse racing engine) |
| 6 | Clash Royale | **Rift Tactics** | Deck / lane arena | 79.6 | M | Canvas 2D fixed-tick simulation |
| 7 | Brawl Stars | **Neon Arena** | Top-down arena shooter | 78.6 | M | Canvas 2D |
| 8 | Minecraft | **Voxel Rift** | 3D creative sandbox | 78.1 | XL | Three.js + Web Worker chunk meshing |
| 9 | Minecraft Dungeons | **Rift Delve** | Isometric action RPG | 74.6 | L | Three.js |
| 10 | Hades | **Undercurrent** | Run-based roguelite | 73.8 | L | Canvas 2D |
| 11 | Hollow Knight | **Hollow Signal** | 2D action platformer | 72.8 | L | Canvas 2D |
| 12 | The Sims 4 | **Habitat** | Life / agent simulation | 69.7 | L | Canvas 2D isometric + DOM UI |
| 13 | Cricket 24 | **Street Cricket** | Arcade cricket | 68.8 | M | Three.js + timing UI |
| 14 | Don't Starve | **Nightfall** | Survival | 68.0 | M–L | Canvas 2D |
| 15 | Clash of Clans | **Rift Hold** | Base building / async raid | 64.5 | L | Canvas 2D isometric + DOM UI |

### Why this set

- **Genre coverage:** board, runner, sandbox (2D and 3D), tower defence, time trial, two arena variants, dungeon crawler, roguelite, platformer, life sim, sports, survival and base building. No two entries share the same core verb except the two sandboxes and the two arenas, which differ in perspective and session shape.
- **Risk spread:** five small games (Chess, runner, tower defence, time trial, cricket) can ship early and prove the pipeline. The large games come later.
- **No backend requirement:** every one of the 15 can ship as a complete single-player experience with local persistence. Clash Royale and Brawl Stars use bots; Clash of Clans uses AI raids.
- **Legal safety:** all 15 use original names, original art, original level layouts and no licensed teams, characters, music or logos.
- **Reuse:** Trackmania reuses the racing engine; Cricket reuses the football/3D camera foundation; the runner and arena games reuse the existing Three.js lifecycle and input patterns.

---

## 5. Build waves

Waves are **sequential**. Finish and QA each game before starting the next. A wave is a planning horizon, not parallel work.

### Wave 1 — quick wins (prove the pipeline)

1. **Rift Chess** — rules-first, low art cost, strong retention. Adds a strategy category.
2. **Neon Rush** — three-lane runner; reuses the 3D scene lifecycle; strong mobile fit.
3. **Lawn Protocol** — lane tower defence; cheap state machines; strong session loop.
4. **Apex Time Trial** — time trial + ghost + track editor; reuses Neon Apex.
5. **Street Cricket** — original arcade cricket; timing-based, no licence.

### Wave 2 — medium builds (systems and content)

6. **Rift Tactics** — fixed-tick lane arena with bots and a deck.
7. **Neon Arena** — top-down arena shooter with bots.
8. **Rift Delve** — isometric dungeon crawler with procedural rooms.
9. **Undercurrent** — room-based roguelite with drafted upgrades.
10. **Nightfall** — survival meters, day/night and crafting.

### Wave 3 — large builds (content-heavy)

11. **Strata** — 2D tile sandbox with mining, crafting and boss gates.
12. **Habitat** — life simulation with needs, schedules and build mode.
13. **Hollow Signal** — 2D action platformer with ability gates.
14. **Voxel Rift** — 3D creative sandbox with chunk meshing.
15. **Rift Hold** — base building and asynchronous AI raids.

---

## 6. Deferred and rejected

| Game | Final | Decision | Why |
|---|---:|---|---|
| Temple Run | 69.0 | Deferred | Duplicate of Subway Surfers |
| Free Fire | 64.5 | Rejected as a shortlist game | Battle-royale netcode is the product |
| Among Us | 58.1 | Rejected | Needs 4+ humans; AI version is a different game |
| Fall Guys | 53.9 | Deferred | 60-player physics; a smaller AI course could be a future mode |
| Rocket League | 62.4 | Deferred | Overlaps Rift Striker; car-ball netcode |
| Stardew Valley | 64.0 | Deferred | Overlaps Habitat's life-sim space; farming could be a Habitat expansion |
| Cities: Skylines | 59.8 | Deferred | Viable but lower score than Rift Hold for the builder slot |
| Genshin Impact | 61.3 | Rejected | Live-service/gacha economy |
| Left 4 Dead 2 | 60.2 | Deferred | Could become a co-op mode later; not a first 15 |
| CS2 / VALORANT / Apex | 58.6 / 55.6 / 54.8 | Rejected | Competitive netcode and content volume |
| Elden Ring | 57.1 | Deferred | Better as a 2D soulslike later |
| Everything below 55 | — | Rejected | Browser fit or dependency cost too high |

---

## 7. No-go features

These are explicitly out of scope for all 15, regardless of the reference game:

- Real-time authoritative multiplayer, matchmaking, anti-cheat or dedicated servers.
- Licensed teams, players, kits, logos, characters, music or broadcast packages.
- Gacha, loot boxes, paid currency or any monetisation that requires a backend.
- Open-world streaming at console scale, 60-player networked physics or 100-bot battle royales.
- Extracted or converted assets from any commercial game.
- Reproduced copyrighted maps, levels, UI layouts or character designs.
- Fake gameplay, dead buttons, placeholder worlds or "coming soon" screens presented as complete.

---

## 8. Approval gate

**Your decision is required before any implementation.**

Reply with one of:

- **Approve all 15** — I will begin with Rift Chess and complete it before starting Neon Rush.
- **Approve with changes** — name the games to add, remove or reorder.
- **Approve a smaller first wave** — e.g. Wave 1 only (five games).

Until approval: no game code, no new dependencies, no asset downloads, no repository changes and no public deployment.
