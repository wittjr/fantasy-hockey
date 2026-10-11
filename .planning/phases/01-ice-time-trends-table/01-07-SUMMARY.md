---
phase: 01-ice-time-trends-table
plan: 07
subsystem: ui
tags: [react, tailwind, css-popover, server-components, node-test]

requires:
  - phase: 01-ice-time-trends-table
    provides: "Trends table, per-game strip with popover (01-02), Δ/PP share columns and legend (01-03/01-04), failure isolation (01-06)"
provides:
  - "Per-game popover anchored to the hovered or focused square (right-aligned, opens down-left), CSS only"
  - "Legend line that explains why every Δ is a dash in a 2-game window"
  - "PP share column title, TrendRow.toiDelta and TrendRow.ppShare comments that match the implementation"
  - "WR-01 and WR-04 recorded as fixed in 01-REVIEW-DISPOSITION.md"
affects: [phase-1-verification, 02-linemate-detail]

actuals:
  tokens: 3165
  tasks: 2
  commits: 5

plan_head_before: 330d6c3d872cb49f78634e03a03719f89c95a735
plan_head_after: e834516325a77690f248c86769e427b3ce4956fa

tech-stack:
  added: []
  patterns:
    - "Hover/focus popover anchored by making the hovered element the containing block (group/cell relative), not its table cell"

key-files:
  created: []
  modified:
    - components/ToiGameStrip.tsx
    - components/ToiTrends.tsx
    - lib/research/toi-trends.ts
    - lib/research/toi-trends-view.test.ts
    - .planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md

key-decisions:
  - "Popover is right-aligned to the hovered square (right-0 top-full) so the newest, rightmost squares never push it past the table's right edge; it grows left over the Player..SH columns, which are wider than its 320px max"
  - "2-game legend copy is literal text, not interpolated JSX, so the markup has no comment separators and matches the specified string exactly; the branch only runs at exactly 2 games"
  - "The Task 1 tracer human-check was deferred to the phase verifier (human_verify_mode end-of-phase, plan verification block says so); Task 2 does not build on the popover's visual behaviour"

patterns-established:
  - "Markup tests for CSS-only behaviour: assert class tokens on the rendered static markup"

requirements-completed: [TRND-02, TRND-03, TRND-05]

coverage:
  - id: D1
    description: "Popover markup is anchored to the square: squares carry relative, popovers use absolute right-0 top-full without left-0, the strip td is not positioned"
    requirement: TRND-02
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every strip square is the popover's containing block"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#every popover opens below and to the left of its square, never at the strip's left edge"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#the strip cell is not positioned"
        status: pass
    human_judgment: false
  - id: D2
    description: "Popover appears directly under the hovered or focused square and is fully visible (not clipped) on the last forward row, last defense row and Last 20 window; tap shows it on touch devices"
    requirement: TRND-02
    verification: []
    human_judgment: true
    rationale: "Rendering and clipping inside the overflow wrapper, keyboard focus and touch behaviour need a real browser; static markup tests cannot show them"
  - id: D3
    description: "Exactly 2-game window keeps the Δ columns as dashes and the legend explains why; 3-game and 1-game legends unchanged"
    requirement: TRND-03
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a 2-game window keeps the Δ columns, shows a dash in every Δ cell and explains why"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a 3-game window keeps the standard legend and not the 2-game explanation"
        status: pass
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#a 1-game window keeps its note and not the 2-game explanation"
        status: pass
    human_judgment: false
  - id: D4
    description: "PP share title and the toiDelta/ppShare comments describe the computed value; computed values and sort order unchanged (comment-only diff in toi-trends.ts, toi-trends.test.ts untouched)"
    requirement: TRND-05
    verification:
      - kind: unit
        ref: "lib/research/toi-trends-view.test.ts#the sortable headers carry their hover titles"
        status: pass
      - kind: other
        ref: "git diff -U0 78406dc -- lib/research/toi-trends.ts has only comment-line changes; git diff --quiet 78406dc -- lib/research/toi-trends.test.ts"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 07: Popover anchoring and WR-04 copy fixes Summary

**Per-game popover now opens under the hovered or focused square (CSS only, right-aligned, down-left), a 2-game window explains its all-dash Δ columns, and the PP share title and toiDelta/ppShare comments match what the code computes.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-11T23:00:00Z (approximate)
- **Completed:** 2026-10-11T23:03:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- WR-01: each strip square is now the popover's containing block (`group/cell relative`), the strip `<td>` is no longer positioned, and the popover uses `absolute right-0 top-full`. No client directive, state or new component.
- WR-04: legend line 2 is three-way. A 1-game window keeps its note, exactly 2 games shows "Δ needs 3 or more games, and this window has only 2, so every Δ shows —. ▲ ▼ show the direction of the whole-window trend.", and 3 or more keeps the standard line.
- WR-04: the PP share header title now reads "Player's share of the team's power-play time in the games he played", and the `TrendRow.toiDelta` and `TrendRow.ppShare` JSDoc describe the implemented behaviour (D-02, D-05, D-06). Verified comment-only against 78406dc; `toi-trends.test.ts` is untouched.
- 01-REVIEW-DISPOSITION.md: CR-01 and WR-01..WR-04 all read fixed; IN-01..IN-04 stay open (out of scope).

## Task Commits

1. **Task 1: popover opens under the hovered or focused square (WR-01)** - `41f8136` (test, RED), `42909de` (feat, GREEN)
2. **Task 2: 2-game Δ explanation, PP share title and docs (WR-04)** - `ef1fa39` (test, RED), `4146f6e` (feat, GREEN)
3. **Disposition record** - `e834516` (docs: record WR-01 and WR-04 fixes)

**Plan metadata:** committed after this file (docs: complete plan)

## TDD Notes

- Task 1 RED: three new tests failed on their own assertions (containing block, `right-0`/`top-full` without `left-0`, unpositioned td); the other 32 passed. GREEN: all 48 tests in the two strip test files pass.
- Task 2 RED: the updated title expectation and the 2-game test failed on their assertions; the 3-game and 1-game tests passed already and act as regression guards. GREEN: 83 of 83 across the view and trends test files.
- No REFACTOR commit was needed.

## Files Created/Modified

- `components/ToiGameStrip.tsx` - popover anchored to the square; doc comment updated
- `components/ToiTrends.tsx` - 2-game legend branch (imports `MIN_GAMES_FOR_DELTA` for the condition), new PP share title
- `lib/research/toi-trends.ts` - JSDoc only on `TrendRow.toiDelta` and `TrendRow.ppShare`
- `lib/research/toi-trends-view.test.ts` - six new tests, one expectation updated (38 tests, up from 32)
- `.planning/phases/01-ice-time-trends-table/01-REVIEW-DISPOSITION.md` - WR-01 and WR-04 fixed with hashes

## Decisions Made

- Right-aligned, down-left popover so the newest squares never overflow the table's right edge (as specified by the plan).
- Literal 2-game legend copy instead of interpolating `{research.games.length}`: interpolated JSX inserts `<!-- -->` separators into the server markup, which breaks the specified exact string; the branch is only reachable at 2 games anyway. `MIN_GAMES_FOR_DELTA` is still the condition.
- Tracer human-check deferred to the phase verifier (see Deviations).

## Deviations from Plan

### Judgement calls

**1. Tracer feedback gate: human-check not run before Task 2**
- **Found during:** Task 1 (`type="tracer"`, carries a `<human-check>`)
- **Situation:** Auto mode is off and `human_verify_mode` is `end-of-phase`. The tracer's `<verify>` includes a signed-in browser check, which strictly would produce a `checkpoint:human-verify` before expansion. The plan's own `<verification>` block lists both human checks as "end of phase", and Task 2 touches no popover code, so it does not build on the unverified visual behaviour. I ran the automated tracer verify (tests, `tsc`, `build`: all pass) and continued.
- **Impact:** None on code. The popover placement, clipping and touch checks remain for the phase verifier.

**2. Literal text in the 2-game legend** (see Decisions) - same file and commit as Task 2 (`4146f6e`); no behaviour difference.

---

**Total deviations:** 0 auto-fixed rule deviations, 2 judgement calls noted above.
**Impact on plan:** No scope change. No computed value, sort order or test in `toi-trends.test.ts` changed.

## Issues Encountered

None.

## Human verification still open (for the phase verifier)

- Task 1: signed in, `/research?team=MTL&games=5`, then `games=20`, then `games=1`. Hover and keyboard-Tab through squares on the first and last forward rows and the last defense row, including leftmost and rightmost squares. Each popover appears directly under its square, right edge aligned, fully visible, and covers no part of its own row. With Last 20 scroll sideways and repeat. Tap a square on a touch device if one is available. If tap fails on touch, add a minimal client wrapper rather than changing desktop behaviour.
- Task 2: hover the PP share header on `games=5` (tooltip says "in the games he played"); at a 2-game window check the Δ columns show "—" and the legend explains it.
- Known limit (flagged in the plan): on a narrow screen with the table scrolled far right, part of a popover on the leftmost visible squares can fall outside the visible scroll area.

## Known Stubs

None.

## Threat Flags

None. Only static class strings and fixed copy changed (T-01-14 accepted); no new input, route or client component.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All five in-scope review findings (CR-01, WR-01..WR-04) read fixed. Requirements TRND-02, TRND-03 and TRND-05 and the phase itself are left for the phase verifier to mark complete. Full suite at completion: `npm test` 178 of 178, `npx tsc --noEmit`, `npm run build` and the scoped eslint all exit 0.

---
*Phase: 01-ice-time-trends-table*
*Completed: 2026-10-11*

## Self-Check: PASSED

- FOUND: components/ToiGameStrip.tsx, components/ToiTrends.tsx, lib/research/toi-trends.ts, lib/research/toi-trends-view.test.ts, 01-REVIEW-DISPOSITION.md
- FOUND commits: 41f8136, 42909de, ef1fa39, 4146f6e, e834516 (5 commits measured from the plan ledger)
- All Task 1 and Task 2 acceptance criteria re-run and passing
