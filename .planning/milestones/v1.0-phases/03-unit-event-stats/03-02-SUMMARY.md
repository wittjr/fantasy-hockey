---
phase: 03-unit-event-stats
plan: 02
subsystem: testing
tags: [nhl, shift-chart, play-by-play, on-ice-attribution, node-test]

requires:
  - phase: 03-unit-event-stats
    provides: "attributeEvents, onIceAt, buildGameEvents, creditsUnit, unitKey and the 2025020084 fixture (plan 03-01)"
provides:
  - "Attribution-rule tests: period boundaries, direction, pulled goalie, opponent with no rows, 4-on-4, 3-on-3, unknown events, accounting, listed-versus-total, purity"
  - "analyzeGameLines credits unit seconds only where creditsUnit allows (D-13, D-21, D-22)"
  - "Time/events consistency test: a unit's Time and its events cover the same seconds"
affects: [03-03, 03-04, 03-06]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3

plan_head_before: fc564fb8c19b5bf93d9a7dc2d51cb333af3c2d8b
plan_head_after: 83f361f289ea02efa6e9cea92c80ef59b699b778

tech-stack:
  added: []
  patterns:
    - "Accounting and listed-versus-total checks loop over ALL_FIXTURES so later fixtures are covered with no new code"
    - "Local synthetic shift/event builders inside the test file, no shared test helper module"

key-files:
  created: []
  modified:
    - lib/research/events.test.ts
    - lib/research/lines.test.ts
    - lib/research/lines.ts

key-decisions:
  - "Pulled-goalie, missing-opponent, 4-on-4 and 3-on-3 seconds skip unit accumulation via the same creditsUnit predicate attributeEvents uses (03-01 decisions 1 and 2)"
  - "Time/events consistency test uses a sixth skater who is a D (13) on the pulled-goalie stretch so the forward trio would be over-credited 90 s without the fix"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "On-ice attribution rules (boundaries, direction, pulled goalie, opponent missing, 4-on-4/3-on-3, unattributed, null for missing data) are pinned by passing tests"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#onIceAt / attributeEvents / buildGameEvents tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Event accounting, listed-plus-Other bound and purity hold on every ALL_FIXTURES game for both teams"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#2025020084 WPG/NSH accounting and listed-versus-total; attributeEvents is pure"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unit Time follows creditsUnit; player seconds, situation seconds and Phase 2 linemate time unchanged"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/lines.test.ts (pulled goalie, opponent rows, 4-on-4, 3-on-3, unitKey, creditsUnit); pair-seconds.test.ts and linemates.test.ts unchanged and green"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#a unit's Time and its events cover the same seconds"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 02: Attribution rules pinned, unit Time follows creditsUnit Summary

**Every on-ice attribution rule is pinned by tests that loop over all committed fixtures, and analyzeGameLines now credits unit seconds only where creditsUnit allows, so a unit's Time and its shot/goal counts cover the same seconds.**

## Performance

- **Duration:** about 12 min
- **Completed:** 2026-10-14T13:22Z
- **Tasks:** 2 of 2
- **Files modified:** 3 (events.test.ts, lines.test.ts, lines.ts)

## Accomplishments

- Task 1 added 15 top-level and per-fixture tests to events.test.ts: the start < t <= end boundary, 00:00 reading no previous-period second, later-period offset, goal and shot direction, 5-on-5 routing to the F trio and D pair, own goalie pulled, situationCode pulled-goalie flag with both goalie shifts present, opponent with no rows, 4-on-4, period-4 3-on-3, unattributed seconds, null from buildGameEvents (empty shifts, null pbp, no plays), per-team accounting and listed-versus-total over ALL_FIXTURES, and purity via structuredClone.
- Task 2 added deliberate, additive lines.test.ts tests and the one-line change in analyzeGameLines. Player seconds and situation seconds are untouched; only unit seconds move to Other.
- Phase 2 suites (pair-seconds, linemates, player-detail-view) are byte-identical to 2518d44 and green.

## Task Commits

1. **Task 1: Pin the attribution rules** - `77f2b93` (test)
2. **Task 2 RED: failing unit-Time tests** - `786e597` (test)
3. **Task 2 GREEN: creditsUnit in analyzeGameLines** - `83f361f` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `lib/research/events.test.ts` - attribution-rule, accounting, listed-versus-total, purity and Time/events consistency tests
- `lib/research/lines.test.ts` - added unit-Time, `unitKey` and `creditsUnit` tests and four assertions inside the empty-net test (74 lines added, 0 deleted)
- `lib/research/lines.ts` - `if (!creditsUnit(situation, mine, opp)) continue;` before the unit accumulation

## Decisions Made

None beyond the plan; the consistency test uses D 13 as the pulled-goalie sixth skater (a deviation from the plan's wording, see below) so it fails without the lines.ts change.

## Deviations from Plan

None - plan executed exactly as written, with two small test-design notes:

- The consistency test's pulled stretch adds D 13 rather than a sixth forward, so the F trio 1,2,3 would be credited 90 s without the fix; the plan only fixed the 60 s expectation.
- No events.ts fix was needed: every Task 1 rule test passed against plan 03-01's implementation.

**Total deviations:** 0 auto-fixed.

## TDD Gate Compliance

- **Task 1 (characterization):** the behaviors already existed from plan 03-01, so the tests were green on first run (unexpected-GREEN investigated: the rules are implemented in events.ts, the tests pin them). The first assertions were checked to be non-vacuous by their specific expected counters and keys. No RED commit exists for it by design; the single `test(03-02)` commit is the pinning commit.
- **Task 2 RED:** `786e597`. Six tests failed on the planned assertions (units credited 90 s / 30 s / 60 s extra instead of Other); semanticAssessment: target tests executed and failed on the planned unit-seconds assertions, not on setup or import faults. The unitKey and creditsUnit tests passed on plan 03-01's exports as predicted.
- **Task 2 GREEN:** `83f361f`; 120 tests across the four research suites pass, then `npm test` 376/376.

## Issues Encountered

None.

## Verification Results

- `npx tsx --test lib/research/play-events.test.ts lib/research/events.test.ts`: fail 0
- `npx tsx --test lib/research/lines.test.ts lib/research/events.test.ts lib/research/pair-seconds.test.ts lib/research/linemates.test.ts`: 120 pass, fail 0
- `npm test`: 376 pass, fail 0; `npx tsc --noEmit` and `npm run lint`: exit 0
- `git diff --numstat 2518d44 -- lib/research/lines.test.ts`: `74 0`; Phase 2 test files diff empty
- `npm run build` not run (symlinked node_modules under Turbopack); the orchestrator runs it after merge.

## Known Stubs

None.

## Threat Flags

None - no new network, auth or schema surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-03 can append fixtures to ALL_FIXTURES and get accounting and listed-versus-total coverage with no new code. Plan 03-06 may now rely on unit Time and unit events covering the same seconds.

## Self-Check: PASSED

- lib/research/events.test.ts, lib/research/lines.test.ts, lib/research/lines.ts exist and carry the changes
- Commits 77f2b93, 786e597, 83f361f are ancestors of HEAD
