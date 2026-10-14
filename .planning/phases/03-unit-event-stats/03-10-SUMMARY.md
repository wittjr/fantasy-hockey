---
phase: 03-unit-event-stats
plan: 10
subsystem: testing
tags: [webkit, playwright, next-dev, unit-tables, tailwind, dark-mode]

requires:
  - phase: 03-unit-event-stats
    provides: "03-06 and 03-08 unit tables in components/LastGameLines.tsx; 03-09 webkit-units-check.cjs harness with U1, U2 and the CHECK_GROUPS extension point"
provides:
  - "webkit-units-check.cjs checks U3 to U6: live render of the six unit tables, PP name link to the player panel, 1024px light and dark overflow, group dividers and Total row styling"
  - "Live render evidence for UNIT-01 to UNIT-03 (MTL, last game Oct 13 vs BUF, W 4-3) and browser evidence for the three UI-SPEC backstop considerations"
affects: [03-11 Phase 2 regression and end-of-phase check]

actuals:
  tokens: 4500
  tasks: 2
  commits: 2
plan_head_before: e95e929445b06057e3f89101bf7cf24ee84df653
plan_head_after: 83a75f02de4b20bb935ca8f99b92bde08b04c808

tech-stack:
  added: []
  patterns:
    - "Layout checks open one page per color scheme (1024x800 context with colorScheme light and dark) up front and share them between U5 and U6, so each scheme loads once"
    - "In-page evaluate functions read computed styles (border-left-width/style, font-weight, border-top-width) rather than class names, so the checks prove what the browser draws"

key-files:
  created: []
  modified:
    - .planning/phases/03-unit-event-stats/webkit-units-check.cjs

key-decisions:
  - "U3 and U4 run on the 1280px context; U5 and U6 use their own 1024x800 light and dark contexts created from the same browser"
  - "A team whose last game has no shift chart, or no linked name in a PP table, FAILs with a reason telling the user to rerun with CHECK_TEAM set to another team, never a SKIP or a vacuous pass"
  - "U6 also requires the divider color to differ between light and dark, which proves the dark: border classes actually applied and not just that the media query matched"

requirements-completed: [UNIT-01, UNIT-02, UNIT-03]

coverage:
  - id: D1
    description: "On live NHL data the six Last game tables render in order EV, PP, SH (forwards then defense) with Goals, Shots and Corsi headers, 13 column headers, Other then Total rows and the legend, and no Other count is negative"
    requirement: UNIT-01
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (PASS U3, MTL, Last game: Oct 13 vs BUF W 4-3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clicking a linked name in a PP table (C. Kreider, PP - Forwards) opens his panel with PP as the current tab (URL gains player=8475184 and sit=pp)"
    requirement: UNIT-03
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (PASS U4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "At 1024px in light and dark all six tables show every column with no wrapper overflow and no name link outside its wrapper"
    requirement: UNIT-02
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (PASS U5; screenshots units-check-light.png and units-check-dark.png)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Group dividers are 1px on exactly the GF, SF and CF cells through header, body, Other and Total rows, and the last row Total has font-weight 500 and a 1px top border, in light and dark"
    requirement: UNIT-02
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (PASS U6)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 10: Live unit-table checks Summary

**The desktop WebKit harness now proves, on live NHL data, that the six unit tables render in order with every header, Other and Total rows, the legend and no negative Other count; that a PP name link opens the PP tab of the player panel; and that at 1024px in light and dark nothing clips and the dividers and Total row match the UI contract.**

## Performance

- **Duration:** about 12 min (two harness runs of roughly 1.5 min each plus writing the checks)
- **Started:** 2026-10-14T14:01Z
- **Completed:** 2026-10-14T14:12Z
- **Tasks:** 2
- **Files modified:** 1 (`webkit-units-check.cjs`; the repo's app code was not touched)

## Accomplishments

- **U3 (UNIT-01 to UNIT-03, live render):** passed on **MTL, last game Oct 13 vs BUF, W 4-3**. All six tables in order (EV, PP, SH; forwards then defense), group headers Goals, Shots, Corsi each colSpan 3 over a colSpan 4 lead cell, the 13 column headers, Other then Total as the last two rows in all six tables, every Other GF, GA, SF, SA, CF and CA cell a dash or a non-negative integer, and the footnotes block after the last table with the legend text including "all time and events while either goalie was pulled". It fails (never passes) when the last game has no shift chart.
- **U4 (UNIT-04 backstop):** clicking the first linked name in PP - Forwards (C. Kreider) moved the URL to `?team=MTL&games=5&player=8475184&sit=pp` and the panel title "C. Kreider L 5/5 GP" with PP as the current situation tab.
- **U5 (overflow backstop):** at 1024x800 in light and in dark, six wrappers each, no wrapper wider than its client width + 1, all 38 name links inside their wrapper. Screenshots: `units-check-light.png` and `units-check-dark.png` in this session's scratchpad directory (`/private/tmp/claude-501/-Users-jwitt-Development-fantasy-hockey/7713118a-e5c4-472c-9541-569ff31869a5/scratchpad/`); the dark one was inspected by eye and shows all six tables with the three dividers continuous and Total as the last, heavier row.
- **U6 (visual backstop):** in both schemes, in all six tables, exactly columns 5, 8 and 11 (GF, SF, CF) have a computed 1px left border in the group-header row, header row 2, every body row, Other and Total; the lead cell has none; the last row is Total with computed font-weight 500 and a 1px top border; the divider color is `lab(90.95 0 0)` in light and `lab(15.20 0 0)` in dark.

## Evidence from the final run (log `units-check-t1.log`, MTL)

```
PASS U1  MTL 6.3 s, TOR 7.3 s, EDM 6.5 s, total 21 s, no banner, no 429 (57 NHL requests counted)
PASS U2  warm reload of MTL: 2 requests, both empty-shift-chart refetches by design (games 2026020045 and 2026020026), 0 misses
PASS U3  tablesWithOtherAndTotal=6, problems=[]
PASS U4  clicked C. Kreider in PP - Forwards, panel tab PP
PASS U5  light and dark: 6 wrappers, 38 links, problems=[]
PASS U6  light and dark: 6 tables, 6 Total rows, problems=[]
units-check: pass=6 fail=0 skip=0
```

The earlier Task 1 run (U1 to U4 only, `units-check-u34.log`) gave the same results: U1 20.6 s total, U2 PASS, U3 and U4 PASS.

## Task Commits

1. **Task 1: U3 and U4** - `9ec1439` (feat)
2. **Task 2: U5 and U6** - `83a75f0` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `.planning/phases/03-unit-event-stats/webkit-units-check.cjs` - U3 to U6 added in `unitChecks` and `layoutChecks`, both listed in `CHECK_GROUPS` after `loadChecks`; U1, U2 and the infrastructure unchanged; header comment lists U1 to U6

## Decisions Made

- U3 and U4 use the default 1280px context; U5 and U6 build their own 1024x800 contexts with `colorScheme` light and dark from `context.browser()`, opened once and shared so each scheme loads the page once.
- A missing prerequisite in the live data (no shift chart for the last game, no linked PP name) FAILs with a rerun-with-another-team reason, matching the plan's rule that U3 never passes without six rendered tables.
- U6 asserts the divider color differs between schemes, so a pass shows the `dark:` classes took effect and not only that the media query matched (U5 separately checks `prefers-color-scheme` applied).

## Deviations from Plan

None - plan executed exactly as written. The harness's `${TMPDIR:-/tmp}` log and screenshot paths were pointed at the session scratchpad by setting TMPDIR for the runs (the scratch app copy also lived there and was removed after the passing run).

## Issues Encountered

- None blocking. Each harness run takes about 1.5 min because it repeats U1's cold three-team load at the 1000 ms start gap; the 60-second NHL quiet precondition was met by the server start-up time of the second run.
- Carried over from 03-09 and unchanged here: warm loads are paced at the 1000 ms start gap too (a cached MTL reload took 6.0 s for 6 games), which is the design issue already reported for plan 03-11 and the user.

## Known Stubs

None.

## Threat Flags

None. The only surface touched is the harness scratch copy; the repo's `app/research/page.tsx` is not edited (git status shows only `webkit-units-check.cjs` modified), the auth gate is removed only in the temp copy, and the dev server stays bound to `127.0.0.1` (T-03-25 acceptance greps: `grep -c "auth"` gives 6, `grep -q "127.0.0.1"` passes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-11 can run the Phase 2 regression and the end-of-phase check; `webkit-units-check.cjs` is a complete U1 to U6 harness and `CHECK_TEAM` selects another team if a last game lacks a shift chart.
- The October data (6-8 games per team) means the live check ran on MTL's Oct 13 game; rerun after merge if the season advances.

## Self-Check: PASSED

- `.planning/phases/03-unit-event-stats/webkit-units-check.cjs` exists; commits `9ec1439` and `83a75f0` are on HEAD.
- Verify commands: both log files end with `units-check:` and contain no `FAIL`; `PASS U1`, `U3`, `U4`, `U5`, `U6` present; `grep -c '"U[1-6]"'` gives 6.

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
