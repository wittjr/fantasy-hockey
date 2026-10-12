---
phase: 01-ice-time-trends-table
fixed_at: 2026-10-12T00:00:00Z
review_path: .planning/phases/01-ice-time-trends-table/01-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-12
**Source review:** .planning/phases/01-ice-time-trends-table/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-05..WR-08; Info items excluded by request)
- Fixed: 4
- Skipped: 0

**Verification environment:** all gates ran in the main checkout (`workflow.use_worktrees` is false, so no worktree was created). `npm test` (188 pass, 0 fail), `npx tsc --noEmit`, `npm run build` and the scoped `npx eslint` command were all green after the last commit.

## Fixed Issues

### WR-05: A failed shift-chart request is reported as "not published"

**Files modified:** `lib/research/team-games.ts`, `lib/research/team-games.test.ts`, `components/ToiTrends.tsx`, `app/research/page.tsx`
**Commit:** 1314b03
**Applied fix:** The shift-chart `.catch` now returns `null` (still logged). `overtime` is computed before the shift inputs, and an OT/SO game with a `null` chart throws, so it lands in `unavailableDates`. A regulation game still falls back to boxscore TOI. The two user-facing strings now read "no shift chart is available ... (not published yet, or it failed to load)". The existing test that expected an OT game with a failed chart to be kept with unknown regulation TOI was changed to expect the game to be left out and reported in `unavailableDates` (new behaviour).

### WR-06: Newest game(s) failing silently re-anchors "Last game" and Δ

**Files modified:** `app/research/page.tsx`
**Commit:** 88b2299
**Applied fix:** `newestMissing` is true when any unavailable date is newer than the newest loaded game. The warning paragraph then adds "; Last game and the last-2-games comparison use the newest games that did load". The page has no render test, so this is covered by tsc/eslint/build only.

### WR-07: Strip square focusable and clickable but exposed as `role="img"`

**Files modified:** `components/ToiStripCell.tsx`, `lib/research/toi-trends-view.test.ts`
**Commit:** adb0f61
**Applied fix:** The square is now `role="button"` with `aria-expanded`, Enter/Space toggle (with `preventDefault`) and Escape dismiss (blurs the square). The tests were updated from `role="img"` to `role="button"`, with an `aria-expanded="false"` assertion on the closed state. `next/dist/docs` was consulted for the `use client` boundary; the server/client boundary is unchanged.

### WR-08: No behavioural test for `ToiStripCell`; fragile popover regexes

**Files modified:** `components/ToiStripCell.tsx`, `lib/research/toi-trends-view.test.ts`
**Commit:** 888cc03
**Applied fix:** Extracted the pure `nextOpen(open, event)` transition function (exported with the `CellEvent` type) and used it for every handler. Two new tests cover click toggling, Enter/Space toggling, and blur/Escape/outside always closing. In the view test, `classTokens` moved above first use. A `popoverTags` helper finds popover opening tags independent of attribute order, and replaces the two `aria-hidden`-first regexes. The lazy `</span></span>` popover regex was replaced by splitting on `aria-hidden="true"` and cutting each chunk at the next `data-state=`.
**Status:** fixed: requires human verification. As the review states, this finding stays partly open. The DOM wiring (`ref.contains`, pointerdown listener add/remove, blur) is still untested because no DOM test library is installed and none was added. Only the state transitions are tested.

---

_Fixed: 2026-10-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
