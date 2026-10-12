---
phase: 01-ice-time-trends-table
plan: 08
subsystem: ui
tags: [nextjs, react-client-component, tailwind-4, webkit, playwright-core, tooltip]

requires:
  - phase: 01-ice-time-trends-table
    provides: "ToiGameStrip hover/focus popover anchored under each square (01-07)"
provides:
  - "ToiStripCell: minimal client square; click/tap toggles data-open, outside pointerdown and blur close it"
  - "Per game popover revealed by click/tap (data-open), mouse hover or keyboard focus-visible; takes no pointer events"
  - "webkit-strip-check.cjs: re-runnable WebKit check (desktop + emulated iPhone) of the strip popover on the real page"
affects: [01-09, verify-work UAT tests 2 and 3, 01-UI-SPEC touch backstop]

plan_head_before: 210e89a60d3a58fc2cc7fd83e4470efa13e63584
plan_head_after: bc9d914c51484b00246122fe54f15710fa145284

actuals:
  tokens: 6900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Server component passes only strings plus server-rendered children into a one-purpose client wrapper (ToiStripCell)"
    - "Tailwind named-group data variant (group-data-[open]/cell:block) reveals a server-rendered popover from client state"
    - "Auth-free scratch copy of the app outside the repo, loopback only, for real-engine browser checks"

key-files:
  created:
    - components/ToiStripCell.tsx
    - .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs
  modified:
    - components/ToiGameStrip.tsx
    - lib/research/toi-trends-view.test.ts

key-decisions:
  - "Per-square client wrapper (ToiStripCell) over native details/summary, the Popover API, or relying on tap-focus; reverses the UI-SPEC 'CSS-only, no client component' rule for the strip under its touch backstop (01-09 records it in the UI-SPEC)"
  - "Keyboard reveal uses group-focus-visible instead of plain group-focus so the focus a mouse click leaves behind does not hold the popover open"
  - "Popover is pointer-events-none so an open popover never blocks the squares under it"
  - "No Escape handling, as planned; keyboard users dismiss by moving focus"

patterns-established:
  - "Client wrapper keeps ARIA contract (role img, aria-label, tabIndex 0) and takes the popover as children"

requirements-completed: [TRND-02]

coverage:
  - id: D1
    description: "A click or tap on a Per game square opens its popover under the square and keeps it open after the pointer leaves; a second click, an outside click or tap, or blur closes it; opening another square closes the first"
    requirement: TRND-02
    verification:
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs#D3,D4,D5,D6,T2,T3,T4"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every popover opens on click, hover or keyboard focus and takes no pointer events"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hover and keyboard focus (Tab) still open the popover; the focus a mouse click leaves behind does not hold it open"
    requirement: TRND-02
    verification:
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs#D8,D10"
        status: pass
    human_judgment: false
  - id: D3
    description: "An open popover never blocks the squares under it; sweeping down a column shows each row's own popover"
    requirement: TRND-02
    verification:
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs#D7,D9"
        status: pass
    human_judgment: false
  - id: D4
    description: "Popovers are not clipped on the first, last-forward and last rows at Last 20, leftmost and rightmost squares"
    requirement: TRND-02
    verification:
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs#D11"
        status: pass
    human_judgment: false
  - id: D5
    description: "Squares show a pointer cursor and keep the hover outline and focus ring; popover content and aria-label unchanged"
    requirement: TRND-02
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every strip square shows a pointer cursor, is a named group and starts closed"
        status: pass
    human_judgment: true
    rationale: "Whether the pointer cursor and outline make the squares recognisably interactive is a visual judgement (UAT G-01-2); plan 01-09 adds the border and larger target"
  - id: D6
    description: "Tapping a square on a physical touch device (iOS Safari, Android Chrome) opens its popover and tapping elsewhere closes it (UAT test 3)"
    requirement: TRND-02
    verification:
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs#T2,T3,T4 (WebKit iPhone 13 emulation)"
        status: pass
    human_judgment: true
    rationale: "Emulation stands in until a physical device is available; the plan's backstop truth is verified by a human on hardware"

duration: 10min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 08: Click or tap a Per game square Summary

**Per game squares open their popover on click or tap through a one-purpose `ToiStripCell` client wrapper, keep hover and keyboard focus, no longer block the squares beneath, and are proven in WebKit (desktop and emulated iPhone) on the real page.**

## Performance

- **Duration:** about 10 min
- **Completed:** 2026-10-12T02:01Z (start time not recorded at launch; duration estimated)
- **Tasks:** 2 (Task 1 as a RED/GREEN pair of commits)
- **Files modified:** 4 (2 created, 2 modified) plus planning files

## Accomplishments

- G-01-2: a click or tap toggles `data-open` on the square; the server-rendered popover is revealed by `group-data-[open]/cell:block`, `group-hover/cell:block` or `group-focus-visible/cell:block`. A second click, an outside `pointerdown`, or blur closes it, so one popover is open at a time by click.
- Open popovers take `pointer-events-none`, so the old occlusion of the squares in the next rows is gone. Squares show `cursor-pointer`; hover outline and focus ring kept.
- `ToiGameStrip` and `ToiTrends` stay server components. Only `label`, `state`, `className` strings and server-rendered children cross into `ToiStripCell` (T-01-15). The document listener exists only while a square is open and is removed in cleanup (T-01-16).
- Re-runnable WebKit check passes against the real `/research` page (14 passed, 0 failed, 0 skipped), giving first evidence for UAT test 3 via iPhone emulation.

## Task Commits

1. **Task 1 (tracer, TDD) RED:** `bd6e483` (test) - two failing markup tests
2. **Task 1 GREEN:** `3a00e80` (feat) - `ToiStripCell` plus `ToiGameStrip` wiring and popover classes
3. **Task 2:** `bc9d914` (test) - `webkit-strip-check.cjs`

**Plan metadata:** committed separately (docs: complete plan)

Tracer gate: Task 1's `<verify>` carries only `<automated>` checks and `human_verify_mode` is `end-of-phase`, so no checkpoint was raised. The verify commands were re-run end to end (53 view+strip tests pass, tsc, build with both CSS selectors present, scoped eslint) and the log line "Tracer verified end-to-end - expanding" was emitted before Task 2.

## TDD record (Task 1)

- **RED:** `every strip square shows a pointer cursor, is a named group and starts closed` and `every popover opens on click, hover or keyboard focus and takes no pointer events` added to `lib/research/toi-trends-view.test.ts`. Run: 53 tests, 51 pass, 2 fail. Both failures are assertion errors on the planned behavior (square tag lacked `cursor-pointer`; popover lacked `group-data-[open]/cell:block`). Semantic assessment: the target tests executed and failed on the intended assertion, not on import, syntax or fixture faults. The plan is `type: execute`, so the `check tdd-red-evidence` classifier record was not produced.
- **GREEN:** `ToiStripCell` plus classes; 53/53 pass. No REFACTOR commit needed.

## Files Created/Modified

- `components/ToiStripCell.tsx` - client square: `useState` open flag, ref, `pointerdown` outside listener while open, click toggle, blur close
- `components/ToiGameStrip.tsx` - renders each square through `ToiStripCell`; popover classes updated; doc comment rewritten
- `lib/research/toi-trends-view.test.ts` - two markup tests for square affordance and popover reveal classes
- `.planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` - WebKit check on an auth-free scratch copy (127.0.0.1:3101, outside the repo, no `.env*`, `cp -Rc` node_modules clone, process group killed and temp dir removed on success)

## Decisions Made

- Client wrapper per square rather than details/summary, Popover API, or tap-focus (reasons in the plan); recorded as the UI-SPEC reversal 01-09 documents.
- `group-focus-visible` replaces `group-focus` so a mouse click's leftover focus cannot hold the popover open.
- No Escape handling (out of the gap); keyboard dismissal is by moving focus.

## Deviations from Plan

### Refinement within a check (not a component change)

**D12 square selection.** The plan says to click the first square whose label contains " · OT · " or " · SO · ". A DNP or no-time square in an OT game also has the tag in its label but no OT time rows, which would fail the "OT excluded +" / "Total (incl. OT)" assertion for reasons unrelated to the feature. The script picks the first such square whose label also contains "OT excluded" or "Total (incl. OT)". It still asserts the tag and the OT row in the popover text. Committed in `bc9d914`.

**Total deviations:** 0 auto-fixed bugs; 1 check-selection refinement. **Impact:** none on the component; check intent unchanged.

## WebKit check

Command: `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` (exit 0, MTL live data).

```
INFO D1 desktop environment {"userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15","hoverHover":true,"pointerFine":true}
PASS D2 nothing is open before any interaction {"shown":[]}
PASS D3 click opens the row-0 popover, it stays open with the pointer away and is not clipped {"shown":true,"open":true,"inside":true,"pop":[675,824,961,954],"wrapper":[96,776,1184,1523]}
PASS D4 a second click on the same square closes it {"shown":false,"open":false}
PASS D5 a click elsewhere closes an open popover {"opened":true,"shown":false}
PASS D6 opening another square closes the first {"row0":false,"row2":true}
PASS D7 an open popover does not block the square below it {"open0":true,"hitIsSquare":true,"row0":false,"row1":true}
PASS D8 hover without a click still opens the popover and moving away closes it {"hovered":true,"open":false,"after":false}
PASS D9 sweeping down a column shows exactly each row's own popover {"rows":21,"bad":[]}
PASS D10 keyboard focus (Tab) opens the popover and Tab away closes it {"square":[0,0,1],"shownOnFocus":true,"shownAfter":false}
PASS D11 popovers are not clipped at Last 20 (first, last-forward and last rows, leftmost and rightmost squares) {"checked":6}
PASS D12 an OT/SO square's popover shows the period tag and the excluded OT time {"r":0,"i":1,"tag":"OT","text":"Oct 3 @ PIT · L 5–6OTTOI—Total (incl. OT)22:43PP—SH—Excluded from averages: no shift data for overtimeNo PP/SH data (shift chart not published)"}
INFO T1 emulated iPhone environment {"userAgent":"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1","hoverHover":false,"pointerFine":false,"maxTouchPoints":0}
PASS T2 tapping a square opens its popover (data-open) {"shown":true,"open":true}
PASS T3 tapping elsewhere closes it {"shown":false}
PASS T4 tapping another square closes the first, tapping the same square again closes it {"shownAfterSecond":[[2,1]],"shownAfterThird":[]}
strip-check: 14 passed, 0 failed, 0 skipped
```

After the run: no process on port 3101, no scratch directory left, `git status --porcelain -- app components lib` clean, and the user's dev server on port 3000 (pid 39045) was not touched.

## Verification results

- `npm test`: 180 tests, 0 fail. `npx tsc --noEmit`: clean. `npm run build`: succeeds; compiled CSS contains `:where(.group\/cell)[data-open]` and `:where(.group\/cell):focus-visible`.
- `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx components/ToiStripCell.tsx`: clean.
- Acceptance greps for Task 1 and Task 2 all pass (`use client` on line 1 of `ToiStripCell.tsx` and absent from `ToiGameStrip.tsx`, `<ToiStripCell`, the three popover classes, `cursor-pointer`, add/remove `pointerdown` listener, `-H` and `127.0.0.1` in the check script).

## Human checks (end of phase, not run here)

From Task 2 `<human-check>`, signed in with `npm run dev`, at http://localhost:3000/research?team=MTL&games=5:

1. Click a square: popover opens directly under it, right edges aligned, stays open after the pointer leaves. Click the same square again: closes. Click a blank area: closes. Click a different square: only the new one is open.
2. Rest the pointer on squares: each shows its popover while hovered. Sweep straight down one column from the first forward row to the last defense row: each row's own popover appears in turn and the first does not stay over the rows below.
3. Click a blank area, then Tab until a square has the focus ring: its popover shows, and Tab moves on and hides it.
4. Repeat (1) at games=20 (scroll the table sideways for the rightmost squares) and games=1 on the first forward row, last forward row and last defense row: every popover is fully visible.
5. UAT test 3: on a phone, tap a square (popover opens) then tap elsewhere (it closes). The WebKit iPhone-emulation lines T2-T4 stand in until a device is available.

Re-run UAT tests 2 and 3 through `/gsd-verify-work` after plan 01-09.

## Issues Encountered

None. The WebKit check passed on its first run.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the client boundary (`ToiStripCell`, T-01-15 mitigated) and the local-only scratch server (T-01-17 mitigated: loopback bind, no `.env*` copied, minimal child environment, process group killed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 01-09 (G-01-5 larger bordered squares, G-01-1b, and recording the client-wrapper reversal in the UI-SPEC). TRND-02 is not marked complete in REQUIREMENTS.md; the phase verifier and UAT own that.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*

## Self-Check: PASSED
