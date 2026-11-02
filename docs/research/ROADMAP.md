# Delivery Roadmap

> Generated 2026-11-02. Sequenced, not parallel. Every game must reach "done" before the next one starts. Effort estimates assume one developer working part-time with agent assistance; they are planning ranges, not promises.

---

> Every game below has a full design document in [GDD/README.md](GDD/README.md). Read the GDD before starting a milestone; the roadmap sets order and gates, the GDD sets content and rules.

## 1. Principles

1. **One game at a time.** No parallel game development.
2. **Done means playable end-to-end**, not "core loop exists".
3. **Platform first.** Fix the known platform gaps before adding games.
4. **No new dependency without proof.** The first 15 need none beyond the chess libraries.
5. **Original art only.** Procedural or verified-licence assets, no exceptions.
6. **Honest limitations.** Every game documents what it does not do.
7. **No public deployment without explicit approval.**

---

## 2. Phase 0 — Platform hardening

Before the first new game, close the existing platform gaps. These are small and prevent rework.

| # | Task | Why | Done when |
|---|---|---|---|
| 0.1 | App-level ErrorBoundary | A game crash should not blank the whole site | A thrown route component shows a recoverable error page |
| 0.2 | Admin route/dashboard with honest local-only notice | Existing auth utilities have no UI | Route works, is dev-only or clearly labelled, and does not claim server security |
| 0.3 | Fix Privacy page "NeoRift" typo | Brand consistency | No misspelling remains |
| 0.4 | Check invalid Tailwind utilities (e.g. `h-4.5`) | Silent style failures | Build output has no unknown utility warnings; visual check passes |
| 0.5 | Add `public/_redirects` | SPA deep links on Cloudflare Pages | Direct load of `/game/:slug` works in preview |
| 0.6 | Add `public/_headers` | Cache and security headers | Headers verified in preview |
| 0.7 | Add `.env.example` | Documents optional configuration without secrets | File lists every `VITE_*` variable with empty values |
| 0.8 | Add passcode-hash helper script | Makes admin setup honest and repeatable | Script prints a SHA-256 hash; no secret is committed |
| 0.9 | README and testing report | Onboarding and honest status | Commands, architecture, limitations and test results documented |
| 0.10 | Vitest coverage for existing helpers | Prevent regressions | Catalogue, embed validation, admin auth and format helpers tested |
| 0.11 | `npm run typecheck`, `npm test`, `npm run build` | Baseline green | All three pass |
| 0.12 | Desktop/mobile browser QA of existing pages | Baseline quality | Route, player, favourites, recents and 404 verified |
| 0.13 | OG cover and sitemap check | Shareable and crawlable | OG image resolves; sitemap lists real routes only |
| 0.14 | Local commit | Checkpoint | Commit created; push only with approval |

**Exit criterion:** a clean, tested platform with no known blocking defects and an honest status document.

---

## 3. Phase 1 — Wave 1: quick wins

Goal: prove the game pipeline five times with small, complete games.

| Order | Game | Effort | Key risk | Milestone focus |
|---|---|---:|---|---|
| 1 | Rift Chess | S (1–2 weeks) | Rules edge cases | Rules adapter, accessible board, clocks, bot difficulty |
| 2 | Neon Rush | S–M (2–3 weeks) | 3D lane collision feel | Lane switching, obstacle pooling, speed ramp, mobile swipe |
| 3 | Lawn Protocol | M (2–3 weeks) | Balance and readability | Grid, sun economy, plant roster, wave director, win/loss |
| 4 | Apex Time Trial | M (2–3 weeks) | Ghost recording and track editor scope | Time trial, ghost, three tracks, editor-lite or cut editor |
| 5 | Street Cricket | M (2–3 weeks) | Timing fairness and camera | Batting/bowling timing, fielding, 3-over match, AI |

### Per-game milestones (same template for all 15)

| Milestone | Deliverable | Gate |
|---|---|---|
| M1 — Design lock | GDD, rules, controls, content cap | GDD reviewed; scope has no unbounded feature |
| M2 — Rules prototype | Pure simulation + Vitest | Deterministic tests pass |
| M3 — Playable core | Menu → play → win/loss → restart | Manual playthrough works on desktop |
| M4 — Content and progression | Levels/waves/tracks/opponents, records | Content cap reached; no placeholder content |
| M5 — UI, audio, mobile | HUD, pause, touch, sound controls | Mobile playthrough works |
| M6 — Integration and QA | Catalogue, thumbnail, related, docs | All QA gates pass |

**Wave 1 exit criterion:** five complete games integrated, each with a playthrough on desktop and mobile, passing typecheck, tests and build.

---

## 4. Phase 2 — Wave 2: systems and content

Goal: medium-complexity games with stronger systems.

| Order | Game | Effort | Key risk | Milestone focus |
|---|---|---:|---|---|
| 6 | Rift Tactics | M (3–4 weeks) | Bot quality and lane balance | Fixed-tick sim, deck, bots, three arenas |
| 7 | Neon Arena | M (3–4 weeks) | Aiming on touch | Top-down shooting, bots, three modes |
| 8 | Rift Delve | L (4–6 weeks) | Procedural room quality | Room generator, gear, three biomes, boss |
| 9 | Undercurrent | L (4–6 weeks) | Boon synergy balance | Six boons per run, room director, meta upgrades |
| 10 | Nightfall | M–L (3–5 weeks) | Survival balancing | Meters, day/night, crafting, one biome, win condition |

**Wave 2 exit criterion:** five systems-heavy games, each with tested rules, a complete run, and no unresolved critical bugs.

---

## 5. Phase 3 — Wave 3: large builds

Goal: content-heavy games that need the pipeline and shared tooling to be mature.

| Order | Game | Effort | Key risk | Milestone focus |
|---|---|---:|---|---|
| 11 | Strata | L (6–8 weeks) | Tile content volume | Mining, crafting, one biome, boss gate, save |
| 12 | Habitat | L (5–7 weeks) | Agent simulation and build UI | Needs, schedules, build mode, one neighbourhood |
| 13 | Hollow Signal | L (5–7 weeks) | Platforming feel and map volume | Movement, combat, ability gates, one zone |
| 14 | Voxel Rift | XL (8–10 weeks) | Chunk meshing performance | Worker meshing, place/break, save, one biome |
| 15 | Rift Hold | L (5–7 weeks) | Base layout and raid AI | Grid base, four buildings, AI raids, upgrade loop |

**Phase 3 exit criterion:** five large games with honest content caps, stable performance on mid-range mobile, and documented limitations.

---

## 6. QA gates

Every game passes all five gates before it is called complete.

### Gate A — Code health

- `npm run typecheck` passes.
- `npm test` passes, including new rules tests.
- `npm run build` passes with no new warnings.
- No unused exports, dead buttons or TODO placeholders in shipped paths.

### Gate B — Gameplay

- Menu → play → pause → resume → win/loss → restart works.
- Fullscreen and route-away cleanup work.
- Keyboard and touch both work.
- No soft-lock, unreachable state or infinite loop.
- Difficulty is selectable or fixed and documented.

### Gate C — Performance

- Frame rate meets the budget in [ARCHITECTURE.md](ARCHITECTURE.md#7-performance-budgets).
- Ten route switches do not leak animation frames, listeners or WebGL contexts.
- Game chunk stays within its size budget.
- Mobile thermal/performance check completed on at least one real device or representative emulation.

### Gate D — Integration

- Catalogue record, thumbnail, instructions and controls are accurate.
- Related games appear correctly.
- Favourites and recents work.
- SEO title/description are unique and honest.
- No console errors or warnings.

### Gate E — Honesty

- Limitations are written down.
- No fake leaderboard, fake player count or fake online status.
- No "coming soon" feature presented as available.
- The game is described as single-player if it is single-player.

---

## 7. Asset pipeline

1. Prefer procedural geometry, materials, textures and Web Audio.
2. If an external asset is unavoidable, run the checklist in [LICENSE-AUDIT.md](LICENSE-AUDIT.md#5-asset-policy).
3. Record author, source, licence and modifications.
4. Optimise before commit: texture sizes, audio bitrate, geometry counts.
5. Add attribution to `public/credits.txt` if required.
6. Never commit a ripped or extracted commercial asset.

---

## 8. Deployment

### Target

Cloudflare Pages, static output.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20 or newer |
| Environment variables | None required for the first 15 games |

### Required files

- `public/_redirects` — `/* /index.html 200`
- `public/_headers` — cache and security headers
- `.env.example` — optional variables only

### Process

1. Build locally and run `npm run preview`.
2. Verify deep links, 404, player, favourites and recents.
3. Create a preview deployment only with approval.
4. Run the QA gates against the preview.
5. Promote to production only with explicit approval.

**No deployment is performed by this research phase.**

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep in sandbox/life-sim games | High | High | Hard content caps in each GDD; one biome/neighbourhood/zone |
| Mobile performance below target | Medium | High | DPR cap, pooling, lazy loading, early device testing |
| Art volume outruns time | High | High | Procedural art first; no hand-drawn content dependency |
| Rules bugs in chess/arena games | Medium | Medium | Pure rules modules + Vitest + deterministic seeds |
| Physics feel is poor | Medium | High | Prototype feel before content; tune early |
| Save corruption | Low | Medium | Versioned payloads, try/catch, reset fallback |
| Licence mistake | Low | High | Audit before adding any asset or dependency |
| Accidental public deployment | Low | High | Explicit approval gate; preview only |
| Existing platform defects surface late | Medium | Medium | Phase 0 hardening first |
| Burnout from 15 games | Medium | High | Waves, one game at a time, shippable increments |

---

## 10. Effort summary

| Phase | Games | Estimated effort |
|---|---|---:|
| Phase 0 — platform hardening | 0 | 1–2 weeks |
| Phase 1 — Wave 1 | 5 | 9–13 weeks |
| Phase 2 — Wave 2 | 5 | 17–23 weeks |
| Phase 3 — Wave 3 | 5 | 29–37 weeks |
| **Total** | **15** | **56–75 weeks part-time** |

This is a long programme. The wave structure exists so that value ships early and the plan can be stopped or reordered after any game.

---

## 11. Approval gate

No implementation begins until the shortlist is approved. After approval, the order is:

1. Phase 0 platform hardening.
2. Rift Chess.
3. Neon Rush.
4. Lawn Protocol.
5. Apex Time Trial.
6. Street Cricket.
7. …and so on, one game at a time.

The roadmap can be re-ordered after any completed game without wasting work, because each game is an independent module.
