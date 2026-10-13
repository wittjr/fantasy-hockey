# Fantasy Hockey Draft Prep

## What This Is

A personal fantasy hockey web app (Next.js on Vercel, Neon Postgres, Discord sign-in) that imports Fantrax and Yahoo leagues and helps with draft prep, weekly lineup planning, and player research. The current milestone focuses on the **Line research** page (`/research`): a per-team view of NHL line combinations and ice-time trends, modelled on Dobber Frozen Pool's "last 3 game lines" page, being refined into a tool for spotting players whose role is changing.

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
- ✓ Ice-time section reads cleanly as a trends table: Avg TOI (regulation), TOI Δ, PP share, PP share Δ, SH, mover tint, sortable headers in the URL; per-game values in a clickable strip with popovers — Phase 1
- ✓ Clicking a player name opens a player detail panel (`?player=`) that shows linemate time per game and per situation (EV/PP/SH) as a heat strip, by name only, with window share — Phase 2
- ✓ Linemate changes are visible via New / Rising / Fading / Out tags (±15 share points, regulation only); unit-table names open the player on that situation — Phase 2

### Active

- [ ] Last-game unit tables show shots, goals, and Corsi for and against per unit, for all situations (EV, PP, SH)

### Out of Scope

- League-wide movers (cross-team risers/fallers list) — wanted, but deferred until the single-team page is refined
- Showing league ownership (rostered/available) on the research page — user wants this integrated into the league view instead; a league toggle on research is undecided
- Automatic linemate "quality" scoring (TOI rank, production, fantasy value) — user chose to see names and judge quality themselves

## Context

- Brownfield Next.js 16 / React 19 app; see `.planning/codebase/` for the full map. AGENTS.md warns this Next.js version has breaking changes — read `node_modules/next/dist/docs/` before writing code.
- Research code: `app/research/page.tsx` (server component, ~374 lines), `lib/research/lines.ts` (line/strength derivation from shift charts, tested), `lib/research/team-games.ts` (loads schedule, boxscores, shift charts per game).
- Data comes from the NHL's public APIs (`api-web.nhle.com` boxscore/schedule, `api.nhle.com/stats` shift charts). Strength state is inferred per second from who is on ice; no play-by-play is used yet.
- Shots/goals/Corsi per unit require the NHL play-by-play feed, with each event attributed to the players on ice at that second via shift charts. Events at line-change seconds are ambiguous, so attribution will be approximate (as on Frozen Pool).
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
| Event stats (SF/SA, GF/GA, CF/CA) on all unit tables, not just EV | User wants PP/SH units evaluated the same way | — Pending |
| Player detail opened by clicking a row in the trends table | Keeps selection in context of the trends | — Pending |
| Linemates shown by name and time, no quality score | User prefers to judge linemate quality themselves | ✓ Shipped Phase 2 (grey tag chips, no ranking) |
| League ownership belongs in the league view, not the research page | Keeps research page league-agnostic; toggle still undecided | — Pending |
| "Recent" = team's last 2 games; Δ needs ≥3 games, arrow ≥2; OT minutes removed from all TOI trends | Small samples are noisy; OT inflates TOI (Phase 1 D-05..D-13) | ✓ Shipped Phase 1 |
| Mover thresholds ±2:00 TOI / ±15 PP-share points | Research found ±1:00/±10 mostly noise | ✓ Shipped Phase 1 |
| Per-game values open on click (small client component), hover/focus kept | Hover-only tiny squares were not discoverable in UAT | ✓ Shipped Phase 1 |
| Site targets laptop browsers; no phone/touch requirement | User decision during Phase 1 UAT | ✓ Applies to all phases |
| Linemate time is regulation only; shade = share of the player's own situation TOI; rows ordered by window share, New tag marks a line change | Consistent with OT-free TOI trends; user chose window-share order in UAT (Phase 2 D-19, D-28) | ✓ Shipped Phase 2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-12 after Phase 2*
