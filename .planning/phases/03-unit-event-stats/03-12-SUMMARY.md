---
phase: 03-unit-event-stats
plan: 12
subsystem: research
tags: [nhl, play-by-play, corsi, unit-stats, fixtures, gap-closure]
requires:
  - phase: 03-unit-event-stats
    provides: "toGameEvents, attributeEvents, buildUnitTable, exclusionsNote, UNIT_LEGEND and the fixture format (plans 03-01 to 03-11)"
provides:
  - "Teammate-blocked attempts count in unit CF/CA (shooter's team CF, opponent CA), never SF or GF"
  - "Fixture 2026020092 (MTL vs BUF, 2026-10-13) and a regression test on the reported numbers"
  - "Exclusion, GameEvents.excluded, exclusionsNote and UNIT_LEGEND narrowed to shootout and penalty shots"
  - "ROADMAP SC3, REQUIREMENTS UNIT-03 and Conventions, 03-CONTEXT and 03-UI-SPEC amended"
affects: [03-13, 03-verification]
actuals:
  tokens: 16800
  tasks: 3
  commits: 5
plan_head_before: 2f546232ec12a3e69f9ae516d069eb07b03d54e0
plan_head_after: 17c93203fb37db0e8a8e73e8fe5ae4cdf2467077
tech-stack:
  added: []
  patterns:
    - "A counting rule is pinned by a fixture of the reported game run through the same functions the page uses (analyzeGameLines, buildGameEvents, buildUnitTable)"
key-files:
  created:
    - lib/research/fixtures/2026020092.json
  modified:
    - lib/research/play-events.ts
    - lib/research/events.ts
    - lib/research/unit-events-view.ts
    - lib/research/events.test.ts
    - lib/research/play-events.test.ts
    - lib/research/unit-events-view.test.ts
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/03-unit-event-stats/03-CONTEXT.md
    - .planning/phases/03-unit-event-stats/03-UI-SPEC.md
key-decisions:
  - "Fixture 2026020092 stores the boxscore SOG (MTL 38, BUF 16); the plan's 17 for BUF is the play-by-play count that includes one shootout shot"
  - "2026020092 is in ALL_FIXTURES only; the GATE_FIXTURES set stays pinned"
requirements-completed: [UNIT-01, UNIT-03, DATA-03]
coverage:
  - id: D1
    description: "MTL line 1 (Suzuki, Caufield, Slafkovsky) EV CF is 11 and line 3 (Kreider, Anderson, Newhook) EV CA is 6 on game 2026020092"
    requirement: UNIT-01
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#UAT G-03-1: MTL line 1 shows EV CF 11 once its teammate-blocked attempt counts"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#UAT G-03-1: MTL line 3 shows EV CA 6 once BUF's teammate-blocked attempt counts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Teammate-blocked attempts add CF for the shooter's team and CA for the other team and never SF or GF; boxscore SOG still reconciles"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#UAT G-03-1: teammate-blocked attempts add CF for the shooter's team and CA for the other, never SF or GF"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#UAT G-03-1 2026020092 MTL/BUF: attributed shots plus penalty shots equal the boxscore SOG"
        status: pass
      - kind: integration
        ref: "npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts (SMOKE OK games=5 withEvents=3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The exclusions note and legend line 3 name only shootout attempts and penalty shots"
    requirement: UNIT-03
    verification:
      - kind: unit
        ref: "lib/research/unit-events-view.test.ts#exclusionsNote tests and UNIT_LEGEND is the three 03-UI-SPEC lines"
        status: pass
    human_judgment: false
  - id: D4
    description: "ROADMAP SC3, REQUIREMENTS, 03-CONTEXT and 03-UI-SPEC state the new rule and cite G-03-1"
    verification: []
    human_judgment: true
    rationale: "Prose edits to spec documents; a reader must judge that they agree with the shipped rule"
duration: 25min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 12: Teammate-blocked attempts count in CF/CA Summary

**Unit Corsi now credits teammate-blocked attempts to the shooter's team (CF) and the opponent (CA), reproducing the reported MTL line 1 EV CF 11 and line 3 EV CA 6, with boxscore SOG reconciliation unchanged**

## Performance

- **Duration:** 25 min
- **Tasks:** 3
- **Files modified:** 11 (1 created)

## Accomplishments

- UAT G-03-1 closed: on MTL 2026020092 the EV forwards unit Suzuki-Caufield-Slafkovsky shows CF 11 (was 10) and Kreider-Anderson-Newhook shows CA 6 (was 5), through `analyzeGameLines`, `buildGameEvents` and `buildUnitTable`.
- `toGameEvents` no longer excludes any blocked shot; the `Exclusion` union, `GameEvents.excluded`, `exclusionsNote` and `UNIT_LEGEND[2]` now cover shootout attempts and penalty shots only.
- A pin over all 9 fixtures (29 teammate-blocked plays) shows `eventOwnerTeamId` is always the shooter's team.
- Spec documents amended: ROADMAP SC3, REQUIREMENTS UNIT-03 and Conventions, 03-CONTEXT (carried-forward exclusions, D-14, D-21) and 03-UI-SPEC (states, exclusions note, legend line 3, coverage row, new Revisions section).

## Task Commits

1. **Task 1 (tracer): reported game end to end** - `7217924` (test, RED) and `9184b8a` (feat, GREEN)
2. **Task 2: remove the exclusion from counter, note and legend** - `68d1a26` (test, RED) and `3673f8d` (feat, GREEN)
3. **Task 3: record the decision in the spec documents** - `17c9320` (docs)

**Plan metadata:** the SUMMARY commit follows this file.

## TDD evidence

**Task 1 RED** (`npx tsx --test lib/research/events.test.ts lib/research/play-events.test.ts`, 131 tests, 5 failed, all on the planned assertion):
- MTL line 1 EV `stats.cf`: actual `'10'`, expected `'11'`.
- MTL line 3 EV `stats.ca`: actual `'5'`, expected `'6'`.
- Delta test (CF/CA with versus without the three teammate-blocked plays): actual `[0, 0]`, expected `[2, 1]`.
- play-events: reason `teammate-blocked` gave exclusion `'teammate-blocked'`, expected `null`; teammate-blocked at `0651` gave exclusion `'teammate-blocked'`, expected `null` (pulledGoalie true).
Semantic assessment: every target test ran and failed on the planned assertion for the intended reason (the exclusion), not on setup, import or fixture faults. The 126 other tests passed, including the SOG reconciliation on 2026020092, which cannot move because blocked shots never reach SF.
**Task 1 GREEN:** same files, 131 tests, 0 failed; `npx tsc --noEmit` clean.

**Task 2 RED** (`events.test.ts`, `unit-events-view.test.ts`, 172 tests, 7 failed): the key-set test, three `exclusionsNote` tests, the legend test and two footnote markup tests, all failing on the removed teammate-blocked counter and copy (for example "undefined teammate-blocked attempts"). **GREEN:** `npm test` 548 tests, 0 failed; `npx tsc --noEmit` and `npm run lint` clean.

**Live smoke** (`npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts`): `SMOKE OK games=5 withEvents=3`. Game 2026020092 printed `SOG 38-16 vs boxscore 38-16, unattributed 0`; the other attributed games also matched.

## Files Created/Modified

- `lib/research/fixtures/2026020092.json` - trimmed real payload, MTL (home) vs BUF, category `teammate-blocked`
- `lib/research/play-events.ts` - exclusion ternary is shootout, penalty-shot or null; `Exclusion` has two members
- `lib/research/events.ts` - `excluded` has `shootout` and `penaltyShot` only
- `lib/research/unit-events-view.ts` - `exclusionsNote` and `UNIT_LEGEND[2]` without teammate-blocked
- `lib/research/events.test.ts`, `play-events.test.ts`, `unit-events-view.test.ts` - regression, reconciliation, owner-is-shooter pin and narrowed-copy tests
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/03-unit-event-stats/03-CONTEXT.md`, `.planning/phases/03-unit-event-stats/03-UI-SPEC.md` - rule amendments citing G-03-1

## Decisions Made

- The fixture records the official boxscore SOG, as the fixture format requires. 2026020092 was decided in a shootout, and the play-by-play counts 17 BUF shots on goal because it includes one shootout shot; the boxscore says 16.
- 2026020092 joins `ALL_FIXTURES` only. The gate set is pinned by its own test and this game is a regression for a counting rule, not a plus-minus gate game.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan stated BUF SOG 17; the official boxscore SOG is 16**
- **Found during:** Task 1 (fixture capture)
- **Issue:** The plan's interfaces and Task 1 acceptance criterion say BUF 17 SOG (`f.awayTeam.sog===17`). The boxscore returns 16 and the play-by-play top-level `sog` also reads 16; 17 is the count of goal and shot-on-goal plays including one shootout shot (MTL 41 versus 38 the same way). Storing 17 would make the SOG reconciliation tests fail.
- **Fix:** The fixture stores the boxscore values (MTL 38, BUF 16), as the fixture format (03-01 Task 1 step 1) says. The reconciliation test asserts against them and passes. All other parts of the acceptance check pass (`category`, home abbrev and SOG 38, non-empty shifts and players).
- **Files modified:** `lib/research/fixtures/2026020092.json`
- **Verification:** reconciliation tests pass; live smoke prints `38-16 vs boxscore 38-16`
- **Committed in:** `7217924`

---

**Total deviations:** 1 auto-fixed (1 plan data error). **Impact:** none on behavior. The plan's own truth ("attributed SF plus penalty-shot SOG equals the boxscore SOG") holds with the real value. The verifier should not re-run the literal `sog===17` check.

## Issues Encountered

- The fixture capture script was first run on 2025020084 and its output compared field by field with the committed fixture (plays, shifts, players, teams all identical) before capturing 2026020092. The script lives in the session scratchpad and is not in the repo.
- Worktree environment: `node_modules` is a symlink to the main checkout (gitignored) and `npx next typegen` was run (gitignored output) so `npx tsc --noEmit` resolves route types. `npm run build` was not run; the orchestrator should run it after merge.

## Known Stubs

None.

## Threat Flags

None. The change removes a branch and adds no parsing or endpoints (T-03-29); the fixture holds public NHL data only (T-03-30).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-1 is closed. Plan 03-13 (G-03-3, G-03-7) is independent of this change.
- `npm run build` was not run in this worktree (symlinked `node_modules` under Turbopack); run it after merge.

## Self-Check: PASSED

- `lib/research/fixtures/2026020092.json` exists; commits `7217924`, `9184b8a`, `68d1a26`, `3673f8d`, `17c9320` are ancestors of HEAD.
- `npm test` (548 tests, 0 failed), `npx tsc --noEmit`, `npm run lint` and the live smoke pass.
- Acceptance checks: `grep -c "shootout attempts and penalty shots are left out" lib/research/unit-events-view.ts` is 1; `Exclusion` has exactly `shootout` and `penalty-shot`; GATE_FIXTURES does not contain 2026020092; no capture script is untracked in the repo; each of the four spec documents contains G-03-1; the UI-SPEC legend line 3 and `UNIT_LEGEND[2]` end with the same sentence.
- STATE.md and ROADMAP plan checkboxes, progress table and plan counts were not touched (orchestrator-owned).

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
