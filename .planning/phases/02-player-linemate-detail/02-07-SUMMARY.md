---
phase: 02-player-linemate-detail
plan: 07
subsystem: testing
tags: [playwright, webkit, browser-check, heat-strip, navigation, scroll-anchoring]

requires:
  - phase: 02-player-linemate-detail
    provides: "Player panel, name links, Escape dismiss, tabs, tags and cap (plans 02-01 to 02-06)"
provides:
  - "webkit-player-check.cjs: re-runnable desktop WebKit check of player selection, jump, tabs, Back/reload, unit-table links, close and the heat strip (N1-N10, H1-H7)"
  - "Close and tab links keep the scroll position in WebKit (overflow-anchor none on the research page main)"
affects: [phase-2-verification, phase-2-uat]

actuals:
  tokens: 9100
  tasks: 2
  commits: 3
plan_head_before: a9b657efbb6c526d390dfc811c572ac1746d7577
plan_head_after: 4f4c70955054499941dba432bbb42b444d64bc16

tech-stack:
  added: []
  patterns:
    - "Browser harness: scratch copy outside the repo, auth gate stripped by exact match, 127.0.0.1 only, no .env*, minimal server env, process-group kill"
    - "Could-not-run conditions after the server is up throw HarnessError so cleanup still runs and the exit code is 2 with no summary line"

key-files:
  created:
    - .planning/phases/02-player-linemate-detail/webkit-player-check.cjs
  modified:
    - app/research/page.tsx

key-decisions:
  - "Fixed the Close-link scroll jump in the component (overflow-anchor none on main) in its own commit instead of loosening N10"
  - "H5 reports a group with no rows as an INFO line inside one check and only SKIPs when no group has rows"

requirements-completed: [PLYR-01, PLYR-02, PLYR-04, UNIT-04]

coverage:
  - id: D1
    description: "Selecting a name jumps to the panel (0-40 px from the top), swaps players, re-clicking the selected name jumps again, Back restores the previous player, reload keeps the player, and a shared URL shows the same panel"
    requirement: PLYR-01
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs (N1-N6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EV/PP/SH tab clicks keep the scroll position; a Last game unit-table name opens that player on the table's tab and jumps to the panel; Last 3 keeps player and tab; a team link drops the player; Close removes the panel and keeps the scroll position"
    requirement: UNIT-04
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs (N7-N10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Heat-strip squares are 20x20 with 24 px pitch; popover shows on hover, focus and click, pins and unpins, closes on an outside press; Escape hides it on both strips without losing focus; pinned popovers are not clipped at Last 20 on the last forward and defense rows"
    requirement: PLYR-02
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs (H1-H6)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 1 Per game strip desktop checks still pass with Phase 2 in place"
    verification:
      - kind: automated_ui
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs (16 passed, 0 failed; no FAIL D line)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Shades are distinguishable on the dark surface (computed opacity 0.2-1, 28 distinct values on 43 squares) and the selected-row bar is visible on green and red tinted rows in both themes"
    requirement: PLYR-02
    verification:
      - kind: automated_ui
        ref: "webkit-player-check.cjs H7 (opacity range and distinct shades)"
        status: pass
    human_judgment: true
    rationale: "Visual legibility of shades and the selected-row bar is a judgment call; H7 only proves distinct shades exist and writes light and dark screenshots for the human check"
  - id: D6
    description: "A real line change reads at a glance: new linemates on top tagged New, old ones Fading or Out; squares read as separate and clickable; the no-chart game shows amber dashed squares and a footnote, never 0"
    requirement: PLYR-04
    verification: []
    human_judgment: true
    rationale: "Readability at a glance and tag noise on real data are judgment calls no test asserts; handed to the end-of-phase human check below"

duration: 11min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 07: WebKit Browser Backstop Summary

**A re-runnable desktop WebKit script (17 checks, live NHL data, scratch copy outside the repo) proves the player panel's jump, Back/reload, tabs, unit-table links, close and heat-strip behaviour, and it caught one real defect: WebKit scroll anchoring threw the page to the top when the panel closed, now fixed with `overflow-anchor: none` on the research page.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-12T19:51:30Z
- **Completed:** 2026-10-12T20:02:37Z
- **Tasks:** 2
- **Files modified:** 2 (one created, one modified)

## Accomplishments

- `webkit-player-check.cjs` (new): copies the repo to an OS temp directory without `.git`, `.next`, `node_modules`, `.planning`, `.claude` or any `.env*` file, clones `node_modules`, strips exactly the three auth-gate lines in the copy only (aborts with "auth gate changed; update webkit-player-check.cjs" if they changed), runs `next dev -p 3102 -H 127.0.0.1` with a minimal environment, drives Playwright's bundled WebKit (desktop, 1280x900) by clicking, kills the server process group, and removes the copy after a fully passing run. Env `CHECK_TEAM` (default MTL). Exit 0 all pass, 1 a check failed, 2 could not run (no summary line).
- Navigation checks N1-N10 all PASS on MTL with live data: select and jump (panel top 15.98 px), swap, re-jump from the bottom (panel top was -1282 before), Back, reload, PP tab keeps scrollY (194 to 194), a PP unit-table name opens C. Kreider on the PP tab, Last 3 keeps player and sit, a team link drops the player, Close keeps scrollY (220 to 220).
- Heat-strip checks H1-H7 all PASS: 20x20 squares with a 24 px minimum pitch, hover/click/pin/unpin, Tab then Escape then Shift+Tab on both the panel and the trends Per game strip (WR-10: focus stays, `data-dismissed` set, no `aria-expanded`, the next Tab lands on the neighbouring square), outside press closes, no clipping at Last 20 (4 squares: leftmost and rightmost of the last forward and last defense rows), dark shades 0.215 to 1.0 with 28 distinct values.
- Phase 1 regression: `webkit-strip-check.cjs` 16 passed, 0 failed (all D checks pass, emulated-phone T checks pass too).
- Full suite green: `npm test` 326 pass, 0 fail; `npx tsc --noEmit`, `npm run build` and `npx eslint app/research lib/research lib/nhl components` exit 0.

## Task Commits

1. **Task 1: harness and navigation checks N1-N10** - `22cad31` (test)
   - product fix found by N10, committed first as its own commit: `b5552b7` (fix)
2. **Task 2: heat-strip checks H1-H7, regression run, suite** - `4f4c709` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs` - the re-runnable WebKit backstop (N1-N10, H1-H7, `player-check:` summary line)
- `app/research/page.tsx` - `[overflow-anchor:none]` added to the `<main>` class list only; the three auth-gate lines are byte-identical

## Decisions Made

- Closing the panel moved scrollY from 220 to 0 in WebKit even though the Close link has `scroll={false}`. Cause (measured, not guessed): no script scrolls the page (no `scrollTo`, `scrollIntoView` or `focus` call fired; only a browser scroll event); removing the panel by plain DOM removal does the same; setting `overflow-anchor: none` on `main` restores 220 while setting it on the panel alone does not. So it is WebKit's native scroll anchoring keeping the "Last game" section fixed, clamped at the top. The fix is one class on `main`. Side effect to know: scroll anchoring is off for the whole research page, which only matters for content that changes height above the viewport; the page is server rendered and its popovers are absolutely positioned.
- N10 was not loosened. The plan names this case ("fix the component in a separate commit and say so"), so the component was fixed.
- H5 emits one result for both groups; a group with no rows prints `INFO H5 <group> has no rows...` and does not fail the check. MTL's player had rows in both groups, so nothing was skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Close link threw the page to the top in WebKit**
- **Found during:** Task 1 (N10)
- **Issue:** after clicking Close with the panel at the top of the viewport, scrollY went from 220 to 0; UI-SPEC says Close uses `scroll={false}` and the plan requires at most 4 px of change
- **Fix:** `[overflow-anchor:none]` on the `<main>` in `app/research/page.tsx` (diagnosis above)
- **Files modified:** `app/research/page.tsx`
- **Verification:** N10 before 220, after 220; N7 and the whole script green again; `npx tsc --noEmit`, eslint, build green
- **Committed in:** `b5552b7`

**2. [Process] Task 1 and Task 2 verify the same script**
- The script was written in two steps as planned (Task 1 commit has N1-N10 and the player-finder helper, Task 2 adds H1-H7). The Task 2 commit is the file as run for the logs below.

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is one class and was required by the plan's own N10 contract. No scope creep.

## Issues Encountered

- The first N10 run failed (scrollY 220 to 0). Diagnosis took four short probes against the kept scratch copy (a throwaway server on 3102 from that copy, killed afterwards, copy deleted). No other check needed a retry.
- Both scripts rely on a NHL live-data window: MTL's Oct 3 game has no shift chart, so the panel showed the amber dashed column and footnote, which is also the case for human check 4.

## Run evidence

- `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs`: `player-check: 17 passed, 0 failed, 0 skipped`, exit 0, team MTL, player N. Suzuki (60 squares). Scratch copy removed.
- `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs`: `strip-check: 16 passed, 0 failed, 0 skipped`.
- Screenshots (OS temp, never in the repo): `/var/folders/66/233hbws17zsgsmbc49t_t7nr0000gn/T/player-check-shots-ETkhaE/` with `light|dark-panel.png`, `light|dark-selected-row.png` and `light|dark-selected-green-row.png` (P. Danault, a green mover row). The dark panel shows the shades separated, the amber dashed no-chart column (Oct 3), New on K. Guhle, Out on J. Struble, Rising and Fading chips on the two forwards whose line changed, and the "Showing 12 of 15 linemates" line.

## Human Checks (end of phase, consolidated)

For the phase UAT in a laptop browser, signed in, `/research?team=MTL&games=5` (MTL has a no-chart game on Oct 3). None blocks this plan.

1. **Jump and history (02-01, 02-03, 02-07 N1-N10):** click a name low in the Ice-time trends table and the page jumps to the panel under the nav; click a name in a PP unit table and the PP tab is active; press Back and the previous player returns; reload and the same player stays. The panel is the first block under the nav, headed `{Name} {Pos} {GP}/{teamGames} GP`.
2. **Line change reads at a glance (02-06, SC1):** find a forward whose line changed in the latest game; his new linemates are at the top tagged New, the old ones Fading or Out. Also judge whether the 15-point Rising/Fading threshold feels noisy (D-27). The dark screenshot shows N. Suzuki with Rising, Fading, New and Out chips.
3. **Squares and shades (02-01, 02-02, 02-05):** squares read as separate clickable squares (borders, 4 px gaps, hover outline, pointer cursor); shades are distinguishable in light and dark mode (open the H7 screenshots); the selected-row bar is visible on green and red tinted rows in both themes (`*-selected-green-row.png`); the Per game popover looks exactly as before; header stats, tab styling and legend wording read well.
4. **Missing shift chart (02-05, SC5):** the Oct 3 squares are amber dashed, the footnote lists the date, nothing shows 0; an absent (dashed grey) and unknown (dashed amber) square's popover says why and shows no times; the Last game unit tables show the same Time and % values as production; unit-table names wrap cleanly with the spinner slots at laptop widths.
5. **Keyboard (02-04, WR-10):** focus a square with Tab and press Escape: the popover hides and the next Tab continues from that square.
6. **Panel details (02-01):** at Last 20 the strip fits its wrapper and shades stay distinguishable from dashed squares; `?sit=pp` and `?sit=sh` show different linemates; `?player=abc` shows nothing; a goalie id shows `That player didn't play for MTL in this window.` with a working Close link that keeps team, games, sort and dir; tab clicks keep the scroll position; Close keeps it too (fixed in this plan).

## Known Stubs

None.

## Threat Flags

None. The harness follows T-02-14 and T-02-15 as planned: the auth gate is removed only in an OS temp copy, the server binds `"127.0.0.1"` on 3102, the copy has no `.env*` files, the server gets only PATH, HOME, TMPDIR, LANG and NEXT_TELEMETRY_DISABLED, and screenshots go to the OS temp directory. playwright-core came from the existing npx cache; no package was installed and `package.json`/`package-lock.json` are untouched by this plan (their changes pre-date it).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All seven plans of phase 2 have a SUMMARY. The phase verifier and UAT own marking requirements and the phase complete; this plan did not touch REQUIREMENTS.md.
- To re-run: `node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs` (a few minutes; `CHECK_TEAM=EDM` if the default team has no charted recent games, exit 2 says so).

## Self-Check: PASSED

- FOUND: `.planning/phases/02-player-linemate-detail/webkit-player-check.cjs`, `app/research/page.tsx`
- FOUND commits `b5552b7`, `22cad31`, `4f4c709` as ancestors of HEAD (3 commits measured from `plan_head_before`)
- Task 1 acceptance: auth-gate abort message, `"127.0.0.1"`, `3102` present; `iPhone` count 0; PASS N1-N10, no FAIL, `player-check:` line; `git status --porcelain AGENTS.md CLAUDE.md` empty
- Task 2 acceptance: `"H1"` to `"H7"` present (7 lines); PASS H1-H4, H5, H6, H7; Phase 1 log has no `FAIL D` and has `strip-check:`; `npm test` fail 0; tsc, build, eslint exit 0; no `.claude/` file and no `package*.json` staged by this plan

---
*Phase: 02-player-linemate-detail*
*Completed: 2026-10-12*
