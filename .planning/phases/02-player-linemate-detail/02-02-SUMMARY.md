---
phase: 02-player-linemate-detail
plan: 02
subsystem: research
tags: [heat-strip, popover, nextjs-server-component, fixture-tests]

requires:
  - phase: 02-player-linemate-detail
    provides: PlayerLinemates panel, linemateDetail, GameDetail.heading, STRIP_SQUARE_CLASS (plan 02-01)
provides:
  - "StripPopover: one server-component popover shared by the Per game strip and the heat strip"
  - "Heat-strip squares show minutes together, share of the player's situation time and the player's situation time on click, hover or focus"
  - "player-detail-view.test.ts: rendered-markup tests for the panel and its popovers"
affects: [02-03, 02-04, 02-05, 02-06, 02-07]

actuals:
  tokens: 5000
  tasks: 2
  commits: 3
plan_head_before: f53537eca7bca4fb2a4cd9c8143a1425d6fa8104
plan_head_after: a4816335c8645731ff9a61c3cc5145e920a59dde

tech-stack:
  added: []
  patterns:
    - "One popover component and one square class for both strips, so their markup cannot drift"
    - "Fixture tests build symmetric GamePairs through a local pairsOf helper and parse squares from rendered markup"

key-files:
  created:
    - components/StripPopover.tsx
    - lib/research/player-detail-view.test.ts
  modified:
    - components/ToiGameStrip.tsx
    - components/PlayerLinemates.tsx

key-decisions:
  - "LinemateRowView is exported from PlayerLinemates.tsx so the dash window share can be tested: buildLinemateView never lists a row with no counted game, so the full panel cannot reach that branch"
  - "Popover heading line is the first grid line and the title drops to the muted style only when a heading is set; without one the Per game markup is byte-identical to before"

patterns-established:
  - "Square parsing in tests: split rendered html on data-state=, read state, tag, fill presence, aria-label and popover lines per chunk"

requirements-completed: [PLYR-02, PLYR-03]

coverage:
  - id: D1
    description: "Clicking, hovering or focusing a heat-strip square shows a popover with the linemate's name, the game, minutes together, share of the player's EV/PP/SH time and the player's EV/PP/SH time; the aria-label states the same facts; absent and unknown squares say why and never show 0:00 or a percentage"
    requirement: PLYR-03
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#a together square's popover starts with the linemate, then the game, then minutes together, share and the player's time"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#unknown and absent squares say why in the popover and the label and never show 0:00 or a percentage"
        status: pass
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#with the PP situation a together square's popover reads Share of PP time and Player's PP time"
        status: pass
    human_judgment: true
    rationale: "That the popover appears on a real click, hover and keyboard focus, and is unclipped inside the overflow wrapper, needs a laptop browser look (backstop in plan 02-07)"
  - id: D2
    description: "The Per game strip and the heat strip render one StripPopover and one square class; the Per game markup, popover classes and aria-labels are unchanged"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts#every heat-strip popover has the Per game strip popover's class string"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts (unedited, 48 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The panel's markup is pinned: section id and labelling, Forwards before Defense with the border-t-2 divider, one square per game per row, unknown/absent/apart/together classes, dash window share, None row, not-in-window notice and close link href"
    requirement: PLYR-02
    verification:
      - kind: unit
        ref: "lib/research/player-detail-view.test.ts (14 tests)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 02: Heat-Strip Popover and Panel Markup Tests Summary

**The heat strip now shows its facts in a popover that is the same `StripPopover` component the Per game strip uses, and 14 fixture tests pin the panel's sections, groups, cell states, notice and close link**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-12T19:25:15Z
- **Completed:** 2026-10-12T19:28:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `StripPopover` holds the Per game popover markup verbatim (class string byte for byte) plus a heading line. `ToiGameStrip` and `PlayerLinemates` both render it, and both squares use `STRIP_SQUARE_CLASS`. `toi-trends-view.test.ts` passes without being edited.
- A together square's popover reads: linemate name, "Oct 1 vs BOS · W 3–2", Together, Share of EV time, Player's EV time. The OT tag sits on the title line. With `sit=pp` the labels read PP. Unknown and absent popovers and aria-labels carry only the reason.
- 14 tests in `lib/research/player-detail-view.test.ts` run in `npm test` (227 to 241 passing, 0 failing).

## Task Commits

1. **Task 1 RED: failing popover tests** - `72b37d1` (test)
2. **Task 1 GREEN: shared StripPopover and heat-strip popovers** - `2fd309c` (feat)
3. **Task 2: panel markup tests (plus the `LinemateRowView` export)** - `a481633` (test)

**Plan metadata:** the `docs(02-02)` commit that adds this file.

## Files Created/Modified
- `components/StripPopover.tsx` - shared popover server component (PopoverRow moved here)
- `components/ToiGameStrip.tsx` - uses `STRIP_SQUARE_CLASS` and `StripPopover`; inline popover and PopoverRow deleted
- `components/PlayerLinemates.tsx` - each square renders `<StripPopover detail={detail} />`; `LinemateRowView` exported
- `lib/research/player-detail-view.test.ts` - fixtures, a symmetric `pairsOf` builder, square parser, 14 tests

## Decisions Made
- Exported `LinemateRowView` (one word) so the "—" window share, required by the plan's behavior list, can be rendered directly. The full panel cannot reach it: a row is only listed with at least 30 seconds of time together in a counted game, so a listed row always has a counted game.
- Everything else followed the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported `LinemateRowView` to test the dash window share**
- **Found during:** Task 2
- **Issue:** The "row with no counted game shows —" case cannot be produced through `PlayerLinemates`, because `buildLinemateView` never lists such a row.
- **Fix:** exported `LinemateRowView` and rendered it directly with an all-unknown row.
- **Files modified:** `components/PlayerLinemates.tsx`
- **Verification:** test passes; the export is the only change to the file in that commit
- **Committed in:** `a481633`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** None on behaviour. One word added to a signature.

## TDD Gate Compliance

- **Task 1:** RED `72b37d1` (5 tests, all failing on the planned assertions: the popover lines were `[]` because the heat-strip squares had no popover; the heat popover count was 0, not 12), GREEN `2fd309c`. `gsd_run check tdd-red-evidence` was not run; the RED output was inspected by hand. The first test's `state === "together"` assertion passed before the failing popover assertion, so the failure was the missing popover, not a fixture fault.
- **Task 2:** pins behaviour 02-01 already built, so there is no genuine RED and no `feat` after the `test` commit (same shape as 02-01 Task 2). To show the tests can fail, two mutations were tried and reverted: `border-t-2` to `border-t` on the Defense divider (1 failure), and `border-amber-600` to `border-red-600` on unknown squares (1 failure). Flagged for the phase TDD review.

## Issues Encountered
None.

## Known Stubs
None.

## Human Checks (end of phase)
For the phase UAT in a laptop browser; none blocks this plan.
1. On `/research?team=MTL&games=5&player=<id>`, click, hover and Tab to a heat-strip square: a popover opens under the square, right-aligned, with the linemate's name first, then the game, Together, Share of EV time and Player's EV time.
2. The popover is not clipped by the table's scroll wrapper, including the bottom rows and at Last 20.
3. An absent (dashed grey) and an unknown (dashed amber) square's popover says why and shows no times.
4. The Per game strip's popover looks exactly as before.

## Threat Flags
None. Names reach the popover as React text children and the aria-label as an attribute string (T-02-16); no raw-HTML API is used.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 02-04 can fix the popover dismiss behaviour once in `StripPopover` for both strips; the tests do not assert the ARIA expanded state or any dismiss class.
- 02-03 edits other files. The panel has no tabs, header stats, cap, tags or legend yet (02-05, 02-06).

## Self-Check: PASSED

- Created files exist: `components/StripPopover.tsx`, `lib/research/player-detail-view.test.ts`
- Commits `72b37d1`, `2fd309c` and `a481633` are ancestors of HEAD
- `npm test`: 241 pass, 0 fail; `npx tsc --noEmit` and `npm run build` exit 0; `npx eslint app/research lib/research lib/nhl components` exits 0
- Task acceptance greps pass; `lib/research/toi-trends-view.test.ts` is not in this plan's commits

---
*Phase: 02-player-linemate-detail*
*Completed: 2026-10-12*
