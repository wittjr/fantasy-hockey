---
phase: 03-unit-event-stats
plan: 05
subsystem: research
tags: [nhl, play-by-play, team-games, reconciliation, node-test, typescript]

requires:
  - phase: 03-unit-event-stats
    provides: "plan 03-01 buildGameEvents, toGameEvents and NhlPlayByPlay; plans 03-02 and 03-03 attribution rules and the reconciliation gate"
provides:
  - "getPlayByPlay(gameId): hour-cached, an empty response re-requested once uncached"
  - "ResearchGame.events: GameEvents | null, filled by loadGame for every game (null = unknown, never zeros)"
  - "Per-game isolation: a play-by-play failure keeps the game, logs the game id, and leaves events null (D-05)"
  - "Re-runnable live reconciliation smoke against the NHL API"
affects: [03-06, 03-07, 03-08, 03-09, 03-11]

plan_head_before: 9deb492de168eeb6ff2d708ee7e09d9ee7015666
plan_head_after: 4a2f3346dc902bf512b5c900e313f0c7b3c156d3

actuals:
  tokens: 9500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Optional upstream feed caught per game to null in loadGame, same idiom as the shift chart"
    - "Empty-but-200 upstream response re-requested once with cache no-store so it is not pinned in the hour cache"

key-files:
  created:
    - .planning/phases/03-unit-event-stats/live-events-smoke.ts
  modified:
    - lib/nhl/client.ts
    - lib/nhl/client.test.ts
    - lib/research/team-games.ts
    - lib/research/team-games.test.ts
    - lib/research/toi-trends-view.test.ts
    - lib/research/player-links-view.test.ts
    - lib/research/player-detail-view.test.ts

key-decisions:
  - "getPlayByPlay mirrors getShiftCharts: FINISHED_GAME_CACHE first, one uncached retry on empty plays, no cache-tier parameter (plan 03-07 adds it)"
  - "Play-by-play is fetched in the same Promise.all as the boxscore and shift chart so it adds no latency per game"

patterns-established:
  - "A new per-game data feed adds one nullable field on ResearchGame and one .catch in loadGame; the three view-test builders take `field: null`"

requirements-completed: [DATA-02, DATA-03]

coverage:
  - id: D1
    description: "getPlayByPlay: published play-by-play from the hour cache in one request, empty one re-requested once uncached, 503 rejects"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/nhl/client.test.ts#getPlayByPlay (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every game load carries events; a play-by-play failure or unpublished play-by-play keeps the game with events null; a missing shift chart gives events null"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/research/team-games.test.ts#a failed play-by-play keeps the game with unknown events and is logged with its game id"
        status: pass
      - kind: unit
        ref: "lib/research/team-games.test.ts#an unpublished play-by-play is requested twice and leaves the game's events unknown"
        status: pass
      - kind: unit
        ref: "lib/research/team-games.test.ts#a missing shift chart gives unknown events even when the play-by-play loaded"
        status: pass
    human_judgment: false
  - id: D3
    description: "On live NHL games, attributed SOG for and against plus penalty shots equals the official boxscore SOG with no unattributed event"
    requirement: DATA-03
    verification:
      - kind: other
        ref: "npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts -> SMOKE OK games=5 withEvents=3"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 05: Play-by-play on every game load Summary

**getPlayByPlay with an uncached retry for an empty response, `ResearchGame.events` filled in loadGame with per-game failure isolation, and a live smoke showing attributed SOG equals the official boxscore on current MTL games**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-14T13:31Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- `getPlayByPlay(gameId)` in `lib/nhl/client.ts`: one hour-cached request for a published play-by-play; an empty `plays` array is re-requested once with `cache: "no-store"` (no `next` key) so an unpublished one is not pinned. A 503 rejects with a message naming `play-by-play`.
- `loadGame` fetches play-by-play in the same `Promise.all` as the boxscore and shift chart. A failure is logged with `Loading play-by-play for game <id> (<team>) failed` and becomes `null`; the game stays in the window (TOI, linemates, unit time), is not named in `unavailableDates`, and its `events` is null. `events` is also null when there is no shift chart, even if the play-by-play loaded (DATA-02).
- `ResearchGame.events: GameEvents | null` added after `pairs`; the three view-test builders got `events: null`.
- `live-events-smoke.ts` reconciles each game's attributed SOG for and against, plus each team's penalty-shot SOG, with the raw boxscore `sog`, requires zero unattributed events, and checks every byUnit sum is at most the total.

## Live smoke runs

- `SMOKE_TEAM` default MTL, `SMOKE_GAMES` default 5: `SMOKE OK games=5 withEvents=3`.
  - 2026020058 (2026-10-08): SOG 33-20 vs boxscore 33-20, unattributed 0
  - 2026020075 (2026-10-10): SOG 30-30 vs boxscore 30-30, unattributed 0
  - 2026020092 (2026-10-13): SOG 38-17 vs boxscore 38-17, unattributed 0
- The two older games (2026020026 on 2026-10-03, 2026020045 on 2026-10-06) have no lines and no events because the NHL stats API returns 0 shift-chart rows for them (confirmed with a direct request). They stay in the window with boxscore TOI, as designed. No second team run was needed.

## Task Commits

1. **Task 1 RED: failing getPlayByPlay tests** - `9c65a74` (test)
2. **Task 1 GREEN: getPlayByPlay** - `f140d5b` (feat)
3. **Task 2: events on every game load, builders, live smoke** - `5d4571b` (feat)
4. **Task 3: per-game isolation tests** - `4a2f334` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `lib/nhl/client.ts` - `getPlayByPlay`
- `lib/nhl/client.test.ts` - four getPlayByPlay tests on the existing `stubFetch`
- `lib/research/team-games.ts` - `ResearchGame.events`, play-by-play fetch with per-game catch, `buildGameEvents` call
- `lib/research/team-games.test.ts` - `pbpFails` and `pbpEmpty` stub fields, per-game request counter, four new tests (12 total)
- `lib/research/toi-trends-view.test.ts`, `player-links-view.test.ts`, `player-detail-view.test.ts` - `events: null` in the builders
- `.planning/phases/03-unit-event-stats/live-events-smoke.ts` - re-runnable live reconciliation (env `SMOKE_TEAM`, `SMOKE_GAMES`)

## Decisions Made

- Followed the plan. `getPlayByPlay` copies the `getShiftCharts` idiom; no cache-tier parameter (plan 03-07 owns it).

## Deviations from Plan

None - plan executed exactly as written.

Notes that are not deviations:

- Task 3 is marked `tdd="true"`, but the behavior it pins was implemented in Task 2, so its tests were green on first run (no RED commit for Task 3). The RED/GREEN pair for Task 1 is present (`9c65a74` then `f140d5b`); its RED failed with `getPlayByPlay is not a function`, the expected failure for a function that did not exist yet.
- Acceptance criterion `grep -q "gamecenter/\${gameId}/play-by-play" lib/nhl/client.ts` exits 1 under macOS BSD grep even though the text is present (the same pattern for the existing `boxscore` line also exits 1; `grep -F` finds it). The criterion's intent is met.
- `npx next typegen` was run in the worktree (output is gitignored) so `tsc --noEmit` resolves `LayoutProps`; `node_modules` is a symlink to the main checkout (gitignored). `npm run build` was not run here; the orchestrator runs it after merge.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema; the only new surface is one more api-web GET per game, covered by T-03-05 to T-03-07 (failure detail goes to `console.error` only).

## Verification

- `npx tsx --test lib/nhl/client.test.ts`: 9 tests, fail 0
- `npx tsx --test lib/research/team-games.test.ts`: 12 tests, fail 0
- `npm test`: 443 tests, fail 0; `npx tsc --noEmit`: exit 0; `npm run lint`: exit 0
- Live smoke: `SMOKE OK games=5 withEvents=3`

## Next Phase Readiness

- Plans 03-06 and 03-08 can read `game.events` (total, byUnit, unattributed); plan 03-07 can add the cache-tier parameter to `getPlayByPlay`.
- Plan 03-04 runs in parallel and edits `events.ts`; this plan reads only `total`, `byUnit` and `unattributed`, so merge order does not matter.

## Self-Check: PASSED

- Created files exist: live-events-smoke.ts, 03-05-SUMMARY.md
- Commits `9c65a74`, `f140d5b`, `5d4571b`, `4a2f334` are ancestors of HEAD; `git rev-list --count 9deb492..HEAD` = 4 before the docs commit

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*
