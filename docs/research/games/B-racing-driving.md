# B. Racing and Driving — Games 11–15

> Citation numbers resolve in [SOURCES.md](../SOURCES.md). Labels: **[verified]**, **[analyst]**, **[unverified]**.

## 11. Forza Horizon 5

**Official site:** [16] https://forza.net/ — reachable. **Media:** no dedicated trailer page verified.

**Mechanics:** open-world arcade-sim racing with point-to-point, circuit and street events entered from a shared festival map; car collection, upgrades, tuning and livery editors; skill scoring for drifts, air, near-misses and wrecks; PR stunt activities such as drift zones, speed traps and danger signs [16][17]. **Modes/progression:** festival/career events plus rotating seasonal content; free-roam convoys, online races and co-op events [analyst]. **Controls:** gamepad-first—triggers for throttle/brake, left stick steer, face buttons for handbrake/rewind/camera; keyboard equivalents exist [analyst]. **Physics/AI:** arcade-leaning simulation where mass, grip and tuning affect understeer and drift; "Drivatars" are the series' behaviour-cloning AI opponents [17][analyst]. **Multiplayer:** online free-roam, PvP races and co-op [analyst]. **Engagement:** constant content, car-collecting fantasy, high-fidelity scenery [analyst].

**Browser feasibility: 1/5.** Licensed car roster, huge open world and live-service content volume are out of scope; only a stylised arcade racer is realistic. **Open-source alternative:** none verified.

## 12. Need for Speed Heat

**Official site:** not verified; the official PC manual is verified at [18]. **Reference:** [19] Wikipedia.

**Mechanics:** day/night split where legal day races pay cash and illegal night races pay REP but raise police heat; heat escalates the longer a player stays out; deep visual and performance customization with grip/drift bias; police pursuit with roadblocks, spike strips and line-of-sight escapes [18][19][analyst]. **Modes/progression:** career/story plus free roam; REP is the main progression currency; Easy/Medium/Hard difficulty changes opponent strength and score targets [18]. **Controls:** keyboard or Xbox controller; auto/manual gearbox; throttle/brake/steer/handbrake/nitrous [18]. **Physics/AI:** arcade handling with tunable grip/drift, nitrous, damage-lite, and police AI that blocks and pursues rather than races a line [analyst]. **Multiplayer:** online free roam and events; a 16-player figure is reported by community sources but is **[unverified]**. **Engagement:** risk/reward night runs, build identity, cop chases as content [analyst].

**Browser feasibility: 2/5.** A night-only drift/pursuit slice is doable; the open city, car roster and police AI make full scope unrealistic. **Open-source alternative:** none verified.

## 13. Assetto Corsa

**Official site:** [20] https://assettocorsa.gg/ — reachable.

**Mechanics:** simulation-first driving where tyre model, suspension geometry, aero and weight transfer are the gameplay; hotlap/time attack and race weekends against AI; setup tuning that materially changes lap time; a large mod ecosystem; VR and triple-screen support [20][analyst]. **Modes/progression:** career events, special events, hotlap, quick races, multiplayer servers and mod content; progression is skill/lap-time based rather than unlock-based [analyst]. **Controls:** wheel and pedals with H-pattern/clutch is the intended path; gamepad and keyboard work but are compromised; force feedback and pedal calibration matter [analyst]. **Physics/AI:** tyre slip curves and heat, flat spots, suspension and differential modelling; AI follows racing lines with difficulty and aggression parameters [analyst]. **Multiplayer:** online servers, leagues and hotlap leaderboards [analyst]. **Engagement:** mastery ceiling, setup experimentation, mod-driven longevity [analyst].

**Browser feasibility: 1/5.** Real tyre/suspension simulation at 60 fps with a laser-scanned track and mod pipeline is out of reach. **Open-source alternative:** none verified.

## 14. Trackmania

**Official site:** [21] https://www.trackmania.com/?lang=en — reachable; the page states "Play FOR FREE across 5 stunning environments" and names Red Island, Blue Bay, Green Coast, White Shore and Stadium. **Reference:** [22] beginner's guide.

**Mechanics:** pure time attack against fixed gold/silver/author medals and leaderboards; deterministic arcade physics so the same input sequence produces the same run; block-based track editor with shareable community maps; ghost replays and split deltas [21][22][analyst]. **Modes/progression:** campaign seasons with medal unlocks, weekly tracks, live server rooms, Cup mode and custom server modes; esports [22][analyst]. **Controls:** keyboard or controller; accelerate, brake, steer only—no gears or clutch [analyst]. **Physics/AI:** arcade but strict grip/drift states, air control and wall-riding; no AI opponents, only ghosts, so the networking problem is ghost/leaderboard sync rather than real-time racing [22][analyst]. **Multiplayer:** live server rooms, custom modes and ghost/leaderboard competition [analyst]. **Engagement:** "one more run" mastery, creative authorship, readable esports [analyst].

**Browser feasibility: 4/5.** Simple inputs, deterministic physics and ghost/leaderboard competition make this one of the best racing fits; the track editor and ghost storage are the real work. **Open-source alternative:** none verified. HexGL is a browser racing reference, not a Trackmania clone [77].

## 15. Rocket League

**Official site:** [24] https://www.rocketleague.com/ — blocked to automation (403); the Epic Games Store page [23] is verified and describes a "high-powered hybrid of arcade-style soccer and vehicular mayhem… fluid, physics-driven."

**Mechanics:** car soccer with driving, jumping, double-jumping, dodging/flipping and boost; boost management as a resource economy; aerials and wall/ceiling play; demolitions and bumps; fixed kickoff duels [23][analyst]. **Modes/progression:** casual and competitive 1v1/2v2/3v3 playlists, seasonal Rocket Pass and limited-time modes; ranked tiers per playlist [analyst]. **Controls:** gamepad strongly preferred—throttle/steer, boost, jump, air-roll/drift; keyboard and mouse viable but air control is harder [analyst]. **Physics/AI:** rigid-body arcade physics: car as a box with impulse jumps/flips, ball as a sphere with high restitution, curved arena walls; no AI in standard play except bot backfill [analyst]. **Multiplayer:** cross-platform online play, skill-based ranked matchmaking, private matches and tournaments [analyst]. **Engagement:** enormous skill ceiling with instantly readable rules, five-minute matches, highlight-reel aerials [analyst].

**Browser feasibility: 3/5.** Small content footprint and simple rules, but 3D car-ball physics plus authoritative netcode at high tick rate is demanding; a simplified 3D or 2D version is very buildable. **Open-source alternative:** none verified.

## Cross-cutting lessons from Group B

Racing divides cleanly into two browser strategies. The first is **time trial**: deterministic physics, ghosts, medals and a track editor, which minimises networking and content cost and maximises replayability. The second is **arena vehicle sport**: a small closed field, one ball, simple rules and local or bot opponents, which trades open-world scale for physics-driven spectacle.

The reference games' live-service layers—seasonal playlists, car licences, battle passes—should not be copied. For NeonRift, the durable parts are medal chasing, ghost replay, track authorship, local split-screen or bot rivalries, and a handling model that is readable in the first thirty seconds.
