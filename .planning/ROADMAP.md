# Roadmap: Fantasy Hockey Draft Prep

## Overview

This milestone refines the existing Line research page (`/research`) into a tool for spotting players whose role is changing. It starts by turning the hard-to-read ice-time grid into a scannable trends table (no new data), then adds the core request: a player detail view showing who each player has been on ice with, game by game, from the shift charts the page already loads. It finishes with the riskiest piece: attributing NHL play-by-play events to on-ice units so the last-game unit tables show shots, goals and Corsi. Fixture tests that reproduce the official boxscore gate that work before any of it reaches the UI.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Ice-Time Trends Table** - Replace the per-game ice-time grid with a sortable trends table that shows who is moving up or down (completed 2026-10-12)
- [x] **Phase 2: Player Linemate Detail** - Click any player to see a per-game linemate heat strip by situation, with New/Rising/Fading tags (completed 2026-10-12)
- [ ] **Phase 3: Unit Event Stats** - Show boxscore-reconciled shots, goals and Corsi on every last-game unit table

## Phase Details

### Phase 1: Ice-Time Trends Table

**Goal**: User can scan a team's ice-time section as a trends table and immediately see which players are gaining or losing TOI and power-play time
**Mode:** mvp
**Depends on**: Nothing (first phase; builds on the existing `/research` page)
**Requirements**: TRND-01, TRND-02, TRND-03, TRND-04, TRND-05
**Success Criteria** (what must be TRUE):
  1. On `/research`, for any team and window, the ice-time section shows one row per player with average TOI, PP share, SH time, a trend arrow and a sparkline as the primary columns, grouped by forwards and defense, and the per-game numeric grid no longer appears
  2. User can still read a player's exact per-game TOI, PP and SH values without the grid (for example by hovering or focusing the sparkline or row), and overtime games are visibly flagged among them
  3. Each row shows a recent-vs-window delta for TOI and for PP share, so a player whose deployment jumped in the latest games stands out even while the window slope is still flat
  4. A player below the minimum games played in the window shows no trend, with the games-played count visible, and games the player missed are left out of averages and trends instead of being counted as 0
  5. User can sort the table by trend, average TOI, or PP share; the sort is in the URL, survives reload, and keeps the F/D grouping

**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Tracer: regulation-TOI trends table (OT/SO via boxscore gameOutcome, loader regulationToi, tested buildTrendRows, components/ToiTrends.tsx; per-game grid removed)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Per-game strip with OT/missed/excluded states and CSS-only hover/focus popover of exact TOI/PP/SH

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Recent-vs-window TOI Δ / PP share Δ, muted slope arrows, mover colour/tint (±2:00 / ±15), DNP last 2, 1-game window

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — URL-persisted sorting by Avg TOI, TOI Δ, PP share, PP share Δ with F/D grouping kept

**Wave 5** *(gap closure)*
- [x] 01-05-PLAN.md — CR-01: count each shift row once for PP/SH (shared uniqueShifts, live smoke on 2026020075); WR-02: refetch an empty shift chart uncached

**Wave 6** *(gap closure, blocked on Wave 5 completion)*
- [x] 01-06-PLAN.md — WR-03: per-game failure isolation (failed boxscore left out and named, failed shift chart = no PP/SH data), friendly error instead of the raw API error

**Wave 7** *(gap closure, blocked on Wave 6 completion)*
- [x] 01-07-PLAN.md — WR-01: popover under the hovered square; WR-04: toiDelta/ppShare docs and PP share title match the code, 2-game Δ explanation

**Wave 8** *(gap closure, UAT; blocked on Wave 7 completion)*
- [x] 01-08-PLAN.md — G-01-2: click/tap opens a square's popover (minimal ToiStripCell client wrapper, hover/keyboard kept, pointer cursor), open popover no longer blocks squares below; re-runnable WebKit check incl. emulated iPhone tap (UAT test 3)

**Wave 9** *(gap closure, UAT; blocked on Wave 8 completion)*
- [x] 01-09-PLAN.md — G-01-5: separate 20x20 bordered squares (4px gap, 2px corners), "Per game (click a square)" hint, intro/legend copy; G-01-1b: "C 5/5 GP"; UI-SPEC strip contract revised

**UI hint**: yes

### Phase 2: Player Linemate Detail

**Goal**: User can open any player from the research page and see who that player has been on ice with, game by game and by situation, so a change in linemates is obvious
**Mode:** mvp
**Depends on**: Phase 1 (clickable rows in the trends table)
**Requirements**: PLYR-01, PLYR-02, PLYR-03, PLYR-04, UNIT-04
**Success Criteria** (what must be TRUE):
  1. Clicking a player row in the trends table, or a player name in any last-game unit table, opens that player's detail section; the URL carries `?player=<id>`, so reload, back/forward and a shared link all show the same player
  2. Player detail shows a linemate heat strip (rows are linemates, columns are the games in the selected window, cell shade is time together as a share of the player's own situation TOI, with minutes shown on click) with separate EV, PP and SH views and forward linemates listed apart from defense partners
  3. Each linemate's time together is also shown as a share of the player's own TOI in that situation, so a regular linemate is distinguishable from an occasional one
  4. Linemates are tagged New, Rising or Fading from time together alone (no quality scoring); a forward moved to a new line in the latest game shows the new linemates as New and the old ones as Fading
  5. Games whose shift chart is missing show as unknown ("—" or blank) in the heat strip, never 0, and do not count toward shares or tags; the existing last-game unit tables still show the same TOI and share values as before this phase

**Plans:** 7/7 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Tracer: ?player=ID opens the panel above the Last game section with the regulation-only linemate heat strip (pair seconds, view-model, URL parsers)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Shared StripPopover for both strips (heat-strip popovers with minutes and share) and the panel's markup pinned by tests
- [x] 02-03-PLAN.md — Trends-table and Last game unit-table names open the player (jump to #player-detail, unit tables on their own tab), selected-row bar, nav/sort links keep or drop the selection

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-04-PLAN.md — WR-10: Escape hides a strip popover without losing focus, expanded state removed (both strips), WebKit D13
- [x] 02-05-PLAN.md — Panel controls: header TOI/PP stats, EV/PP/SH tabs, legend, amber no-chart footnote, empty states

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-06-PLAN.md — New/Rising/Fading/Out tags from time together, per-situation cap with tagged rows always shown, Show all / Show fewer

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-07-PLAN.md — WebKit backstop (jump, Back, reload, tabs, unit-table links, squares, clipping, Escape, dark mode) and end-of-phase human check

**UI hint**: yes

### Phase 3: Unit Event Stats

**Goal**: User can judge each last-game unit (EV, PP, SH; forwards and defense) by its shots, goals and shot attempts for and against, with counts that reconcile with the official boxscore
**Mode:** mvp
**Depends on**: Phase 2 (shared on-ice timeline and "unknown, not 0" handling for missing shift charts)
**Requirements**: DATA-01, DATA-02, DATA-03, UNIT-01, UNIT-02, UNIT-03
**Success Criteria** (what must be TRUE):
  1. Fixture tests on real games (regulation, overtime, shootout, empty-net goal, penalty shot, missing shift chart) reproduce official team shots on goal and every skater's plus-minus from attributed play-by-play events, and they pass before any unit-table event columns are built
  2. Every last-game unit table (EV, PP, SH; forwards and defense) shows SF/SA, GF/GA and CF/CA counts plus SF%, CF% and +/-, with "—" where a unit has no events
  3. A legend on the page defines each stat and its exclusions (empty-net, shootout and teammate-blocked attempts), and an "other" row makes each table's unit totals add up to the team's totals for that game
  4. For a game whose shift chart or play-by-play is missing, event stats show "—" (never 0) and the game is left out of any average or trend that would include it
  5. Selecting "Last 20" for any team loads without failing from NHL API throttling, even with play-by-play added to every game load

**Plans**: TBD
**UI hint**: yes
**Gate**: Event-attribution fixture tests (criterion 1) must pass before any plan that adds event columns to the unit tables runs.
**Research flags**: Needs a fixture-test spike (5-6 real games) before the main build; measure NHL 429 behaviour with the bounded-concurrency loader in dev before deploying to Vercel; decide the per-game on-ice vs `situationCode` match threshold (research suggests 95%) for flagging a game's event stats as unreliable.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ice-Time Trends Table | 9/9 | Complete    | 2026-10-12 |
| 2. Player Linemate Detail | 7/7 | Complete    | 2026-10-12 |
| 3. Unit Event Stats | 0/TBD | Not started | - |
