---
phase: 01-ice-time-trends-table
plan: 01
subsystem: ui
tags: [nextjs, react-server-components, nhl-api, shift-charts, node-test]

requires:
  - phase: none
    provides: existing /research page, team-games loader, trendSlope
provides:
  - Regulation-only TOI per skater per game (ResearchGame.overtime / regulationToi) from boxscore gameOutcome and shift charts
  - Pure buildTrendRows builder where missed games and unknown values are never 0
  - Server-rendered "Ice-time trends" table (components/ToiTrends.tsx) replacing the per-game numeric grid
  - Shared formatters in lib/research/format.ts
affects: [01-02, 01-03, 01-04]

actuals:
  tokens: 5825
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure row builder in lib/research with structural input types so tests pass plain objects"
    - "Server component rendered with renderToStaticMarkup(createElement(...)) in a .ts test so the existing npm test glob runs it"

key-files:
  created:
    - lib/research/toi-trends.ts
    - lib/research/toi-trends.test.ts
    - lib/research/toi-trends-view.test.ts
    - lib/research/format.ts
    - components/ToiTrends.tsx
  modified:
    - lib/nhl/client.ts
    - lib/research/lines.ts
    - lib/research/lines.test.ts
    - lib/research/team-games.ts
    - app/research/page.tsx

key-decisions:
  - "regulationSeconds counts verbatim-duplicate shift rows once, because the NHL feed repeats rows (22 rows vs 19 boxscore shifts in game 2026020075)"
  - "Unknown regulation TOI (OT/SO game with no shift chart) is null, so the game is excluded from Avg TOI rather than counted as 0"

patterns-established:
  - "Unknown is null, never 0: perGame cells are null for missed games; toi/pp/sh are null when their source is missing"

requirements-completed: [TRND-01, TRND-04]

coverage:
  - id: D1
    description: "Ice-time section is an 'Ice-time trends' table, one row per skater (F block then D block, goalies excluded), no per-game numeric grid"
    requirement: TRND-01
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#renders headers in order, forwards before defense, no goalies"
        status: pass
    human_judgment: true
    rationale: "Visual layout and readability of the live /research page is auth-gated and was only fixture-tested; the plan's end-of-phase human-check covers it"
  - id: D2
    description: "Avg TOI uses regulation TOI; missed games and OT/SO games without a shift chart never count as 0; unknowns render as a dash"
    requirement: TRND-04
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts (missed game, OT with/without shifts, excluded-only player)"
        status: pass
      - kind: integration
        ref: "live MTL smoke over last 5 games (SMOKE OK games=5 ot=2 rows=21)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Amber footnote lists dates of games with no shift chart; empty-window message shown when no skaters played"
    requirement: TRND-01
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts (footnote, no footnote, empty window)"
        status: pass
    human_judgment: false

plan_head_before: 07ca5d97a1acc80b66d644a0053d4863971288d3
plan_head_after: c524e1d2adef05327b18b59c64b0cf148e9e1590
duration: 11min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 01: Regulation-TOI Ice-Time Trends Table Summary

**Server-rendered "Ice-time trends" table on /research built from NHL boxscore gameOutcome and shift charts: regulation-only Avg TOI, pooled PP share, SH per game and a sparkline, with missed games and unknown values never counted as 0**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-11T19:50:42Z
- **Completed:** 2026-10-11T20:01Z
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- Loader now records `overtime` ("OT" | "SO" | null) and `regulationToi` per game with no new NHL request.
- `buildTrendRows` produces one row per skater, forwards then defense by Avg TOI descending, null Avg TOI last.
- `/research` shows the new table (Player, Pos + n/N GP, Avg TOI, PP share, SH, TOI trend); the per-game grid is gone.
- The table lives in `components/ToiTrends.tsx` as a server component with an empty-window message and an amber footnote for games without shift charts.
- Test count went from 62 to 83, all passing; the live MTL smoke passes on a real OT game and a real SO game.

## Task Commits

1. **Task 1 (tracer): boxscore outcome to loader to trend rows to /research** - `33665cd` (feat)
2. **Task 2: pin "unknown is never 0" and overtime rules** - `6857f21` (test)
3. **Task 3: ToiTrends server component with empty and no-shift-chart states** - `c524e1d` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `lib/nhl/client.ts` - optional `gameOutcome.lastPeriodType` on `NhlBoxscore`
- `lib/research/lines.ts` - `REGULATION_PERIODS`, `regulationSeconds`
- `lib/research/team-games.ts` - `ResearchGame.overtime` and `regulationToi`, filled in `loadGame`
- `lib/research/toi-trends.ts` - `buildTrendRows`, row/cell types, moved trend thresholds
- `lib/research/format.ts` - `formatClock`, `formatDate`, `gameLabel`, `resultLabel` moved out of the page
- `components/ToiTrends.tsx` - the section, `Sparkline`, empty and footnote states
- `app/research/page.tsx` - old row builder and grid removed; renders `ToiTrends`; auth gate unchanged
- `lib/research/toi-trends.test.ts`, `lib/research/toi-trends-view.test.ts`, `lib/research/lines.test.ts` - unit and rendered-markup tests

## Decisions Made
- Identical shift rows are counted once in `regulationSeconds` (see deviation 1).
- Followed the plan for everything else: no partial-shift-chart guard, PP/SH still come from whole-game `lines` including OT, and a dressed skater with 00:00 boxscore TOI is treated as not dressed (existing loader behavior).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate shift rows over-counted regulation seconds**
- **Found during:** Task 1 (live smoke run)
- **Issue:** The plan specifies a plain sum. In SO game 2026020075 the NHL shift chart repeats rows verbatim (player 8482087: 22 rows vs 19 boxscore shifts), giving 1061 s regulation against 933 s boxscore TOI, and the smoke check failed.
- **Fix:** `regulationSeconds` skips a row whose (playerId, period, startSec, endSec) was already counted. Regulation TOI now never exceeds boxscore TOI.
- **Files modified:** `lib/research/lines.ts`; regression case added in `lib/research/lines.test.ts` (Task 2)
- **Verification:** smoke prints `SMOKE OK games=5 ot=2 rows=21`; "counts a verbatim duplicate shift row once" test passes
- **Committed in:** `33665cd` (Task 1), test in `6857f21`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct regulation TOI; two lines of logic, no scope creep.

## Issues Encountered
- Execution first halted because HEAD was on protected `main` (pre-commit assertion). The user moved work to `gsd/phase-1-ice-time-trends-table` and execution resumed; no config was changed by the executor.
- Pre-existing: `analyzeGameLines` has the same duplicate-row weakness for PP/SH seconds. Logged in `deferred-items.md`, not fixed.

## TDD Gate Compliance

Tasks 2 and 3 are marked `tdd="true"`, but neither followed RED-before-GREEN:
- **Task 2:** the implementation (`buildTrendRows`, `regulationSeconds`) was written in the Task 1 tracer, as the plan orders it. The Task 2 tests were written afterward and passed on first run. There is no `test(...)` commit that fails before a `feat(...)` commit, so no RED evidence exists and the RED gate is not met.
- **Task 3:** the component and its rendered-markup tests were committed together in one `feat(01-01)` commit, with no separate RED commit.
- The `test(01-01)` commit exists (`6857f21`) but comes after the `feat(01-01)` commit (`33665cd`), the reverse of the required order. The tests do pin the behavior; the discipline of seeing them fail first was not applied.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Threat Flags
None. The threat-model mitigations hold: auth gate kept (T-01-01), no new NHL request (T-01-02), `ToiTrends` has no client directive (T-01-03).

## Next Phase Readiness
- Plans 01-02 to 01-04 can add the per-game strip, deltas and sorting on `TrendRow.perGame`, `toiSlope`, `ppShareSlope` and the exported trend thresholds.
- The Task 3 `<human-check>` (signed-in look at `/research?team=MTL&games=5`: columns, "n/5 GP", amber footnote for the no-shift-chart game, no TOI trend column on "Last game") is left for the end-of-phase verifier; the page is auth-gated and was not viewed.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*

## Self-Check: PASSED

All created files exist and commits 33665cd, 6857f21, c524e1d are on the branch.
