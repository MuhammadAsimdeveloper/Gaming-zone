# Source and Tool Directory

> Verified 2026-11-02 via the GitHub API and official licence files. No repository was cloned or executed, so **exact build commands were not verified** unless stated. Treat "build notes" as pointers, not instructions.

---

## 1. How to use this directory

- **Direct use** means the licence permits copying with notice, and the code is relevant to a shortlisted game.
- **Rules reference** means the project is useful to understand a system, not to copy.
- **Architecture reference** means read for design ideas only.
- **Do not use** means the licence or existence claim failed verification.

The licence classes are explained in [LICENSE-AUDIT.md](LICENSE-AUDIT.md).

---

## 2. Verified repositories

| Repository | Language | Engine / stack | Implemented (per description) | Maintenance | Licence | Commercial | Missing / caveat | Adaptability | Difficulty | Build notes |
|---|---|---|---|---|---|---|---|---|---|---|
| [sausi-7/games](https://github.com/sausi-7/games) | JavaScript | Phaser, Three.js, vanilla JS | "142 playable browser games in one repo" | Active 2026-04-26 | MIT | Yes, caveat | Single MIT claim over an aggregate; per-game provenance unknown | Low as a whole; useful for isolated patterns | Medium (audit) | Not cloned; 148 MB repo |
| [BKcore/HexGL](https://github.com/BKcore/HexGL) | JavaScript | Three.js | Futuristic HTML5 racing game | 2024-06-29 | MIT | Yes | A complete game, not a library; art/code reuse would not be original | Reference for rendering and track feel | Medium | Not cloned; check README |
| [FreezingMoon/AncientBeast](https://github.com/FreezingMoon/AncientBeast) | TypeScript | Browser | Turn-based strategy game | Active 2026-11-01 | AGPL-3.0 | Copyleft | Network use triggers disclosure | Architecture reference only | High | Not cloned |
| [mozilla/BrowserQuest](https://github.com/mozilla/BrowserQuest) | JavaScript | Browser + Node | Multiplayer HTML5 experiment | Archived 2023-07-14 | MPL-2.0 code; CC-BY-SA 3.0 content | Code yes; content share-alike | Deprecated; not maintained | Low | High | Archived; do not build on |
| [Hextris/hextris](https://github.com/Hextris/hextris) | JavaScript | Canvas | Fast puzzle game | 2023-05-13 | GPL-3.0 | Copyleft | GPL; GitHub reports `NOASSERTION` but licence file is GPL-3.0 | Reference only | Medium | Not cloned |
| [freeciv/freeciv-web](https://github.com/freeciv/freeciv-web) | JavaScript + C | HTML5/WebGL | Browser strategy with AI and multiplayer | Active 2026-03-27 | AGPL-3.0 client / GPL server | Copyleft | Heavy server component | Architecture reference | Very high | Not cloned |
| [luanti-org/luanti](https://github.com/luanti-org/luanti) | C++ | Custom voxel engine | Voxel game-creation platform | Active 2026-10-30 | LGPL code; CC-BY-SA 3.0 media | Code weak copyleft; media share-alike | Not a browser engine | Voxel architecture reference | Very high | Not cloned |
| [jhlywa/chess.js](https://github.com/jhlywa/chess.js) | TypeScript | None | Move generation/validation, check/checkmate/draw detection | Active 2026-08-11 | BSD-2-Clause | Yes | No UI, no AI, no clocks | **Direct use** | Low | Published TypeScript library; check README for package name/version |
| [josefjadrny/js-chess-engine](https://github.com/josefjadrny/js-chess-engine) | TypeScript | None | Zero-dependency engine with configurable AI difficulty | Active 2026-02-22 | MIT | Yes | No UI | **Direct use** | Low | Check README |
| [oakmac/chessboardjs](https://github.com/oakmac/chessboardjs) | JavaScript | None | Standalone chessboard UI | 2024-04-17 | MIT | Yes | UI only | **Direct use** or reference | Low | Check README |
| [guyz/tinystrike](https://github.com/guyz/tinystrike) | JavaScript | Browser | Tactical FPS with solo, bot and online modes | Active 2026-10-03 | ISC | Yes | Not needed for the first 15 | Reference for FPS loop | High | Check README |
| [acherm/fifacher](https://github.com/acherm/fifacher) | JavaScript | Three.js | Broadcast-style football, procedural assets | Active 2026-07-31 | **None** | **No** | All-rights-reserved | **Do not use** | — | — |
| [citybound/citybound](https://github.com/citybound/citybound) | Rust | Custom | Work-in-progress multiplayer city simulation | 2023-01-07 | AGPL-3.0 | Copyleft | Stale; Rust/WASM complexity | Architecture reference | Very high | Not cloned |
| [openfootmanager/openfootmanager](https://github.com/openfootmanager/openfootmanager) | Rust | Custom | Football manager simulation | Active 2026-11-02 | GPL-3.0 | Copyleft | Manager sim, not arcade | Reference only | High | Not cloned |
| [hydren/terrarium](https://github.com/hydren/terrarium) | C++ | Custom | Terraria clone | 2018-12-13 | GPL-2.0 | Copyleft | Stale GitHub mirror; upstream on GitLab | Reference only | High | Do not build on the mirror |
| [RenderBr/mineralic](https://github.com/RenderBr/mineralic) | C# | Custom | In-development Terraria clone | 2017-11-27 | **None** | **No** | All-rights-reserved | **Do not use** | — | — |
| [kusum-bhattarai/Clash-Royale-Clone](https://github.com/kusum-bhattarai/Clash-Royale-Clone) | C++20 | Headless simulation + terminal | Terminal Clash Royale and a headless simulation library | Active 2026-10-08 | MIT | Yes | C++ only; no browser UI | **Rules reference**; concepts portable | Medium | Check README |
| [arizkhalid/among-us-clone](https://github.com/arizkhalid/among-us-clone) | JavaScript | Browser | Web Among Us clone claiming multiplayer | Active 2026-07-14 | MIT | Yes | Among Us not in first 15 | Reference | Medium | Check README |
| [Impostor/Impostor](https://github.com/Impostor/Impostor) | C# | Server | Among Us private-server reimplementation | Active 2026-10-31 | GPL-3.0 | Copyleft | Server only, not a game | Reference only | High | Not needed |

### Excluded candidates

| Candidate | Status | Action |
|---|---|---|
| `trigger-rally/trigger-rally` | 404; org also 404 | Do not cite; nearest GitHub hits are unconfirmed forks |
| `3dcity/3dcity` | 404; account has no public repos | Do not cite; `3dcitydb/3dcitydb` is an unrelated CityGML database |
| `mozilla/BrowserQuest` | Archived/deprecated | Historical reference only |
| `acherm/fifacher` | No licence | Read-only reference |
| `RenderBr/mineralic` | No licence | Read-only reference |

---

## 3. Verified engines and tools

| Tool | Role | Licence | Use now? | Notes |
|---|---|---|---|---|
| [Three.js](https://threejs.org/) | 3D renderer | MIT | **Yes, installed** | Used by the three existing 3D games |
| [React](https://react.dev/) | UI | MIT | **Yes, installed** | React 19 |
| [Vite](https://vite.dev/) | Build | MIT | **Yes, installed** | Vite 8 |
| [Tailwind CSS](https://tailwindcss.com/) | Styling | MIT | **Yes, installed** | Tailwind 4 |
| [Vitest](https://vitest.dev/) | Tests | MIT | **Yes, installed** | Vitest 5 |
| [Phaser](https://phaser.io/) | 2D framework | MIT | No | Add only if a 2D prototype proves Canvas 2D insufficient |
| [PixiJS](https://pixijs.com/) | 2D WebGL renderer | MIT | No | Strong for sprite-heavy games; not needed yet |
| [Babylon.js](https://www.babylonjs.com/) | 3D engine | Apache-2.0 | No | Would duplicate Three.js |
| [PlayCanvas engine](https://github.com/playcanvas/engine) | 3D engine | MIT | No | Editor is a separate commercial product |
| [Rapier](https://rapier.rs/) | Physics | Apache-2.0 | No | Add only for a physics-first game |
| [cannon-es](https://github.com/pmndrs/cannon-es) | Physics | MIT | No | Lightweight alternative |
| [Matter.js](https://brm.io/matter-js/) | 2D physics | MIT | No | Could suit a future puzzle game |

**Version note:** the exact versions in `package.json` are authoritative. Do not upgrade a major version as part of a game build.

---

## 4. Mapping tools to the shortlist

| Shortlisted game | Direct code | Reference | New dependency |
|---|---|---|---|
| Rift Chess | chess.js, js-chess-engine, chessboardjs | Chess.com feature set | None (React DOM) |
| Neon Rush | — | Subway Surfers course pacing | None (Three.js) |
| Strata | — | Terraria progression, Terrarium architecture | None |
| Lawn Protocol | — | PvZ wave pacing | None |
| Apex Time Trial | Existing racing engine | Trackmania ghost/editor | None |
| Rift Tactics | Clash Royale Clone rules (port concepts, not C++) | Clash Royale lane pacing | None |
| Neon Arena | — | Brawl Stars arena readability | None |
| Voxel Rift | — | Luanti chunk architecture (read-only) | None; Web Worker |
| Rift Delve | — | Minecraft Dungeons room pacing | None |
| Undercurrent | — | Hades boon synergies | None |
| Hollow Signal | — | Hollow Knight platforming feel | None |
| Habitat | — | Sims needs/schedules | None |
| Street Cricket | — | Cricket 24 timing model | None |
| Nightfall | — | Don't Starve meter pressure | None |
| Rift Hold | — | Clash of Clans raid loop | None |

---

## 5. Asset sources (not verified in this pass)

No external asset has been added. If one is needed, verify each file individually.

| Source | Typical licence | Caveat |
|---|---|---|
| Kenney | Mostly CC0 | Check the specific pack |
| Poly Haven | CC0 | Good for HDRIs/textures |
| OpenGameArt | Mixed | Per-asset licence review required |
| Freesound | Mixed | Per-sound licence review required |
| Google Fonts | Mostly OFL | Per-family review required |

The default remains **procedural/original art**, which avoids most of this work.

---

## 6. Build and installation reality check

Because no repository was cloned:

- **Do not trust a build command written in this document.** Read each project's own README and lockfile.
- **Do not copy a repository wholesale.** Most are references; the permissive ones are libraries or partial games.
- **Do not add a dependency just because it is listed here.** The first 15 games need none beyond the chess libraries.

For the three chess libraries, the practical path is:

1. Read the current README and licence.
2. Add the package at a pinned version.
3. Keep the licence text in the project credits.
4. Wrap the library behind a small adapter (`rules.ts`) so it can be replaced.
5. Test move legality, check/checkmate, castling, en passant, promotion and draw conditions.

---

## 7. Verification limits

- Repository metadata was read from the GitHub API on 2026-11-02.
- Descriptions are the repositories' own; features were **not** independently executed.
- Build instructions were **not** tested.
- Licence values were read from GitHub metadata and, for `NOASSERTION` cases, from the licence file.
- Commercial-use statements are licence interpretations, not legal advice.
- A repository can change licence or disappear; re-check before reuse.
