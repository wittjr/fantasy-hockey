---
phase: 02-player-linemate-detail
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/research/page.tsx
  - components/LastGameLines.tsx
  - components/PlayerLinemates.tsx
  - components/PlayerLink.tsx
  - components/StripPopover.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/research/game-strip.ts
  - lib/research/linemates.ts
  - lib/research/lines.ts
  - lib/research/pair-seconds.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends.ts
  - lib/research/linemates.test.ts
  - lib/research/pair-seconds.test.ts
  - lib/research/player-detail-view.test.ts
  - lib/research/player-links-view.test.ts
  - lib/research/toi-trends.test.ts
  - lib/research/toi-trends-view.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the pair-seconds pass, the linemate view-model, the server-rendered panel, the URL param allowlists, the
shared popover, and the client-cell Escape handling. The full `lib/research` suite passes (265 tests).

Checked and found sound:

- **Regulation-only pair seconds.** `pairSeconds` skips every bucket at or past 3600 s, so OT and 2OT never count.
  Pair seconds come from the same deduplicated skater set as own seconds, so they cannot exceed either skater's own seconds.
- **Unknown and absent games.** `linemateCell` returns `null` seconds, share and selfSeconds for unknown and absent
  states. `pooledShare`, `windowShare`, `recentSeconds` and the min-seconds filter all skip null cells, so these games never become 0.
- **URL allowlists.** `parsePlayer`, `parseSit` and `parseAll` accept only a digit string, `pp`/`sh`, and `"1"`. `team` is
  checked against `NHL_TEAM_ABBREVS`, and `games` against `GAME_COUNTS`. Every href is built by `researchHref` or
  `playerHref` through `URLSearchParams` from validated values. No raw param reaches a link.
- **Server/client boundary.** `ToiStripCell` imports only types from server modules (`import type`, erased). Its popover
  arrives as server-rendered `children`, so no `Map` crosses the boundary.
- **SC5.** The diff of the old `page.tsx` `UnitTable` against `LastGameLines.tsx` shows `formatClock(u.seconds)` and
  `u.pct.toFixed(1)` unchanged, and `analyzeGameLines` is only refactored (`bucketOnIce` extracted verbatim).

No blockers. One inconsistency in the new pair pass for overlapping shift rows and one wrong user-facing message are worth fixing. The rest is minor.

## Warnings

### WR-01: pairSeconds classifies strength from a duplicate-inflated skater count, then deduplicates only the credited seconds

**File:** `lib/research/pair-seconds.ts:41-45`
**Issue:** `situationFor(mine, opp)` reads `mine.skaters.length`. When one player has two differing, overlapping
shift rows (the case the comment on line 44 acknowledges), `bucketOnIce` pushes his id twice, so the skater count is
inflated by one for those seconds. A real 5v5 second then classifies as PP (or a 4v5 as EV). Only after that does line 45
collapse the ids with `new Set`.
- **Own seconds.** The player gets one credit, filed in the wrong situation. `analyzeGameLines` instead credits him twice.
- **Result.** `pairs.self` and `lines.playerSeconds` diverge, and the "same situationFor classification" claim in the
  file header is only true for clean charts.
- **Test gap.** The oracle test passes only because its fixture has no overlapping rows.

The pair pass is internally consistent (never exceeds own seconds), but the strength classification is wrong exactly
where the dedupe was meant to help.

**Fix:** Deduplicate before classifying, and say whether the divergence from `analyzeGameLines` is intended:
```ts
const skaters = [...new Set(mine.skaters)];
const situation = situationFor({ skaters, goalie: mine.goalie }, opp);
```
Add an overlapping-rows case to `pair-seconds.test.ts`. If `analyzeGameLines` should also stop double-counting, fix both together so the oracle stays true.

### WR-02: "no-earlier-data" tag note states a false cause

**File:** `components/PlayerLinemates.tsx:99`
**Issue:** The message reads "has no earlier games in this window to compare with". The reason `no-earlier-data`
(`linemates.ts:142`) is returned whenever no earlier game has both a shift chart and situation time for the player.
With a 5-game window it fires, for example:
- on the PP tab, when the player had no PP time in the first 3 games;
- when the earlier games have no shift chart.

In both cases earlier games exist, so the sentence is wrong and sends the user to look for a problem that is not there.

**Fix:** Word it by what is actually checked:
```ts
"no-earlier-data": `No tags: ${name} has no ${SITUATION_WORDS[sit]} time with a shift chart in the earlier games of this window to compare with.`,
```

## Info

### IN-01: Sort/tab links carry `sit` and `all` when no player is selected

**File:** `components/ToiTrends.tsx:218`, `app/research/page.tsx:64`
**Issue:** `SortHeader` always passes `{ player: selected, sit, all }`, and the team nav passes `{ sit }`. With no `?player`,
a visit to `?all=1` or `?sit=pp` (hand-edited or left over) keeps `all=1` or `sit=pp` forever in every sort and team link.
They are harmless and allowlisted, but they pollute shareable URLs with state that has no visible effect.
**Fix:** In `researchHref`, emit `sit` and `all` only when `extras.player` is a number. Update the `researchHref` tests, which currently pin the opposite behaviour.

### IN-02: Escape cannot dismiss a popover that is open by mouse hover alone

**File:** `components/ToiStripCell.tsx:75-77`
**Issue:** The Escape handler is `onKeyDown` on the square, so it only runs when the square has focus. A popover shown
purely by hover, without a click or tab to the square, cannot be dismissed with Escape, though the doc comment cites WCAG 1.4.13.
A click focuses the square (tabIndex 0), so only the pure-hover case is uncovered. Low impact on a laptop-only personal tool.
**Fix:** While hovered, also listen for `keydown` Escape on `document`, or narrow the comment so it does not claim dismissal for hover.

### IN-03: Close link's accessible name does not contain its visible text

**File:** `components/PlayerLinemates.tsx:124-131`
**Issue:** The visible text is "× Close player detail", but `aria-label` is `Close ${name} detail`. "Close player detail" is not a
substring of that label, which breaks WCAG 2.5.3 (Label in Name) for speech-control users.
**Fix:** Drop the `aria-label` (the `×` is `aria-hidden`), or use `Close player detail: ${name}`.

### IN-04: Name links get different `sort` values depending on which table they are in

**File:** `app/research/page.tsx:110-111`, `components/ToiTrends.tsx:46`
**Issue:** `LastGameLines` and `PlayerLinemates` receive the raw parsed `sort`. `ToiTrends` computes `effectiveSort(...)`
and uses that for its name and sort links. In a 1-game window with `sort=toiDelta` requested, a Last game name link keeps
`sort=toiDelta` while a trends-table name link drops it. The page is therefore inconsistent about whether the URL "keeps the request".
**Fix:** Pick one rule (probably the raw `sort` everywhere, as the `effectiveSort` comment implies) and pass the same value to all three components.

### IN-05: Duplicated situation labels and an export with no consumers

**File:** `components/LastGameLines.tsx:13`, `components/PlayerLinemates.tsx:316`
**Issue:**
- `SITUATION_LABELS` repeats `SITUATION_ABBREV` from `lib/research/linemates.ts`. Two copies of one mapping can drift.
- `LinemateRowView` is `export`ed but only used within its own file.
- `buildTrendRows(...)` runs twice per request: once in `PlayerLinemates` and once in `ToiTrends`. This is a duplication note only; performance is out of scope.

**Fix:** Import `SITUATION_ABBREV` in `LastGameLines`, remove the unused `export`, and pass the already built `row` into the panel if the duplication matters.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
