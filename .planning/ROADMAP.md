# Roadmap: Fantasy Hockey Draft Prep

## Overview

This milestone refines the existing Line research page (`/research`) into a tool for spotting players whose role is changing. It starts by turning the hard-to-read ice-time grid into a scannable trends table (no new data), then adds the core request: a player detail view showing who each player has been on ice with, game by game, from the shift charts the page already loads. It finishes with the riskiest piece: attributing NHL play-by-play events to on-ice units so the last-game unit tables show shots, goals and Corsi. Fixture tests that reproduce the official boxscore gate that work before any of it reaches the UI.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Ice-Time Trends Table** - Replace the per-game ice-time grid with a sortable trends table that shows who is moving up or down
- [ ] **Phase 2: Player Linemate Detail** - Click any player to see a per-game linemate heat strip by situation, with New/Rising/Fading tags
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
**Plans**: TBD
**UI hint**: yes

### Phase 2: Player Linemate Detail
**Goal**: User can open any player from the research page and see who that player has been on ice with, game by game and by situation, so a change in linemates is obvious
**Mode:** mvp
**Depends on**: Phase 1 (clickable rows in the trends table)
**Requirements**: PLYR-01, PLYR-02, PLYR-03, PLYR-04, UNIT-04
**Success Criteria** (what must be TRUE):
  1. Clicking a player row in the trends table, or a player name in any last-game unit table, opens that player's detail section; the URL carries `?player=<id>`, so reload, back/forward and a shared link all show the same player
  2. Player detail shows a linemate heat strip (rows are linemates, columns are the games in the selected window, cell shade is minutes together) with separate EV, PP and SH views and forward linemates listed apart from defense partners
  3. Each linemate's time together is also shown as a share of the player's own TOI in that situation, so a regular linemate is distinguishable from an occasional one
  4. Linemates are tagged New, Rising or Fading from time together alone (no quality scoring); a forward moved to a new line in the latest game shows the new linemates as New and the old ones as Fading
  5. Games whose shift chart is missing show as unknown ("—" or blank) in the heat strip, never 0, and do not count toward shares or tags; the existing last-game unit tables still show the same TOI and share values as before this phase
**Plans**: TBD
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
| 1. Ice-Time Trends Table | 0/TBD | Not started | - |
| 2. Player Linemate Detail | 0/TBD | Not started | - |
| 3. Unit Event Stats | 0/TBD | Not started | - |
