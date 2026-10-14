---
phase: 03-unit-event-stats
plan: 11
subsystem: testing
tags: [playwright, webkit, regression, live-smoke, nhl-api]

requires:
  - phase: 03-unit-event-stats
    provides: "03-06 two-row unit-table header, 03-05 live-events-smoke.ts, 03-10 live unit-table render checks"
provides:
  - "Phase 2 WebKit regression harness repaired for the Phase 3 table layout: 17 passed, 0 failed"
  - "Live smoke re-run: attributed shots on goal reconcile with the boxscore on current MTL games"
  - "Full suite results (npm test, tsc, lint) and the end-of-phase human check ready for the user"
affects: [03-unit-event-stats verification, phase 3 UAT]

actuals:
  tokens: 1200
  tasks: 2
  commits: 1
plan_head_before: 84e7eed2c953b155a07af6bfc03fced1b3c8ff0b
plan_head_after: b6a8cf744cf255801bbc5b36f6397226154e8b42

tech-stack:
  added: []
  patterns:
    - "Harness readiness probe hits /research without a team so a cold NHL load cannot abort the probe"

key-files:
  created: []
  modified:
    - .planning/phases/02-player-linemate-detail/webkit-player-check.cjs

key-decisions:
  - "N8 finds PP tables by any thead th starting 'PP - ' and links by tbody a with player=, instead of the last cell of the first header row"
  - "Readiness probe changed to /research (no team), the same fix 03-09's harness already uses"

requirements-completed: [DATA-01, UNIT-01, UNIT-02, UNIT-03]

coverage:
  - id: D1
    description: "Phase 2 WebKit regression run passes with the N8 lookup updated for the two-row unit-table header"
    requirement: UNIT-01
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs (player-check: 17 passed, 0 failed, 0 skipped; PASS N8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live smoke reconciles current games: attributed shots on goal equal the official boxscore SOG for both teams, no unattributed event"
    requirement: DATA-01
    verification:
      - kind: integration
        ref: "npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts (SMOKE OK games=5 withEvents=3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full suite: npm test, tsc, lint pass; npm run build deferred to the orchestrator"
    verification:
      - kind: unit
        ref: "npm test (536 pass, 0 fail); npm run lint (exit 0)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (one error, LayoutProps, from the missing generated .next/types in the worktree; npm run build not run per orchestrator instruction)"
        status: unknown
    human_judgment: true
    rationale: "tsc and build need the orchestrator's post-merge build, where .next/types exist"
  - id: D4
    description: "End-of-phase human check: boxscore cross-check of Last game Total SF, legend and exclusions wording, light and dark screenshots, no-data game, post-deploy Vercel Last 20"
    verification: []
    human_judgment: true
    rationale: "Needs a signed-in browser, the NHL.com boxscore and judgment on wording; the executor has no user to ask"

duration: 17min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 11: Phase 2 regression and end-of-phase checks Summary

**Phase 2's WebKit harness passes again (17/0/0) after repairing its N8 lookup for the two-row unit-table header, the live smoke reconciles MTL's current games to the boxscore, and the suite is green except for the build and tsc steps that need the orchestrator's merged checkout.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-14T14:09:42Z
- **Completed:** 2026-10-14T14:26:26Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- N8 now finds PP tables by any `thead th` starting "PP - " and links by `tbody a` with `player=`. Every other check in the 681-line harness is untouched. The run ends `player-check: 17 passed, 0 failed, 0 skipped`; N8 clicked C. Kreider in a PP table and landed on `?team=MTL&games=5&player=8475184&sit=pp` with PP current.
- Live smoke on MTL, 5 games: `SMOKE OK games=5 withEvents=3`. The three games with events reconcile exactly: 2026-10-08 SOG 33-20, 2026-10-10 SOG 30-30, 2026-10-13 SOG 38-17, all equal to the boxscore with `unattributed 0`.
- `npm test`: 536 tests, 536 pass, `ℹ fail 0`. `npm run lint`: exit 0.

## Task Commits

1. **Task 1: Phase 2 regression run with the N8 lookup updated** - `b6a8cf7` (test)
2. **Task 2: Live smoke, full suite and the end-of-phase check** - no file changes; results recorded here, human check pending (see below)

**Plan metadata:** the docs commit that adds this SUMMARY.

## Files Created/Modified

- `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs` - N8 lookup updated (the plan's change), readiness probe moved to `/research`, node_modules clone resolves the symlink (both deviations below)

## Decisions Made

None beyond the plan, apart from the two harness fixes under Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 2 harness readiness probe aborted by the slower Phase 3 page**
- **Found during:** Task 1
- **Issue:** The harness waited for the scratch server by fetching `/research?team=MTL&games=5` with a 3 s abort. Since Phase 3 that page also loads play-by-play and takes longer than 3 s cold, so every probe was aborted, the 180-iteration loop never saw a 200, and two runs produced no output (the first ran 11 minutes before I killed it).
- **Fix:** Probe `/research` (no team), which compiles the page without any NHL load. This is the same approach 03-09's `webkit-units-check.cjs` already uses. The first real navigation (`networkidle`, 120 s) absorbs the cold load.
- **Files modified:** `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`
- **Verification:** the run completed, 17 passed, 0 failed.
- **Committed in:** `b6a8cf7`

**2. [Rule 3 - Blocking] node_modules clone from a symlink**
- **Found during:** Task 1 (worktree environment, as the task brief predicted)
- **Issue:** The worktree's node_modules is a symlink to the main checkout; `cp -Rc` copies a symlink as a symlink and Turbopack rejects it.
- **Fix:** `cp -Rc` now sources `fs.realpathSync(path.join(root, "node_modules"))`, the one-line change used in 03-09. It is harmless in a normal checkout.
- **Files modified:** `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`
- **Committed in:** `b6a8cf7`

**3. [Environment] `npm run build` and the build half of the suite not run**
- **Found during:** Task 2
- **Issue:** The orchestrator's brief says not to run `npm run build` from this worktree; it builds after merge. `npx tsc --noEmit` reports one error, `app/layout.tsx(20,50): Cannot find name 'LayoutProps'`. `LayoutProps` is a global type Next generates into `.next/types`, which does not exist in this fresh worktree (it exists in the main checkout). `app/layout.tsx` is not touched by any Phase 3 plan (last change `6f4ac40`), and it is the only tsc error.
- **Impact:** tsc and build need confirming by the orchestrator after the merge.

---

**Total deviations:** 2 auto-fixed (both Rule 3, both in the Phase 2 harness file), 1 environment limitation.
**Impact on plan:** The two fixes are needed to run the harness at all; no product code touched.

## Issues Encountered

- Two harness runs hung with an empty log before the probe fix above; both were killed and their scratch copies removed. The passing run's scratch copy was removed by the harness.
- The smoke shows `withEvents=3` of 5 games; the other two games have no play-by-play events in the loader result (printed nothing, so they carry no events or no lines). The reconciliation covers the three that do.

## Pending: end-of-phase human check (Task 2)

No user was available to the executor, so items 1-5 are recorded as **pending**. For `/gsd-verify-work`:

1. Signed in, on a laptop browser, open `/research?team=MTL&games=5`. For the Last game (Oct 13 vs BUF, W 4-3, the game 03-10's U3 passed on), add MTL's SF in the EV, PP and SH Total rows of the forwards tables. It should equal MTL's shots on goal on the NHL.com boxscore, minus any penalty shot the exclusions note lists. The live boxscore SOG for that game is 38 for MTL and 17 for BUF (smoke).
2. Read the legend and exclusions note: do SF, GF, CF, SF%, CF%, +/- and Other read clearly, and is it clear that pulled-goalie and 4-on-4/3-on-3 time and events sit in Other?
3. Look at the screenshots from 03-10:
   - `/private/tmp/claude-501/-Users-jwitt-Development-fantasy-hockey/7713118a-e5c4-472c-9541-569ff31869a5/scratchpad/units-check-light.png`
   - `/private/tmp/claude-501/-Users-jwitt-Development-fantasy-hockey/7713118a-e5c4-472c-9541-569ff31869a5/scratchpad/units-check-dark.png`

   Columns should line up, the Goals/Shots/Corsi dividers should run down each table, and the Total row should stand out.
4. If any game in the window has no shift chart or no play-by-play, its cells show "—" with the amber note, never 0.
5. After deploying to Vercel, open Last 20 for two teams within a minute: no "Couldn't load NHL data" banner (research A1 egress, A2 function time for a ~10 s cold load). **Post-deploy check: pending.**

## Known Stubs

None.

## Threat Flags

None. The only surface touched is the Phase 2 harness; the auth gate is still removed only in its temp copy and the dev server stays bound to 127.0.0.1 (T-03-27 unchanged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 plans are all executed once this merges. The orchestrator needs to run `npm run build` and `npx tsc --noEmit` on the merged checkout, then hand the human check above to `/gsd-verify-work`.

---
*Phase: 03-unit-event-stats*
*Completed: 2026-10-14*

## Self-Check: PASSED

- `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`: found, modified in `b6a8cf7`
- Commit `b6a8cf7`: found in HEAD ancestry
- Phase 2 run log: `player-check: 17 passed, 0 failed, 0 skipped`, `PASS N8`, no FAIL line
