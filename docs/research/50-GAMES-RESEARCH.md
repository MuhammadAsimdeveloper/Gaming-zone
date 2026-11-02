# Top 50 Commercial Games — Clean-Room Research Report

> Prepared 2026-11-02 for NeonRift. Depth: deep. Scope: 50 commercial reference games, 21 candidate repositories, 12 engines/tools and 2 hosting plans.
>
> **Status: research complete; shortlist awaiting your approval. No new game implementation has started.**

---

## TL;DR

1. **Browser feasibility is not evenly distributed.** Twenty of the 50 reference games score 1–2/5 for a zero-budget clean-room build. The strongest opportunities are deterministic, content-light, 2D or stylised-3D loops: chess (5/5), Terraria-like sandbox (5/5), Subway Surfers-like runner (5/5), Minecraft-like voxel sandbox (4/5), Trackmania-like time trial (4/5), Clash Royale-like arena (4/5), Brawl Stars-like arena (4/5) and Plants vs. Zombies-like lane defence (4/5).
2. **Technology is rarely the blocker; content and netcode are.** Voxel rendering, tilemaps, 2D physics and stylised 3D all run in modern browsers. What kills projects is art volume, animation volume, live-service content and authoritative multiplayer.
3. **Licensing cannot be cloned away.** Sports titles (EA FC, eFootball, Cricket 24, NBA 2K) and licensed open worlds are out of scope for a zero-budget original studio. The correct move is genre-level arcade abstraction, not imitation of licensed presentation.
4. **Multiplayer-dependent designs are a trap without a backend.** Among Us is rules-cheap but fun-expensive: it needs four or more humans. A single-player version with AI crewmates is a different, weaker product.
5. **The seed repository list needs correction.** `trigger-rally/trigger-rally` and `3dcity/3dcity` return 404 and are not verified. BrowserQuest is archived/deprecated. Hextris is GPL-3.0 despite GitHub reporting `NOASSERTION`.
6. **Only a handful of permissive, directly useful codebases were verified:** chess.js (BSD-2), js-chess-engine and chessboard.js (MIT), Tiny Strike (ISC), Clash Royale Clone (MIT, C++ headless), Among Us web clone (MIT), plus the existing Three.js/React/Vite/Tailwind stack (MIT).
7. **The current NeonRift portfolio already covers three of the highest-value 3D categories.** Neon Apex (arcade street racing), Rift Striker (3D football) and Neon City Drive (compact open-world driving) overlap Forza/NFS, EA FC and GTA. New work should avoid duplicating them.

---

## Executive summary

This report studies 50 commercial games as **research targets**, not as material to copy. For each game it records the official site, available media, mechanics, modes, controls, progression, physics/AI, multiplayer, engagement drivers and a browser-feasibility score. It then records whether a verified open-source alternative exists and what that alternative actually is.

The central conclusion is that **the browser is a strong platform for small, deterministic, highly replayable systems** and a weak platform for content-heavy simulations, licensed sports and large-scale real-time multiplayer. The best clean-room opportunities are not "the biggest games made smaller"; they are **different games built from the same reusable loops**—a tile sandbox, a fixed-tick arena, a wave director, a run-based roguelite, an endless runner or a turn-based board game.

Three portfolio realities shape the recommendation:

- NeonRift already ships **seven 2D games** (snake, tic-tac-toe, memory, rock-paper-scissors, reaction time, brick breaker, math sprint) and **three 3D games** (racing, football, open-world driving). The marginal value of a fourth racing or football game is low.
- The platform's strengths are **instant play, no account, local persistence and a single reusable player shell**. Games that depend on accounts, servers or live operations fight the platform rather than fit it.
- The zero-budget constraint is real. Cloudflare Pages free and GitHub Free are sufficient for static delivery, but there is **no verified free authoritative real-time multiplayer service** in this stack. Any design that assumes one is mis-scoped.

The recommended shortlist (scored in [SHORTLIST-15.md](SHORTLIST-15.md)) therefore favours **single-player, deterministic, locally persisted games with high replayability and original procedural art**. The final selection is deliberately weighted toward genres the current portfolio does not cover.

---

## Methodology

### Pipeline

| Stage | What was done | Output |
|---|---|---|
| Scope | Clarified existing games, deliverable format and verification priority | Three existing 3D games treated as built; modular docs; verification prioritised |
| Retrieval | Five parallel research agents, ten games each, with search/fetch budgets | Per-game evidence notes for all 50 |
| Repository verification | GitHub API metadata for 21 candidate repositories | Existence, language, SPDX licence, archive status, last push |
| Tool and hosting verification | Official sites and GitHub licence files for 12 engines/libraries; Cloudflare and GitHub plan pages | Licence and free-tier audit |
| Citation spot-check | Ten high-risk claims checked against their cited sources | Verdicts recorded in [SOURCES.md](SOURCES.md) and the verification log below |
| Synthesis | Cross-checking, scoring, shortlist and GDD planning | This report, the shortlist and the GDD set |

### Evidence labels

- **[verified]** — seen on the cited official page or repository during this pass.
- **[analyst]** — genre knowledge or reasonable inference, clearly not a quote from the source.
- **[unverified]** — commonly stated but not confirmed by a fetched source in this pass.

### Source tiers

- **T1** — official game site, official documentation or official repository.
- **T2** — reputable outlet, reference work or store page.
- **T3** — community wiki, listing or unverified secondary source.

A listed source does not mean every claim on it was verified. The exact claim-level caveats live in the group files and the verification log.

### What this report does not claim

- It does not claim that any commercial game can be legally copied. It cannot.
- It does not claim that any candidate repository is a complete game. Most are prototypes, libraries or server reimplementations.
- It does not claim performance numbers that were not measured. All performance statements are budgets or inferences, not benchmarks.
- It does not claim that Cloudflare Pages has unlimited bandwidth or requests; the official limits page did not state those figures.

---

## Current NeonRift portfolio

| Layer | What exists | Implication |
|---|---|---|
| 2D games (7) | Snake, Tic-Tac-Toe, Memory, Rock-Paper-Scissors, Reaction Time, Brick Breaker, Math Sprint | Casual/arcade coverage is already broad; new 2D work must add a distinct loop, not another variant |
| 3D games (3) | Neon Apex (street racing), Rift Striker (football), Neon City Drive (open-world driving) | Racing, football and driving categories are covered at prototype-to-playable quality |
| Shared systems | Typed catalogue, lazy game registry, reusable player, favourites, recents, local best scores, toast, preferences | A new game can integrate in one registry entry plus a metadata record |
| Security | External URL allowlist, iframe sandbox, env-gated ads/analytics | No new backend or secret is required for single-player games |
| Hosting | Static Vite build, Cloudflare Pages target | Games must be fully client-side or use an explicitly approved service |

**Portfolio rule for selection:** a new game must either (a) cover a genre with no current entry, or (b) be a clearly better implementation of an existing genre with a distinct hook. "Another racer" and "another football game" fail this test by default.

---

## The 50-game index

Feasibility is a 1–5 browser-fit score for a **zero-budget clean-room implementation**, not a quality score for the original game. "OSS" marks whether a verified open-source alternative was found.

### A. Open-world, sandbox and simulation

| # | Game | Official link | Fit | OSS | Note |
|---|---|---|---|---|---|
| 1 | Grand Theft Auto V | [rockstargames.com/gta-v](https://www.rockstargames.com/gta-v) | 1 | No | City scale, streaming, vehicles, ragdolls and content volume |
| 2 | Minecraft | [minecraft.net](https://www.minecraft.net/en-us) | 4 | Yes | Luanti (LGPL code, CC-BY-SA media) |
| 3 | Roblox | [create.roblox.com](https://create.roblox.com/landing) | 2 | No | Platform/UGC/networking/economy, not a single game |
| 4 | Red Dead Redemption 2 | [rockstargames.com/reddeadredemption2](https://www.rockstargames.com/reddeadredemption2) | 1 | No | Animation, world density, systemic AI |
| 5 | The Sims 4 | [ea.com/…/the-sims-4/features](https://www.ea.com/games/the-sims/the-sims-4/features) | 3 | No | Agent simulation is feasible; content breadth is not |
| 6 | Cities: Skylines | [paradoxinteractive.com/…/cities-skylines](https://www.paradoxinteractive.com/games/cities-skylines) | 3 | Yes | CityBound (AGPL-3.0, work-in-progress) |
| 7 | Euro Truck Simulator 2 | [eurotrucksimulator2.com](https://eurotrucksimulator2.com/) | 3 | No | One vehicle and scripted roads are feasible |
| 8 | BeamNG.drive | [beamng.com/…/physics](https://beamng.com/game/about/physics/) | 2 | No | High-node soft-body solving is a performance ceiling |
| 9 | Farming Simulator | [farming-simulator.com/about.php](https://www.farming-simulator.com/about.php) | 2 | No | Vehicle/implement physics plus licensed content |
| 10 | Teardown | [80.lv interview](https://80.lv/articles/teardown-developer-breaks-down-multiplayer-and-voxel-destruction-tech) | 2 | No | Persistent voxel destruction is CPU-bound |

### B. Racing and driving

| # | Game | Official link | Fit | OSS | Note |
|---|---|---|---|---|---|
| 11 | Forza Horizon 5 | [forza.net](https://forza.net/) | 1 | No | Licensed roster, open world, live service |
| 12 | Need for Speed Heat | [EA PC manual](https://www.ea.com/able/resources/need-for-speed/need-for-speed-heat/pc/text-manual) | 2 | No | Night drift/pursuit slice only |
| 13 | Assetto Corsa | [assettocorsa.gg](https://assettocorsa.gg/) | 1 | No | Tyre/suspension simulation and mod pipeline |
| 14 | Trackmania | [trackmania.com](https://www.trackmania.com/?lang=en) | 4 | No | Time trial is a strong fit; HexGL is only a racing reference |
| 15 | Rocket League | [Epic store](https://store.epicgames.com/p/rocket-league) | 3 | No | Car-ball physics is buildable; high-tick netcode is not |

### C. Shooting, action and survival

| # | Game | Official link | Fit | OSS | Note |
|---|---|---|---|---|---|
| 16 | PUBG | [pubg.com](https://pubg.com/) | 1 | No | 100-player authoritative servers and map volume |
| 17 | Fortnite | [Epic Creative docs](https://dev.epicgames.com/documentation/fortnite/lets-play-in-fortnite-creative) | 1 | No | Build/edit netcode and live-service volume |
| 18 | Call of Duty: Warzone | [callofduty.com guide](https://www.callofduty.com/guides/training/call-of-duty-guides-warzone-how-to-play) | 1 | No | Server scale and live balance (page fetch timed out) |
| 19 | Counter-Strike 2 | [counter-strike.net/news](https://www.counter-strike.net/news) | 2 | Yes | Tiny Strike (ISC), browser tactical FPS reference |
| 20 | VALORANT | [playvalorant.com](https://playvalorant.com/en-us/) | 2 | Yes | Tiny Strike only; no Valorant-specific repo verified |
| 21 | Apex Legends | [ea.com/…/apex-legends](https://www.ea.com/games/apex-legends/apex-legends) | 2 | No | Bots-and-one-arena slice only |
| 22 | Free Fire | [ff.garena.com](https://ff.garena.com/) | 4 | No | Low-poly, short rounds, touch-first |
| 23 | Minecraft Dungeons | [minecraft.net/about-dungeons-ii](https://www.minecraft.net/en-us/about-dungeons-ii) | 4 | No | Procedural dungeons and simple AI |
| 24 | Left 4 Dead 2 | [l4d.com/game.html](https://www.l4d.com/game.html) | 3 | No | Director logic is tractable; four-player netcode is not |
| 25 | DOOM Eternal | [Steam](https://store.steampowered.com/app/782330/DOOM_Eternal/) | 2 | No | One-arena resource-loop demo only |

### D. Adventure, RPG and exploration

| # | Game | Official link | Fit | OSS | Note |
|---|---|---|---|---|---|
| 26 | Breath of the Wild | [nintendo.com product page](https://www.nintendo.com/au/games/nintendo-switch/the-legend-of-zelda-breath-of-the-wild/) | 1 | No | Systemic physics and content scale |
| 27 | Elden Ring | [bandainamcoent.com/games/elden-ring](https://www.bandainamcoent.com/games/elden-ring) | 2 | No | A 2D soulslike is the better target |
| 28 | The Witcher 3 | [thewitcher.com/witcher3](https://www.thewitcher.com/witcher3) | 1 | No | Narrative and voice volume |
| 29 | Genshin Impact | [genshin.hoyoverse.com](https://genshin.hoyoverse.com/en/) | 3 | No | Art/AI fit; live service/gacha do not (content unverified) |
| 30 | Terraria | [terraria.org](https://terraria.org/) | 5 | Yes | Terrarium (GPL-2.0, stale mirror); Mineralic unlicensed |
| 31 | Stardew Valley | [stardewvalley.net](https://www.stardewvalley.net/) | 2 | No | Loop is simple; content volume is not |
| 32 | Hollow Knight | [hollowknight.com](https://www.hollowknight.com/) | 3 | No | Platforming is achievable; art/map volume is not |
| 33 | Hades | [supergiantgames.com/games/hades](https://www.supergiantgames.com/games/hades/) | 3 | No | Room combat plus boons is a strong fit |
| 34 | Don't Starve | [klei.com/games/dont-starve](https://www.klei.com/games/dont-starve) | 3 | No | Survival meters over a 2D world |
| 35 | Subnautica | [unknownworlds.com/games](https://unknownworlds.com/games) | 1 | No | 3D open-world streaming and dense assets |

### E. Sports, strategy and casual

| # | Game | Official link | Fit | OSS | Note |
|---|---|---|---|---|---|
| 36 | EA Sports FC | [ea.com/…/fc-27](https://www.ea.com/games/ea-sports-fc/fc-27) | 1 | Yes | FIFACHER (unlicensed, research only); Openfoot (GPL-3.0, manager) |
| 37 | eFootball | [konami.com/efootball/…/overview](https://www.konami.com/efootball/en/page/overview) | 2 | Yes | FIFACHER (unlicensed, research only) |
| 38 | Cricket 24 | [Steam](https://store.steampowered.com/app/2358260/Cricket_24/) | 2 | No | Timing duel is buildable; licensed sim is not |
| 39 | NBA 2K | [nba.2k.com/2k26](https://nba.2k.com/2k26/) | 2 | No | Arcade 5v5 only |
| 40 | Chess.com | [chess.com](https://www.chess.com/) | 5 | Yes | chess.js (BSD-2), js-chess-engine (MIT), chessboard.js (MIT) |
| 41 | Clash of Clans | [supercell.com/…/clashofclans](https://supercell.com/en/games/clashofclans/) | 2 | No | Raid loop fits; content volume does not |
| 42 | Clash Royale | [supercell.com/…/clashroyale](https://supercell.com/en/games/clashroyale/) | 4 | Yes | Clash Royale Clone (MIT, C++ headless simulation) |
| 43 | Age of Empires II | [Steam DE](https://store.steampowered.com/app/813780/Age_of_Empires_II_Definitive_Edition/) | 1 | No | Micro-RTS only |
| 44 | Civilization VI | [civilization.2k.com/civ-vi](https://civilization.2k.com/civ-vi/) | 1 | No | Miniature hex 4X only; Freeciv-web is a different game |
| 45 | Among Us | [innersloth.com/games/among-us](https://www.innersloth.com/games/among-us/) | 3 | Yes | Web clone (MIT); Impostor is a GPL-3.0 server |
| 46 | Fall Guys | [fallguys.com](https://www.fallguys.com/) | 2 | No | 60-player networked physics; 12-runner AI slice is 3/5 |
| 47 | Subway Surfers | [subwaysurfers.com](https://subwaysurfers.com/) | 5 | No | Best-in-class scope fit |
| 48 | Temple Run | [imangistudios.com](https://imangistudios.com/) | 4 | No | Spline corridor runner |
| 49 | Brawl Stars | [supercell.com/…/brawlstars](https://supercell.com/en/games/brawlstars/) | 4 | No | 2D arena and short matches |
| 50 | Plants vs. Zombies | [ea.com/games/plants-vs-zombies](https://www.ea.com/games/plants-vs-zombies) | 4 | No | Lane defence with cheap state machines |

---

## Cross-cutting findings

### 1. The best browser games are small simulations, not small worlds

Terraria, Chess, Clash Royale, Subway Surfers and Plants vs. Zombies all have a **small rule set with a large content surface**. The simulation fits in a browser; the content can be expanded over time. Open worlds invert this: the simulation is expensive and the content is even more expensive. **Confidence: high.**

### 2. Deterministic fixed-tick simulation is the reusable architecture

Chess, Clash Royale, Brawl Stars and Plants vs. Zombies all benefit from a deterministic tick where the same inputs produce the same outcome. This enables replays, bots, testing and—if ever needed—lockstep multiplayer. Racing and football already use a fixed-step loop in NeonRift. **Confidence: high (design inference, not measured).**

### 3. Content volume, not rendering, is the usual budget breaker

Minecraft-like rendering is proven in browsers; Stardew-like content is not cheap. Hollow Knight's platforming physics is achievable; its hand-drawn map and animation are not. Every GDD must therefore state a **content cap** alongside its feature list. **Confidence: high.**

### 4. Multiplayer is a backend commitment, not a checkbox

Among Us, Fall Guys, Brawl Stars and Clash Royale all derive much of their value from other humans. A static Cloudflare Pages deployment cannot provide authoritative real-time matchmaking, anti-cheat or reconnection by itself. Without an approved backend, these games must ship as **single-player with bots** and be described honestly as such. **Confidence: high.**

### 5. Licensed sports are legally unavailable, not merely difficult

EA FC, eFootball, Cricket 24 and NBA 2K depend on club, league and player licences. A clean-room studio cannot reproduce kits, player likenesses, logos or broadcast packages. The viable product is an **original arcade sports game with fictional teams**—which NeonRift already has in Rift Striker. **Confidence: high.**

### 6. The strongest open-source code is infrastructure, not games

Verified permissive projects are mostly libraries: chess.js, js-chess-engine, chessboard.js, Tiny Strike, Clash Royale's headless simulation. Engines (Three.js, Phaser, PixiJS, Babylon.js, PlayCanvas, Rapier, cannon-es, Matter.js) are permissively licensed and usable. Complete, licensable browser games are rare; complete **clones of commercial games** are rarer and often unlicensed. **Confidence: high.**

### 7. Copyleft is usable only with deliberate separation

AGPL/GPL projects (AncientBeast, Freeciv-web, CityBound, Openfoot Manager, Impostor, Terrarium, Hextris) can inform architecture and rules, but direct code reuse in a proprietary static site creates source-disclosure obligations. The safe pattern is **read for understanding, reimplement independently**. **Confidence: high.**

### 8. Asset licensing is a separate audit from code licensing

Luanti's code is LGPL but its media is CC-BY-SA 3.0. BrowserQuest's code is MPL-2.0 but its content is CC-BY-SA 3.0. A repository's root licence does not automatically cover bundled art, audio or third-party games—`sausi-7/games` is the clearest example of an aggregate with a single MIT claim over 142 games. **Confidence: high.**

### 9. The portfolio's marginal value is in new genres

NeonRift already covers casual arcade, racing, football and open-world driving. The highest-value additions are **strategy/tower defence, a run-based roguelite, a tile sandbox, a board game and an endless runner**—genres with no current entry. **Confidence: medium-high (portfolio judgement).**

### 10. "Clone" must mean "reimplement the loop"

The legal and practical meaning of a clean-room clone is: same genre verbs, original code, original art, original level layouts, original names and branding. Anything closer—extracted assets, copied maps, reproduced UI, trademarked characters—is out of bounds. This report treats the 50 games as **design references only**. **Confidence: high.**

---

## Verification log

| Claim | Source | Verdict |
|---|---|---|
| Trackmania is free to play and has five environments (Red Island, Blue Bay, Green Coast, White Shore, Stadium) | Official Trackmania site [21] | Supported verbatim |
| Among Us supports 4–15 players | Official Innersloth page [67] | Supported verbatim |
| Fall Guys supports up to 60 players | Official Fall Guys site [68] | Supported verbatim |
| Left 4 Dead 2 uses AI Director 2.0 to customise layout, weather and lighting | Official L4D2 page [41] | Supported verbatim |
| BeamNG.drive uses node/beam soft-body physics | Official BeamNG physics page [12] | Supported verbatim |
| Brawl Stars matches run under three minutes | Official Supercell page [73] | Supported verbatim |
| Minecraft has Creative and Survival modes | Official Minecraft article [4] | **Unverified** — page blocked during spot-check |
| Cities: Skylines traffic simulation details | Game Developer article [9] | **Unverified** — body not retrievable |
| Chess.com supports daily/correspondence chess | Features guide [61]; variants page [62] | **Partial** — features guide describes it; variants page does not confirm it as a mode |
| Subway Surfers uses exactly three lanes | Official site [70] | **Unsupported as a quote** — treated as genre-standard/unverified |

Additional verification facts:

- GitHub metadata was read from the public API on 2026-11-02.
- `trigger-rally/trigger-rally` and `3dcity/3dcity` returned 404; both are excluded from the verified repository set.
- `mozilla/BrowserQuest` is archived and marked deprecated; code MPL-2.0, content CC-BY-SA 3.0.
- `Hextris/hextris` is GPL-3.0 despite GitHub reporting `NOASSERTION`.
- `luanti-org/luanti` is LGPL for code and CC-BY-SA 3.0 for media.
- `acherm/fifacher` and `RenderBr/mineralic` have no licence file and are treated as all-rights-reserved.
- Cloudflare Pages free tier: 500 builds/month, 1 concurrent build, 20,000 files, 25 MiB per file. Bandwidth and request limits were not stated on the official page.
- GitHub Free: unlimited public and private repositories and "$12 USD of included compute usage per month". A "2,000 Actions minutes" figure was not stated on the pages checked.

---

## Limitations and honest caveats

1. **No game was played for this report.** Mechanics are derived from official descriptions, documentation and genre knowledge, not from hands-on measurement.
2. **Not every official trailer or screenshot page was verified.** Where a media URL was not confirmed, the group file says so rather than guessing.
3. **Feasibility scores are judgements**, not benchmarks. They assume a small team, procedural/original art and a static client-side deployment.
4. **Some control bindings are genre-typical and labelled [unverified].** Official pages rarely document default bindings.
5. **Repository metadata can change.** Licences and maintenance status were checked on 2026-11-02 and should be re-checked before any reuse.
6. **No legal advice is given.** Licence compatibility for a commercial deployment requires a lawyer's review.
7. **The 50-game list is a reference set, not a market forecast.** Audience appeal scores are estimates.

---

## Research package

| Document | Contents |
|---|---|
| [README.md](README.md) | Package cover, deliverable status and verification limits |
| [SOURCES.md](SOURCES.md) | 107 numbered sources with tiers and verification notes |
| [games/A-open-world-sandbox-simulation.md](games/A-open-world-sandbox-simulation.md) | Games 1–10 |
| [games/B-racing-driving.md](games/B-racing-driving.md) | Games 11–15 |
| [games/C-shooting-action-survival.md](games/C-shooting-action-survival.md) | Games 16–25 |
| [games/D-adventure-rpg-exploration.md](games/D-adventure-rpg-exploration.md) | Games 26–35 |
| [games/E-sports-strategy-casual.md](games/E-sports-strategy-casual.md) | Games 36–50 |
| [SHORTLIST-15.md](SHORTLIST-15.md) | Weighted scoring and the recommended 15 |
| [LICENSE-AUDIT.md](LICENSE-AUDIT.md) | Verified licences, compatibility and asset policy |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Platform and per-genre technical architecture |
| [ROADMAP.md](ROADMAP.md) | Delivery order, milestones and QA gates |
| [SOURCE-DIRECTORY.md](SOURCE-DIRECTORY.md) | Verified repositories, tools and what each is good for |
| [GDD/](GDD/) | One Game Design Document per shortlisted game |

---

## Decision gate

The next step is **your approval of the 15-game shortlist**. Until then:

- No new game code will be written.
- No existing project files will be deleted or overwritten.
- No repository, asset or dependency will be added.
- No public deployment will occur.

After approval, development proceeds **one game at a time**, to a usable quality level, with desktop and mobile QA before the next game starts.
