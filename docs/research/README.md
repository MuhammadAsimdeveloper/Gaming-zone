# NeonRift — 50-game research and development package

> Generated 2026-11-02. **Research and design only. The 15 shortlisted games have not been implemented.** The 10 games already in the repository are separate, existing work.

This folder is the complete deliverable for the “Top 50 Video Games — research, clean-room design and build plan” brief. It is organised as separate documents so each can be reviewed on its own.

---

## Start here

| Document | What it answers |
|---|---|
| [50-GAMES-RESEARCH.md](50-GAMES-RESEARCH.md) | The master report: methodology, findings, all 50 games, verification log and limitations |
| [SHORTLIST-15.md](SHORTLIST-15.md) | The weighted scoring model, all 50 scores, filters, the recommended 15 and build waves |
| [GDD/README.md](GDD/README.md) | Index of the 15 design documents |
| [LICENSE-AUDIT.md](LICENSE-AUDIT.md) | Verified licences for engines, tools and candidate repositories; what may be reused and what may not |
| [SOURCE-DIRECTORY.md](SOURCE-DIRECTORY.md) | The 21 verified repositories, languages, features, maintenance, licence and adaptability |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Platform constraints, module pattern, simulation design, engine per game, budgets, testing and deployment |
| [ROADMAP.md](ROADMAP.md) | Phase 0 platform hardening, three sequential waves, milestones, QA gates and effort ranges |
| [SOURCES.md](SOURCES.md) | Numbered source register with credibility tiers and verification notes |
| [games/](games/) | Per-group research notes for all 50 references |

---

## Deliverable status

| Brief deliverable | Status | Where |
|---|---|---|
| Research on all 50 named games | Complete | [50-GAMES-RESEARCH.md](50-GAMES-RESEARCH.md), [games/](games/) |
| Official websites and gameplay references | Complete with caveats | Per-game entries and [SOURCES.md](SOURCES.md) |
| GitHub repository directory | Complete; 21 verified, 2 not found | [SOURCE-DIRECTORY.md](SOURCE-DIRECTORY.md) |
| Open-source alternatives | Complete | Per-game entries; reuse classification in [LICENSE-AUDIT.md](LICENSE-AUDIT.md) |
| Licence audit and commercial-use assessment | Complete | [LICENSE-AUDIT.md](LICENSE-AUDIT.md) |
| Top-15 shortlist with rationale | Complete | [SHORTLIST-15.md](SHORTLIST-15.md) |
| 15 game design documents | Complete | [GDD/](GDD/) |
| Clean-room implementation plans | Complete at design level | GDD sections 1–3, 5 and 10; licence policy |
| Technical architecture | Complete | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Development roadmap | Complete | [ROADMAP.md](ROADMAP.md) |
| Asset directory | Planned, not built | Requirements per GDD; no assets downloaded |
| Working games | 10 existing; 15 planned | `src/games/` and `src/games3d/` |
| Integration documentation | Complete at design level | [ARCHITECTURE.md](ARCHITECTURE.md) §1, §6; GDD section 9 |
| QA and performance reports | **Not yet produced for the 15** | Budgets and test plans in GDDs; platform baseline still to be run |
| Deployment instructions | Documented, not executed | [ARCHITECTURE.md](ARCHITECTURE.md) §12 |

---

## What is verified and what is not

**Verified:**
- Every `[N]` citation in the research documents resolves to a numbered entry in [SOURCES.md](SOURCES.md); a scripted check found 107 defined entries, no gaps and no undefined references.
- Repository metadata (existence, language, SPDX licence, archived status, last push) was read from the public GitHub API on 2026-11-02.
- Engine and tool licences were read from official repositories (Three.js, Phaser, PixiJS, Babylon.js, PlayCanvas engine, Rapier, cannon-es, Matter.js, React, Vite, Tailwind, Vitest).
- Cloudflare Pages and GitHub Free limits are quoted only where the official page stated them.

**Not verified, and not claimed:**
- That any candidate repository builds successfully — none was cloned, and no build command in [SOURCE-DIRECTORY.md](SOURCE-DIRECTORY.md) was executed.
- Cloudflare Pages bandwidth/request limits and a “2,000 Actions minutes” figure — not stated on the official pages checked.
- Some official trailers, exact control bindings and specific mode counts — marked *unverified* in the per-game notes.
- `trigger-rally/trigger-rally` and `3dcity/3dcity` — both returned 404 and are not treated as verified projects.
- Commercial suitability of any game concept — the documents describe design feasibility, not legal advice.

---

## Scope boundary

- The 50 titles are **research targets**, not instructions to copy proprietary games.
- All 15 designs use original names, art direction, characters, maps and UI.
- No proprietary code, extracted game files, logos, music, character likenesses or exact level layouts are used.
- No real-time multiplayer, gacha, paid currency or live-service economy is planned.
- No game is described as complete unless its essential feature list, QA gates and integration checks pass.

---

## Approval gate

Implementation of the 15 games has **not** started. The next step requires an explicit decision:

- approve all 15,
- approve with changes, or
- approve a smaller first wave (for example Wave 1 only).

Until then: no game code, no new dependencies, no asset downloads, no destructive Git operations and no public deployment.
