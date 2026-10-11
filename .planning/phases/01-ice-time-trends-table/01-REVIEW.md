---
phase: 01-ice-time-trends-table
reviewed: 2026-10-11T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.test.ts
  - lib/nhl/client.ts
  - lib/research/lines.test.ts
  - lib/research/lines.ts
  - lib/research/team-games.test.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-11
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Incremental re-review after gap-closure plans 01-05..01-07. Diff base `a4a913a`. Dependencies read for context but not in scope: `lib/research/game-strip.ts`, `lib/research/format.ts`, `components/PendingLink.tsx`. `tsx --test` passes (122 tests), and `tsc --noEmit` and `eslint` are clean on the scoped files.

Prior findings verified as fixed:

- **CR-01** (duplicate shift rows in `analyzeGameLines`): `uniqueShifts` is now shared by `regulationSeconds` and `analyzeGameLines`, with tests for the PP/SH inflation case. The dedupe key includes team, so two clubs' rows never collide.
- **WR-01** (popover anchoring): the `<td>` is no longer positioned, each square is `relative`, and the popover is `right-0 top-full`. There is no remaining anchoring defect.
- **WR-02** (empty shift chart cached for an hour): an empty first result is re-requested with `cache: "no-store"`. The second request's rejection propagates to the caller's `.catch`.
- **WR-03** (one failed game blanks the page, raw error shown): `Promise.allSettled`, `unavailableDates`, and fixed error copy with server-side logging. No raw error text reaches the page. The team param is allowlisted and links are built from validated values.
- **WR-04** (comment/behaviour mismatch, silent dashes at 2 games): the doc comments match the code, the 2-game legend is added, and the PP share title is corrected.

No critical defects found. The two warnings concern how partial-failure handling (the WR-03 fix) is surfaced to the user. IN-01..IN-04 are unchanged and still present.

## Warnings

### WR-05: A failed shift-chart request is reported as "the NHL hasn't published shift charts"

**File:** `lib/research/team-games.ts:76-79` (surfaced at `components/ToiTrends.tsx:153-157` and `app/research/page.tsx:126`)
**Issue:** `loadGame` swallows a shift-chart rejection (503, network error, malformed envelope) and substitutes `[]`, which is identical to the "unpublished" case. Both the Ice-time trends footer ("No PP/SH data for ...: the NHL hasn't published shift charts for those games yet") and the Last game panel ("The NHL hasn't published shift charts for this game yet") then state an upstream fact that is false for a transient failure. Unlike the `unavailableDates` banner, there is no "Reload to try again" hint. For a failed chart on an OT/SO game, `regulationToi` becomes `null`, so every skater is silently excluded from that game's Avg TOI, slope and Δ. The user cannot tell this is a recoverable failure and not a data property. The only trace is a server log line.
**Fix:** Record the failure on the game and word the copy accordingly. For example, add `shiftChartFailed: boolean` to `ResearchGame`, set it in the `.catch`, and branch the copy:
```ts
// team-games.ts
let shiftChartFailed = false;
getShiftCharts(gameId).catch((err) => {
  console.error(...);
  shiftChartFailed = true;
  return [];
});
// ...game = { ..., shiftChartFailed }
```
Then show "Couldn't load shift charts for X. Reload to try again." when `shiftChartFailed`, and keep the "not published yet" text for the genuinely empty case.

### WR-06: When the newest game(s) fail to load, "Last game" and the "last 2 games" Δ silently re-anchor to older games

**File:** `lib/research/team-games.ts:133-146`, `app/research/page.tsx:116-123`, `lib/research/toi-trends.ts:102-107`
**Issue:** After `allSettled`, `games` holds only the games that loaded and the failed ones are dropped. Every consumer treats `games[games.length - 1]` and the final `RECENT_GAMES` indices as the team's latest games.
- If the newest game's boxscore fails, `LastGameLines` renders the heading "Last game: Oct 3 ..." for a game that is not the team's last game.
- The TOI Δ and PP share Δ columns, the movers tint and `dnpLast2` compare "the team's last 2 games" against the rest. They now compare the last 2 loaded games, which can skip the most recent real game.
- The amber banner names the missing date, but nothing says the recency-based columns shifted. A pickup decision (the app's core value) can rest on a Δ that omits the latest game.

**Fix:** Make the degradation explicit. Either:
- (a) reword the banner when the failed game is newer than the last loaded one, for example "Couldn't load Oct 5; Last game, Δ and mover flags below use the latest games that loaded"; or
- (b) when a failed game falls inside the most recent `RECENT_GAMES` of the requested window, label the "Last game" heading with its date as "Latest loaded game".

Option (a) is the minimum change, since `unavailableDates` and the loaded dates are both already available.

## Info

### IN-01: `if (secs)` conflates a 0:00 clock with a malformed one

**File:** `lib/research/team-games.ts:92-93`
**Issue:** `parseClock` returns `0` for "0:00" and `null` for malformed input. The truthiness check treats both as "did not dress". A skater who dressed but logged "00:00" renders as DNP, which is arguably intended, but the code does not say so and the null case is dropped silently.
**Fix:** `if (secs !== null && secs > 0)` with a short comment stating the intent.

### IN-02: Non-null assertion inside a closure

**File:** `app/research/page.tsx:134`
**Issue:** `game.lines!.units[...]` sits inside a `.map` callback. TypeScript cannot carry the `!game.lines` narrowing into the closure, so the assertion is needed. It is safe today but fragile if the surrounding branch changes.
**Fix:** Hoist `const lines = game.lines;` into the narrowed branch (for example `const units = game.lines.units;` before the JSX) and use it in the closure.

### IN-03: Negative "OT excluded" time rendered as positive

**File:** `lib/research/game-strip.ts:38` (consumed by `components/ToiGameStrip.tsx`)
**Issue:** `+${formatClock(cell.totalToi - cell.toi)}` uses `formatClock`, which applies `Math.abs`. If shift-derived regulation TOI exceeds boxscore total (a chart that overlaps or runs long), the popover shows `+0:12` for a negative difference, hiding the inconsistency.
**Fix:** Clamp or flag it, for example `const ot = cell.totalToi - cell.toi; value: ot < 0 ? "—" : `+${formatClock(ot)}``.

### IN-04: `getShiftCharts` assumes the response envelope

**File:** `lib/nhl/client.ts:140-141`
**Issue:** `(await res.json()) as { data: NhlShift[] }` followed by `data.data.filter(...)` throws a bare `TypeError` ("Cannot read properties of undefined") if the envelope changes or `data` is missing. This is an undocumented API. The error is now caught per game, but the log message carries no game context.
**Fix:** `const rows = data?.data; if (!Array.isArray(rows)) throw new Error(`NHL shift charts ${gameId}: unexpected response shape`);`

### IN-05: Popover headroom is a fixed magic number

**File:** `components/ToiTrends.tsx:56` (`pb-28 -mb-24`)
**Issue:** The scroll wrapper (`overflow-x-auto` forces `overflow-y: auto` as well) reserves 7rem of bottom padding so the last rows' popovers are not clipped, then pulls the layout back with a negative margin. The popover height is content-driven. The worst case is an excluded OT cell with no chart, which has 5 rows, 2 notes and a wrapping note at `max-w-xs`, and it can exceed the reserve. The popover would then be clipped or add an inner vertical scrollbar on the bottom rows. This is estimated from the CSS, not observed in a browser.
**Fix:** Verify the worst-case popover on the last row in a browser. If it clips, raise the reserve or derive it from the maximum popover line count.

### IN-06: Threshold copy and "regular-season" wording are hard-coded and can drift from the code

**File:** `components/ToiTrends.tsx:50` and `app/research/page.tsx:97`
**Issue:** The intro paragraph states "2:00 or more of TOI or 15 or more points" while the behaviour comes from `TOI_MOVER_SECONDS` and `PP_MOVER_POINTS`. A threshold change will leave the copy stale, and the view test pins the copy string, not the constants. Separately, the empty state says "hasn't finished a regular-season game" although `RESEARCH_GAME_TYPES` includes playoffs (type 3).
**Fix:** Interpolate the constants into the copy (`formatClock(TOI_MOVER_SECONDS)`, `PP_MOVER_POINTS`) and change the empty-state wording to "a game".

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
