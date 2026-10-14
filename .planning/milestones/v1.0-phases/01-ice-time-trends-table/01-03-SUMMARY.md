---
phase: 01-ice-time-trends-table
plan: 03
subsystem: ui
tags: [nextjs, react-server-components, tailwind, a11y, node-test, tdd]

requires:
  - phase: 01-ice-time-trends-table
    provides: "Plan 01 TrendRow/buildTrendRows, slope thresholds, formatClock; plan 02 per-game strip and OT handling in ToiTrends"
provides:
  - "TOI change and PP share change columns on every row: team's last 2 games vs the player's earlier games, gated at 3 included games with 1 in each part"
  - "Muted whole-window slope arrow right after each change, never green or red"
  - "Mover colouring (120 s TOI, 15 PP-share points) with row tint, mixed-sign rows untinted, sr-only Moving up/down"
  - "DNP last 2 badge and window-of-1 handling (columns, arrows, sparkline and tint absent, explanatory note)"
affects: [01-04]

actuals:
  tokens: 7232
  tasks: 2
  commits: 4

commits: 4
plan_head_before: 019263d70ad26af76fd5e3652862783328736e07
plan_head_after: ff9ff1a5676cfdabd15992243be82671f85cb9de

tech-stack:
  added: []
  patterns:
    - "Mover and display share one rounding: deltaCrossing compares Math.round(abs) so a displayed +2:00 or +15 always colours and +1:59 or +14 never does"
    - "PP share change uses team-PP-weighted means per part, so each part equals its pooled share"
    - "Arrow slot always renders (empty when no direction) so delta digits stay aligned"

key-files:
  created: []
  modified:
    - lib/research/toi-trends.ts
    - lib/research/toi-trends.test.ts
    - lib/research/format.ts
    - components/ToiTrends.tsx
    - lib/research/toi-trends-view.test.ts

key-decisions:
  - "Mover thresholds are 120 s and 15 points (D-18), not RESEARCH's 180/25; exported as TOI_MOVER_SECONDS and PP_MOVER_POINTS so retuning is a constant change"
  - "PP share change renders as a signed whole number with no pts suffix (+18, -7), per the Layout & Columns table; the header carries the unit"
  - "Recent part is the team's last 2 games by index regardless of whether the player played both, so a player who missed one still gets a change if the other gates pass"

patterns-established:
  - "Pure delta/mover logic in lib/research/toi-trends.ts; component only maps classes"

requirements-completed: [TRND-03, TRND-04]

coverage:
  - id: D1
    description: "TOI change and PP share change columns in D-01 order with the 3-game / both-parts gate and signed formatting"
    requirement: "TRND-03"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#recentDelta, formatSigned*, buildTrendRows deltas"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#renders headers in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Muted slope arrows after each change, at 2 or more games, with inclusive thresholds"
    requirement: "TRND-03"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#slopeDirection is inclusive of the threshold"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a rising TOI slope shows a muted up arrow"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mover colour and row tint (120 s / 15 points, none on mixed signs) and DNP last 2 badge"
    requirement: "TRND-03"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends.test.ts#deltaCrossing / moverDirection / dnpLast2"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#up-mover / mixed-sign / DNP markup tests"
        status: pass
    human_judgment: true
    rationale: "Whether tint frequency reads as a handful per roster and whether the colours look right on a real team needs a human look (plan human-check)"
  - id: D4
    description: "Window-of-1 shows values only: no change columns, arrows, sparkline, tint, plus the explanatory note"
    requirement: "TRND-04"
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a one-game window has no delta or trend columns"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 03: Who Is Moving Summary

**Recent-vs-window TOI and PP share changes with 3-game gating, muted slope arrows, 2:00 / 15-point green-red movers with row tint, and a "DNP last 2" badge, all as pure tested logic plus a thin server component.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-11T20:07:41Z
- **Completed:** 2026-10-11T20:11:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Every row shows TOI change and PP share change right after Avg TOI and PP share. The change is the team's last 2 games minus the player's earlier games, shown only with 3 or more included games and at least one in each part; otherwise a dash with the games-played count still visible.
- A muted triangle follows each change (whole-window slope, 15 s/game or 3 points/game, inclusive). It is never green or red, and the change colour wins when they disagree.
- Changes that display as 2:00 or more, or 15 points or more, are green or red and medium weight. The row tints when the crossing changes agree in sign and does not tint on mixed signs. The tint is announced with sr-only "Moving up/down".
- A player absent from both of the team's last 2 games in a window larger than 2 gets a "DNP last 2" badge after his name with dashes for both changes.
- A 1-game window drops the change columns, arrows, sparkline and tint and shows "Deltas and trends need 2 or more games. Choose Last 3 or more."; wider windows show legend line 2.

## Task Commits

TDD cycle for each task:

1. **Task 1: TOI and PP share change columns with gates and muted arrows**
   - RED `f902f68` (test): 16 new tests failing for the planned reason (functions and columns absent)
   - GREEN `55f0beb` (feat): recentDelta, slopeDirection, signed formatters, DeltaCell/TrendArrow, notes
2. **Task 2: Highlight big movers and players who sat out the last 2 games**
   - RED `b0ce91a` (test): 9 new tests failing (deltaCrossing, moverDirection, tint, badge absent)
   - GREEN `ff9ff1a` (feat): mover thresholds, deltaCrossing, moverDirection, dnpLast2, tint, badge

**Plan metadata:** committed with this SUMMARY (docs: complete plan). No REFACTOR commits were needed.

## TDD Gate Compliance

RED then GREEN commits exist for both tasks (`test(01-03)` before `feat(01-03)`). RED evidence came from the project's own `tsx --test` run: the named new tests failed (TypeError for missing exports, assertion failures for missing markup); tests that passed vacuously in RED (window-of-1 never tints, sub-threshold change has no colour) are boundary guards, not the target proof. The `check tdd-red-evidence` classifier was not run because `tdd_mode` was not enabled for this dispatch.

## Files Created/Modified
- `lib/research/toi-trends.ts` - RECENT_GAMES, MIN_GAMES_FOR_DELTA, mover thresholds, recentDelta, slopeDirection, deltaCrossing, moverDirection; TrendRow gains toiDelta, ppShareDelta, dnpLast2, mover
- `lib/research/format.ts` - formatSignedClock and formatSignedPoints (U+2212 minus, zero unsigned)
- `components/ToiTrends.tsx` - TrendArrow, DeltaCell, two new columns, tint, badge, legend line 2 and window-1 note
- `lib/research/toi-trends.test.ts` - unit tests for all new pure logic and row fields
- `lib/research/toi-trends-view.test.ts` - markup tests for header order, notes, dashes, arrows, tint, colour, badge

## Decisions Made
- Mover thresholds follow D-18 (120 s, 15 points); the plan's own note that this is looser than RESEARCH's 180/25 stands, and retuning is two constants.
- PP share change is a signed integer with no suffix; the header carries the unit.
- "Recent" stays the team's last 2 games by index, so a player who missed one of them still gets a change if the gates pass (flagged in the plan; unchanged).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing popover test selected the new arrow span**
- **Found during:** Task 1 (GREEN)
- **Issue:** `the popover holds the same values` matched the first `<span aria-hidden="true">...</span></span>` in the row, which became the trend arrow glyph, so `popovers[0]` no longer held strip detail.
- **Fix:** Filtered the matched spans to those containing "Oct" (strip popovers) instead of weakening the arrow's `aria-hidden`.
- **Files modified:** lib/research/toi-trends-view.test.ts
- **Verification:** all 42 tests pass, then 130 after Task 2
- **Committed in:** 55f0beb

**2. [Rule 1 - Bug] Wrong expected value in my own RED test**
- **Found during:** Task 1 (RED authoring)
- **Issue:** The PP-weighted case (recent 50 w100 and 20 w300 vs earlier 10) was first written as 7.5; the plan's 17.5 is correct (recent mean 27.5 minus 10).
- **Fix:** Corrected before the RED commit.
- **Files modified:** lib/research/toi-trends.test.ts
- **Committed in:** f902f68

---

**Total deviations:** 2 auto-fixed (2 bug, both in tests)
**Impact on plan:** No scope change. Neither affected shipped behaviour.

## Issues Encountered
None. `npm run lint` was not used because it fails at baseline on untracked `.claude/` files; the plan's scoped eslint command was used instead.

## Verification
- `npx tsx --test lib/research/toi-trends.test.ts lib/research/toi-trends-view.test.ts`: 53 pass, 0 fail
- `npm test`: 130 pass, 0 fail (baseline was 104)
- `npx tsc --noEmit`, scoped `eslint`, and `npm run build`: clean
- All acceptance-criteria greps pass; `grep -c "/gm" components/ToiTrends.tsx` is 0 and `text-red-600` count is 0

## Known Stubs
None.

## Threat Flags
None. No new endpoints, auth paths or trust boundaries; pure computation over data already loaded in plan 01 (T-01-05 accepted, T-01-SC n/a).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 01-04 (URL-persisted sorting): `toiDelta`, `ppShareDelta`, `ppShare` and `avgToi` are all numeric-or-null row fields, so null-sinks-to-bottom sorting can build directly on them.
- End-of-phase human check is pending: open `/research?team=MTL&games=5` and a few teams at Last 10, confirm tinted rows are a handful per roster, mixed-sign rows are untinted, a scratched player shows "DNP last 2", and "Last game" shows the note with no change columns.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*

## Self-Check: PASSED
