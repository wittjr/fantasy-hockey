# Requirements: Fantasy Hockey Draft Prep — Line Research

**Defined:** 2026-10-11
**Core Value:** At a glance, show which players on a team are moving up or down in deployment — so pickup/drop decisions can be made before the rest of the league notices.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Data Reliability

- [ ] **DATA-01**: User can load "Last 20" for any team without the page failing from NHL API throttling (bounded request concurrency + retry on HTTP 429)
- [ ] **DATA-02**: User sees "—" (unknown), never 0, for event stats and linemate time in games whose shift charts or play-by-play are missing, and those games are excluded from averages and trends
- [ ] **DATA-03**: User sees shot/goal/Corsi counts that reconcile with the official boxscore — fixture tests reproduce team SOG and per-skater plus-minus

### Trends

- [x] **TRND-01**: User can scan the ice-time section as a trends table: average TOI, PP share, SH time, trend arrow and sparkline are the primary columns; the per-game numeric grid is removed
- [x] **TRND-02**: User can still see exact per-game TOI/PP/SH values for a player (tooltip or player detail)
- [x] **TRND-03**: User can see a recent-vs-window delta (recent games vs window average) for TOI and PP share
- [x] **TRND-04**: User does not see a trend for players below a minimum number of games played; missed games are not treated as 0; OT games are flagged
- [x] **TRND-05**: User can sort the trends table by trend, average TOI, or PP share, with the sort preserved in the URL and F/D grouping kept

### Player Detail

- [ ] **PLYR-01**: User can click a player row to open that player's detail; the selection is in the URL (`?player=<id>`) so it survives reload and can be shared
- [ ] **PLYR-02**: User can see a linemate heat strip for the player — rows are linemates, columns are games, shading is minutes together — split by situation (EV/PP/SH) and by forward linemates vs D partners
- [ ] **PLYR-03**: User can see time together as a share of the player's own situation TOI
- [ ] **PLYR-04**: User can see linemates tagged New / Rising / Fading based on time together only (no quality scoring)

### Unit Event Stats

- [ ] **UNIT-01**: User can see SF/SA, GF/GA, CF/CA raw counts on every last-game unit table (EV, PP, SH; forwards and defense)
- [ ] **UNIT-02**: User can see SF%, CF% and +/- on unit tables, showing "—" when a unit has no events
- [ ] **UNIT-03**: User can read a legend defining the stats and exclusions (empty-net, shootout, teammate-blocked attempts are excluded), with an "other" row so unit totals reconcile with team totals
- [ ] **UNIT-04**: User can click a player name in a unit table to open that player's detail

## v2 Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Cross-team

- **MOVR-01**: User can see a league-wide list of the biggest TOI / PP-share risers and fallers across all teams

### League Integration

- **LEAG-01**: User can see deployment trends for players inside their league view
- **LEAG-02**: User can toggle a league on the research page to flag rostered/available players (undecided)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Linemate quality score (TOI rank, points, fantasy value) | User prefers to judge linemate quality from names and time |
| WOWY with/without performance (CF% with a teammate) | Tiny samples, approximate attribution; not the deployment question |
| Per-60 rates and xG on unit tables | Meaningless on one game / a few minutes; xG needs a model |
| Trend slopes on event stats (CF/SF/GF) | Per-game CF% for short lines is noise |
| Projected lines / lineup predictions | Not derivable from public NHL data |
| Zone starts, line matching, matchup tools | Scope creep; needs additional event context |
| Real-time auto-refresh | Shift charts publish after games; page-load freshness is sufficient |
| Persisting derived stats in Neon | Fetch-cache model is sufficient; revisit only if performance demands it |

## Conventions (decided)

- Events are attributed to players on ice during the second before the event timestamp (`start < t <= end`).
- Blocked shots count toward the shooting team's Corsi (`eventOwnerTeamId` is the shooter's team).
- Excluded from SF/GF/CF: empty-net events, shootout events (`periodType === "SO"`), and `teammate-blocked` attempts.

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| TRND-01 | Phase 1 | Complete |
| TRND-02 | Phase 1 | Complete |
| TRND-03 | Phase 1 | Complete |
| TRND-04 | Phase 1 | Complete |
| TRND-05 | Phase 1 | Complete |
| PLYR-01 | Phase 2 | Pending |
| PLYR-02 | Phase 2 | Pending |
| PLYR-03 | Phase 2 | Pending |
| PLYR-04 | Phase 2 | Pending |
| UNIT-01 | Phase 3 | Pending |
| UNIT-02 | Phase 3 | Pending |
| UNIT-03 | Phase 3 | Pending |
| UNIT-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-10-11*
*Last updated: 2026-10-11 after roadmap creation*
