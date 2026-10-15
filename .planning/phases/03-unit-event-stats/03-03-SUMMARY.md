---
phase: 03-unit-event-stats
plan: 03
subsystem: research
tags: [nhl, play-by-play, fixtures, reconciliation, node-test, typescript]

requires:
  - phase: 03-unit-event-stats
    provides: "plan 03-01 mapper, attribution and fixture format; plan 03-02 attribution rules and accounting checks"
provides:
  - "Six real trimmed NHL fixtures: overtime, shootout, empty-net, penalty-shot, penalty-shot-goal-ot, missing-shift-chart"
  - "DATA-03 gate on six games: team SOG and every skater's plus-minus, with one pinned and cause-checked exception"
  - "Exclusion counters pinned on the real shootout and penalty-shot games; gate fixture set pinned"
affects: [03-04, 03-06]

plan_head_before: ccaa480ac897dfd795ef2d9e49725eb05f955b0a
plan_head_after: 260522f1f21290cc4e39c74d6ede41b93a4861fe

actuals:
  tokens: 78900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Pinned known-exception table (KNOWN_BOXSCORE_DISAGREEMENTS) with a cause test, instead of a tolerance"

key-files:
  created:
    - lib/research/fixtures/2025020306.json
    - lib/research/fixtures/2026020075.json
    - lib/research/fixtures/2025020343.json
    - lib/research/fixtures/2025020528.json
    - lib/research/fixtures/2025020500.json
    - lib/research/fixtures/2026020026.json
  modified:
    - lib/research/events.test.ts

key-decisions:
  - "No attribution fix was needed: play-events.ts and events.ts are unchanged; every game reproduced on the rules from plans 03-01 and 03-02 except the one named exception"
  - "The plus-minus loop became a recomputePlusMinus helper so the cause test reuses the same rule while skipping one goal"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "Team SOG reproduces from raw play-by-play and from attributed totals plus penalty shots on the regulation, overtime, shootout, empty-net and both penalty-shot games, with no unattributed event"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#<gameId> <team>: shots on goal from play-by-play equal the boxscore SOG (6 games x 2 teams)"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#<gameId> <team>: attributed shots plus penalty shots equal the boxscore SOG for and against (6 games x 2 teams)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every skater's plus-minus reproduces on the six gate games, with one documented exception (2025020500, A. Panarin: official 0, reproduced -1)"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#<gameId>: every skater's plus-minus recomputed from attributed goals equals the boxscore"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#KNOWN_BOXSCORE_DISAGREEMENTS entry is explained by its boundary goal"
        status: pass
    human_judgment: false
  - id: D3
    description: "The missing-shift-chart game 2026020026 reproduces both teams' SOG from play-by-play and gives null (unknown) events, never zeros"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#2026020026 <team>: with no shift chart the events are unknown (null), never zeros"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shootout attempts and penalty shots on the real edge-case games are counted in the excluded counters, and the six-game gate set is pinned"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "lib/research/events.test.ts#the shootout attempts of 2026020075 are counted in excluded.shootout"
        status: pass
      - kind: unit
        ref: "lib/research/events.test.ts#the gate fixture set is pinned, and every gate fixture is in ALL_FIXTURES with the missing-chart game"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 03: Edge-Case Reconciliation Gate Summary

**Real overtime, shootout, empty-net, penalty-shot and missing-shift-chart NHL games now run through the same SOG and plus-minus reconciliation as the regulation game: team SOG reproduces on all six gate games and every skater's plus-minus reproduces with one documented, cause-checked exception.**

## Performance

- **Duration:** about 12 min (start time was not recorded at execution start; approximate)
- **Completed:** 2026-10-14T13:26:31Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 (6 fixtures created, `lib/research/events.test.ts` modified)

## Accomplishments

- Six fixtures captured live once with a throwaway script (kept outside the repo, never committed). The script was validated first by re-capturing 2025020084 and getting a byte-identical file to the committed fixture. 2025020306 (OT), 2026020075 (SO), 2025020343 (empty-net), 2025020528 (penalty shot), 2025020500 (penalty-shot goal + OT) and 2026020026 (shifts stored `[]` by construction). Fixture directory is 364 KB for 7 files.
- `GATE_FIXTURES` has six games and `ALL_FIXTURES` seven; plan 03-02's accounting and listed-versus-total checks cover the new games with no new code and pass.
- Team SOG (raw mapper count, and attributed situation totals plus penalty shots with `unattributed` 0) matches the boxscore for both teams on all six gate games; 2026020026 matches from play-by-play.
- Plus-minus matches the boxscore for every F and D on five games and for every skater on the sixth except the one pinned entry below.
- `buildGameEvents` returns null for both teams of 2026020026 (no shifts), never zero counts.
- `excluded.shootout` on 2026020075 equals its number of shootout-mapped events (above 0); `excluded.penaltyShot` is 1 on 2025020528 and 2025020500. Mutation check: emptying `PENALTY_SHOT_CODES` in play-events.ts makes four tests fail (then restored with `git checkout`).

## Known exceptions

One plus-minus exception on the gate games:

- **Game 2025020500 (NYR vs MTL), A. Panarin, player id 8478550.** Official boxscore plus-minus 0; reproduced -1.
- **Cause:** his period-1 shift 15:28-16:18 ends on the same second as the period-1 goal at 16:18 (scored by MTL). The locked `start < t <= end` rule counts him on ice for that goal; the official record does not. The rule is unchanged for this one skater.
- **Cause test:** `KNOWN_BOXSCORE_DISAGREEMENTS entry is explained by its boundary goal` asserts from the fixture that he has a period-1 shift ending "16:18", that a counted period-1 goal sits at 16:18, that his reproduced value is -1, and that with only that goal left out his recomputed value equals the official 0. The entry is pinned in `KNOWN_BOXSCORE_DISAGREEMENTS` (`official`, `reproduced`, `why`); the plus-minus test asserts his `official` value against the fixture and his reproduced value against `reproduced`. No other skater, game or tolerance is exempt.

SC1 / DATA-03: every skater reproduces on the six gate games with one documented exception.

(This is not "all skaters reconcile". 03-VALIDATION.md's Known Exceptions list is the orchestrator's to update after merge; this worktree did not touch it.)

## Task Commits

1. **Task 1: capture six games, run the SOG and plus-minus gate, pin the one exception** - `8f02d2f` (test)
2. **Task 2: pin exclusion counters on the edge-case games and the gate fixture set** - `260522f` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified

- `lib/research/fixtures/2025020306.json`, `2026020075.json`, `2025020343.json`, `2025020528.json`, `2025020500.json`, `2026020026.json` - trimmed real NHL payloads in the 2025020084 format
- `lib/research/events.test.ts` - six-game `GATE_FIXTURES`, seven-game `ALL_FIXTURES`, `KNOWN_BOXSCORE_DISAGREEMENTS`, `recomputePlusMinus` helper, cause test, missing-chart tests, exclusion-counter and gate-set tests

## Decisions Made

None beyond the plan's recorded decisions. No attribution change was required.

## Deviations from Plan

None - plan executed exactly as written.

Environment notes (not code deviations): the worktree had no `node_modules`; the main checkout's was symlinked (gitignored, nothing installed, `package.json` and lockfile untouched) and `npx next typegen` was run so `tsc` resolves route types. `npm run build` was not run (Turbopack rejects the symlink); the orchestrator should run it after merge. No file under `app/` or `components/` changed.

### TDD gate note

Task 1 RED: after adding the five games to `GATE_FIXTURES` with the plus-minus test still unexempted, `npx tsx --test lib/research/events.test.ts` ran 74 tests with exactly one failure, "2025020500: every skater's plus-minus ... A. Panarin (8478550) plus-minus", actual -1, expected 0. That is the planned assertion failing for the planned reason (the target test executed and failed on its assertion, not a load or fixture fault), and it is the evidence for the pinned exception. The formal `check tdd-red-evidence` classifier was not run and no separate RED commit was made, because the fixtures and the test change are one reviewable unit and the production code was already complete (this plan adds the gate, not new behavior). Task 2 had no RED phase: its tests pass on first run against existing code, and the mutation check above stands in as evidence they can fail.

## Issues Encountered

None. The capture precondition held (NHL APIs reachable). 2025020528 returned 158 shot plays today against 157 in the research notes; its SOG and plus-minus still reconcile. 2026020026's shift chart is still unpublished upstream; its stored `shifts` is `[]` regardless.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; fixtures hold public NHL data only and the capture script is outside the repo (`git ls-files` for `*capture*` is empty).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-04 may append 2025020565 to `ALL_FIXTURES` only (not `GATE_FIXTURES`; the gate-set test pins the six games). Plan 03-06 can now build on a gate that passes on every game type SC1 names. Phase verification should read the Known exceptions section above.

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: six fixture files and `lib/research/events.test.ts`
- FOUND commits 8f02d2f and 260522f (ancestors of HEAD)
- `npm test` 435 pass / 0 fail, `npx tsc --noEmit` and `npm run lint` clean
