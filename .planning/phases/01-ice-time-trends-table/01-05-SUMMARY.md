---
phase: 01-ice-time-trends-table
plan: 05
subsystem: research
tags: [nhl-shift-charts, power-play, next-fetch-cache, node-test, tdd]

requires:
  - phase: 01-ice-time-trends-table
    provides: analyzeGameLines / regulationSeconds, getShiftCharts, trends table PP share / SH columns (plans 01-01..01-04)
provides:
  - uniqueShifts: one shared de-duplication of verbatim-repeated NHL shift rows, used by analyzeGameLines and regulationSeconds
  - getShiftCharts re-requests an empty cached chart uncached (cache no-store), so PP/SH appear on the next view after the NHL publishes
  - lib/nhl/client.test.ts: fetch-stub tests for shift-chart caching
affects: [01-06, 01-07, phase-2-linemates, phase-3-event-attribution]

plan_head_before: 80214c50fab3b68dd59b1454b10745028c7cf11f
plan_head_after: eca51c5f9a14d5739c4b372802fb3206c95ea6dd

actuals:
  tokens: 2100
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "De-duplicate upstream feed rows inside each pure consumer through one shared helper, not in the loader"
    - "Next fetch cache cannot be told to skip a 200 after the fact; re-request uncached when the cached body is empty"

key-files:
  created: [lib/nhl/client.test.ts]
  modified:
    - lib/research/lines.ts
    - lib/research/lines.test.ts
    - lib/nhl/client.ts
    - .planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md
    - .planning/phases/01-ice-time-trends-table/deferred-items.md

key-decisions:
  - "uniqueShifts lives in lib/research/lines.ts and is called inside both analyzeGameLines and regulationSeconds, not in loadGame: the regression test can only target the pure function, and Phase 2/3 reuse stays safe with no caller discipline"
  - "WR-02 fixed by one uncached re-request only when the cached shift chart is empty (cache: no-store), not by a short revalidate on every chart, which would refetch up to 20 published charts per page view each minute and add NHL 429 risk (DATA-01, Phase 3)"
  - "Overlapping but non-identical shift rows stay out of scope; only exact (team, playerId, period, startSec, endSec) repeats collapse"

patterns-established:
  - "Exact-key row de-duplication via a small exported helper with first-occurrence, input-order semantics"
  - "Fetch tests stub globalThis.fetch with t.mock.method and a response queue, asserting call count and init"

requirements-completed: []

coverage:
  - id: D1
    description: "PP, SH, PP share and EV/PP/SH classification count each NHL shift row once; MTL on game 2026020075 reads PP 480 s / SH 454 s instead of 549 / 395"
    requirement: TRND-01
    verification:
      - kind: unit
        ref: "lib/research/lines.test.ts#analyzeGameLines counts a verbatim duplicate shift row once"
        status: pass
      - kind: unit
        ref: "lib/research/lines.test.ts#a duplicated skater row does not turn even strength into a power play"
        status: pass
      - kind: integration
        ref: "live smoke: npx tsx -e (game 2026020075) prints SMOKE OK game=2026020075 duplicates=3 pp=480 sh=454"
        status: pass
    human_judgment: false
  - id: D2
    description: "uniqueShifts collapses only exact repeats, keeps first occurrence and input order; no player's PP/SH seconds exceed the team's"
    requirement: TRND-04
    verification:
      - kind: unit
        ref: "lib/research/lines.test.ts#uniqueShifts only collapses exact (team, player, period, start, end) repeats"
        status: pass
      - kind: unit
        ref: "lib/research/lines.test.ts#with duplicates, no player's PP or SH seconds exceed the team's"
        status: pass
    human_judgment: false
  - id: D3
    description: "An empty, not-yet-published shift chart is re-requested uncached on the next view; a published chart is still served from the hour cache with one request"
    verification:
      - kind: unit
        ref: "lib/nhl/client.test.ts#getShiftCharts re-requests an empty chart uncached and returns the published rows"
        status: pass
      - kind: unit
        ref: "lib/nhl/client.test.ts#getShiftCharts serves a published chart from the hour cache with one request"
        status: pass
    human_judgment: false
  - id: D4
    description: "CR-01 and WR-02 recorded as fixed in 01-05 with commit hashes in 01-REVIEW-DISPOSITION.md and deferred-items.md"
    verification:
      - kind: other
        ref: "grep -E '^\\| (CR-01|WR-02) \\|.*fixed in 01-05 \\([0-9a-f]{7,}\\) \\|$' 01-REVIEW-DISPOSITION.md"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 05: Shift-row de-duplication and empty shift-chart refetch Summary

**Shared `uniqueShifts` makes analyzeGameLines count each NHL shift row once (MTL on game 2026020075 now PP 480 s / SH 454 s, not 549 / 395), and `getShiftCharts` re-requests an empty cached chart uncached so PP/SH appear as soon as the NHL publishes.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-11T22:53:47Z
- **Completed:** 2026-10-11T22:55:54Z
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments
- CR-01 closed: `uniqueShifts` drops verbatim-repeated (team, playerId, period, startSec, endSec) rows; `analyzeGameLines` and `regulationSeconds` both iterate it, and the private Set in `regulationSeconds` is gone. A duplicate can no longer inflate a player's PP/SH seconds or turn 5v5 into a phantom power play.
- Live smoke on game 2026020075 (3 repeated rows in the feed) prints `SMOKE OK game=2026020075 duplicates=3 pp=480 sh=454`, and no player's PP/SH exceeds the team's.
- WR-02 closed: an empty shift chart is no longer pinned in the fetch cache for an hour; published charts and the boxscore keep the 3600 s cache with a single request.
- 11 new tests (6 in lines.test.ts including strength flip, boundary and invariant; 5 in the new client.test.ts). `npm test` 164 pass, up from the 154 baseline.

## TDD Gate Compliance

Both tasks ran RED then GREEN; no REFACTOR was needed.

- **Task 1 RED** (`fd61ab1`): 5 new tests failed, 8 existing passed. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target: "analyzeGameLines counts a verbatim duplicate shift row once"). Semantic assessment: the target ran and failed on the planned deep-equal (the duplicated player's `playerSeconds` doubled, and the strength-flip case read `pp: 60` instead of `ev: 60`); the two `uniqueShifts` tests failed with "not a function", which is the expected pre-implementation state, not a load fault. **GREEN** `b382dff`.
- **Task 2 RED** (`26ac3f7`): 2 of 5 tests failed (empty-chart refetch, both-empty), 3 pinned unchanged behaviour and passed. `RED_EVIDENCE_OK`. Semantic assessment: failures were the planned "no second uncached request" assertion (call count 1, expected 2). **GREEN** `1991867`.

## Task Commits

1. **Task 1: Count each shift row once for PP/SH (CR-01)** - `fd61ab1` (test), `b382dff` (feat)
2. **Task 2: Refetch an empty shift chart uncached (WR-02) and record CR-01/WR-02 as fixed** - `26ac3f7` (test), `1991867` (feat), `eca51c5` (docs: record CR-01 and WR-02 fixes)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `lib/research/lines.ts` - exported `uniqueShifts`; `regulationSeconds` and `analyzeGameLines` iterate it
- `lib/research/lines.test.ts` - duplicate-row regression, strength flip, uniqueShifts order/empty, boundary, PP/SH invariant tests
- `lib/nhl/client.ts` - module-private `fetchShiftCharts`; `getShiftCharts` retries once with `cache: "no-store"` only on an empty chart
- `lib/nhl/client.test.ts` - new fetch-stub tests for shift-chart caching
- `.planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md` - CR-01 and WR-02 rows read `fixed in 01-05 (hash)`
- `.planning/phases/01-ice-time-trends-table/deferred-items.md` - CR-01 entry marked fixed with a Fix line

## Decisions Made
- De-duplication sits inside the two pure consumers via one helper, not in `loadGame`: the verifier's regression ("a duplicate leaves situationSeconds and playerSeconds unchanged") can only be unit-tested against `analyzeGameLines`, `loadGame` needs the network, and Phase 2/3 reuse of `analyzeGameLines` stays safe with no caller discipline. `team-games.ts` is untouched (`git diff 78406dc -- lib/research/team-games.ts` is empty).
- WR-02 mechanism: per the Next 16 fetch docs the cache decision is made from request options and any 200 is stored, so an empty 200 cannot be kept out of the cache afterward, and `revalidateTag` is not callable during a Server Component render. A short `revalidate` on every chart would refetch up to 20 published charts per page view each minute, adding NHL load where DATA-01 (Phase 3) already worries about HTTP 429. The chosen approach adds one uncached request only for a game whose cached chart is empty; that empty cached entry expires on its own within the hour. No retry or backoff added (DATA-01).
- Overlapping but non-identical shift rows are deliberately not de-duplicated (none observed; would be speculative).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type error in the new client.test.ts**
- **Found during:** Task 2 (full-suite verification after GREEN)
- **Issue:** My fetch-stub call record typed `init` as `RequestInit & { next?: { revalidate?: number } }`, which conflicts with Next's `NextFetchRequestConfig` (`revalidate: number | false`); `tsc --noEmit` and `npm run build` failed.
- **Fix:** Typed `init` as plain `RequestInit` (Next already adds `next`).
- **Files modified:** lib/nhl/client.test.ts
- **Verification:** `npx tsc --noEmit`, `npm run build`, eslint and `npm test` all pass.
- **Committed in:** `1991867` (the RED commit `26ac3f7` contains the mistyped test, which only runs under tsx and so failed for the intended reason there)

---

**Total deviations:** 1 auto-fixed (1 bug in my own test code)
**Impact on plan:** None on scope or behaviour.

## Issues Encountered
- Not a plan issue: the `gsd_run check tdd-red-evidence` classifier requires the record inside the project directory, so the two evidence JSON files were written to the project root temporarily and deleted; neither was committed.
- `requirements.ready-ids` reports 0 of 3 ready (TRND-01, TRND-03, TRND-04 are also declared by sibling gap plans 01-06 and 01-07 with no SUMMARY yet), so `requirements-completed` is empty and REQUIREMENTS.md was not changed. They become ready when the last declaring plan finishes.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for 01-06 (the remaining gap plans). The PP share, PP share Δ, SH and mover tint now read correct shift data; unknown PP/SH stays "—".
- The live smoke pins MTL PP 480 s / SH 454 s for game 2026020075; if the NHL edits that feed it fails loudly on the duplicate-count check instead of passing silently.

## Self-Check: PASSED

- Files present: lib/research/lines.ts, lib/research/lines.test.ts, lib/nhl/client.ts, lib/nhl/client.test.ts, 01-REVIEW-DISPOSITION.md, deferred-items.md
- Commits present on this branch: fd61ab1, b382dff, 26ac3f7, 1991867, eca51c5
- Final checks: `npm test` 164 pass / 0 fail, `npx tsc --noEmit` clean, `npm run build` exit 0, scoped eslint clean, live smoke OK

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*
