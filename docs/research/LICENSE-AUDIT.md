# Licence and Asset Audit

> Verified 2026-11-02. This is an engineering audit, **not legal advice**. Re-check every licence before shipping a commercial product.

---

## 1. Licence classes used in this audit

| Class | Examples | What it means for NeonRift |
|---|---|---|
| **Permissive** | MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC | Can be used in a proprietary site with licence and copyright notice preserved. Apache-2.0 also requires a NOTICE file and patent grant handling. |
| **Weak copyleft** | LGPL-2.1/3.0, MPL-2.0 | File-level or library-level obligations. Dynamic linking/MPL files can often be combined with proprietary code, but modifications to covered files must be shared. Requires care. |
| **Strong copyleft** | GPL-2.0/3.0, AGPL-3.0 | Derivative works must be distributed under the same licence. AGPL extends this to network use. **Do not copy into the NeonRift codebase** without a deliberate open-source decision. |
| **Unlicensed** | No LICENSE file | All rights reserved by default. **Do not reuse** until the author grants permission. |
| **Media licences** | CC0, CC-BY, CC-BY-SA, OFL | Separate from code. CC-BY-SA is share-alike and can infect the combined work; avoid for proprietary art unless the whole asset is isolated and attributed. |

A repository's root licence does **not** automatically cover bundled art, audio, fonts or third-party games. Each asset needs its own provenance.

---

## 2. Verified engines and tools

All licences below were read from the official repository's licence file, not from memory.

| Tool | Role | Licence | Commercial use | Notes |
|---|---|---|---|---|
| Three.js | 3D renderer | MIT | Yes | Already in use |
| Phaser 3 | 2D game framework | MIT | Yes | Not currently installed; add only if a game justifies it |
| PixiJS | 2D WebGL renderer | MIT | Yes | Not currently installed |
| Babylon.js | 3D engine | Apache-2.0 | Yes | Requires NOTICE/patent terms |
| PlayCanvas engine | 3D engine | MIT | Yes | The hosted Editor is a separate commercial product |
| Rapier | 3D/2D physics | Apache-2.0 | Yes | WASM; not needed for the first 15 |
| cannon-es | 3D physics | MIT | Yes | Lightweight alternative |
| Matter.js | 2D physics | MIT | Yes | Could suit a future physics puzzle |
| React | UI | MIT | Yes | Already in use |
| Vite | Build tool | MIT | Yes | Already in use |
| Tailwind CSS | Styling | MIT | Yes | Already in use |
| Vitest | Tests | MIT | Yes | Already in use |

**Decision:** the first 15 games need **no new engine dependency**. Three.js covers 3D, Canvas 2D plus React covers 2D and UI, and deterministic simulations are plain TypeScript. Add Phaser, PixiJS, Rapier or Matter.js only when a specific game's prototype proves the custom approach is slower or worse.

---

## 3. Verified game repositories

Method: GitHub API metadata plus the licence file where GitHub reported `NOASSERTION`. "Commercial" means the licence permits commercial use, not that the project is production-ready.

| Repository | Language | Licence | Commercial | Maintenance | What it actually is |
|---|---|---|---|---|---|
| `sausi-7/games` | JavaScript | MIT | Yes, with caveat | Active (2026-04-26) | 142-game aggregate (~148 MB). A single MIT claim over bundled third-party games; **manual per-game review required** |
| `BKcore/HexGL` | JavaScript | MIT | Yes | Last push 2024-06-29 | Futuristic browser racing game; a rendering/gameplay reference |
| `FreezingMoon/AncientBeast` | TypeScript | AGPL-3.0 | Copyleft | Active (2026-11-01) | Turn-based strategy game; network use triggers source disclosure |
| `mozilla/BrowserQuest` | JavaScript | MPL-2.0 code + CC-BY-SA 3.0 content | Code yes, content share-alike | Archived/deprecated (2023-07-14) | HTML5 multiplayer experiment; not a foundation |
| `Hextris/hextris` | JavaScript | GPL-3.0 (despite `NOASSERTION`) | Copyleft | Last push 2023-05-13 | Fast puzzle game; reference only |
| `freeciv/freeciv-web` | JavaScript + C | AGPL-3.0 client / GPL server | Copyleft | Active (2026-03-27) | Browser strategy game; architecture reference only |
| `luanti-org/luanti` | C++ | LGPL code + CC-BY-SA 3.0 media | Code weak copyleft; media share-alike | Active (2026-10-30) | Voxel platform; engine architecture reference |
| `jhlywa/chess.js` | TypeScript | BSD-2-Clause | Yes | Pinned 1.4.0 (2026-11-07) | Installed for Rift Chess M1 rules; notice in `THIRD_PARTY_NOTICES.md` |
| `josefjadrny/js-chess-engine` | TypeScript | MIT | Yes | Active (2026-02-22) | Zero-dependency chess engine with configurable difficulty |
| `oakmac/chessboardjs` | JavaScript | MIT | Yes | Last push 2024-04-17 | Standalone chessboard UI |
| `guyz/tinystrike` | JavaScript | ISC | Yes | Active (2026-10-03) | Tactical browser FPS with solo, bot and online modes |
| `acherm/fifacher` | JavaScript | **No licence** | **No** | Active (2026-07-31) | Three.js broadcast-style football; all-rights-reserved |
| `citybound/citybound` | Rust | AGPL-3.0 | Copyleft | Stale (2023-01-07) | Work-in-progress city simulation; reference only |
| `openfootmanager/openfootmanager` | Rust | GPL-3.0 | Copyleft | Active (2026-11-02) | Football manager sim; reference only |
| `hydren/terrarium` | C++ | GPL-2.0 | Copyleft | Stale mirror (2018-12-13) | Terraria clone; upstream moved to GitLab |
| `RenderBr/mineralic` | C# | **No licence** | **No** | Stale (2017-11-27) | In-development Terraria clone; all-rights-reserved |
| `kusum-bhattarai/Clash-Royale-Clone` | C++ | MIT | Yes | Active (2026-10-08) | Terminal game plus headless simulation library |
| `arizkhalid/among-us-clone` | JavaScript | MIT | Yes | Active (2026-07-14) | Web-based Among Us clone claiming multiplayer |
| `Impostor/Impostor` | C# | GPL-3.0 | Copyleft | Active (2026-10-31) | Among Us private-server reimplementation, not a game |

### Excluded or unverified

| Candidate | Status | Reason |
|---|---|---|
| `trigger-rally/trigger-rally` | **404** | Repository and organisation do not exist; do not cite as verified |
| `3dcity/3dcity` | **404** | Account exists with no public repositories; nearest hit is an unrelated CityGML database |
| `mozilla/BrowserQuest` | Archived | Deprecated; code and content have different licences |
| `acherm/fifacher` | Unlicensed | No permission to reuse; read-only reference |
| `RenderBr/mineralic` | Unlicensed | No permission to reuse; read-only reference |

---

## 4. Reuse decisions

### Safe to use directly (with notices)

| Project | Use | Obligation |
|---|---|---|
| `chess.js` | Chess rules and move validation | Keep BSD-2 copyright and licence text |
| `js-chess-engine` | Bot opponent / difficulty levels | Keep MIT notice |
| `chessboardjs` | Optional board UI reference; a custom board is also viable | Keep MIT notice if code is copied |
| `guyz/tinystrike` | FPS input/loop reference; not needed for the first 15 | Keep ISC notice if code is copied |
| `kusum-bhattarai/Clash-Royale-Clone` | Rules and target-selection reference; C++ not portable to the browser | Keep MIT notice if code is ported |
| `arizkhalid/among-us-clone` | Networking/role reference; Among Us is not in the first 15 | Keep MIT notice if code is copied |

### Reference only — do not copy code

| Project | Why |
|---|---|
| `luanti-org/luanti` | LGPL code and CC-BY-SA media; architecture inspiration only |
| `citybound/citybound` | AGPL-3.0; network use disclosure |
| `openfootmanager/openfootmanager` | GPL-3.0 |
| `hydren/terrarium` | GPL-2.0; stale mirror |
| `Hextris/hextris` | GPL-3.0 |
| `freeciv/freeciv-web` | AGPL-3.0 client |
| `FreezingMoon/AncientBeast` | AGPL-3.0 |
| `Impostor/Impostor` | GPL-3.0 server |
| `BKcore/HexGL` | MIT, but a complete game's art/code is not a shortcut for an original racer |
| `sausi-7/games` | Single MIT claim over 142 bundled games; per-game provenance unknown |

### Do not use

- `acherm/fifacher` and `RenderBr/mineralic` — no licence.
- `trigger-rally/trigger-rally` and `3dcity/3dcity` — do not exist as cited.
- Any asset extracted from a commercial game.

---

## 5. Asset policy

### Default: original procedural art

NeonRift's existing 3D games already use procedural geometry, materials and lighting. This is the safest and cheapest path. New games should follow it:

- **2D:** vector/canvas shapes, tile patterns, generated sprites or hand-authored SVG.
- **3D:** primitive-composed models with custom materials, procedural textures and lighting; no imported commercial models.
- **Audio:** Web Audio synthesis for effects and music; no sampled commercial tracks.
- **Fonts:** use the project's existing licensed font stack; any new font needs an OFL or equivalent licence.

### If external assets are used

Every asset must pass this checklist before entering the repository:

1. **Source and author** recorded.
2. **Licence** recorded (CC0, CC-BY, OFL, MIT, etc.).
3. **Commercial use** explicitly allowed.
4. **Attribution** text captured if required.
5. **Share-alike** checked — CC-BY-SA assets must not force the whole game to share alike.
6. **Trademark/character** check — no recognisable commercial characters, logos or trade dress.
7. **File provenance** — no ripped, converted or extracted game files.

### Recommended external sources (not verified in this pass)

These are commonly used, but **each asset still needs its own licence check**:

- **Kenney** — game art and audio, mostly CC0.
- **Poly Haven** — HDRIs, textures and models, CC0.
- **OpenGameArt** — mixed licences; per-asset review required.
- **Freesound** — mixed licences; per-sound review required.
- **Google Fonts** — mostly OFL; per-family review required.

No external asset has been added to the repository by this research.

### Attribution template

```
<Asset name> by <Author>, licensed under <Licence>.
Source: <URL>. Modifications: <yes/no and what changed>.
```

Store attribution in `public/credits.txt` or an in-app Credits page if any external asset is used.

---

## 6. Trademark and trade-dress risks

| Risk | Example | Mitigation |
|---|---|---|
| Game name | Using "Minecraft", "Clash Royale", "Subway Surfers" | Original names only (e.g. Voxel Rift, Rift Tactics, Neon Rush) |
| Character likeness | Recognisable mascots or costumes | Original silhouettes and colour systems |
| Logos and UI | Copying a distinctive HUD or card frame | Original layout and visual language |
| Maps and levels | Reproducing a famous track or arena | Original procedural or hand-authored layouts |
| Music | Reusing a commercial theme | Procedural Web Audio or licensed/CC0 music |
| Sports licences | Real clubs, kits, players, leagues | Fictional teams and original kits |
| Trade dress | A near-identical overall look | Distinct NeonRift art direction and naming |

**Rule:** the reference game supplies the **genre verbs**, not the identity. If a screenshot could be mistaken for the original, it is too close.

---

## 7. Dependency checklist for new games

Before adding any dependency:

- [ ] Is it necessary, or can the existing stack do it?
- [ ] Is the licence permissive or compatible?
- [ ] Is the package maintained and reasonably small?
- [ ] Does it work in a static Vite build?
- [ ] Does it add a heavy runtime to a page that does not need it?
- [ ] Is it lazy-loaded if it is heavy?
- [ ] Is the licence notice added to the project's credits?
- [ ] Has the bundle size impact been measured?

**Current decision:** no new runtime dependency for Wave 1 except the chess libraries already identified. Everything else uses React, Canvas 2D and Three.js.

---

## 8. Audit conclusion

- The **engine stack is commercially safe** (MIT/Apache-2.0) and already installed.
- The **highest-value direct code reuse** is chess.js, js-chess-engine and chessboard.js.
- Most attractive-looking game repositories are **copyleft, unlicensed or incomplete**. They are references, not shortcuts.
- **Original procedural art and original level layouts** remain the only scalable zero-budget strategy.
- Two of the user-supplied starting repositories do not exist, and two candidate repositories have no licence. These are recorded rather than quietly used.
