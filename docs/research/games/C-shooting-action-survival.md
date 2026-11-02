# C. Shooting, Action and Survival — Games 16–25

> Citation numbers resolve in [SOURCES.md](../SOURCES.md). Labels: **[verified]**, **[analyst]**, **[unverified]**.

## 16. PUBG: Battlegrounds

**Official site:** [25] https://pubg.com/ — reachable; the site describes a battle royale that pits 100 players against each other and is free to play. **Reference:** [26] official LABS news.

**Mechanics:** 100-player last-person-standing battle royale with airdrop insertion, ground looting, a shrinking play zone, a loot economy of weapons/attachments/armour/healing, and vehicles for rotation [25][analyst]. **Modes/progression:** solo/duo/squad battle royale plus rotating Arcade/LABS modes [26]; seasonal and ranked progression [analyst]. **Controls:** standard FPS/TPS—WASD, mouse aim, ADS, crouch/prone, sprint, reload, inventory, free-look [analyst]. **Physics/AI:** projectile ballistics with travel time and drop, penetration and armour mitigation, vehicle physics, large-map streaming; AI bots only in select modes [analyst]. **Multiplayer:** 100-player online matches with squad voice and matchmaking [25]. **Engagement:** single-life tension, looting-to-fighting power curve, emergent squad stories [analyst].

**Browser feasibility: 1/5.** 100-player authoritative servers, huge maps and a deep weapon/loot set are outside browser scope; a 16-bot single-map arena is the realistic ceiling. **Open-source alternative:** none verified.

## 17. Fortnite

**Official site:** no official consumer site verified (fortnite.com returned 403); the verified official source is the Creative documentation [27]. **Reference:** [28] IGN battle-royale guide.

**Mechanics:** 100-player battle royale with a shrinking storm and loot rarity tiers; Build mode with instant walls, floors, ramps and edits from harvested materials; Zero Build variant; third-person aiming and a large item/vehicle pool [27][28][analyst]. **Modes/progression:** Battle Royale, Zero Build, Creative/UGC islands, Solo/Duo/Trio/Squad; seasonal Chapters and Battle Pass [27][28][analyst]. **Controls:** standard TPS with mouse aim and dedicated build hotkeys; weapon slots; gamepad build-mode toggle [analyst]. **Physics/AI:** projectile weapons with travel/drop, grid-snapped building with structural support, destruction of player builds; no AI in core BR except bot fill [analyst]. **Multiplayer:** 100-player online matches, cross-play, parties and Creative matchmaking [27]. **Engagement:** build-fight skill expression, constant seasonal novelty, fast pacing [analyst].

**Browser feasibility: 1/5** (2/5 for a Zero-Build-only slice). Building/editing netcode and live-service content volume are not reproducible in-browser; a small Zero Build arena with bots is. **Open-source alternative:** none verified.

## 18. Call of Duty: Warzone

**Official site:** [29] https://www.callofduty.com/guides/training/call-of-duty-guides-warzone-how-to-play — surfaced, but the fetch timed out. Treat specific mechanics as **[unverified]** unless corroborated. **Reference:** [30] GameSpot Gulag article.

**Mechanics:** large-scale battle royale with contracts, cash and buy stations; a Gulag where eliminated players fight a 1v1 for redeploy; loadout drops; movement-shooter feel with slide, tactical sprint and mantling; Resurgence-style modes [29][30][analyst]. **Modes/progression:** BR solos/duos/trios/quads plus Resurgence and Plunder; seasonal Battle Pass and weapon levelling [analyst]. **Controls:** standard FPS—WASD, mouse, ADS, sprint/tac-sprint, slide, crouch/prone, lethal/tactical, ping, gamepad aim assist [analyst]. **Physics/AI:** fast time-to-kill, hitscan-leaning ballistics, vehicles, no AI opponents in core BR [analyst]. **Multiplayer:** squad-based online BR, cross-play, voice/comms [29][analyst]. **Engagement:** high-stakes Gulag second chances, loadout customization, constant meta churn [30][analyst].

**Browser feasibility: 1/5.** Server scale, weapon content and live balance updates dwarf a browser client; a 20-bot "Gulag plus one POI" prototype is the honest target. **Open-source alternative:** none verified.

## 19. Counter-Strike 2

**Official site:** [31] https://www.counter-strike.net/news — reachable. **Reference:** [32] community wiki for Premier.

**Mechanics:** 5v5 round-based bomb defusal; attackers plant, defenders defuse; rounds won by elimination, objective or time; a per-round economy funding rifles, utility and armour; recoil/spray control and counter-strafing; smoke, flash, molotov and HE utility; map control and information trading [31][32][analyst]. **Modes/progression:** Premier with a CS Rating after placement wins, Competitive map pools, Wingman/Deathmatch/Casual, and an active-duty map rotation [31][32][analyst]. **Controls:** WASD, mouse, crouch/walk, jump, buy menu hotkeys, grenade cycle; no ADS except sniper scopes [analyst]. **Physics/AI:** hitscan bullets with penetration and wall-bang damage, grenade physics, deterministic movement; no AI in competitive play—bots only fill empty servers [analyst]. **Multiplayer:** 5v5 online with ranked matchmaking and lobbies [31][analyst]. **Engagement:** clean economic mind-games, clutch scenarios, high mechanical ceiling with a low rule count [analyst].

**Browser feasibility: 2/5.** Mechanics are simple to state, but hitscan netcode, map quality and fairness are hard; a LAN-style bot defusal game on one map is achievable. **Open-source alternative:** Tiny Strike, a browser tactical FPS with solo, bot and online modes, ISC license [86]. It is a reference, not a drop-in engine.

## 20. VALORANT

**Official site:** [33] https://playvalorant.com/en-us/ — reachable; the site describes a 5v5 character-based tactical FPS where "precise gunplay meets unique agent abilities." **Reference:** [34] official patch notes.

**Mechanics:** 5v5 round-based tactical shooter with spike plant/defuse; four agent abilities including an ultimate; four roles—Duelist, Sentinel, Initiator, Controller; credit economy and ultimate points; first-shot accuracy and movement inaccuracy [33][34]. **Modes/progression:** Competitive, Unrated, Swiftplay, Spike Rush and Team Deathmatch; per-agent mastery and Act-level progression [34]. **Controls:** standard FPS—WASD, mouse, ADS, crouch, walk; abilities on Q/E/C and ultimate on X [analyst]. **Physics/AI:** mostly hitscan weapons with fixed spray patterns and movement-accuracy curves; ability physics (smokes, walls, recon) are the differentiator; no AI in competitive modes [analyst]. **Multiplayer:** 5v5 online matchmaking with ranked tiers and cross-region servers [33][analyst]. **Engagement:** hero-shooter identity inside a CS-like economy, ability combos, short readable rounds [analyst].

**Browser feasibility: 2/5.** 5v5 tactical netcode plus per-agent ability VFX/logic is a large content and sync problem; a two-ability, one-map, bot-filled prototype is realistic. **Open-source alternative:** Tiny Strike is the closest verified browser tactical-FPS reference [86]; no Valorant-specific repository was verified.

## 21. Apex Legends

**Official site:** [35] https://www.ea.com/games/apex-legends/apex-legends — reachable; the page describes a free-to-play battle royale with teams of three, powerful abilities and cross-play. **Media:** [36] official "Marked" gameplay trailer.

**Mechanics:** squad drop from a dropship after choosing a Legend; floor/deathbox looting; each Legend has a passive, tactical and ultimate; shield-then-health damage with knock-down and banner respawns; shrinking ring; movement tech including slide, climb and zip lines [35][36][analyst]. **Modes/progression:** trios/duos BR, Ranked, rotating Mixtape playlists and seasonal events; battle pass, Legend unlocks and cosmetics [35][analyst]. **Controls:** keyboard/mouse—WASD, mouse aim/fire, crouch/slide, jump, tactical on Q, ultimate on Z; gamepad bumpers for abilities [analyst]. **Physics/AI:** projectiles with travel time and bullet drop, momentum-preserving slide/air-strafe; PvP-only, so AI is limited to bot-fill lobbies [analyst]. **Multiplayer:** online-only, server-authoritative squads [35]. **Engagement:** ability-plus-gunplay combos, high movement ceiling, ping communication, short match loop [analyst].

**Browser feasibility: 2/5.** A bots-and-one-arena slice is buildable; authoritative 60-player netcode plus map/asset volume is out of scope. **Open-source alternative:** none verified.

## 22. Free Fire

**Official site:** [37] https://ff.garena.com/ — reachable; the site describes a multiplayer battle royale for Android and iOS. **Store:** [38] Free Fire MAX Google Play listing.

**Mechanics:** island drop, loot weapons/armour/meds, shrinking safe zone; each character carries a distinct skill plus pets; deployable gloo-wall cover is the signature mechanic; squad knock-down/revive; airdrops [37][38][analyst]. **Modes/progression:** BR solo/duo/squad ranked, Clash Squad (round-based 4v4 with a buy phase), Lone Wolf, training; character/weapon progression and cosmetics [analyst]. **Controls:** mobile-first—left virtual joystick, right-side fire/aim/crouch/jump buttons, optional gyro; PC only via emulator [analyst]. **Physics/AI:** arcade ballistics, forgiving recoil, low-poly collision; bot-filled lobbies at lower ranks are widely reported but **[unverified]** here. **Multiplayer:** online-only real-time matches with squads [37]. **Engagement:** ten-minute matches, low device requirements, hero-skill variety and gloo-wall tactics [analyst].

**Browser feasibility: 4/5.** Low-poly art, short rounds and touch-first UI translate cleanly to WebGL/mobile; only real-time netcode is a real cost. **Open-source alternative:** none verified.

## 23. Minecraft Dungeons

**Official site:** [39] https://www.minecraft.net/en-us/about-dungeons-ii — the current page fronts Dungeons II; the original 2020 game's facts below are from the series pages and official gameplay demo [40].

**Mechanics:** isometric action-RPG with procedurally assembled levels; three gear slots (melee, ranged, armour) plus up to three artifacts on cooldowns; enchantment points spent per item; dodge roll; no classes—build is defined by gear [39][40][analyst]. **Modes/progression:** solo or up to four-player co-op; campaign plus DLC; Daily Trials and Ancient Hunts; escalating difficulty tiers and a camp hub with merchants [39][analyst]. **Controls:** keyboard/mouse—WASD move, mouse aim/attack, roll and artifact hotkeys, potion; gamepad twin-stick style [analyst]. **Physics/AI:** flat navmesh mobs with aggro radii and telegraphed attacks; arrows as projectiles; no systemic physics [analyst]. **Multiplayer:** drop-in co-op with per-player loot; no PvP [analyst]. **Engagement:** loot/build experimentation, short dungeon runs, couch/online co-op [analyst].

**Browser feasibility: 4/5.** Tile-based procedural dungeons and simple AI fit a browser engine; cost is content breadth (gear and enchantment combinations), not technology. **Open-source alternative:** none verified.

## 24. Left 4 Dead 2

**Official site:** [41] https://www.l4d.com/game.html — reachable; the page describes five campaigns for co-operative, Versus and Survival modes, AI Director 2.0 customizing level layout, world objects, weather and lighting, and a large weapon set.

**Mechanics:** four-survivor co-op through linear campaigns; special infected disrupt formation (Smoker pull, Boomer horde, Hunter pounce, Charger, Jockey, Spitter, Tank, Witch); temporary versus permanent health, pills/adrenaline/medkits and defibrillator revives; melee shove and friendly fire on higher difficulty [41][analyst]. **Modes/progression:** Campaign, Versus (4v4 with player-controlled infected), Survival, Scavenge, Realism and Mutations; no persistent progression—unlocks are achievements/Workshop content [41]. **Controls:** keyboard/mouse—WASD, mouse aim, reload, use, crouch/walk modifiers, shove, slot keys for throwables/healing; full gamepad support [analyst]. **Physics/AI:** Source-engine hitscan weapons and ragdolls; the AI Director tracks party intensity and paces hordes, item placement, weather and lighting [41]. **Multiplayer:** four-player online co-op, 4v4 Versus, local/Workshop support [41]. **Engagement:** Director-driven unpredictability, tight team resource management, asymmetric Versus [analyst].

**Browser feasibility: 3/5.** Director logic and horde pathing are tractable in JavaScript; the blocker is four-player netcode plus level/audio content volume. **Open-source alternative:** none verified.

## 25. DOOM Eternal

**Official site:** [42] Steam store page — verified; the Bethesda page exists but returned only navigation markup during retrieval.

**Mechanics:** "push-forward" arena FPS built on a resource loop—Glory Kills on staggered demons restore health, the Chainsaw restores ammo, and Flame Belch grants armour; dash, double jump and mantling; weapon/mod quick-swap; destructible demon weak points force target prioritization [42][analyst]. **Modes/progression:** single-player campaign plus two Ancient Gods DLCs; Battlemode (1 Slayer versus 2 player-controlled demons); Master Levels; per-weapon upgrades and masteries [42][analyst]. **Controls:** keyboard/mouse—WASD, mouse fire/alt-fire, dash, jump/double jump, chainsaw, grenade, number keys for weapon swap; gamepad supported [analyst]. **Physics/AI:** no ragdoll/sandbox physics; demon-specific behaviour trees with stagger states and projectile patterns; per-demon attack gating [analyst]. **Multiplayer:** asymmetric Battlemode only; campaign is solo [42]. **Engagement:** resource-loop mastery under pressure, speed/mobility, aggressive soundtrack-paced combat [analyst].

**Browser feasibility: 2/5.** A one-arena "glory kill loop" demo is realistic in WebGL; a full campaign needs animation and art volume far beyond browser scope. **Open-source alternative:** none verified.

## Cross-cutting lessons from Group C

This group is where browser ambition most often outruns delivery. The reusable patterns are the **small-loop** ones: a round economy (CS2), a role kit (Valorant), a resource triangle (DOOM Eternal), a director that paces pressure (Left 4 Dead 2), and a compact loot/build loop (Minecraft Dungeons). The non-reusable parts are 60–150-player authoritative netcode, huge licensed content sets and animation-heavy campaigns.

For NeonRift, the honest path is bots, one arena or one short run, deterministic scoring and local persistence—not a promise of competitive netplay.
