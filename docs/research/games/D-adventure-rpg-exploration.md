# D. Adventure, RPG and Exploration — Games 26–35

> Citation numbers resolve in [SOURCES.md](../SOURCES.md). Labels: **[verified]**, **[analyst]**, **[unverified]**.

## 26. The Legend of Zelda: Breath of the Wild

**Official site:** [43] https://www.nintendo.com/au/games/nintendo-switch/the-legend-of-zelda-breath-of-the-wild/ — reachable; the product page opens with the 100-year-slumber premise. **Media:** no official trailer URL was verified in this pass; only third-party uploads surfaced, so no media link is asserted.

**Mechanics:** "open-air" traversal with stamina-gated climbing, swimming and paragliding; breakable weapons; four Shiekah Slate runes (Magnesis, Stasis, Cryonis, Remote Bombs); systemic chemistry where fire spreads, metal conducts lightning and rain affects climbing; cooking and elixirs; temperature and weather [43][analyst]. **Modes/progression:** single-player only; shrine orbs trade for hearts or stamina, armour upgrades, Korok-seed inventory expansion; four Divine Beasts and a Hyrule Castle finale; no difficulty setting [analyst]. **Controls:** gamepad only—dual sticks, face buttons for attack/jump/sprint, triggers for bow/shield, rune radial; no native keyboard/mouse [analyst].

**Art direction:** cel-shaded, painterly open-air look with strong weather and lighting shifts [analyst].

**Physics/AI:** the standout system—rigid-body props, buoyancy, wind and fire propagation, climbing raycasts against arbitrary geometry; enemy AI is simple patrol/aggro camps rather than a simulation [analyst]. **Multiplayer:** none.

**Engagement:** emergent puzzle solutions, the "see that hill, go there" curiosity loop, and systemic experimentation [analyst].

**Browser feasibility: 1/5.** The systemic physics and content scale are the hardest items in this set to reproduce; only a small physics-sandbox slice is realistic. **Open-source alternative:** none verified.

## 27. Elden Ring

**Official site:** [44] https://www.bandainamcoent.com/games/elden-ring — reachable; the page currently foregrounds the Shadow of the Erdtree expansion. **Media:** no official trailer URL verified in this pass.

**Mechanics:** stamina-gated souls combat—light/heavy/charged attacks, guard counters, parries, roll i-frames; FP spells and Ashes of War; flask charges refilled at sites of grace; runes as currency, dropped on death and recoverable; open field plus legacy dungeons; mounted combat and double jump; crouch-stealth; spirit summons and co-op phantoms [44][analyst]. **Modes/progression:** single-player with optional online co-op and PvP invasions/arena; NG+ cycles; no difficulty slider—challenge is tuned by build and levelling [analyst]. **Controls:** gamepad primary (bumpers for attacks, triggers for guard/skill, dodge button); keyboard/mouse supported [analyst].

**Art direction:** dark fantasy with desaturated palettes, oppressive scale and landmark-driven vistas [analyst].

**Physics/AI:** animation-driven hitboxes and frame data rather than ragdoll simulation; boss state machines with long telegraphed combos and punish windows; persistent patrol/aggro state [analyst]. **Multiplayer:** summon-based co-op, invasions and arena duels [analyst].

**Engagement:** readable-but-brutal boss mastery, buildcraft freedom and discovery-driven exploration [analyst].

**Browser feasibility: 2/5.** Combat feel lives in animation timing; a 2D soulslike captures the loop far better than a 3D browser clone. **Open-source alternative:** none verified.

## 28. The Witcher 3: Wild Hunt

**Official site:** [45] https://www.thewitcher.com/witcher3 — reachable; the page describes "silver for monsters, steel for humans", potions/oils and two swords, the war-torn Northern Kingdoms, and choices with consequences. **Media:** no official trailer URL verified in this pass.

**Mechanics:** third-person melee with fast/strong attacks, dodge, roll and parry; five Signs (Aard, Igni, Quen, Yrden, Axii); Witcher Senses investigation; alchemy with potions, oils, bombs and toxicity; skill tree and mutagens; crafting and Witcher gear sets; horseback travel; Gwent [45][analyst]. **Modes/progression:** single-player open world across several regions plus two expansions, NG+ and four difficulty levels; XP/level gating and quest-level warnings [analyst]. **Controls:** gamepad or keyboard/mouse—WASD, mouse attack, dodge/roll and sign keys, quick item, sprint [analyst].

**Art direction:** grounded dark fantasy rooted in Slavic folklore, with dense settlements and moody weather [analyst].

**Physics/AI:** no systemic physics; sword hitboxes, horse/boat movement; monsters with oil/bomb/sign weaknesses and pattern-based attacks; NPC schedules and guard reactions [analyst]. **Multiplayer:** none.

**Engagement:** consequence-heavy side quests, the monster-hunt preparation loop and dense world writing [analyst].

**Browser feasibility: 1/5.** Narrative and voice content volume dominates; a browser take would be a compact quest-driven 2D RPG. **Open-source alternative:** none verified.

## 29. Genshin Impact

**Official site:** [46] https://genshin.hoyoverse.com/en/ — the URL resolved but returned only analytics/JavaScript scaffolding, so page content and official status are **[unverified]** in this pass. **Media:** not verified.

**Mechanics:** open-world action RPG with a four-character party and instant swapping; seven elements producing reactions (Vaporize, Melt, Overload, Freeze, Superconduct, Electro-Charged, Swirl, Crystallize, Bloom family, Aggravate/Spread) [46][analyst]; stamina-gated climbing, gliding and swimming; elemental energy bursts; five weapon classes [analyst]. **Modes/progression:** solo exploration plus co-op for domains/bosses (player count **[unverified]**), Spiral Abyss floors, seasonal events; Adventure Rank, resin stamina, gacha and a battle pass [analyst]. **Controls:** touch, keyboard/mouse (WASD, mouse, E skill, Q burst, 1–4 party swap) and gamepad [analyst].

**Art direction:** anime cel-shading with bright regional palettes and elemental VFX [analyst].

**Physics/AI:** lightweight—no systemic physics; enemy camps with aggro radii, elemental shields and boss attack patterns [analyst]. **Multiplayer:** co-op up to four players in domains/overworld (**[unverified]**) [analyst].

**Engagement:** reaction team-building, character collection and exploration built on elemental puzzle verbs [analyst].

**Browser feasibility: 3/5.** Cel-shaded art and simple AI suit WebGL; the live-service backend, gacha economy and content volume are the real blockers. **Open-source alternative:** none verified.

## 30. Terraria

**Official site:** [47] https://terraria.org/ — reachable; the page's own summary is "Dig, fight, explore, build!" **Media:** not verified.

**Mechanics:** 2D tile sandbox—mine and place blocks with tiered tools, crafting stations and recipe trees, boss-gated progression (world evil → Hardmode), accessory modifiers, NPC housing requirements, day/night cycle and invasions; water, lava and honey flow and interact [47][analyst]. **Modes/progression:** single-player and online multiplayer; Classic/Expert/Master difficulties, Journey mode (creative-style power menu), secret world seeds, Corruption versus Crimson world generation [analyst]. **Controls:** keyboard/mouse—WASD, mouse aim/use, hotbar 1–0, inventory, jump, grappling hook; gamepad supported [analyst].

**Art direction:** 16-bit pixel sandbox with distinct biome palettes and layered backgrounds [analyst].

**Physics/AI:** tile-grid collision and cellular liquid simulation; gravity-affected projectiles; simple walker/flyer AI plus phase-based boss patterns—all reproducible with a tilemap and cheap steering [analyst]. **Multiplayer:** host/join co-op sessions (maximum player count **[unverified]**).

**Engagement:** constant "one more upgrade" progression, building freedom and cheap-to-learn/expensive-to-master combat [analyst].

**Browser feasibility: 5/5.** A 2D tile engine, simple AI and modest per-frame costs are ideal for browsers; the cost is item/content breadth, not technology. **Open-source alternative:** `hydren/terrarium` is a C++ Terraria clone under GPL-2.0, but the GitHub copy is a 2018 mirror moved to GitLab [90]. `RenderBr/mineralic` is an in-development Terraria-like C# project with **no license file** and must be treated as all-rights-reserved. Neither is a drop-in engine.

## 31. Stardew Valley

**Official site:** [48] https://www.stardewvalley.net/ — reachable. **Press/media:** [49] https://www.stardewvalley.net/press/ — reachable; a dedicated official trailer URL was not verified in this pass.

**Mechanics:** open-ended country-life RPG—inherit a farm, clear land, plant/water/harvest crops across seasons; a tool-and-stamina loop (hoe, pickaxe, axe, watering can, fishing rod) plus procedurally laid-out caves; ranching, fishing, foraging, cooking/crafting and relationship/dating progression; a day clock and energy budget, with sleep advancing the calendar [48][49]. **Modes/progression:** single-player campaign plus 1–3 player co-op on most platforms [49]; progression through farm value, tool upgrades, community-centre bundles and marriage [analyst]. **Controls:** keyboard/mouse and gamepad on PC, tap-to-move on mobile; exact bindings **[unverified]**.

**Art direction:** warm, high-detail pixel art with seasonal palette shifts [analyst].

**Physics/AI:** tile-based movement with no rigid-body physics; NPCs run daily schedules and dialogue state machines; crop growth is a calendar tick simulation [analyst]. **Multiplayer:** 1–3 player co-op farm [49].

**Engagement:** long-horizon farm optimization, relationship/story beats and low-pressure pacing [analyst].

**Browser feasibility: 2/5.** The core loop is simple 2D tile logic, but content volume (seasons, hundreds of items, NPC schedules) is the blocker, not technology. **Open-source alternative:** none verified.

## 32. Hollow Knight

**Official site:** [50] https://www.hollowknight.com/ — reachable; the studio site is https://www.teamcherry.com.au/. **Media:** official gameplay demonstrations exist on Team Cherry's YouTube channel, but no individual video URL was verified in this pass.

**Mechanics:** 2D side-scrolling action-adventure through a ruined insect kingdom; nail melee with directional attacks; dash, wall-jump and double-jump gate traversal; a soul meter built by hitting enemies and spent to heal; a charm loadout that modifies stats/abilities (**[unverified]** on fetched pages) [50][analyst]. **Modes/progression:** single-player metroidvania with ability-gated map unlock, boss defeats, geo currency and bench checkpoints [analyst]. **Controls:** gamepad-first (move, jump, attack, dash, focus/heal, cast); a keyboard mapping exists on PC but bindings are **[unverified]**.

**Art direction:** hand-drawn, ink-heavy monochrome environments with selective colour and moody lighting [analyst].

**Physics/AI:** tight fixed-step platformer physics—velocity/gravity, coyote time, hitstop and knockback on both player and enemies; enemies use patrol/charge/ranged state machines with telegraphed attacks [analyst]. **Multiplayer:** none.

**Engagement:** precise, readable combat; hand-drawn atmosphere and discovery; boss-mastery loops [analyst].

**Browser feasibility: 3/5.** Canvas/WebGL 2D platforming physics is very achievable, but art volume and a large interconnected map make full scope unrealistic. **Open-source alternative:** none verified.

## 33. Hades

**Official site:** [51] https://www.supergiantgames.com/games/hades/ — reachable; the page describes a rogue-like dungeon crawler in which you "defy the god of the dead" through the Underworld of Greek myth. **Media:** the official site is the media hub; no separate trailer URL was verified.

**Mechanics:** room-by-room combat with dash, strike, special and cast; short runs reset on death; boon drafting from gods between rooms, with boons combining into build-defining synergies; meta-currency persists between runs for permanent upgrades [51][analyst]. **Modes/progression:** run-based roguelike with narrative progression that advances on every death; difficulty via the Pact of Punishment (**[unverified]** detail) [analyst]. **Controls:** gamepad or keyboard/mouse—move, attack, special, dash, cast, call; exact bindings **[unverified]**.

**Art direction:** vibrant hand-illustrated Greek myth with an isometric camera and strong character portraits [analyst].

**Physics/AI:** top-down action where hitboxes, i-frames and knockback matter more than simulation; telegraphed wind-ups and aggro/range states; a room spawn director controls pacing [analyst]. **Multiplayer:** none.

**Engagement:** buildcraft variance per run, story delivered through repetition and extremely readable combat feedback [analyst].

**Browser feasibility: 3/5.** The isometric combat loop plus boon system is a strong browser fit; the volume of boons, enemies and dialogue is the main cost. **Open-source alternative:** none verified.

## 34. Don't Starve

**Official site:** [52] https://www.klei.com/games/dont-starve — reachable; the page calls it an "uncompromising wilderness survival game full of science and magic." The standalone multiplayer game is [53] https://www.klei.com/games/dont-starve-together. **Media:** not verified.

**Mechanics:** wilderness survival with health, hunger and sanity meters (sanity drains in darkness and near monsters—**[unverified]** on fetched pages); a day/night cycle where darkness is lethal; seasonal hazards; crafting, base building and farming; generally permanent death [52][analyst]. **Modes/progression:** sandbox survival with escalating seasons; Don't Starve Together is the standalone multiplayer expansion—"fight, farm, build and explore together" [53]; a further title, Don't Starve Elsewhere, is listed as announced/in development [53]. **Controls:** point-and-click or keyboard/mouse on PC, gamepad on consoles; exact bindings **[unverified]**.

**Art direction:** hand-drawn, gothic storybook style with exaggerated silhouettes [analyst].

**Physics/AI:** 2D top-down with simple collision; hunger/sanity/temperature as continuous simulations; creature wander/aggro/flee states plus herd and night-time behaviour [analyst]. **Multiplayer:** yes, via Don't Starve Together [53].

**Engagement:** tension from resource scarcity, emergent base-building failure stories and a distinctive art style [analyst].

**Browser feasibility: 3/5.** The survival simulation is mostly numbers and timers over a 2D world, so a trimmed version is very feasible; long-run balancing is the hard part. **Open-source alternative:** none verified.

## 35. Subnautica

**Official site:** [54] https://unknownworlds.com/games — reachable; the page describes an underwater open-world adventure where you "craft equipment and submarines to explore lush coral reefs, volcanoes, cave systems, and more—all while trying to survive." The franchise site currently fronts Subnautica 2. **Media:** not verified.

**Mechanics:** oxygen, hunger and thirst management; depth pressure limits; base building and vehicle construction as progression gates; scanning/research to unlock blueprints (**[unverified]** on fetched pages) [54][analyst]. **Modes/progression:** survival plus an optional creative/freedom mode (**[unverified]**); progression by depth and blueprint unlocks; Subnautica 2 adds a new alien world with solo or four-player co-op [54]. **Controls:** keyboard/mouse on PC, gamepad on consoles; swim/look/interact/inventory bindings **[unverified]**.

**Art direction:** vivid underwater science fiction with bioluminescence, murk and scale-driven dread [analyst].

**Physics/AI:** 3D swimming with buoyancy and drag rather than full rigid-body simulation; a large world streamed in chunks; creature AI driven by aggro/territory and sound detection; leviathans patrol regions [analyst]. **Multiplayer:** the original is single-player; Subnautica 2 adds four-player co-op [54].

**Engagement:** thalassophobia-driven tension, exploration discovery and base/vehicle ownership [analyst].

**Browser feasibility: 1/5.** 3D open-world streaming, dense flora/fauna and large asset budgets are far beyond a browser clean-room scope. **Open-source alternative:** none verified.

## Cross-cutting lessons from Group D

This group separates **systems** from **content**. Breath of the Wild and Subnautica are expensive because their value lives in systemic simulation and dense 3D worlds. Terraria, Stardew Valley, Hades and Don't Starve are approachable because their rules are small and deterministic—their cost is content breadth (items, crops, boons, creatures), which a browser team can scale down honestly.

The reusable loops for NeonRift are: a **tile sandbox with tiered tools** (Terraria), a **calendar-and-energy farm loop** (Stardew), a **room-based run with drafted upgrades** (Hades), a **tight 2D platformer with ability gates** (Hollow Knight), and a **survival meter triangle** (Don't Starve). The non-reusable parts are hand-drawn art volume, voice/narrative content and open-world 3D streaming.

The honest browser target is a **content-complete vertical slice**—one biome, one progression arc, ten to twenty items—not a cut-down imitation of a 40-hour game.
