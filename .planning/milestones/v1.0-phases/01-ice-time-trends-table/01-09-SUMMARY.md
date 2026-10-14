---
phase: 01-ice-time-trends-table
plan: 09
subsystem: ui
tags: [react, tailwind, next, webkit, playwright, ui-spec]
requires:
  - phase: 01-ice-time-trends-table
    provides: "01-08 ToiStripCell click/tap popover, pointer cursor, WebKit strip check"
provides:
  - "Per game squares that read as separate, bordered 20x20 targets on a 24px pitch"
  - "Per game column hint, click/tap intro copy and blue-ring legend copy"
  - "Pos cell reading 'C 5/5 GP'"
  - "WebKit check S1 (square size and pitch)"
  - "01-UI-SPEC.md strip contract matching what ships"
affects: [verify-work UAT tests 1, 2, 3, 5]
plan_head_before: d570cd0348b30a1097a7379b35ed92962414384e
plan_head_after: 21b7b420d8fe10201fe03a492ae04f74e347f63c
actuals:
  tokens: 8600
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - "State border colour appended to a shared base `border` class; played squares get a neutral track so low-opacity fills still read as squares"
key-files:
  created: []
  modified:
    - components/ToiGameStrip.tsx
    - components/ToiTrends.tsx
    - lib/research/toi-trends-view.test.ts
    - .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs
    - .planning/phases/01-ice-time-trends-table/01-UI-SPEC.md
key-decisions:
  - "Squares are 20x20 (h-5 w-5) with gap-1 and rounded-xs: 24px pitch meets WCAG 2.5.8 and the square is no taller than the 20px text line, so rows do not grow"
  - "Every square carries a 1px border (solid neutral played, dashed grey missed, dashed sky OT without shift data); the played OT/SO sky ring is kept"
  - "Inner fill span lost its rounding class; the square's border and rounded-xs frame it"
requirements-completed: [TRND-02, TRND-04]
coverage:
  - id: D1
    description: "Each Per game square is a separate bordered 20x20 square with 4px gaps and 2px corners; played, missed and OT-without-shift-data states carry distinct borders and a played OT/SO game keeps its sky ring"
    requirement: TRND-04
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every square is 20x20 with 2px corners and a 1px border, and nothing inside the strip uses the 4px radius"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a played square has a solid neutral border, a missed one a dashed grey border, an OT one without shift data a dashed sky border"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#the strip has 4px gaps, no hairline gap"
        status: pass
    human_judgment: true
    rationale: "Whether the squares visually read as separate, clickable games and are easy to land on is a visual judgment (UAT G-01-5)"
  - id: D2
    description: "Squares are at least 20x20 and at least 24px apart centre to centre in a real WebKit engine, and click, tap, keyboard, non-blocking and Last 20 placement checks still pass"
    requirement: TRND-02
    verification:
      - kind: e2e
        ref: "node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs (S1, D2-D12, T2-T4: 15 passed, 0 failed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per game header reads 'Per game (click a square)', intro ends 'click, tap or hover a square for exact per-game times.', legend line 1 says 'A blue ring means overtime; OT minutes are excluded.'"
    requirement: TRND-02
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#renders headers in order, forwards before defense, no goalies"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#the section intro is the approved copy"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#legend line 1 names the dashed and blue-ring marks and no longer says outlined"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pos cell text reads position, a space, then games played ('C 3/3 GP', 'L 2/3 GP')"
    requirement: TRND-04
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#the Pos cell reads the position, a space, then games played"
        status: pass
    human_judgment: false
  - id: D5
    description: "01-UI-SPEC.md strip contract describes what ships after 01-08 and 01-09, with a Revisions entry naming G-01-2, G-01-5 and G-01-1b"
    verification:
      - kind: other
        ref: "Task 2 <verify> grep chain exits 0; square and popover class strings in the spec match ToiGameStrip.tsx verbatim"
        status: pass
    human_judgment: true
    rationale: "Spec prose accuracy beyond the verbatim class strings and copy is a reviewer judgment"
duration: 3 min
completed: 2026-10-12
status: complete
---

# Phase 1 Plan 09: Separate, bordered 20x20 Per game squares Summary

**Per game squares are now separate bordered 20x20 targets (gap-1, rounded-xs, per-state borders), the column header says "(click a square)", Pos reads "C 5/5 GP", and 01-UI-SPEC.md describes the strip and popover that actually ship.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-12T02:03:39Z
- **Completed:** 2026-10-12T02:06:00Z
- **Tasks:** 2 (Task 1 as RED then GREEN)
- **Files modified:** 5

## Accomplishments
- Squares changed from 12x16 with a 1px gap and 4px radius to 20x20 with a 4px gap, 2px corners and a 1px border on every square: solid neutral for played (the track that keeps a 0.2-opacity game reading as a square), dashed grey for missed, dashed sky for OT without shift data. The played OT/SO sky ring and the TOI shading formula are unchanged (D-10, D-13).
- Copy now tells the user what to do at the column itself: header "Per game (click a square)" (hint is `font-normal` in the header's neutral-500), intro "click, tap or hover", legend names "A blue ring means overtime".
- Pos cell has a real space between position and GP count (G-01-1b).
- WebKit check gained S1 (every row-0 square at least 20x20, neighbours at least 24px apart; measured minPitch 24). All 15 checks pass, including click, tap, keyboard, non-blocking sweep, Last 20 clipping and the OT popover (D12).
- 01-UI-SPEC.md: Revisions entry (G-01-2, G-01-5, G-01-1b), spacing, colour, layout, interaction contract (ToiStripCell, popover classes, cell states with borders), copy, UI considerations and component contract updated; class strings copied verbatim from the components.

## TDD Gate Compliance

- **RED** (`7292943`): 8 new/updated assertions written first. All 8 failed on the planned assertions (old header and intro text, `gap-px`, `h-4 w-3 rounded-sm` with no `border`, "C3/3 GP" style Pos text, no header hint, old "Outlined" legend); none failed on a syntax, import or discovery fault. The one-game Per game test was loosened to `startsWith` and passed before and after, as intended. Semantic assessment: each failure was the planned behavior missing, not a test fault. (This plan is `type: execute` with `tdd="true"` on the task; the `check tdd-red-evidence` classifier was not run because the plan is not `type: tdd`.)
- **GREEN** (`96c4fa6`): 59/59 in the two target test files, 186/186 in `npm test`.
- **REFACTOR:** none needed.

## Task Commits

1. **Task 1 RED: failing tests for bordered 20x20 squares, hint, copy, Pos** - `7292943` (test)
2. **Task 1 GREEN: squares, copy, Pos separator, WebKit S1** - `96c4fa6` (feat)
3. **Task 2: UI-SPEC strip contract revision** - `21b7b42` (docs)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `components/ToiGameStrip.tsx` - gap-1, `h-5 w-5 rounded-xs border`, per-state border colours, fill span unrounded
- `components/ToiTrends.tsx` - Pos separator, Per game header hint, intro and legend line 1 copy
- `lib/research/toi-trends-view.test.ts` - updated header/intro/one-game tests; new tests for gap, size, corners, per-state borders, header hint, legend and "C 3/3 GP"/"L 2/3 GP"
- `.planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` - check S1
- `.planning/phases/01-ice-time-trends-table/01-UI-SPEC.md` - revised strip contract

`lib/research/game-strip.ts`, `game-strip.test.ts` and `components/ToiStripCell.tsx` are untouched (`git diff 79fee89` on the first two is empty).

## Decisions Made
- 20x20 squares on a 24px pitch (WCAG 2.5.8 spacing rule); no taller than the row's 20px text line. Cost: Last 20 strip is 476px (was 259px) inside the existing horizontal scroll.
- Inner fill span no longer has its own rounding (plan instruction); the square's `rounded-xs` and border frame it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The WebKit scratch server on 127.0.0.1:3101 was confirmed stopped afterwards; the user's dev server on port 3000 was not touched. `npm run build` ran against the repo as the plan requires.

## Human Checks (end of phase, not run)
These are browser `<human-check>` items for UAT (`/gsd-verify-work`, tests 1, 2, 3 and 5), together with the 01-08 Task 2 check. Signed in, open `/research?team=MTL&games=5`:
- Each game in Per game is its own clearly separate square with gaps and a faint border; pointer cursor; easy to land on with the mouse.
- A low-TOI game is still visibly a square; a missed game is a dashed grey square.
- A played OT/SO game has a sky ring and its popover shows the OT (or SO) tag and "OT excluded +m:ss"; an OT game with no shift chart is a dashed sky square.
- Column header reads "Per game (click a square)"; Pos reads like "C 5/5 GP" with a visible space.
- Repeat with `games=20`: the strip scrolls sideways without wrapping and rows are no taller than before.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Last plan of the phase. Requirements TRND-02 and TRND-04 are deliberately not marked Complete here; the phase verifier and UAT own that.

## Self-Check: PASSED

- Files exist: ToiGameStrip.tsx, ToiTrends.tsx, toi-trends-view.test.ts, webkit-strip-check.cjs, 01-UI-SPEC.md.
- Commits `7292943`, `96c4fa6`, `21b7b42` are ancestors of HEAD; `git rev-list --count d570cd0..HEAD` = 3.
- `npm test` 186 pass / 0 fail; `npx tsc --noEmit`, `npm run build` and the scoped eslint exit 0; WebKit check 15 passed, 0 failed (S1 PASS).
- All Task 1 and Task 2 acceptance greps pass.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-12*
