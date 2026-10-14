---
phase: 03-unit-event-stats
plan: 07
subsystem: api
tags: [nhl-api, next-data-cache, rate-limiting, retry, concurrency]

requires:
  - phase: 03-unit-event-stats
    provides: "03-05 play-by-play and shift-chart game loader (loadGame, getPlayByPlay, getShiftCharts)"
provides:
  - "Tiered finished-game cache (finishedGameCache): 1 h under 48 h old, 30 days after"
  - "429 retry in nhlGet that only waits for Retry-After of 5 s or less, at most twice"
  - "mapPaced bounded, paced pool; loadTeamResearch loads games newest first"
affects: [03-09 cold Last 20 measurement and pacing tuning]

actuals:
  tokens: 21500
  tasks: 2
  commits: 4
plan_head_before: e8d2aad5f53a99d353480e712f29b07fa6714b71
plan_head_after: 7e6ca09c7bd31cf719dd48e8c27b118fc580d26a

tech-stack:
  added: []
  patterns:
    - "Cache tier chosen per game from the schedule startTimeUTC and passed down as a parameter"
    - "In-house paced worker pool instead of p-limit/p-retry"

key-files:
  created: []
  modified:
    - lib/nhl/client.ts
    - lib/nhl/client.test.ts
    - lib/research/team-games.ts
    - lib/research/team-games.test.ts

key-decisions:
  - "Constants start at MAX_CONCURRENT_GAMES = 3 and GAME_START_GAP_MS = 500; plan 03-09 tunes them from the cold Last 20 measurement"
  - "A thrown network error is not retried; only a 429 with a short numeric Retry-After is"
  - "Game age comes from startTimeUTC (not gameDate); a missing or unparseable value uses the 1 h tier"

patterns-established:
  - "retryAfterMs(status, retryAfter, attempt) is a pure decision function, tested at its boundaries; nhlGet loops on it"

requirements-completed: [DATA-01]

coverage:
  - id: D1
    description: "Boxscore, play-by-play and shift-chart fetches use a 1 h cache for games under 48 h old and 30 days for older games; missing or unparseable startTimeUTC uses 1 h; empty re-requests stay uncached"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "lib/nhl/client.test.ts#finishedGameCache tiers, cache parameter and uncached re-request tests"
        status: pass
      - kind: unit
        ref: "lib/research/team-games.test.ts#a game that started 30 days ago uses the 30 day cache on all three game requests"
        status: pass
    human_judgment: false
  - id: D2
    description: "A 429 with Retry-After of 5 s or less is retried up to 2 times; a longer, missing or non-numeric Retry-After fails at once"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "lib/nhl/client.test.ts#retryAfterMs and nhlGet 429 tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Game loader runs through a bounded, paced pool newest first, never rejects as a whole, and returns games oldest first"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "lib/research/team-games.test.ts#mapPaced tests and newest-first test"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cold Last 20 loads for any team without NHL throttling failures (live evidence)"
    requirement: DATA-01
    verification: []
    human_judgment: true
    rationale: "Needs live NHL requests; measured and constants tuned in plan 03-09"

duration: 25min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 07: Throttle-safe game loading Summary

**Tiered 1 h / 30 day finished-game cache, a 429 retry that never waits out a ban, and a paced newest-first game pool (3 at a time, 500 ms apart) for "Last 20"**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-14T13:11:00Z
- **Completed:** 2026-10-14T13:36:00Z
- **Tasks:** 2 (TDD, 4 commits)
- **Files modified:** 4

## Accomplishments

- `finishedGameCache(startTimeUTC, now)` picks a 3600 s tier for games under 48 h old (or with a missing/unparseable start) and a 2592000 s tier after; `getBoxscore`, `getPlayByPlay` and `getShiftCharts` take it as a `cache` parameter, and the empty-result re-requests stay `cache: "no-store"` with no `next` key.
- `retryAfterMs` plus the `nhlGet` attempt loop retry a 429 up to twice, only for a numeric Retry-After from 0 to 5 s; a 50-60 s ban, a missing or date-form header fails at once so the page renders with the game named.
- `mapPaced` caps games in flight at `MAX_CONCURRENT_GAMES` and spaces starts `GAME_START_GAP_MS` apart (slot reserved before waiting so concurrent workers stay spaced); `loadTeamResearch` loads newest first and reverses back so games still come back oldest first, with `unavailableDates` and logging unchanged.

## Task Commits

1. **Task 1: Tiered finished-game cache and 429 retry**
   - RED `e919840` (test)
   - GREEN `c717ef5` (feat)
2. **Task 2: Paced, newest-first game pool**
   - RED `cc05fe7` (test)
   - GREEN `7e6ca09` (feat)

No refactor commits were needed.

## TDD Gate Compliance

RED evidence: before the Task 1 implementation, `npx tsx --test lib/nhl/client.test.ts` failed on the new tests (`retryAfterMs is not a function`; the 429 retry tests failed on assertion, e.g. `1 !== 3` request count, and the thrown `NHL API ... 429`). Before the Task 2 implementation, `npx tsx --test lib/research/team-games.test.ts` failed 5 of 18 tests (`mapPaced is not a function` x3; newest-first and 30-day-tier assertions on `loadTeamResearch`). Semantic assessment: the targeted new tests executed and failed for the planned reasons (missing behaviour), not for syntax or fixture faults; the pre-existing tests passed throughout. The RED test for the "no startTimeUTC uses the hour cache" case passed before implementation by design (it pins existing behaviour). The classifier `check tdd-red-evidence` was not run (no `gsd_run` in this worktree environment).

## Files Created/Modified

- `lib/nhl/client.ts` - tiered cache constants and `finishedGameCache`, `retryAfterMs`, retrying `nhlGet`, `startTimeUTC?` on `NhlClubGame`, `cache` parameter on the three game fetchers; `FINISHED_GAME_CACHE` removed
- `lib/nhl/client.test.ts` - tier boundary, cache-parameter, uncached re-request and 429 retry tests; `stubFetch` accepts `headers`
- `lib/research/team-games.ts` - `MAX_CONCURRENT_GAMES`, `GAME_START_GAP_MS`, `mapPaced`, `loadGame` `cache` parameter, paced newest-first `loadTeamResearch(team, count, { gapMs })`
- `lib/research/team-games.test.ts` - `{ gapMs: 0 }` on existing calls, `calls` Stub field, `mapPaced` and newest-first/tier tests

## Decisions Made

None beyond the plan: constants 3 and 500 ms as specified, no retry on thrown network errors, `startTimeUTC` as the age source.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Verification: `npx tsx --test lib/nhl/client.test.ts` (19 pass), `npx tsx --test lib/research/team-games.test.ts` (18 pass, 0.27 s), `npm test` (484 pass, 0 fail), `npx tsc --noEmit` and `npm run lint` clean. `npm run build` was not run (symlinked node_modules under Turbopack; the orchestrator runs it after merge).

## Known Stubs

None.

## Threat Flags

None - no new endpoints, auth paths or schema; mitigations T-03-11, T-03-12, T-03-13 are implemented and tested as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 03-09, which runs the live cold Last 20 check and tunes `MAX_CONCURRENT_GAMES` / `GAME_START_GAP_MS`. `loadTeamResearch` keeps its `TeamResearch` result and `(team, count)` call shape, so 03-06 merges in either order.

## Self-Check: PASSED

- Files modified exist: lib/nhl/client.ts, lib/nhl/client.test.ts, lib/research/team-games.ts, lib/research/team-games.test.ts (FOUND)
- Commits e919840, c717ef5, cc05fe7, 7e6ca09 are ancestors of HEAD (FOUND)

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
