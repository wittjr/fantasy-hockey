---
phase: 01-ice-time-trends-table
plan: 02
subsystem: ui
tags: [nextjs, react-server-components, tailwind, css-popover, a11y, node-test]

requires:
  - phase: 01-ice-time-trends-table
    provides: "Plan 01 TrendRow/PerGameCell, ToiTrends table, format.ts formatters, ResearchGame.overtime"
provides:
  - "Per game strip column: one shaded 12x16 square per team game, oldest left"
  - "Pure strip model (lib/research/game-strip.ts): stripOpacity, stripCellState, gameDetail, detailText"
  - "CSS-only hover/focus popover plus aria-label with date, opponent, result, TOI, PP, PP share, SH"
  - "OT/SO disclosure in the strip (sky ring), popover (tag + OT excluded +m:ss) and sparkline (hollow sky dot)"
affects: [01-03, 01-04]

actuals:
  tokens: 5237
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "One GameDetail model feeds both aria-label (detailText) and popover markup so they cannot drift"
    - "Shade via inline opacity on an inner fill element; all Tailwind class strings static"
    - "Popover anchored to the td (cell not positioned), shown with group-hover/cell and group-focus/cell, no client component"

key-files:
  created:
    - lib/research/game-strip.ts
    - lib/research/game-strip.test.ts
    - components/ToiGameStrip.tsx
  modified:
    - components/ToiTrends.tsx
    - lib/research/toi-trends-view.test.ts

key-decisions:
  - "stripOpacity is tested with a 1e-9 tolerance because 0.2 + 0.8 * 0.5 is 0.6000000000000001 in floating point"
  - "Popover is a hidden wrapper span containing an inner grid span, because hidden/block and grid on one element would conflict"

patterns-established:
  - "Server-rendered markup tests extract rows and strip cells by regex ([\\s\\S], not the s flag, because tsconfig targets ES2017)"

requirements-completed: [TRND-02, TRND-04]

coverage:
  - id: D1
    description: "Each row has a Per game strip with one cell per team game, oldest first, shaded by regulation TOI relative to the player's own average; missed games are dashed grey, OT games without shift data are dashed sky"
    requirement: TRND-02
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every row has one strip cell per team game, oldest first, with played / dnp / excluded states"
        status: pass
      - kind: unit
        ref: "lib/research/game-strip.test.ts#stripOpacity / stripCellState tests"
        status: pass
    human_judgment: true
    rationale: "Whether the shading and square shapes read well at a glance on the live, auth-gated page is a visual judgment"
  - id: D2
    description: "Exact per-game TOI, PP, PP share and SH are reachable by hover and keyboard focus, and are the cell's aria-label"
    requirement: TRND-02
    verification:
      - kind: unit
        ref: "lib/research/game-strip.test.ts#detailText tests"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every strip cell is focusable, role img, and carries the full detail as its aria-label"
        status: pass
    human_judgment: true
    rationale: "The CSS hover/focus popover opening, its clipping on the last rows and Last 20, and tap on touch devices cannot be asserted from static markup; covered by the end-of-phase human check"
  - id: D3
    description: "OT/SO games are flagged in the strip (sky ring), popover (OT/SO tag and OT excluded +m:ss) and sparkline (hollow sky dot); legend states OT minutes are excluded"
    requirement: TRND-04
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a played OT game is ringed in sky; a regulation game is not"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#the sparkline marks a played OT game with a hollow sky dot"
        status: pass
      - kind: unit
        ref: "lib/research/game-strip.test.ts#detailText for an OT game tags it and shows the excluded OT minutes"
        status: pass
    human_judgment: false

plan_head_before: da81df674c24f4c417ea349da78b9135ca5c1b09
plan_head_after: 4fd157054533fdd0a8042fde505c84ffcacfcaf6
duration: 4min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 02: Per-Game Strip With OT-Disclosing Hover Detail Summary

**Per-game strip on every ice-time trends row: one regulation-TOI-shaded square per team game with a CSS-only hover/focus popover and matching aria-label, and OT/SO games flagged by sky ring, "OT excluded +m:ss" row and hollow sparkline dot**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-11T20:03:28Z
- **Completed:** 2026-10-11T20:07Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- New `Per game` column between SH and TOI trend, shown for every window size including 1 game.
- Shade is `0.2 + 0.8 * clamp((toi - avg + 120) / 240, 0, 1)` on an inner fill, so the popover is never faded.
- Missed games render as a dashed grey empty cell, OT games without shift data as a dashed sky cell; neither is ever shown as 0:00.
- Every cell is `tabIndex={0}`, `role="img"`, with an aria-label built from the same `GameDetail` as the aria-hidden popover; no client component, no raw-HTML props.
- Sparkline draws a hollow sky dot (r 3) on OT/SO games; the legend line explaining squares, shading, dashed and outlined cells is first in the footnotes; the scroll wrapper has `pb-28 -mb-24` for popover clearance.
- Tests went from 83 to 104, all passing; tsc, scoped eslint and `npm run build` are clean, and the built CSS contains the group-hover/focus, ring-sky-500, stroke-sky-500 and fill-background utilities.

## Task Commits

1. **Task 1: strip, shading, missed/OT/excluded states, OT dots** - `9f78913` (test, RED: 6 failing markup tests), `b7b1716` (feat)
2. **Task 2: exact values on hover and focus** - `ebc4bdb` (test, RED: 11 failing tests), `4fd1570` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `lib/research/game-strip.ts` - shade, cell state, `GameDetail`, `gameDetail`, `detailText`
- `lib/research/game-strip.test.ts` - 13 unit tests for shading, states and every detail-text case
- `components/ToiGameStrip.tsx` - strip `td`, cells, popover (server component)
- `components/ToiTrends.tsx` - Per game column, `Sparkline` `overtime` prop, legend line, `pb-28 -mb-24`
- `lib/research/toi-trends-view.test.ts` - OT/missed/excluded fixtures and strip markup assertions

## Decisions Made
- Float tolerance in the 0.6 shade test (see key-decisions); the production value is unchanged.
- Popover split into a `hidden` wrapper and an inner grid span so the show/hide display values do not collide.

## Deviations from Plan

None - plan executed exactly as written. (The test-side regex fix from the `s` flag to `[\s\S]` and the float-tolerance assertion were corrections to my own new tests before their first passing commit, not plan deviations.)

## Issues Encountered
- A first draft of the view test used the regex `s` flag, which `tsc` rejects under the ES2017 target; replaced with `[\s\S]` before committing.
- The Task 1 RED commit failed on assertions, but the Task 2 RED tests fail with "gameDetail is not a function" (the export did not exist yet), which is a weaker RED than an assertion mismatch for the `game-strip.test.ts` cases; the markup tests in the same commit failed on assertions.

## TDD Gate Compliance

Both tasks followed RED then GREEN with separate commits: `9f78913` test then `b7b1716` feat (Task 1), `ebc4bdb` test then `4fd1570` feat (Task 2). `workflow.tdd_mode` is not enabled, so the `tdd-red-evidence` classifier was not run; RED was confirmed by hand from the node:test output. For Task 1 the pure-module tests (`stripOpacity`, `stripCellState`) were committed with the GREEN commit rather than in the RED commit, because a missing module is a load failure rather than a valid RED. No REFACTOR commit.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Threat Flags
None. T-01-04 holds: opponent and date strings are rendered only as React text and attribute values; `dangerouslySetInnerHTML` count is 0 in both components.

## Next Phase Readiness
- Plans 01-03 and 01-04 can add deltas and sorting on `TrendRow`; the table already has the strip and sparkline columns they sit beside.
- Left for the end-of-phase human check (the page is auth-gated and was not viewed): popover visibility on the last forward row, last defense row and Last 20; tap behavior on iOS Safari and Android Chrome (add a minimal client wrapper only if it fails); reconciliation of regulation TOI plus "OT excluded" against NHL.com on MTL's SO game.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*

## Self-Check: PASSED

All created files exist and commits 9f78913, b7b1716, ebc4bdb, 4fd1570 are on the branch.
