---
phase: 03-unit-event-stats
plan: 08
subsystem: ui
tags: [react, server-components, node-test, tailwind, nhl-play-by-play]

requires:
  - phase: 03-unit-event-stats
    provides: "03-04 GameEvents quality/chartSuspect, matchRatio/matchIsLow; 03-06 unit-events-view view-model and six-table layout"
provides:
  - "exclusionsNote, UNIT_LEGEND, topNotes and missingPlayByPlayNote in lib/research/unit-events-view.ts"
  - "Amber notes above the Last game tables; exclusions note, legend and older-dates note under them"
affects: [03-10 WebKit check U3, 03-11]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 02e9a7043f36f8d9d450858a35e402f57a97cd9a
plan_head_after: 268c54556024782411dc4db030e904bdaaf8aa3c

tech-stack:
  added: []
  patterns:
    - "All note and legend copy lives in the pure view-model; the component only prints strings"
    - "Fixed UI-SPEC copy with only dates and a rounded percent filled in (T-01-11 pattern)"

key-files:
  created: []
  modified:
    - lib/research/unit-events-view.ts
    - lib/research/unit-events-view.test.ts
    - components/LastGameLines.tsx

key-decisions:
  - "topNotes returns [] when lines is null, so a game with no shift chart shows only the existing no-shift-chart message"
  - "The D-16 percent keeps Math.max(1, ...) per the plan, although with the 0.95 threshold the rounded value is never below 5"

patterns-established:
  - "Footnotes block order: exclusions note, three legend lines, older-dates amber note"

requirements-completed: [UNIT-03, DATA-02]

coverage:
  - id: D1
    description: "Exclusions note lists only non-zero shootout, penalty-shot and teammate-blocked counts, singular for 1, omitted when none or events null"
    requirement: UNIT-03
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#exclusionsNote lists the non-zero kinds in order, plural by default"
        status: pass
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: the footnotes block follows the tables with the exclusions note, then the three legend lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three-line legend under the tables defining GF/GA/SF/SA/CF/CA, SF%/CF%, +/-, Other, Total and the exclusions (D-21 pulled-goalie wording)"
    requirement: UNIT-03
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#UNIT_LEGEND is the three 03-UI-SPEC lines"
        status: pass
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#markup: the legend renders without an exclusions note when nothing was excluded or events are null"
        status: pass
    human_judgment: false
  - id: D3
    description: "Amber notes above the tables in order D-18, D-23, D-16 with the rounded mismatch percent, and none for a clean game"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#topNotes (5 tests) and markup: amber notes sit above the tables in the order D-18, D-23, D-16"
        status: pass
    human_judgment: false
  - id: D4
    description: "Older-dates amber note naming window games with a chart but no play-by-play, last in the footnotes block"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#missingPlayByPlayNote (2 tests) and markup: the older-dates note closes the footnotes block after the legend"
        status: pass
    human_judgment: false
  - id: D5
    description: "Notes and legend read well and wrap at laptop widths on the real page with live data"
    verification: []
    human_judgment: true
    rationale: "Live-data render and visual check is plan 03-10's WebKit check U3, not this plan"

duration: 25min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 08: Legend, Exclusions and Amber Reliability Notes Summary

**Pure-view-model legend, exclusions note and three amber reliability notes (no play-by-play, corrupted chart, shift disagreement) plus an older-dates note, printed by LastGameLines around the six unit tables**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 3

## Accomplishments
- `exclusionsNote` lists only non-zero shootout, penalty-shot and teammate-blocked counts (singular for 1) and is null when nothing was excluded or events are null.
- `UNIT_LEGEND` holds the three 03-UI-SPEC legend lines verbatim, including the D-21 wording that Other holds all time and events while either goalie was pulled. It renders whenever the tables render, including with events null.
- `topNotes` returns the D-18, D-23 and D-16 amber notes in that order, only when they apply; the D-16 note shows the rounded mismatch percent.
- `missingPlayByPlayNote` names older window dates that have a shift chart but no play-by-play (the last game is excluded) via `formatDate`, joined by ", ".
- `LastGameLines` prints the top notes between the heading and the tables, then a footnotes block (exclusions note, legend, older-dates amber note). With `game.lines` null it still shows only the existing no-shift-chart message.

## Task Commits

1. **Task 1: Legend and exclusions note** - `197e060` (test, RED), `ae67df5` (feat, GREEN)
2. **Task 2: Amber reliability notes** - `eef760b` (test, RED), `268c545` (feat, GREEN)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Notes

- RED (both tasks): the new tests were committed alone and ran against a module that did not yet export the functions. The module loaded under tsx (CommonJS transform, missing exports are `undefined`), the previously passing tests stayed green, and only the target tests failed: 6 of 38 for Task 1, 11 of 52 for Task 2. Failures were TypeErrors on the absent exports and, for the markup tests, a real assertion failure (footnotes block absent / amber notes absent). Semantic assessment: the target tests executed and failed for the intended reason (behavior not implemented), not for a syntax, fixture or discovery fault. The `gsd_run check tdd-red-evidence` classifier was not run because this is a `type: execute` plan with `tdd="true"` tasks, not a `type: tdd` plan.
- GREEN: minimal implementation; 38/38 then 52/52 in the file, 536/536 in `npm test`.
- REFACTOR: none needed.

## Files Created/Modified
- `lib/research/unit-events-view.ts` - added `exclusionsNote`, `UNIT_LEGEND`, `topNotes`, `missingPlayByPlayNote`
- `lib/research/unit-events-view.test.ts` - note, legend and markup-order tests (20 new)
- `components/LastGameLines.tsx` - top amber notes, footnotes block, older-dates note

## Decisions Made
- `topNotes` returns an empty list when `lines` is null so the no-shift-chart game never shows event notes (matches the UI-SPEC state table).
- `Math.max(1, ...)` on the D-16 percent is kept as the plan specifies; with the 0.95 threshold the rounded value is always at least 5, so it is a guard rather than a reachable case, and no test pretends otherwise.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit` first failed with `Cannot find name 'LayoutProps'` in `app/layout.tsx` because route types were not generated in the fresh worktree; running `npx next typegen` (as the orchestrator note describes) cleared it. Not related to this plan.
- `npm run build` was not run: the worktree uses a symlinked `node_modules`, which Turbopack cannot build against. The orchestrator runs the build after merge. `npm test` (536 pass, 0 fail), `npx tsc --noEmit` and `npm run lint` all pass.

## Known Stubs

None.

## Threat Flags

None. All note copy is fixed text with only dates and a rounded percent filled in (T-03-09); notes render as React text (T-03-23); no API path, status or error text reaches markup (tested).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for plan 03-10: WebKit check U3 renders the notes and legend against live NHL data.
- No live NHL API requests were made by this plan.

## Self-Check: PASSED

- Files exist: `lib/research/unit-events-view.ts`, `lib/research/unit-events-view.test.ts`, `components/LastGameLines.tsx`
- Commits present on branch: `197e060`, `ae67df5`, `eef760b`, `268c545` (4 commits since base `02e9a70`)

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
