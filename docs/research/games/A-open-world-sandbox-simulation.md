# A. Open-World, Sandbox and Simulation — Games 1–10

> Research date: 2026-11-02. Citation numbers resolve in [SOURCES.md](../SOURCES.md). Labels: **[verified]** = directly supported by a cited source; **[analyst]** = genre-standard design inference, not a sourced product claim; **[unverified]** = could not be confirmed in this pass.

## 1. Grand Theft Auto V

**Official site:** [1] https://www.rockstargames.com/gta-v — reachable. **Media:** Rockstar's own trailer and gameplay pages were surfaced; only the official site is treated as verified here.

**Mechanics:** Third-person open-world action combining driving, shooting, cover combat, mission and heist structures, a wanted-level police response, property/business ownership, vehicle customization, and ambient traffic and pedestrians [1][analyst]. **Modes/progression:** Story Mode and GTA Online are both named on the official page [1]; progression runs through mission unlocks, money, property and rank [analyst]. **Controls:** WASD and mouse aim, weapon switching, gamepad support [analyst]. **Physics/AI:** vehicle handling, ragdoll characters, traffic and police AI, large-world streaming [analyst]. **Multiplayer:** GTA Online ships alongside the story mode [1]. **Engagement:** satirical open world, heist planning, emergent sandbox chaos [analyst].

**Browser feasibility: 1/5.** The combination of city scale, streaming, vehicle and ragdoll physics, and content volume is far beyond a zero-budget browser build. **Open-source alternative:** none verified.

**Evidence note:** The official site establishes the product and online mode. Mechanics and control details are analyst summaries and should not be presented as quoted specifications.

## 2. Minecraft

**Official site:** [3] https://www.minecraft.net/en-us — reachable. **Modes:** Creative and Survival are described on official pages [4], but the spot-check could not fetch the page; treat the distinction as **[unverified in this pass]** even though it is genre-standard. **Mechanics:** voxel world of placeable/destructible blocks; mining, crafting, health/hunger survival, hostile mobs, creative flight and unlimited resources [3][4][analyst]. **Progression:** resource tiers and survival goals in Survival; unrestricted building in Creative [analyst]. **Controls:** WASD, mouse look, mine/place clicks, hotbar, inventory, sneak, double-tap jump to fly in Creative [analyst]. **Physics/AI:** AABB block collision, gravity, fluid flow, simple mob pathing, chunk streaming and greedy-meshed terrain [analyst]. **Multiplayer:** server and shared-world play is a core part of the product [3][analyst]. **Engagement:** creative expression, exploration, progression, moddability [analyst].

**Browser feasibility: 4/5.** Chunked voxel rendering and simple collision are proven browser patterns; content breadth, not rendering, is the real cost. **Open-source alternative:** Luanti (formerly Minetest), C++/Lua, LGPL-2.1+ for code and CC-BY-SA 3.0 for media [76]. Freeminer exists but its license was not stated in the search result and is not recommended without review.

**Evidence note:** The official site supports the product and multiplayer framing. The specific mode claim is flagged because the official article was blocked during verification.

## 3. Roblox

**Official site:** The consumer homepage was not verified; the Creator Hub [5] https://create.roblox.com/landing and Studio documentation [6] https://create.roblox.com/docs/studio are verified. **Media:** not verified.

**Mechanics:** A platform of user-created 3D experiences rather than a single game; Roblox Studio is a free creation tool for Windows and Mac with publishing to consoles, desktops and mobile [6]; experiences are networked multiplayer by default and avatars carry identity/customization and a virtual-currency economy [analyst]. **Modes/progression:** per-experience loops; platform-level progression through avatar items, badges and creator monetization [analyst]. **Controls:** WASD and mouse, touch on mobile, gamepad on console, with per-experience mappings [analyst]. **Physics/AI:** engine rigid-body physics, humanoid character controller, server-authoritative replication, Luau scripting [analyst]. **Multiplayer:** inherent; experiences are shared sessions [analyst]. **Engagement:** enormous UGC variety, social play, low creation barrier.

**Browser feasibility: 2/5.** Replicating the platform (UGC tooling, networking, moderation, economy) is a multi-year product, not a game. **Open-source alternative:** none verified.

## 4. Red Dead Redemption 2

**Official site:** [2] https://www.rockstargames.com/reddeadredemption2 — reachable. **Media:** Rockstar's official gameplay video was surfaced; not re-fetched here.

**Mechanics:** third-person open-world action with shootouts, robberies, hunting, horseback riding, NPC interaction and an honor rating that shifts with behavior [2][analyst]. **Modes/progression:** Story Mode and Red Dead Online [2]; chapter-based story progression [analyst]. **Controls:** WASD and mouse aim, weapon wheel, horse-specific controls, gamepad triggers [analyst]. **Physics/AI:** ragdoll characters, horse/wagon handling, NPC schedules, witness and law-response systems [analyst]. **Multiplayer:** Red Dead Online [2]. **Engagement:** character-driven narrative, systemic world detail, hunting and exploration [analyst].

**Browser feasibility: 1/5.** Animation volume, world density and systemic AI are the hardest parts, and all are content-bound. **Open-source alternative:** none verified.

## 5. The Sims 4

**Official site:** [7] https://www.ea.com/games/the-sims/the-sims-4/features — reachable.

**Mechanics:** household life simulation; Live, Build and Buy modes; room-based construction; emotion/need-driven Sims; relationships and careers [7][analyst]. **Modes/progression:** no campaign; progression through careers, skills, aspirations and expansions [analyst]. **Controls:** mouse-driven point-and-click with keyboard shortcuts; the player issues commands rather than directly driving characters [analyst]. **Physics/AI:** autonomy/utility-based decision making, grid pathfinding, object state machines; minimal real-time physics [analyst]. **Multiplayer:** none; single-player product [7][analyst]. **Engagement:** emergent soap-opera storytelling, house building, mods and custom content [analyst].

**Browser feasibility: 3/5.** An isometric agent simulation with needs AI is very doable; the blocker is content breadth—objects, animations and character creation. **Open-source alternative:** none verified.

## 6. Cities: Skylines

**Official site:** [8] https://www.paradoxinteractive.com/games/cities-skylines — reachable (redirects to `/about`).

**Mechanics:** zoning, road placement, taxation, public services and public transport; a multi-tiered simulation described as easy to build and hard to master; extensive local traffic simulation [8]. **Modes/progression:** sandbox city growth with population milestones and density unlocks [analyst]. **Controls:** mouse-centric construction tools, keyboard shortcuts, edge-scroll/WASD camera [analyst]. **Physics/AI:** agent-based vehicles and citizens with pathfinding, service dispatch, and water/terrain simulation [analyst]; a Game Developer article describes traffic as a separate simulation computing path choice and vehicle velocity [9], but the article body was not retrievable during the spot-check, so this specific claim is **[unverified]**. **Multiplayer:** none [analyst]. **Engagement:** traffic-engineering puzzle, visible growth, deep modding ecosystem [analyst].

**Browser feasibility: 3/5.** A grid city with a few thousand pathfinding agents is achievable in WebGL; visual fidelity and agent counts must be reduced. **Open-source alternative:** CityBound, Rust, AGPL-3.0, explicitly a work-in-progress multiplayer city simulation [88]. AGPL is copyleft and unsuitable for direct code reuse in a proprietary static site without legal review; use it as an architectural reference only.

## 7. Euro Truck Simulator 2

**Official site:** [10] https://eurotrucksimulator2.com/ — reachable. **Store:** [11] Steam page confirms hauling cargo across cities and growing a trucking company.

**Mechanics:** haul cargo across a large European road network; licensed truck models and customization; route planning, fuel, fatigue, damage and fines [10][11][analyst]. **Modes/progression:** career/company progression, free roaming, external contracts [10][analyst]. **Controls:** keyboard and mouse, gamepad or steering wheel; mouse-look cabin; optional shifter/sequential gearbox [analyst]. **Physics/AI:** simplified articulated trailer physics, AI traffic obeying signals and speed limits, collision and fine events [analyst]. **Multiplayer:** Convoy mode is commonly reported but was not confirmed on the fetched official page; treat as **[unverified]**. **Engagement:** relaxing long-haul rhythm, steady economic progression, authentic road map [analyst].

**Browser feasibility: 3/5.** One vehicle, a scripted road network and light traffic AI are feasible; map and content volume are the cost. **Open-source alternative:** none verified.

## 8. BeamNG.drive

**Official site:** [12] https://beamng.com/game/about/physics/ — reachable; the page states vehicles are deformable through "Node and Beam" structures and that beams behave as springs.

**Mechanics:** soft-body vehicle simulation, sandbox driving, deformable/destructible vehicles, vehicle tuning and driving scenarios [12][analyst]. **Modes/progression:** free roam and scenarios; a career mode exists but was not verified in this pass. **Controls:** WASD and mouse camera, gamepad/wheel support, bindings for lights, gears, handbrake and clutch [analyst]. **Physics/AI:** node/beam mass-spring soft bodies, soft tires, coupling of rigid and soft parts; CPU-heavy per vehicle [12]. **Multiplayer:** not verified on the official pages checked; third-party mods exist but are unverified. **Engagement:** unmatched crash/deformation spectacle, experimentation, tactile driving feel [analyst].

**Browser feasibility: 2/5.** High-node-count soft-body solving per vehicle in JavaScript/WASM plus rendering is a hard performance ceiling; a low-node or 2D cut-down is the realistic target. **Open-source alternative:** none verified.

## 9. Farming Simulator (series)

**Official site:** [13] https://www.farming-simulator.com/about.php — reachable. **Academy:** [14] tutorial hub exists; not a trailer page.

**Mechanics:** three maps, new crops and animals, 400+ machines from 150+ brands, weather events and ground deformation [13]; crop cycle of cultivate, sow, fertilize, harvest and sell; land and fleet purchase [14][analyst]. **Modes/progression:** career with farm-manager or start-from-scratch options, contracts and co-op multiplayer [13]. **Controls:** keyboard and mouse, gamepad/wheel; per-vehicle controls for implements and hydraulics [analyst]. **Physics/AI:** wheeled vehicle and implement attachment physics, terrain deformation, hired-worker helper AI [13][analyst]. **Multiplayer:** yes; the official page describes solo and team play [13]. **Engagement:** ownership/progression fantasy, calm repeatable loop, co-op and mods [analyst].

**Browser feasibility: 2/5.** Vehicle/implement physics plus a huge licensed content set; a single-crop vertical slice is the only sane scope. **Open-source alternative:** none verified.

## 10. Teardown

**Official site:** no official domain was verified in this pass. **Media:** the strongest source found is an 80.lv developer interview on voxel destruction and multiplayer [15].

**Mechanics:** voxel-based destruction sandbox with heist-style objectives using vehicles, tools and explosives [15][analyst]. **Modes/progression:** campaign, sandbox and mods are commonly reported; a specific campaign mission count was not verified and is not used here. **Controls:** WASD and mouse, tool/weapon selection, grab-and-throw interaction [analyst]. **Physics/AI:** voxel-vs-voxel collision computed on the CPU while rendering runs on the GPU, a point attributed to creator Dennis Gustafsson [15]; persistent destruction state is the defining cost [analyst]. **Multiplayer:** discussed by the developer as technically difficult; shipping status not verified [15]. **Engagement:** emergent destruction, plan-then-execute heists, physics comedy [analyst].

**Browser feasibility: 2/5.** Persistent voxel destruction with CPU collision is the hard part; a small-scale WebGPU/WASM version with pre-baked chunks is the realistic ceiling. **Open-source alternative:** none verified.

## Cross-cutting lessons from Group A

The open-world reference set is a warning about scope, not a template. Every title in this group derives its value from content volume, animation quality or systemic density rather than from a clever core loop. For a zero-budget browser platform, the transferable ideas are narrower: a compact district rather than a city, a single vehicle rather than a fleet, a handful of systemic interactions rather than a simulated world, and one production chain rather than a licensed machinery catalogue.

The strongest feasible borrowings are: Minecraft's chunked voxel world, The Sims' needs-driven agents, Cities: Skylines' pathfinding pressure, Euro Truck Simulator's route economy, BeamNG's deformation spectacle as a small sandbox, and Teardown's destruction as a puzzle constraint. None of these should be attempted at the reference game's scale.
