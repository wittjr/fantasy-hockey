---
phase: 03-unit-event-stats
plan: 09
subsystem: testing
tags: [nhl-api, rate-limiting, webkit, playwright, next-dev]

requires:
  - phase: 03-unit-event-stats
    provides: "03-07 mapPaced pool, MAX_CONCURRENT_GAMES / GAME_START_GAP_MS constants, tiered finished-game cache"
provides:
  - "cold-last20-check.ts: re-runnable live cold-load throttling check (COLD OK / COLD FAIL)"
  - "GAME_START_GAP_MS set to 1000 ms from measurement (MAX_CONCURRENT_GAMES stays 3)"
  - "webkit-units-check.cjs: scratch-copy WebKit harness with U1 (cold Last 20, three teams) and U2 (warm reload); plan 03-10 appends U3-U6 through CHECK_GROUPS"
affects: [03-10 unit-table WebKit checks, 03-11 final verification and Vercel egress check]

actuals:
  tokens: 5000
  tasks: 2
  commits: 2
plan_head_before: 02e9a7043f36f8d9d450858a35e402f57a97cd9a
plan_head_after: b1f2270ff7db17b3cc1c775654fe349e1ff18ad8

tech-stack:
  added: []
  patterns:
    - "Harness checks are self-contained check() calls grouped in functions listed in CHECK_GROUPS, so later plans append without touching earlier ones"
    - "NODE_OPTIONS=--require preload that wraps globalThis.fetch to log real NHL network calls (Next wraps the wrapper, so cache hits never reach it)"

key-files:
  created:
    - .planning/phases/03-unit-event-stats/cold-last20-check.ts
    - .planning/phases/03-unit-event-stats/webkit-units-check.cjs
  modified:
    - lib/research/team-games.ts

key-decisions:
  - "GAME_START_GAP_MS = 1000 (a game start per second, about 3 NHL requests per second); 500, 600 and 750 ms all hit 429 on the third team"
  - "U2 treats the by-design uncached re-request of an empty shift chart or play-by-play as expected and every other reload request as a cache miss"

requirements-completed: [DATA-01]

coverage:
  - id: D1
    description: "A cold Last 20 for three teams back to back, with no fetch cache, loads every game with no 429 and no unavailable date (also nine teams in a row, about 60 games)"
    requirement: DATA-01
    verification:
      - kind: other
        ref: "npx tsx .planning/phases/03-unit-event-stats/cold-last20-check.ts (COLD OK at gap 1000; also COLD_TEAMS with nine teams)"
        status: pass
    human_judgment: false
  - id: D2
    description: "In the running app a cold Last 20 for three teams in 21 s shows the Last game section, no load-error banner and no 429 in the dev server log"
    requirement: DATA-01
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (PASS U1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A warm reload makes no NHL request except the uncached re-request of shift charts that are still empty"
    requirement: DATA-01
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/03-unit-event-stats/webkit-units-check.cjs (PASS U2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Vercel egress is not throttled differently from this machine, and a 20-game (mid-season) cold load stays acceptable"
    verification: []
    human_judgment: true
    rationale: "Needs the deployed app and a full season of games; this machine only has 6-8 games per team in October (plan 03-11 human-check item 5)"

duration: 55min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 09: Cold Last 20 measurement and in-app load checks Summary

**Cold Last 20 loads clean for three teams (and nine in a row) at a 1000 ms game-start gap, proven from the command line and in the running app under desktop WebKit, with a warm reload making no cache-miss request.**

## Performance

- **Duration:** about 55 min (most of it waiting out 60 s NHL quiet periods between live runs)
- **Completed:** 2026-10-14T14:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 changed)

## Accomplishments

- `cold-last20-check.ts`: loads each team in `COLD_TEAMS` (default MTL,TOR,EDM) with `loadTeamResearch(team, 20)` and default pacing, outside Next so nothing is cached; prints `team=`, `games=`, `unavailable=`, `seconds=` per team, fails on any unavailable date or any logged error mentioning 429.
- Pacing tuned from the measurement: `GAME_START_GAP_MS` 500 to 1000, `MAX_CONCURRENT_GAMES` unchanged at 3; the comment in `lib/research/team-games.ts` now states the measured basis.
- `webkit-units-check.cjs`: copy of the Phase 2 harness approach (scratch copy, auth gate removed only in the copy, loopback dev server on 3103, node_modules cloned from `realpathSync` so a worktree symlink works, desktop WebKit) plus the `count-nhl-fetch.cjs` preload written into the temp directory. U1 and U2 pass.

## Pacing runs (cold, no fetch cache)

The October season has only 6-8 finished games per team, so a "Last 20" is about 6-8 games here; a third team's 3 requests per game still pushes the total past the NHL burst. Each game makes 3 requests (boxscore and play-by-play on api-web, shift chart on api.nhle.com), so the gap in ms maps to requests per second as 3000/gap.

| Run | MAX_CONCURRENT_GAMES | GAME_START_GAP_MS | Teams | Per-team seconds (games) | Outcome |
|-----|---|------|-------|--------------------------|---------|
| 1 | 3 | 500 | MTL,TOR,EDM | EDM 2.7 s (4 loaded, 2 unavailable); earlier teams not captured | COLD FAIL, 429 on EDM |
| 2 | 3 | 500 | MTL,TOR,EDM | 3.1 (6), 3.2 (7), 2.6 (2 of 6) | COLD FAIL, 4 unavailable, 10 errors with 429 |
| 3 | 3 | 600 | MTL,TOR,EDM | 3.4 (6), 3.8 (7), EDM all 6 failed | COLD FAIL, 16 errors with 429 |
| 4 | 3 | 750 | MTL,TOR,EDM | 4.4 (6), 4.8 (7), 3.9 (4 of 6) | COLD FAIL, 2 unavailable, 4 errors with 429 |
| 5 | 3 | 1000 | MTL,TOR,EDM | 5.3 (6), 6.2 (7), 5.2 (6) | **COLD OK** |
| 6 | 3 | 1000 | nine teams (MTL,TOR,EDM,BOS,NYR,CGY,VAN,COL,DAL), 60 games, about 180 requests in about 55 s | 5.3 to 7.4 per team (6-8 games) | **COLD OK** |

Each failing run waited at least 90 s after the previous one. Final constants: **MAX_CONCURRENT_GAMES = 3, GAME_START_GAP_MS = 1000**.

Reading: at 4 or more requests per second the 429s start after roughly 50 requests (around the third team), at 3 per second nothing fails even over about 180 requests in a minute (run 6, equal to three full 20-game teams back to back at mid-season).

## In-app checks (webkit-units-check.cjs, final run)

- **U1 PASS:** MTL 6.6 s, TOR 7.1 s, EDM 6.2 s (total 20.8 s, all within a minute), each page rendered the Last game section with no banner, no 429 in the server log; 57 NHL requests counted.
- **U2 PASS:** reloading MTL (5.9 s) made 2 NHL requests, both `shiftcharts` for games 2026020045 and 2026020026, which the NHL still returns empty (`total: 0`); the loader deliberately re-requests an empty chart uncached on every load (03-07). Zero other requests, so boxscore, play-by-play, schedule and non-empty shift charts all came from the cache. The counter works (57 in U1), so no SKIP.

## Task Commits

1. **Task 1: cold Last 20 check and pacing** - `15b3b28` (feat)
2. **Task 2: WebKit harness with U1 and U2** - `b1f2270` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `.planning/phases/03-unit-event-stats/cold-last20-check.ts` - live cold-load throttling check
- `.planning/phases/03-unit-event-stats/webkit-units-check.cjs` - scratch-copy WebKit harness, checks U1 and U2, `CHECK_GROUPS` extension point for 03-10
- `lib/research/team-games.ts` - `GAME_START_GAP_MS` 500 to 1000 and the comment explaining the measurement

## Decisions Made

- Stopped at the first passing gap (1000 ms) rather than searching between 750 and 1000; 750 failed, 1000 passed with margin over nine teams. A gap near 850 might pass but was not tried.
- The request counter matches `nhle.com` (api-web and the api.nhle.com shift charts), not only api-web as the plan text says, because shift charts are NHL requests too and the reload showed they are the only ones re-requested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] U2 would have failed on correct caching behavior**
- **Found during:** Task 2
- **Issue:** With the counter on both NHL hosts, the warm reload showed 2 shift chart requests for games whose chart the NHL publishes as empty. The loader re-requests an empty chart uncached by design, so a flat "zero requests" assertion fails on correct behavior.
- **Fix:** `isEmptyResult(url)` asks the API whether a re-requested shift chart or play-by-play is empty; those are reported as `refetchedEmpty` and only other requests count as misses.
- **Files modified:** `.planning/phases/03-unit-event-stats/webkit-units-check.cjs`
- **Verification:** final harness run, PASS U2 with `misses: []`.
- **Committed in:** `b1f2270`

**2. [Rule 1 - Bug] Server log lines split across stream chunks**
- **Found during:** Task 2
- **Issue:** Splitting each stdout/stderr chunk on newlines could cut an `NHL-FETCH` line in two and miss it.
- **Fix:** per-stream tail buffer carried to the next chunk.
- **Committed in:** `b1f2270`

**3. [Rule 3 - Blocking] Harness readiness probe loaded NHL data**
- **Found during:** Task 2
- **Issue:** the Phase 2 readiness check opens `/research?team=MTL&games=5`, which would warm the fetch cache and make U1 not cold.
- **Fix:** the harness waits on `/research` with no team, which compiles the page without NHL requests.
- **Committed in:** `b1f2270`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking). **Impact on plan:** all inside the declared files; they make the checks measure what they claim.

## Issues Encountered

- Four of six cold runs hit 429 while tuning (expected by the plan); each was followed by at least 90 s of quiet.
- Findings for the orchestrator and plan 03-11, not fixed here (outside this plan's scope):
  1. **Warm loads are paced too.** `mapPaced` sleeps the start gap for every game whether or not it is cached, so a fully cached reload took 5.9 s for 6 games and will take about 20 s for 20 games at the 1000 ms gap (it was about 10 s at 500 ms). The cold time per team is the same: about 1 s per game, so about 20 s for a full Last 20 against the D-19 expectation of about 10 s and the 15 s "report" threshold. A fix would pace only requests that miss the cache, which the loader cannot tell in advance; this is a design decision for the user.
  2. This machine's October data (6-8 games per team) cannot show a true 20-game cold time; the per-team figure above is extrapolated at 1 s per game. Vercel egress (research A1) remains the plan 03-11 human-check item 5.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- Plan 03-10 can add U3 to U6 as new check functions and list them in `CHECK_GROUPS` after `loadChecks`; the infrastructure (scratch copy, server, preload, `log`, `check`, `pause`) stays as is.
- Plan 03-11 should rerun both scripts after merge and decide what to do about warm-load pacing (finding 1 above).

## Self-Check: PASSED

- `.planning/phases/03-unit-event-stats/cold-last20-check.ts` and `webkit-units-check.cjs` exist; commits `15b3b28` and `b1f2270` are on HEAD.
- `npm test`: 515 pass, 0 fail; `npx tsc --noEmit`: exit 0 (run after the constant change).

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
