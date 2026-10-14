# Fantasy Hockey Draft Prep

## What This Is

A personal fantasy hockey web app (Next.js on Vercel, Neon Postgres, Discord sign-in) that imports Fantrax and Yahoo leagues and helps with draft prep, weekly lineup planning, and player research. Its **Line research** page (`/research`), modelled on Dobber Frozen Pool's "last 3 game lines" page, is a per-team tool for spotting players whose role is changing: an ice-time trends table, a per-player linemate panel, and shot/goal/Corsi stats on every last-game unit table (v1.0).

## Core Value

At a glance, show which players on a team are moving up or down in deployment — so pickup/drop decisions can be made before the rest of the league notices.

## Requirements

### Validated

<!-- Inferred from existing code (codebase map, 2026-10-11). -->

- ✓ Discord OAuth sign-in with database sessions — existing
- ✓ Import Fantrax leagues by URL; sync teams, rosters, and draft picks — existing
- ✓ Connect Yahoo via OAuth (PKCE) and import Yahoo NHL leagues — existing
- ✓ Draft prep: gap analysis, schedule-fit rankings, keeper overrides, draft targets, live draft-pick sync — existing
- ✓ Weekly planner: daily optimal lineups and pickup recommendations from Fantrax per-game projections, with "The List" spreadsheet fallback — existing
- ✓ Line research page: pick team + last 1/3/5/10/20 games; last-game EV/PP/SH units (time and % share) derived from NHL shift charts — existing
- ✓ Line research ice-time grid: per-game TOI/PP/SH, average TOI, PP share, TOI and PP-share trend slopes with sparklines — existing
- ✓ Ice-time section reads cleanly as a trends table: Avg TOI (regulation), TOI Δ, PP share, PP share Δ, SH, mover tint, sortable headers in the URL; per-game values in a clickable strip with popovers — v1.0 (Phase 1)
- ✓ Clicking a player name opens a player detail panel (`?player=`) that shows linemate time per game and per situation (EV/PP/SH) as a heat strip, by name only, with window share — v1.0 (Phase 2)
- ✓ Linemate changes are visible via New / Rising / Fading / Out tags (±15 share points, regulation only); unit-table names open the player on that situation — v1.0 (Phase 2)
- ✓ Last-game unit tables (EV, PP, SH; forwards and defense) show GF/GA/+/-, SF/SA/SF%, CF/CA/CF% per unit with Other and Total rows, a legend and an exclusions note; counts reconcile with the official boxscore — v1.0 (Phase 3)
- ✓ "Last 20" loads without NHL API throttling failures (bounded concurrency, 429 retry, finished-game cache); missing shift charts or play-by-play show "—", never 0 — v1.0 (Phase 3)

### Active

- [ ] Show the details of the "Other" row (which below-cap units, 4v4/3v3 and pulled-goalie stretches make it up) — deferred from Phase 3 UAT, backlog 999.1

### Out of Scope

- League-wide movers (cross-team risers/fallers list) — wanted, but deferred until the single-team page is refined
- Showing league ownership (rostered/available) on the research page — user wants this integrated into the league view instead; a league toggle on research is undecided
- Automatic linemate "quality" scoring (TOI rank, production, fantasy value) — user chose to see names and judge quality themselves

## Context

- Brownfield Next.js 16 / React 19 app; see `.planning/codebase/` for the full map. AGENTS.md warns this Next.js version has breaking changes — read `node_modules/next/dist/docs/` before writing code.
- Shipped v1.0 Line Research (2026-10-14): 3 phases, 29 plans; research logic and tests in `lib/research/` (pure, fixture-tested view-models; 557 tests), UI in `components/ToiTrends.tsx`, `PlayerLinemates.tsx`, `LastGameLines.tsx`, page `app/research/page.tsx`.
- Data comes from the NHL's public APIs (`api-web.nhle.com` boxscore/schedule/play-by-play, `api.nhle.com/stats` shift charts). Strength state is inferred per second from who is on ice; play-by-play events are attributed to the skaters on ice at that second and reconciled to the boxscore on committed fixture games.
- Known debt: review info items carried forward (see STATE.md); Phase 3 had no UI audit; "Last 20" verified only on 6-8 finished games per team so far.
- Inspiration: https://frozenpool.dobbersports.com/frozenpool_last3gamelines.php?team=MTL
- It's early in the 2026-27 season (October); the draft is done, so in-season research is the priority.

## Constraints

- **Tech stack**: Next.js 16 App Router, Tailwind 4, Drizzle/Neon, deployed on Vercel — existing app, keep consistent
- **Data sources**: Public, unauthenticated NHL APIs only — no paid data feeds
- **Code style**: Minimum code that solves the problem; touch only what's needed (AGENTS.md principles)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Refine the research page before adding league-wide views | Single-team page must be readable and useful first | ✓ Good — Phase 1 trends table shipped |
| Event stats (SF/SA, GF/GA, CF/CA) on all unit tables, not just EV | User wants PP/SH units evaluated the same way | ✓ Shipped Phase 3 |
| Player detail opened by clicking a row in the trends table | Keeps selection in context of the trends | ✓ Shipped Phase 2 (player name opens the panel) |
| Linemates shown by name and time, no quality score | User prefers to judge linemate quality themselves | ✓ Shipped Phase 2 (grey tag chips, no ranking) |
| League ownership belongs in the league view, not the research page | Keeps research page league-agnostic; toggle still undecided | — Pending |
| "Recent" = team's last 2 games; Δ needs ≥3 games, arrow ≥2; OT minutes removed from all TOI trends | Small samples are noisy; OT inflates TOI (Phase 1 D-05..D-13) | ✓ Shipped Phase 1 |
| Mover thresholds ±2:00 TOI / ±15 PP-share points | Research found ±1:00/±10 mostly noise | ✓ Shipped Phase 1 |
| Per-game values open on click (small client component), hover/focus kept | Hover-only tiny squares were not discoverable in UAT | ✓ Shipped Phase 1 |
| Site targets laptop browsers; no phone/touch requirement | User decision during Phase 1 UAT | ✓ Applies to all phases |
| Linemate time is regulation only; shade = share of the player's own situation TOI; rows ordered by window share, New tag marks a line change | Consistent with OT-free TOI trends; user chose window-share order in UAT (Phase 2 D-19, D-28) | ✓ Shipped Phase 2 |
| Pulled-goalie and 4v4/3v3 events and time go to each table's "Other" row; only shootout and penalty-shot attempts are excluded | Keeps listed units comparable and Other + units = Total (Phase 3 D-12, D-13, D-21, D-22) | ✓ Shipped Phase 3 |
| Teammate-blocked attempts count in CF/CA | Matches the convention other line-stat sites use (UAT G-03-1) | ✓ Shipped Phase 3 |
| Plus-minus follows the shift chart at the goal second, even where the official figure differs | One known case (Panarin, 2025020500) looks like a manual league adjustment | ✓ Accepted Phase 3 |
| Small text meets WCAG AA: amber notes are `amber-700`, placeholder dashes `neutral-600`; disabled options stay `neutral-400` | UI audits found 2.5-3.2:1 text; inactive controls are exempt and the grey signals disabled | ✓ Applied after v1.0 audits |

---
*Last updated: 2026-10-14 after v1.0 milestone*
