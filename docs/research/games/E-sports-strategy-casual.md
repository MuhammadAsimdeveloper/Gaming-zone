# E. Sports, Strategy and Casual — Games 36–50

> Citation numbers resolve in [SOURCES.md](../SOURCES.md). Labels: **[verified]**, **[analyst]**, **[unverified]**.

## 36. EA Sports FC

**Official site:** [55] https://www.ea.com/games/ea-sports-fc/fc-27 — reachable; the page frames modes from "Kickabouts and 1v1s to teaming up with friends in Clubs." **Media:** the official EA Sports FC YouTube channel exists, but no individual trailer URL was verified in this pass.

**Mechanics:** 11v11 football simulation with licensed clubs, kits and players; passing, shooting, dribbling and timed-finish/skill-move inputs (**[unverified]** series-standard detail); Ultimate Team builds a squad from player cards and completes challenges; FC 26 adds a 48-team international tournament and international Manager Live Challenges [55][analyst]. **Modes/progression:** Ultimate Team, Career, Clubs, Kick-Off/Kickabouts and 1v1, plus seasonal live content [55][analyst]. **Controls:** gamepad primary; keyboard/mouse supported on PC; exact bindings **[unverified]**.

**Art direction:** photoreal broadcast presentation—licensed kits, scanned players, stadium atmosphere and TV-style overlays [analyst].

**Physics/AI:** animation-driven rather than ragdoll physics—the ball is a simulated body with spin and drag, players are mocap-blended state machines; team AI uses formation/role positioning and pressing lines. The animation and tuning cost is enormous [analyst]. **Multiplayer:** extensive online play through Clubs, Ultimate Team rivals and 1v1 [55].

**Engagement:** squad-building collection, real-world licensing authenticity and ranked competition [analyst].

**Browser feasibility: 1/5.** Licensing, animation volume and 22-agent simulation are out of scope; only an arcade abstraction is realistic—which NeonRift already has in Rift Striker. **Open-source alternative:** FIFACHER is a Three.js broadcast-presentation football game with **no license file** (all-rights-reserved pending review) [87]; Openfoot Manager is a GPL-3.0 manager simulation, not an arcade match engine [89].

## 37. eFootball

**Official site:** [56] https://www.konami.com/efootball/en/page/overview — reachable; the overview describes Authentic Team and Dream Team squads, "Smart Assist Controls," Bluetooth controller support on mobile, and PvP/VS AI/Friend Matches/eFootball League. **Media:** not verified.

**Mechanics:** free-to-play football with two squad philosophies—Authentic Team (real clubs and national teams) and Dream Team (build your own); assist-driven controls lower the input barrier; online PvP, VS AI, friend matches and a league [56][analyst]. **Modes/progression:** Authentic Team, Dream Team, online league, friend matches and VS AI; live-service seasonal updates [56][analyst]. **Controls:** simplified assist scheme plus manual control; touch on mobile, controller supported [56].

**Art direction:** realistic football presentation with licensed kits and stadium broadcast framing [analyst].

**Physics/AI:** animation-driven ball/player model similar to other football sims; teammate positioning and assist systems are the design core [analyst]. **Multiplayer:** online PvP, friend matches and league play [56].

**Engagement:** free entry, squad collection and a low input barrier through assists [analyst].

**Browser feasibility: 2/5.** The mobile-first, assist-driven model is the most browser-portable football design, but licensing and animation cost remain prohibitive. **Open-source alternative:** FIFACHER [87] is the closest Three.js reference but is unlicensed; treat it as read-only research, not reusable code.

## 38. Cricket 24

**Official site:** [57] https://store.steampowered.com/app/2358260/Cricket_24/ — reachable; the store page lists The Ashes, a global career mode, cross-platform multiplayer, 300+ players and 50 stadiums. **Reference:** [58] Wikipedia.

**Mechanics:** officially licensed cricket simulation and the official video game of the 2023 Ashes; batting and bowling use timing-and-placement input; field placement and bowling variation (**[unverified]** series-standard detail); "realistic fielding mechanics" [57][58]. **Modes/progression:** Ashes series, career mode, competitions and online multiplayer [57][58]. **Controls:** gamepad primary—batting uses stick/timing, bowling uses aim plus release timing; keyboard/mouse on PC, exact bindings **[unverified]**.

**Art direction:** realistic stadium and broadcast presentation with licensed international teams [analyst].

**Physics/AI:** ball trajectory with bounce, seam/spin deviation and swing is the heart of the simulation; fielders and AI captains handle placement and aggression. Deterministic ball physics is well suited to a simplified 2D/3D rebuild [analyst]. **Multiplayer:** cross-platform multiplayer [57].

**Engagement:** authentic Ashes licence, career stat progression and tense ball-by-ball decisions [analyst].

**Browser feasibility: 2/5.** A timing-based batting/bowling duel with simplified physics is very buildable; a full 50-stadium licensed sim is not. **Open-source alternative:** none verified.

## 39. NBA 2K

**Official site:** [59] https://nba.2k.com/2k26/ — reachable; the page names "immersive MyCAREER, MyTEAM, and MyNBA game modes." **Modes guide:** [60] https://nba.2k.com/2k26/game-guide/game-modes/ — reachable; describes narrative-driven MyCAREER with Key Games and rewards, and MyTEAM card collecting with "Animation Breakers."

**Mechanics:** 5v5 basketball simulation with authentic NBA presentation; shot timing and contest model, dribble moves and defensive stance (**[unverified]** series-standard detail); MyCAREER narrative progression and MyTEAM card collecting [59][60]. **Modes/progression:** MyCAREER, MyTEAM, MyNBA and CREWS, with seasonal content refreshes [59][60]. **Controls:** gamepad primary, keyboard/mouse on PC; shot-stick versus button timing—exact bindings **[unverified]**.

**Art direction:** photoreal NBA broadcast presentation with scanned arenas and licensed uniforms [analyst].

**Physics/AI:** animation-blended player movement with a shot-probability model rather than pure ball physics; AI runs play sets, help defence and rotations [analyst]. **Multiplayer:** online through MyTEAM, CREWS and MyCAREER city play (**[unverified]** beyond mode listings).

**Engagement:** card collecting and squad building, career narrative and annual seasonal churn [analyst].

**Browser feasibility: 2/5.** An arcade 5v5 with simplified shooting math is feasible; authentic animation, arenas and mode depth are not. **Open-source alternative:** none verified.

## 40. Chess.com

**Official site:** [61] https://www.chess.com/ — reachable; the site's own features guide covers rated/unrated games, bots, daily chess, simultaneous exhibitions, variants, puzzles, lessons and tournaments. **Variants:** [62] https://www.chess.com/variants — reachable; lists Chess960, Bughouse, 4-Player Chess, Duck Chess and more. Daily (correspondence) chess is described in the features guide but was not confirmed as a distinct mode on the variants page in this pass.

**Mechanics:** rated or unrated games against humans at any time control; bots and computer opponents; daily/correspondence chess; simultaneous exhibitions; variants including Chess960, Bughouse, 4-Player Chess and Duck Chess; puzzles, lessons and tournaments [61][62]. **Modes/progression:** time controls from bullet to daily, rating-based matchmaking, puzzle rating and lessons; clubs/teams **[unverified]** [61]. **Controls:** mouse/tap drag-or-click piece movement; no gamepad relevance.

**Art direction:** clean, high-contrast 2D board and piece sets with optional themes; the interface intentionally stays out of the way [analyst].

**Physics/AI:** no physics. Legal move generation, check/checkmate/stalemate detection, SAN/FEN handling and a bot engine; deterministic and turn-based—ideal for deterministic lockstep netcode [analyst]. **Multiplayer:** real-time and correspondence online play with ratings [61].

**Engagement:** zero-friction instant matchmaking, measurable rating improvement and endless variant/puzzle content [analyst].

**Browser feasibility: 5/5.** Rules-based, asset-light, turn-based and mobile-friendly—the highest-feasibility entry in this set. **Open-source alternative:** three verified libraries cover the hard parts—`chess.js` for move generation and check/checkmate/stalemate detection (BSD-2-Clause) [83], `js-chess-engine` for a zero-dependency engine with configurable difficulty (MIT) [84], and `chessboard.js` for a standalone board UI (MIT) [85]. None is a complete product; the UI, rating loop and persistence remain NeonRift's work.

## 41. Clash of Clans

**Official site:** [63] https://supercell.com/en/games/clashofclans/ — reachable; the page and blog confirm village building, clan wars and a rotating event cadence. **Media:** no official trailer URL was verified in this pass.

**Mechanics:** grid-based village building; gold/elixir/dark-elixir economy with collectors and storages; troop training then deployment around an enemy base; star rating from destruction percentage; defensive towers and walls; builder-timer progression [63][analyst]. **Modes/progression:** single-player campaign, trophy ladder and clan-versus-clan Clan Wars (confirmed on site); rotating events; Town Hall levels gate content (**[unverified]** detail) [63]. **Controls:** touch drag-and-drop, tap and pinch zoom; the browser equivalent is mouse drag with grid snapping [analyst].

**Art direction:** chunky, saturated fantasy-cartoon look with exaggerated buildings and readable silhouettes [analyst].

**Physics/AI:** essentially no physics. Unit pathfinding around walls (A*/flow field), target-selection heuristics, projectile travel with splash radius, troop state machines and placement validity checks [analyst]. **Multiplayer:** asynchronous base raiding, clans, Clan Wars and clan social features [63].

**Engagement:** base-design creativity, three-minute raid sessions and clan accountability loops [analyst].

**Browser feasibility: 2/5.** The raid loop is browser-friendly, but the content volume (dozens of buildings and troops across Town Hall tiers) and art needs swamp a small team. **Open-source alternative:** none verified.

## 42. Clash Royale

**Official site:** [64] https://supercell.com/en/games/clashroyale/ — reachable; the page confirms King and Princess towers, card collection/upgrade, Trophies, Crowns and Arenas. **Media:** not verified.

**Mechanics:** eight-card deck; regenerating elixir spent to deploy troops and spells; two Princess towers and one King tower per side; win by destroying the King tower or holding more towers at time-out; card levels and upgrades; hard counter relationships [64][analyst]. **Modes/progression:** 1v1 Arena ladder with trophies and crowns; other modes (2v2, challenges) exist but were not confirmed by fetched pages (**[unverified]**); card upgrade economy [64]. **Controls:** touch drag card to arena and tap to place; browser mouse drag/drop plus 1–4 hotkeys [analyst].

**Art direction:** bright, readable fantasy-cartoon with strong card frames and unit silhouettes [analyst].

**Physics/AI:** no real physics. Lane-constrained pathing to the nearest bridge, target-acquisition rules (buildings-only versus any), aggro/retarget, splash radii, homing projectiles and tower targeting priority; a deterministic fixed-tick simulation is the right architecture [analyst]. **Multiplayer:** real-time 1v1 PvP and clans; replays **[unverified]** [analyst].

**Engagement:** roughly three-minute matches, deck-building meta and bluff/counter mind games [analyst].

**Browser feasibility: 4/5.** A small 2D arena and deterministic simulation suit browsers; the cost is card content volume and netcode. **Open-source alternative:** `kusum-bhattarai/Clash-Royale-Clone` is a C++20 terminal game plus a headless simulation library under MIT [91]. It is a useful rules reference, not a browser engine, and its presentation/UI cannot be reused as-is.

## 43. Age of Empires II

**Official site:** [65] https://store.steampowered.com/app/813780/Age_of_Empires_II_Definitive_Edition/ — reachable; the store page documents the Definitive Edition. The franchise site is https://www.ageofempires.com/. **Media:** not verified.

**Mechanics:** real-time strategy; villager economy across food, wood, gold and stone; four age advances gating units and buildings; a counter-unit triangle; walls, formations and fog of war; base-building plus army micro [65][analyst]. **Modes/progression:** historical campaigns, random-map versus AI, ranked multiplayer and co-op versus AI (**[unverified]** specific counts); Definitive Edition is a 2019 remaster [65]. **Controls:** mouse select/right-click orders, box-drag selection, hotkeys, control groups and minimap; gamepad on the console version [analyst].

**Art direction:** detailed isometric historical art with civilization-specific architecture and unit sets [analyst].

**Physics/AI:** no physics; grid/A* pathfinding with unit collision and formation steering; attack/armour/pierce-armour combat math; projectile arcs; scripted AI opponents with build orders and scouting [analyst]. **Multiplayer:** team matches and ranked ladders (exact sizes **[unverified]**) [analyst].

**Engagement:** economic build-order mastery, historical campaign flavour and a very high skill ceiling [analyst].

**Browser feasibility: 1/5.** Dozens of civilizations and hundreds of units/technologies plus large-army pathfinding put a faithful clone far out of browser scope; a micro-RTS is the realistic target. **Open-source alternative:** none verified; Freeciv-web [80] is an AGPL-3.0 browser 4X/strategy reference, not an Age of Empires implementation.

## 44. Civilization VI

**Official site:** [66] https://civilization.2k.com/civ-vi/ — reachable; the page documents the 2016 release. **Media:** not verified.

**Mechanics:** turn-based 4X on a hex map; cities expand into specialized districts with adjacency bonuses; separate technology and civics trees with eureka/inspiration boosts; one military unit per tile; diplomacy, religion, trade and culture/science/domination victory paths [66][analyst]. **Modes/progression:** single-player versus AI leaders, scenarios, multiplayer and expansions (**[unverified]** multiplayer specifics); an iOS version exists [analyst]. **Controls:** mouse plus keyboard shortcuts; touch on mobile [analyst].

**Art direction:** stylized, board-game-clean historical art with readable hex terrain and leader portraits [analyst].

**Physics/AI:** no physics; hex pathfinding, procedural map generation, per-leader AI agendas and sequential turn resolution; very large persistent state [analyst]. **Multiplayer:** turn-based, with a simultaneous-turn option (**[unverified]**) [analyst].

**Engagement:** "one more turn" pacing, emergent alternate history and multiple viable victory routes [analyst].

**Browser feasibility: 1/5.** The ruleset, UI surface and art/data volume are orders of magnitude beyond a browser clone; only a miniature hex 4X is realistic. **Open-source alternative:** none verified; Freeciv-web [80] is the closest browser 4X reference but is a different game under AGPL-3.0.

## 45. Among Us

**Official site:** [67] https://www.innersloth.com/games/among-us/ — reachable; the game page embeds an official YouTube video, and the site confirms 4–15 players online or on local WiFi. **Media:** the official Innersloth YouTube channel is [no individual video URL verified].

**Mechanics:** 4–15 players online or local WiFi (confirmed); Crewmates complete tasks while Impostors kill and sabotage; bodies are reported; emergency meetings lead to discussion and a vote to eject; hidden-role information asymmetry [67][analyst]. **Modes/progression:** online, local WiFi, private lobbies and role variants; cosmetic hats/pets [67][analyst]. **Controls:** virtual joystick plus action buttons on mobile, WASD and mouse on PC, gamepad supported [analyst].

**Art direction:** simple, high-contrast 2D cartoon astronauts with readable colours and cramped sci-fi maps [analyst].

**Physics/AI:** top-down 2D movement with wall collision; vision limited by line-of-sight raycasts; task minigames; no NPC AI in the base game (**[unverified]**); server-authoritative movement is needed for fair play [analyst]. **Multiplayer:** real-time 4–15 player lobbies with join codes [67].

**Engagement:** bluffing and social deduction, short rounds and betrayal moments with friends [analyst].

**Browser feasibility: 3/5.** 2D art and movement are cheap, but real-time netcode plus the need for four or more humans (or competent AI crewmates) is the real cost. **Open-source alternative:** `arizkhalid/among-us-clone` is a web-based MIT-licensed clone that claims multiplayer support [92]; `Impostor/Impostor` is a GPL-3.0 C# reimplementation of the Among Us **server**, not a playable game [93].

## 46. Fall Guys

**Official site:** [68] https://www.fallguys.com/ — reachable; the site confirms free-to-play, Solo Show, ranked modes, a creative course builder and Show-Bucks cosmetics. **Reference:** [69] Wikipedia.

**Mechanics:** up to 60 players (confirmed) run physics-driven obstacle courses; round-by-round qualification and elimination; jump, dive and grab; a final round decides the winner [68][69]. **Modes/progression:** Solo Show, ranked modes and a creative course builder (confirmed); cosmetics bought with Show-Bucks [68]. **Controls:** gamepad or keyboard—move, jump, dive, grab; mouse camera on PC [analyst].

**Art direction:** candy-coloured, toy-like 3D obstacle courses with squishy character animation [analyst].

**Physics/AI:** the crux—momentum-based character controller, slope sliding, springs, rotating/moving platforms, ragdoll wobble, grab/grapple constraints and network-synced physics; little to no enemy AI, with bots only in some modes (**[unverified]**) [analyst]. **Multiplayer:** 60-player cross-platform matchmaking and parties (confirmed) [68].

**Engagement:** slapstick failure comedy, short rounds and cosmetic self-expression [analyst].

**Browser feasibility: 2/5.** Networked 3D physics for 60 players is heavy; a 12-runner single-player/AI obstacle course is a realistic 3/5 slice. **Open-source alternative:** none verified.

## 47. Subway Surfers

**Official site:** [70] https://subwaysurfers.com/ — reachable; the page confirms escaping the guard and dodging oncoming trains. The studio is SYBO Games. **Media:** not verified.

**Mechanics:** three-lane endless runner; swipe left/right to switch lane, up to jump and down to roll; coins; power-ups and hoverboards (**[unverified]** specific item behaviour); mission sets; character/board unlocks; seasonal "World Tour" theming [70][analyst]. **Modes/progression:** endless high-score runs, daily missions/challenges and seasonal content updates; Subway Surfers City is a distinct newer title [70][analyst]. **Controls:** touch swipes; browser arrow keys/WASD; gamepad analog stick [analyst].

**Art direction:** bright stylized 3D city with toy-like trains, graffiti palette and seasonal skins [analyst].

**Physics/AI:** auto-forward motion, lane snapping with interpolation, gravity/jump arcs, chunk-based obstacle spawning, AABB collision, gradual speed ramp and a scripted guard/dog chase that is visual only [analyst]. **Multiplayer:** none in the core runner (**[unverified]** whether any social/leaderboard layer exists).

**Engagement:** instant restarts and a one-more-run pull, a collect/unlock loop and constant seasonal novelty [analyst].

**Browser feasibility: 5/5.** A three-lane runner with pooled obstacles is squarely in browser scope, even in 2.5D or Three.js. **Open-source alternative:** none verified.

## 48. Temple Run

**Official site:** [71] https://imangistudios.com/ — reachable as the studio/franchise site. **Reference:** [72] Wikipedia (2011 endless runner). **Media:** not verified.

**Mechanics:** behind-the-back endless runner; swipe to turn at junctions, jump and slide; tilt to steer/collect on mobile; a Demon Monkey pursuit; coins fund upgrades, power-ups and characters; distance-driven score [72][analyst]. **Modes/progression:** endless runs, objective/mission lists and character/upgrade unlocks; Temple Run 2 (2013) is a separate title [71][72]. **Controls:** swipes plus accelerometer tilt on mobile; browser arrow keys/WASD or mouse drag [analyst].

**Art direction:** stylized ruin-temple adventure with a warm palette and a persistent pursuer silhouette [analyst].

**Physics/AI:** movement constrained to a spline path with discrete lane/junction branches; jump arcs; obstacle timing gates; monotonic speed increase; the pursuer is a scripted rubber-band distance, not real AI [analyst]. **Multiplayer:** none; leaderboards only (**[unverified]**) [analyst].

**Engagement:** chase tension, tight input rhythm and steady unlock progression [analyst].

**Browser feasibility: 4/5.** A pseudo-3D corridor on a spline plus a follow camera is very achievable; art and animation are the main cost. **Open-source alternative:** none verified.

## 49. Brawl Stars

**Official site:** [73] https://supercell.com/en/games/brawlstars/ — reachable; the page confirms 3v3 and battle-royale modes and that matches run "under three minutes." **Modes reference:** [74] official game-modes support article.

**Mechanics:** top-down arena shooter; 3v3 and battle royale; each Brawler has a main attack, a Super and passives; tap-to-auto-aim or manual aim; destructible cover and bushes for stealth; respawns [73][74]. **Modes/progression:** rotating 3v3 modes plus solo/duo battle royale (categories confirmed; individual mode names **[unverified]**); Brawler unlocks/upgrades, trophies and a Brawl Pass [73][74]. **Controls:** dual virtual joysticks (move and aim/fire); browser WASD plus mouse aim and click to fire [analyst].

**Art direction:** bold, chunky cartoon characters with high-contrast team colours and readable arenas [analyst].

**Physics/AI:** no gravity; projectile travel and wall collision, spread patterns, bush visibility checks, respawn timers and a small map grid; bot-filled matches at low trophies (**[unverified]**) [analyst]. **Multiplayer:** real-time online 3v3/BR matchmaking, clubs/teams (**[unverified]**) [analyst].

**Engagement:** two-to-three-minute matches, wide Brawler variety and skill plus meta progression [analyst].

**Browser feasibility: 4/5.** 2D tile arenas and hitscan/simple projectiles are easy; bots can replace netplay for a demo, but real PvP needs authoritative servers. **Open-source alternative:** none verified.

## 50. Plants vs. Zombies

**Official site:** [75] https://www.ea.com/games/plants-vs-zombies — reachable; the EA page and PopCap studio page document the franchise, including Replanted and Battle for Neighborville. **Media:** not verified.

**Mechanics:** lane-based tower defence—seed packets placed on a lawn grid, sun as currency from sun-producing plants and sky drops, plant recharge cooldowns, zombies advancing down lanes and stopping to eat plants, lawnmowers as last-ditch defence and escalating flag waves; grid dimensions such as 5×9 are commonly documented but **[unverified]** here [75][analyst]. **Modes/progression:** Adventure levels across themed areas plus survival/puzzle/minigame side modes (**[unverified]**); the franchise includes PvZ 2, Replanted and Battle for Neighborville [75]. **Controls:** mouse point/click to plant, shovel to remove, seed-packet selection; touch on mobile [analyst].

**Art direction:** comedic, hand-drawn suburban-garden cartoon with exaggerated plant and zombie silhouettes [analyst].

**Physics/AI:** no physics. Zombies walk straight down a lane and switch to an "eating" state on collision; projectile/pea collision; sun-spawn timers and a wave director control cadence and difficulty—trivially cheap state machines [analyst]. **Multiplayer:** the original is single-player; Battle for Neighborville offers six online modes [75].

**Engagement:** readable escalating pressure, discovery of plant combos and a comedic tone [analyst].

**Browser feasibility: 4/5.** A grid tower defence with a few dozen plants is one of the best browser fits here; content breadth, not technology, is the limit. **Open-source alternative:** none verified.

## Cross-cutting lessons from Group E

This group contains the **best and worst** browser bets in the list. Chess is close to ideal: deterministic rules, tiny assets, turn-based netcode and a mature set of permissively licensed libraries. Plants vs. Zombies, Subway Surfers, Brawl Stars and Clash Royale are also strong because their simulations are small, fixed-tick and readable on a phone.

The expensive entries share one of three costs: **licensing** (EA FC, eFootball, Cricket 24, NBA 2K), **live-service scale** (Clash of Clans, Fall Guys) or **simulation depth** (Age of Empires II, Civilization VI). A clean-room browser studio cannot buy its way past licensing and should not pretend to.

Among Us is the clearest **dependency trap**: the rules are cheap, but the fun requires four or more humans in real time. Without authoritative multiplayer infrastructure, a single-player version with AI crewmates is a different, weaker game. That risk must be explicit before selection.

For NeonRift, the strongest reusable patterns are the **deterministic card/arena simulation** (Clash Royale, Brawl Stars), the **grid defence wave director** (Plants vs. Zombies), the **chunked endless runner** (Subway Surfers, Temple Run) and the **rules-first board game** (Chess). Sports titles should stay as arcade abstractions, not licensed simulations.
