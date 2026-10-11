---
phase: 01-ice-time-trends-table
reviewed: 2026-10-11T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.ts
  - lib/research/format.ts
  - lib/research/game-strip.test.ts
  - lib/research/game-strip.ts
  - lib/research/lines.test.ts
  - lib/research/lines.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.test.ts
  - lib/research/toi-trends.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-11
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The sort, delta and mover logic in `toi-trends.ts` holds up on edge cases (null ordering, the sign convention, URL round-tripping, the 1-game fallback). Search params are validated against an allowlist before they reach any link, so I found no injection path.

The one defect I would call a blocker is in the shift-chart pipeline. Duplicate shift rows are de-duplicated for TOI but not for PP/SH/line analysis, so one repeated row can corrupt the PP share and SH numbers the table displays. The other findings are about popover placement, cached empty shift charts, all-or-nothing page failure, and doc/behaviour drift.

No structural findings (fallow) were provided. The test files were not reviewed beyond a check that `lines.test.ts` covers de-duplication only for `regulationSeconds`.

## Critical Issues

### CR-01: Duplicate shift rows are de-duplicated for TOI but not for strength/PP/SH analysis

**File:** `lib/research/lines.ts:77-91` (compare `lines.ts:22-33`)
**Issue:** `regulationSeconds` explicitly guards against the NHL feed repeating a shift row verbatim (the comment cites game 2026020075). `analyzeGameLines` consumes the same `shiftInputs` with no such guard. Each duplicated row pushes the same `playerId` into `onIce.skaters` a second time for every second of the shift. Consequences for that game:
- `mine.skaters.length` is inflated, so `situationFor` can classify even strength as PP, or 5-on-4 as 5-on-3 and so on.
- `situationSeconds.pp/sh` and the per-player `playerSeconds` are wrong. These feed `ppShare`, `ppShareDelta`, `shAvg` and the mover tinting, which is the main output of this phase.
- EV unit detection (`ids.length !== EV_UNIT_SIZE[group]`) silently drops the affected seconds from the EV lines, and PP/SH units get a duplicated id.

The TOI column, which is boxscore based or de-duplicated, stays correct while PP and SH come from the corrupted analysis, so the table is internally inconsistent for that game. Overlapping non-identical rows (a shift ending at 12:05 and the next starting at 12:03) have the same effect, but verbatim duplicates are the documented real-world case.
**Fix:** De-duplicate the shifts once in `loadGame`, or inside `analyzeGameLines` with the same key `regulationSeconds` uses. For example:
```ts
// lines.ts, top of analyzeGameLines
const seen = new Set<string>();
for (const shift of shifts) {
  const pos = positions.get(shift.playerId);
  if (!pos || shift.endSec <= shift.startSec) continue;
  const key = `${shift.playerId}:${shift.period}:${shift.startSec}:${shift.endSec}`;
  if (seen.has(key)) continue;
  seen.add(key);
  // ...existing per-second bucketing
}
```
Add a regression test with a verbatim duplicate shift in `lines.test.ts` that asserts `situationSeconds` and `playerSeconds` are unchanged.

## Warnings

### WR-01: Hover/focus popover is anchored to the `<td>`, not to the hovered square

**File:** `components/ToiGameStrip.tsx:7, 27, 37`
**Issue:** The only `relative` element is the `<td>` (line 7). The per-cell `<span>` (line 27) has `group/cell` but no `relative`, so the `absolute left-0 top-full` popover (line 37) resolves against the td. Every square's popover opens at the left edge of the strip, below the whole cell group, not under the square being hovered. In a 20-game window the popover for game 20 appears about 240px away from the square. The `pb-28 -mb-24` hack on the wrapper in `ToiTrends.tsx:55` looks like a workaround for the same clipping problem and will not fix the placement.
**Fix:** Add `relative` to the cell span and drop it from the td (or keep both). If left-edge clipping at the row end matters, anchor with `left-1/2 -translate-x-1/2`.

### WR-02: An empty, not-yet-published shift chart is cached for an hour

**File:** `lib/nhl/client.ts:116-145` (consumer `lib/research/team-games.ts:87-110`)
**Issue:** The `getShiftCharts` docstring says the feed "can be empty for a short while after a game ends". The same fetch applies `FINISHED_GAME_CACHE` (`revalidate: 3600`) to that empty response. A page view in the minutes after a game therefore pins `lines: null` for up to an hour. The UI then shows "The NHL hasn't published shift charts" and "No PP/SH data for ...", and the OT regulation TOI is excluded as well. The boxscore may well be final and correct at that point.
**Fix:** Do not cache an empty result. For example, fetch with `cache: "no-store"` when `data.length === 0`, or use a short `revalidate` (for example 60) for the shift chart request and rely on the hour-long boxscore cache only.

### WR-03: One failed request fails the whole page

**File:** `lib/research/team-games.ts:71, 123`; `app/research/page.tsx:40-44`
**Issue:** `Promise.all` over up to 20 games, each running two requests, rejects the entire load if any single boxscore or shift-chart fetch returns a non-2xx status. A transient 5xx or 429 on one of up to 40 concurrent requests blanks the table. The page also renders the raw `Error.message` (`NHL API gamecenter/.../boxscore failed: 503`), which exposes internal paths and gives the user nothing to act on.
**Fix:** Treat a shift-chart failure as "no shift data" for that game (catch inside `loadGame` and use `[]`), so the boxscore-based TOI still renders. Show a generic message in the page and log the detail server-side. Consider limiting concurrency.

### WR-04: Doc/behaviour mismatch for `toiDelta` and `ppShare`, and a misleading hint at exactly 2 games

**File:** `lib/research/toi-trends.ts:47-56, 198, 206`; `components/ToiTrends.tsx:62-64, 138-146`
**Issue:**
- The `TrendRow.toiDelta` comment says "Mean TOI over the team's last 2 games he *played*". The implementation (`recentDelta`, line 97) splits by team game index, whether or not the player played. The `recentDelta` doc comment states the by-index behaviour, so the two comments contradict each other, and a maintainer following the `TrendRow` comment would "fix" the code the wrong way.
- The `ppShare` comment and the column title say "over the window". The denominator (`teamPpTotal`, line 197) only sums team PP in games where the player dressed and had a chart. A player who missed games gets a share against a smaller denominator than the whole window, and that is what gets sorted on.
- When a team has exactly 2 finished games, `showTrend` is true, so the Δ columns render, but `recentDelta` always returns null because of the 3-game gate. The help text only says "needs 3 or more games played" and never tells the user why every Δ is a dash.

**Fix:** Correct the `toiDelta` and `ppShare` comments and column titles to match the implementation, or change the code to match the intent. Consider `showTrend = games.length >= MIN_GAMES_FOR_DELTA` for the Δ columns, so the delta columns are hidden until a delta is possible.

## Info

### IN-01: `if (secs)` conflates a 0:00 clock with a malformed one

**File:** `lib/research/team-games.ts:83-84`
**Issue:** `parseClock` returns `null` for malformed input and `0` for "00:00". The truthiness check drops both, so a dressed skater with 0:00 TOI is treated as a non-participant ("Did not play") instead of a 0:00 game. This is probably the intended behaviour, but it is implicit.
**Fix:** Write it explicitly (`if (secs !== null && secs > 0)`) with a comment stating that 0:00 means did not play.

### IN-02: Non-null assertion inside a closure

**File:** `app/research/page.tsx:127`
**Issue:** `game.lines!.units...` relies on the `!game.lines` guard on line 118, but narrowing is lost inside the `flatMap` callback. It is safe today and fragile under refactoring.
**Fix:** Bind `const lines = game.lines;` after the guard and use `lines.units[...]`.

### IN-03: Negative "OT excluded" time is rendered as positive

**File:** `lib/research/game-strip.ts:42-44`
**Issue:** `cell.totalToi - cell.toi` is `boxscore - shift-derived regulation`. If the shift chart over-counts (overlapping rows, or the CR-01 duplicates), the difference is negative, and `formatClock` takes `Math.abs`, so the popover shows "+1:05" for a negative amount.
**Fix:** Clamp with `Math.max(0, ...)`, or hide the row when the difference is not positive.

### IN-04: `getShiftCharts` assumes the response envelope

**File:** `lib/nhl/client.ts:144-145`
**Issue:** `data.data.filter(...)` throws a `TypeError` ("Cannot read properties of undefined") if the undocumented stats endpoint changes shape, and that error surfaces to the user unchanged (see WR-03).
**Fix:** `return (data.data ?? []).filter(...)`, or throw an explicit error naming the endpoint.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
