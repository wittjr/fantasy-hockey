---
phase: 03-unit-event-stats
plan: 04
subsystem: testing
tags: [nhl, play-by-play, shift-chart, data-quality, node-test, fixtures]

requires:
  - phase: 03-unit-event-stats
    provides: "buildGameEvents/attributeEvents, GATE_FIXTURES and ALL_FIXTURES, the fixture loader (plans 03-01 to 03-03)"
provides:
  - "GameEvents.quality { checked, matched }: shift-chart versus situationCode agreement per game (D-16, D-17)"
  - "GameEvents.chartSuspect: corrupted shift chart flag (D-23)"
  - "EVENT_MATCH_THRESHOLD, MAX_REPEATED_SHIFT_SHARE, matchQuality, matchRatio, matchIsLow, isShiftChartSuspect exports"
  - "Negative fixture lib/research/fixtures/2025020565.json (category corrupted-shift-chart)"
affects: [03-08 amber warnings on the Line research page, 03-05, later fixture additions]

actuals:
  tokens: 30000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Reliability signals are computed where events are attributed and ride on GameEvents beside the counts; a flagged game keeps its counts and shows a warning"
    - "Negative fixtures join ALL_FIXTURES (accounting checks) and never GATE_FIXTURES (plus-minus gate)"

key-files:
  created:
    - lib/research/fixtures/2025020565.json
  modified:
    - lib/research/events.ts
    - lib/research/events.test.ts

key-decisions:
  - "MAX_REPEATED_SHIFT_SHARE stays at the plan's starting 0.05: gate fixtures measure at most 0.4% (2026020075), the corrupted chart 34.6%"
  - "EVENT_MATCH_THRESHOLD stays 0.95: the six gate fixtures measure 99.4-100% (minimum 2025020528 at 156/157)"
  - "matchQuality is per game (both teams), not per team, so quality is identical for either team's GameEvents"

patterns-established:
  - "isShiftChartSuspect reads the raw shift list before bucketOnIce drops unknown ids, so foreign-team rows are visible"

requirements-completed: [DATA-02, DATA-03]

coverage:
  - id: D1
    description: "Every gate fixture meets EVENT_MATCH_THRESHOLD and removing period 2's shifts drops 2025020084, 2026020075 and 2025020343 below it (D-16, D-17)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#every gate fixture matches its shift chart to situationCode at or above EVENT_MATCH_THRESHOLD"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#2025020084 with every period-2 shift removed falls below EVENT_MATCH_THRESHOLD"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shootout and penalty-shot events never count toward the ratio; an event with no shift data counts as checked and not matched (D-17)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#the shootout attempts of 2026020075 and the penalty shots of 2025020528 are not counted in checked"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#matchQuality: an event with no shift data at its second is checked and not matched"
        status: pass
    human_judgment: false
  - id: D3
    description: "isShiftChartSuspect flags the corrupted chart 2025020565 and none of the six gate fixtures (D-23)"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#2025020565 is flagged by both rules: players from other teams and a repeated share above the threshold"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#no gate fixture is flagged, and each repeated-row share is below MAX_REPEATED_SHIFT_SHARE"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every non-null GameEvents carries quality and chartSuspect, and a flagged game still returns its counts"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#buildGameEvents on the corrupted 2025020565 is flagged and still returns counts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Repeated rows and other teams' players in 2025020565 change no count, and its events still balance"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#2025020565 BUF: repeated rows and other teams' players change no count"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#2025020565 BUF: included + excluded + unattributed account for every mapped event"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 04: Match quality and corrupted-chart flag Summary

**Per-game shift-chart versus situationCode match ratio (95% threshold) and a corrupted-shift-chart flag (foreign-team rows or more than 5% repeated rows) on GameEvents, with the real corrupted game 2025020565 committed as a negative fixture.**

## Performance

- **Duration:** about 3 min of recorded wall time after context loading
- **Started:** 2026-10-14T13:28:37Z
- **Completed:** 2026-10-14T13:31:18Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `matchQuality` compares shift-derived goalie flags and skater counts per team against each event's `situationCode`. Gate fixtures measure 124/124, 103/103, 129/129, 120/120, 156/157 and 132/132. Removing period 2 drops 2025020084, 2026020075 and 2025020343 below 0.95.
- `isShiftChartSuspect` flags 2025020565 by both rules (VGK and SJS rows are present; 750 of 2,166 rows are repeats, 34.6%) and none of the six gate fixtures (largest repeated share 0.4%).
- `buildGameEvents` now fills `quality` and `chartSuspect` from the same shifts and play-by-play it attributes. Plan 03-08 can show an amber note without hiding counts.
- Raw and `uniqueShifts`-deduplicated shifts give deep-equal `attributeEvents` for both teams of 2025020565, and the accounting and listed-versus-total checks from plan 03-02 pass on it through `ALL_FIXTURES`.

## Task Commits

1. **Task 1 RED: failing match-quality tests** - `deb45b1` (test)
2. **Task 1 GREEN: match quality on GameEvents** - `961680e` (feat)
3. **Task 2 RED: fixture 2025020565 and failing D-23 tests** - `ec611e3` (test)
4. **Task 2 GREEN: corrupted-chart flag on GameEvents** - `aaaff3d` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan). No refactor commit; no cleanup was needed.

## Files Created/Modified

- `lib/research/events.ts` - `EVENT_MATCH_THRESHOLD`, `MAX_REPEATED_SHIFT_SHARE`, `matchQuality`, `matchRatio`, `matchIsLow`, `isShiftChartSuspect`; `GameEvents.quality` and `GameEvents.chartSuspect`; `buildGameEvents` fills both
- `lib/research/events.test.ts` - 19 new tests; `ALL_FIXTURES` gains 2025020565
- `lib/research/fixtures/2025020565.json` - trimmed real NHL payload, 2,166 shift rows verbatim, 101 KB (fixture directory is 464 KB, 8 files)

## Decisions Made

- Thresholds kept at the plan's starting values (0.95 and 0.05); both sit clear of the measurements on each side, so nothing was tuned to pass.
- `attributeEvents` keeps its signature and returns `quality { 0, 0 }` and `chartSuspect false` as placeholders; `buildGameEvents` overwrites them. Callers that want the signals use `buildGameEvents`.

## Deviations from Plan

### Notes on measured data

**1. The corrupted chart's repeat structure differs from the research note**
- **Found during:** Task 2 (fixture capture)
- **Issue:** Research and the plan describe 2025020565 as 2,166 rows = 722 unique x 3 (share about 0.67). The captured payload has 2,166 rows, 1,416 unique under the `uniqueShifts` key (671 rows appear once, 740 twice, 5 three times), so the repeated share is 0.346, not 0.67. The foreign-team claim holds (VGK 334 and SJS 333 rows).
- **Fix:** Documented the measured values in the `MAX_REPEATED_SHIFT_SHARE` comment and the SUMMARY instead of the research figure. The 0.05 threshold still separates the fixtures (gate maximum 0.004, corrupted 0.346), so no behavior changed. The plan's acceptance criterion (more than 2,000 rows) holds.
- **Files modified:** lib/research/events.ts (comment only)
- **Committed in:** aaaff3d

**2. RED evidence for Task 1 and Task 2 is a semantic assessment, not classifier output**
- The RED runs failed on the new target tests only (12 failures with 84 passing, then 6 failures with 103 passing). Failures were `TypeError: ... is not a function` for the not-yet-exported functions, which is the planned absence of the behavior, not a syntax or load fault. I did not run `gsd_run check tdd-red-evidence` (the CLI was not invoked in this worktree); this is recorded rather than claimed.

---

**Total deviations:** 0 auto-fixed; 2 documentation notes above.
**Impact on plan:** None on behavior or scope.

## TDD Gate Compliance

- RED: `deb45b1` (`test(03-04)`), `ec611e3` (`test(03-04)`)
- GREEN: `961680e` (`feat(03-04)`), `aaaff3d` (`feat(03-04)`)
- REFACTOR: none.

The Task 2 robustness tests (raw versus `uniqueShifts` equality, accounting on 2025020565) passed at RED by design: they characterize existing behavior over the new fixture. The new-behavior tests (`isShiftChartSuspect`, `chartSuspect`, `MAX_REPEATED_SHIFT_SHARE`) failed at RED.

## Issues Encountered

- `npx tsc --noEmit` first reported `Cannot find name 'LayoutProps'` until `npx next typegen` ran in the worktree (as the wave instructions anticipated). After that tsc, lint and the full suite (460 tests) pass.
- The capture script lived in the session scratchpad outside the repository and is not committed (`git ls-files` for `*capture*` is empty).

## Known Stubs

None.

## Threat Flags

None. T-03-04 is mitigated as planned (both flags are tested on 2025020565 and the period-removed fixtures). T-03-19 and T-03-SC are accepted as planned: no packages were touched and the fixture holds public NHL data only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-08 can read `quality` (with `matchIsLow`) and `chartSuspect` from `GameEvents` to render the amber "counts may be off" notes.
- `requirements-completed` lists DATA-02 and DATA-03 verbatim from the plan; REQUIREMENTS.md was not edited here because later plans in the phase also declare these IDs (shared-ID gate).

## Self-Check: PASSED

- Files exist: `lib/research/events.ts`, `lib/research/events.test.ts`, `lib/research/fixtures/2025020565.json`
- Commits `deb45b1`, `961680e`, `ec611e3`, `aaaff3d` are ancestors of HEAD
- `npx tsx --test lib/research/events.test.ts` ℹ fail 0 (109 tests); `npm test` ℹ fail 0 (460 tests); `npx tsc --noEmit` and `npm run lint` exit 0
- All acceptance greps pass; 8 fixture files, 464 KB; no capture script tracked

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
