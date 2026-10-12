---
phase: 01-ice-time-trends-table
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/research/page.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/team-games.test.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
findings:
  critical: 0
  warning: 1
  info: 10
  total: 11
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This is a re-review of the auto-fixer's four commits since f74a6a2 (1314b03 WR-05, 88b2299 WR-06, adb0f61 WR-07, 888cc03 WR-08). WR-05 and WR-06 are correct. WR-07 and WR-08 are mostly sound, but the aria-expanded wiring introduced by WR-07 has one real defect (WR-10 below).

**WR-05 (verified correct).** `loadGame` computes `overtime` before building the shift inputs. A failed chart now yields `null` rather than `[]`. An OT/SO game with a `null` chart throws, `Promise.allSettled` records it as rejected, and its `gameDate` goes into `unavailableDates` (`team-games.ts:99,141-148`). Three cases were traced:
- A regulation game with a failed chart is kept. `shifts ?? []` gives empty `shiftInputs`, `regulationToi = toi` (boxscore), and `lines = null`.
- An OT game with a published chart is unchanged.
- An OT game with an empty (not yet published) chart gives `shifts = []`, not `null`, so it does not throw. It is kept with `regulationToi = null` and `lines = null`, which renders as the "excluded" dashed-sky square.

The `getShiftCharts` re-fetch for an empty result (`lib/nhl/client.ts:149-151`) is untouched. A throw from it is caught by the same `.catch` and becomes `null`. Side effect: one failed shift-chart request is logged twice (once in the `.catch`, once in `loadTeamResearch`). That is harmless.

**WR-06 (verified correct for the case it targets).** Both sides of the `>` comparison are ISO `YYYY-MM-DD` strings (`recent[i].gameDate` from the schedule, `games[last].date` from `box.gameDate`), so lexical comparison is valid. The strict `>` is right because a failed game cannot share a date with a loaded one. Narrowing of the `let research` inside the `.some` closure is accepted by tsc (the only assignment is before the closure). The fixer reports tsc and build green. Only the gap in IN-11 remains.

**WR-07 (mostly correct).** `role="button"` with `onKeyDown` works in a Next 16 client component because the server/client boundary is unchanged. Details:
- Space is `preventDefault`-ed on keydown, so the page does not scroll.
- Enter is also prevented, which is harmless.
- aria-expanded renders as `"false"` / `"true"` (`aria-expanded={open}` on a span emits the string), and the SSR test asserts it.

Real problems are in WR-10 and IN-12.

**WR-08 (still partly open per the ledger, not re-reported).** `popoverTags` is non-vacuous. It matches on the `aria-hidden="true"` attribute plus the `group-hover/cell:block` class token regardless of attribute order, and every test also asserts the count of 9. The `.split('aria-hidden="true"')` popover test is adequate: chunks from the sparkline and trend arrows are discarded by the `includes("Oct")` filter. The `nextOpen` tests are a truth table that restates the one-line implementation. They would not catch the actual regression surface (the `e.key` to event mapping, the effect, and the blur wiring in the component). That is the already-tracked "DOM wiring untested" gap, so I am noting it rather than raising it again.

## Warnings

### WR-10: aria-expanded and data-open do not track whether the popover is actually visible; Enter/Space are visually a no-op for keyboard users

**File:** `components/ToiStripCell.tsx:46-62` (CSS in `components/ToiGameStrip.tsx:41`)
**Issue:** The popover is shown by any of `group-hover/cell`, `group-focus-visible/cell`, or `group-data-[open]/cell`. `aria-expanded` and `data-open` only reflect the React state, which is driven by click, Enter, Space, Escape and blur. Consequences:
1. A keyboard user tabs to a square and the popover is already visible through `:focus-visible`, while `aria-expanded="false"`. Pressing Enter or Space then sets `open=true`, and the popover looks identical. Pressing it again sets `open=false`, and the popover stays visible because focus-visible still shows it. The toggle the fix added has no visible effect on the keyboard path, and `aria-expanded` is false while the content is on screen.
2. Escape clears `open` and blurs the square. That dismisses the focus-visible popover, but it also drops keyboard focus to `<body>` every time, even when nothing was open. A keyboard user loses their place in the 100+ tab stops.
3. With the mouse hovering a square (laptop target), Escape cannot dismiss the hover popover, so the WCAG 1.4.13 "dismissible" requirement that motivated WR-07 is met only for the keyboard-focus path.

**Fix:** Either make `open` the sole source of visibility for keyboard and click (drop `group-focus-visible/cell:block` from the popover and open on focus: `onFocus={() => setOpen(true)}`, leaving hover as the pointer path), or stop claiming state. Concretely, in `ToiStripCell` add `onFocus` for keyboard-initiated focus only (guard with `e.currentTarget.matches(":focus-visible")`). Keep `onKeyDown` Escape as `setOpen(false)` without `blur()`. Add a `data-dismissed` flag, or `group-data-[open]:...`, so Escape can also hide a hovered popover. Whichever model you pick, `aria-expanded` should be derived from the same condition that shows the popover.

## Info

### IN-11: `newestMissing` does not cover a failed second-newest game; no test for the WR-05/WR-06 edge paths

**File:** `app/research/page.tsx:51-54`, `lib/research/team-games.test.ts:103-126`
**Issue:** `newestMissing` is true only when a failed date is newer than the newest loaded game. If the second-newest game of A, B, C, D fails (C), "Last game" is still D, so no note appears. Yet the "last 2 games" comparison silently uses B and D. The wording the fix adds also claims only the "newest games that did load" case. Separately, the team-games tests have no case for an OT/SO game with a published-but-empty chart (the "still excluded, not unavailable" branch, `team-games.ts:109`). The stub always returns non-empty `SHIFT_ROWS`. The WR-06 clause has no test (the page has no render test).
**Fix:** Compute `lastTwoDisturbed` as "any unavailable date newer than the second-newest loaded game" and use it for the clause. Add a `shiftChartEmpty?: number[]` option to `Stub` and a test that an OT game with `data: []` is kept with `regulationToi === null` and `lines === null`, and is not in `unavailableDates`. Extract the newest-missing predicate to a pure function in `lib/research/` and unit-test it.

### IN-12: `nextOpen` and `CellEvent` live in a `"use client"` module; key repeat and modified Enter/Space still toggle

**File:** `components/ToiStripCell.tsx:6-11, 53-61`
**Issue:** `nextOpen` and `CellEvent` are exported from a `"use client"` file. A server component that imports `nextOpen` gets a client reference that throws if it is called on the server. Only the test imports it today, so there is no bug yet. The `enter` and `space` events are indistinguishable from `click` in `nextOpen`, so the three-way union adds nothing. Holding Enter or Space auto-repeats keydown, so the popover flickers open and closed. Ctrl/Alt/Meta+Enter also toggles.
**Fix:** Move `nextOpen` to `lib/research/` (a plain module, as the project convention for pure logic suggests). Guard the handler with `if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;`.

### IN-13: `aria-expanded` on a button whose controlled content is `aria-hidden`

**File:** `components/ToiStripCell.tsx:48-50`, `components/ToiGameStrip.tsx:41`
**Issue:** The popover is `aria-hidden="true"` and the full detail is already in `aria-label`. A screen reader therefore announces "button, collapsed/expanded" for a control that reveals nothing it can read. There is no `aria-controls`. This is noise rather than breakage, and ties into WR-10.
**Fix:** Drop `aria-expanded` and use `aria-haspopup`-free, label-only semantics (for example `role="img"` plus a non-toggling click), or make the popover readable and reference it with `aria-describedby`.

### IN-01: `if (secs)` conflates a 0:00 clock with a malformed one (still open)

**File:** `lib/research/team-games.ts:94`
**Issue:** Unchanged by the fix commits. A skater with a `0:00` boxscore TOI is dropped, the same as an unparseable one.
**Fix:** `if (secs !== null)`, if a skater who dressed with 0:00 should count as played.

### IN-02: Non-null assertion inside a closure (still open)

**File:** `app/research/page.tsx:140`
**Issue:** `game.lines!` inside the `.map` closure (the ledger cites line 134; the code shifted after the fix).
**Fix:** `const lines = game.lines;` after the null check, then use `lines`.

### IN-05: Popover headroom `pb-28 -mb-24` is a fixed magic number (still open)

**File:** `components/ToiTrends.tsx:56`
**Issue:** Unchanged. A last-row popover whose content grows (long opponent and result strings with `max-w-xs`) can exceed the reserved space and clip against `overflow-x-auto`.
**Fix:** Check it in a browser at the 20-game window, or portal the popover out of the scroll container.

### IN-06: Intro copy hard-codes thresholds; empty state says "regular-season" (still open)

**File:** `components/ToiTrends.tsx:50`, `app/research/page.tsx:102`
**Issue:** "2:00" and "15 points" duplicate `TOI_MOVER_SECONDS` and `PP_MOVER_POINTS`. The empty-state copy says "regular-season" although playoff games are included.
**Fix:** Interpolate the constants through `formatClock`. Reword the empty state to "hasn't finished a regular-season or playoff game".

### IN-07: A second click on a hovered square has no visible effect (still open)

**File:** `components/ToiStripCell.tsx:52`, `components/ToiGameStrip.tsx:41`
**Issue:** On a laptop the pointer is over the square, so `group-hover` already shows the popover. The toggle only matters for touch, which this site does not target. Related to WR-10.
**Fix:** Soften the "(click a square)" header hint to "hover a square", or accept it.

### IN-09: Tests pin the literal light tint in five places; dark classes untested (still open)

**File:** `lib/research/toi-trends-view.test.ts:252-254, 269, 293, 298`
**Issue:** Unchanged by the fix commits.
**Fix:** Export the tint class strings from a shared constant and assert on that, plus the `dark:bg-*-900/40` variant.

### IN-10: `text-green-700` on green-100 is only just above AA (still open)

**File:** `components/ToiTrends.tsx:232`
**Issue:** Contrast is 4.56:1. Unchanged.
**Fix:** Use `text-green-800` for headroom.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
