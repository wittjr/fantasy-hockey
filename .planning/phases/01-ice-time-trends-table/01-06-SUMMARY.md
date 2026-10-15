---
phase: 01-ice-time-trends-table
plan: 06
subsystem: research
tags: [nhl-api, promise-allsettled, error-isolation, node-test, tdd, next-app-router]

requires:
  - phase: 01-ice-time-trends-table
    provides: loadTeamResearch / loadGame, getShiftCharts, trends table and the "No PP/SH data for" footnote (plans 01-01..01-05)
provides:
  - "TeamResearch.unavailableDates: dates of window games whose boxscore failed; those games are left out of games"
  - "loadTeamResearch uses Promise.allSettled and throws only when every game in the window fails"
  - "loadGame turns a failed shift-chart request into an empty list, so the game behaves like one with no published chart"
  - "app/research/page.tsx: amber unavailable-games note and a fixed friendly load-error banner (no API error text in markup)"
  - "lib/research/team-games.test.ts: loader tests with a stubbed global fetch"
affects: [01-07, phase-2-linemates, phase-3-concurrency-DATA-01]

plan_head_before: fc3e3e4e3ddf12d7a49cf5227641065019b3b577
plan_head_after: 7b9685aa40274d252a05e678a34d63e8fcc3440e

actuals:
  tokens: 2050
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Isolate upstream failures per item with Promise.allSettled; log each failure server-side and disclose the left-out item in the UI"
    - "Test network loaders by stubbing globalThis.fetch with t.mock.method and routing on URL"

key-files:
  created: [lib/research/team-games.test.ts]
  modified:
    - lib/research/team-games.ts
    - app/research/page.tsx
    - lib/research/toi-trends-view.test.ts
    - .planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md

key-decisions:
  - "A game whose boxscore fails is left out of the window and its date shown in an amber note, never kept as all-DNP or zeros: without a boxscore there is no roster, TOI or result, and keeping it would create false DNP badges (TRND-04). No backfill with an older game (extra requests, DATA-01 territory)"
  - "The load-error banner shows fixed copy and the error detail goes only to the server log (console.error); the page no longer touches error.message"
  - "No retry, backoff or concurrency limit added; a failed request is not cached by Next (only HTTP 200 is stored), so a reload retries it"

patterns-established:
  - "Per-game failure isolation: loadGame rejects on boxscore failure, loadTeamResearch collects rejections into unavailableDates"

requirements-completed: [TRND-01, TRND-04]

coverage:
  - id: D1
    description: "A failed boxscore request leaves only that game out of the window and names its date; the rest of the table still loads"
    requirement: TRND-04
    verification:
      - kind: unit
        ref: "lib/research/team-games.test.ts#a failed boxscore leaves only that game out and names its date"
        status: pass
      - kind: unit
        ref: "lib/research/team-games.test.ts#a left-out game is never kept as a game nobody played in"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed shift-chart request keeps the game with boxscore TOI and no line data; an OT game has unknown regulation TOI"
    requirement: TRND-01
    verification:
      - kind: unit
        ref: "lib/research/team-games.test.ts#a failed shift chart keeps the game with boxscore TOI and no line data"
        status: pass
      - kind: unit
        ref: "lib/research/team-games.test.ts#an OT game with a failed shift chart is kept but has unknown regulation TOI"
        status: pass
    human_judgment: false
  - id: D3
    description: "Total failure rejects naming the team; a team with no finished games still loads empty; failures are logged server-side"
    requirement: TRND-01
    verification:
      - kind: unit
        ref: "lib/research/team-games.test.ts#rejects when every game in the window fails"
        status: pass
      - kind: unit
        ref: "lib/research/team-games.test.ts#a team with no finished games loads empty without throwing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Research page shows the amber unavailable-games note and the friendly rose banner with no raw API error text"
    requirement: TRND-04
    verification:
      - kind: other
        ref: "grep gates on app/research/page.tsx (no .message outside comments; copy strings present); npm run build"
        status: pass
    human_judgment: true
    rationale: "Page rendering of the amber note and banner is not covered by a rendered-page test; visual/copy adequacy needs a look in the browser"

duration: 3min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 06: Per-game NHL failure isolation Summary

**Promise.allSettled per-game isolation so one failed boxscore drops only that game (named in an amber note) and a failed shift chart costs only that game's PP/SH, with a fixed friendly error banner instead of the raw API text.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-11T22:58:09Z
- **Completed:** 2026-10-11T23:01:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 created)

## Accomplishments
- `loadTeamResearch` keeps every game that loads, logs each failure with its game id, and lists dropped dates in `TeamResearch.unavailableDates`; it throws only when the whole window fails.
- A rejected shift-chart request becomes an empty list, so the game shows boxscore TOI, PP/SH "—", appears in the existing "No PP/SH data for" footnote, and an OT/SO game is excluded from Avg TOI, Δ and slope (D-12, D-13).
- The research page shows an amber note ("Couldn't load NHL data for {dates}, so those games are left out of this window. Reload to try again.") and a fixed rose banner ("... right now. Try again in a minute."); error text goes only to the server log.
- WR-03 recorded as fixed in 01-REVIEW-DISPOSITION.md.

## TDD Cycle

**Task 1 (tracer)**
- RED (`213fabd`): 5 tests in the new `team-games.test.ts`; all 5 failed. The failed-boxscore tests rejected with `NHL API gamecenter/1/boxscore failed: 503` (the old `Promise.all` behaviour the plan replaces), the no-finished-games test failed on `unavailableDates` being `undefined` (expected `[]`), and the all-failed test failed because the rejection message did not name the team. Semantic assessment: the target tests ran and failed for the planned reason (no per-game isolation, field absent), not a syntax, import or fixture fault. The `gsd_run check tdd-red-evidence` classifier was not run (no `TDD_MODE` and the plan is `type: execute`); the assessment is by inspection of the real test output.
- GREEN (`d0ce098`): `Promise.allSettled`, `unavailableDates`, amber note, fixture field; 37 of 37 tests in the two files passed.
- Tracer gate: `human_verify_mode` is `end-of-phase` and `<verify>` was automated-only, so the verify was re-run (tests, `tsc`, `next build` all passed) and the plan expanded with no checkpoint.

**Task 2**
- RED (`47cc31f`): 3 shift-chart tests added; 3 of 8 failed (failed chart rejected the whole game, and the log test was tightened to also require the game be kept, since the allSettled path would otherwise log "game 3" by coincidence).
- GREEN (`8e74774`): `getShiftCharts(gameId).catch(...)` and the friendly banner; 8 of 8 passed.
- No REFACTOR commit (no change needed).

## Task Commits

1. **Task 1: boxscore failure isolation** - `213fabd` (test), `d0ce098` (feat)
2. **Task 2: shift-chart failure isolation, friendly error** - `47cc31f` (test), `8e74774` (feat)
3. **WR-03 disposition** - `7b9685a` (docs)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `lib/research/team-games.ts` - `allSettled` over window games, `unavailableDates`, shift-chart `.catch`, per-failure `console.error`
- `lib/research/team-games.test.ts` - new; stubbed-fetch tests for failed boxscore, failed shift chart (REG and OT), all failed, no finished games, logging
- `app/research/page.tsx` - amber unavailable-games note; `loadFailed` boolean replaces the error string; server-side `console.error`
- `lib/research/toi-trends-view.test.ts` - `research()` fixture carries `unavailableDates: []`
- `.planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md` - WR-03 row reads `fixed in 01-06 (d0ce098, 8e74774)`

## Decisions Made
- Boxscore failure leaves the game out and discloses its date rather than keeping it as an all-DNP game or inventing zeros (TRND-04). The "team's last 2 games" used by Δ (D-05) therefore become the last 2 games that loaded; the amber note tells the user. No backfill with an older game.
- The load-error banner shows fixed copy only. This amends UI-SPEC's E1 error row ("Couldn't load NHL data for {team}: {error}"); UI-SPEC.md itself was not edited.
- A failed shift chart reuses the existing "NHL hasn't published shift charts ... yet" footnote wording; a reload retries it because Next caches only HTTP 200 responses.
- No retry, backoff or concurrency limit (DATA-01 stays in Phase 3).

## Deviations from Plan

None - plan executed exactly as written. (Minor: the amber note's sentence is kept on one JSX line so the plan's literal-string acceptance grep matches.)

## Issues Encountered
- BSD `sed -i` rejected the in-place disposition edit; redone with the Edit tool. No effect on the result.

## Known Stubs

None.

## Threat Flags

None. The change reduces disclosed surface (T-01-11: no API path or status reaches the markup; gate `grep -v '^\s*//' app/research/page.tsx | grep -c '\.message'` returns 0). T-01-12 and T-01-13 mitigated and covered by the loader tests.

## Verification
- `npm test`: 172 pass, 0 fail
- `npx tsc --noEmit`: clean
- `npm run build`: compiled successfully
- `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx`: clean
- All acceptance-criteria greps pass, including the WR-03 disposition row regex.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for 01-07. The amber note and friendly banner are not covered by a rendered-page test; worth a glance in the browser (cannot be forced without a failing NHL request).

## Self-Check: PASSED

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*
