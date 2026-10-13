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
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This is an incremental re-review. The original 20-file review was at a325686. Since then only `lib/research/linemates.ts` and
`lib/research/linemates.test.ts` changed (ad603e9, "order linemates by window share", D-28). Both were re-read in full, along with
the diff. The other 18 files are unchanged (`git diff a325686 HEAD --stat -- app components lib` lists only those two). Every prior
finding was re-opened against the current source and still applies. None were dropped.

The full `lib/research` suite passes (265 tests).

The D-28 change itself is correct:

- **Dead code removed cleanly.** `recentSeconds` is gone from the interface, the accumulator and the sort, with no remaining references.
- **`start` still used.** It is still needed for tags and `recentStart`.
- **Sort key.** `windowShare` is never null for a listed row. A row only reaches the sort if `together >= LINEMATE_MIN_SECONDS`, which implies a
  counted cell with `selfSeconds > 0`. The `?? 0` is therefore defensive, not a bug.
- **Tie-breaking.** Mathematically equal ratios produce identical IEEE doubles because each is a single correctly rounded division. The
  `windowShare` tie, then `totalSeconds`, then id chain is a total order, so it is deterministic.

The change did leave one stale user-facing string (WR-04). Two minor notes follow (IN-06, IN-07).

## Warnings

### WR-01: pairSeconds classifies strength from a duplicate-inflated skater count, then deduplicates only the credited seconds

**File:** `lib/research/pair-seconds.ts:41-45` (still applies)
**Issue:** `situationFor(mine, opp)` reads `mine.skaters.length`. When one player has two differing, overlapping
shift rows (the case the comment on line 44 acknowledges), `bucketOnIce` pushes his id twice (`lines.ts:98`), so the skater count is
inflated by one for those seconds. A real 5v5 second then classifies as PP (or a 4v5 as EV). Only after that does line 45
collapse the ids with `new Set`.
- **Own seconds.** The player gets one credit, filed in the wrong situation. `analyzeGameLines` instead credits him twice (`lines.ts:130`).
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

**File:** `components/PlayerLinemates.tsx:99` (still applies)
**Issue:** The message reads "has no earlier games in this window to compare with". The reason `no-earlier-data`
(`linemates.ts:140`) is returned whenever no earlier game has both a shift chart and situation time for the player.
With a 5-game window it fires, for example:
- on the PP tab, when the player had no PP time in the first 3 games;
- when the earlier games have no shift chart.

In both cases earlier games exist, so the sentence is wrong and sends the user to look for a problem that is not there.

**Fix:** Word it by what is actually checked:
```ts
"no-earlier-data": `No tags: ${name} has no ${SITUATION_WORDS[sit]} time with a shift chart in the earlier games of this window to compare with.`,
```

### WR-04: Footer still says linemates are sorted "most recent time together first" after D-28

**File:** `components/PlayerLinemates.tsx:240`, pinned by `lib/research/player-detail-view.test.ts:589`
**Issue:** ad603e9 changed the sort key in `buildLinemateView` to window share (highest first), but the user-facing line under the
list still reads "Showing N of M linemates, most recent time together first." The list is no longer ordered that way.
- **Wrong in the exact case D-28 targets.** After a line change, an old linemate with a high window share is listed above a new one with
  more recent time.
- **Cause.** The edit touched only the two files in the commit, and the string lives in a component and a view test.
- **Test.** The view test asserts the stale wording, so the suite stays green and cannot flag the drift.

**Fix:** Change the wording to match the ordering in both places, for example:
```tsx
`Showing ${view.cappedCount} of ${view.total} linemates, highest share of time together first. `
```
and update the expected string at `player-detail-view.test.ts:589` to match.

## Info

### IN-01: Sort/tab links carry `sit` and `all` when no player is selected

**File:** `components/ToiTrends.tsx:218`, `app/research/page.tsx:64` (still applies)
**Issue:** `SortHeader` always passes `{ player: selected, sit, all }`, and the team nav passes `{ sit }`. With no `?player`,
a visit to `?all=1` or `?sit=pp` (hand-edited or left over) keeps `all=1` or `sit=pp` forever in every sort and team link.
They are harmless and allowlisted, but they pollute shareable URLs with state that has no visible effect.
**Fix:** In `researchHref`, emit `sit` and `all` only when `extras.player` is a number. Update the `researchHref` tests, which currently pin the opposite behaviour.

### IN-02: Escape cannot dismiss a popover that is open by mouse hover alone

**File:** `components/ToiStripCell.tsx:75-77` (still applies)
**Issue:** The Escape handler is `onKeyDown` on the square, so it only runs when the square has focus. A popover shown
purely by hover, without a click or tab to the square, cannot be dismissed with Escape, though the doc comment cites WCAG 1.4.13.
A click focuses the square (tabIndex 0), so only the pure-hover case is uncovered. Low impact on a laptop-only personal tool.
**Fix:** While hovered, also listen for `keydown` Escape on `document`, or narrow the comment so it does not claim dismissal for hover.

### IN-03: Close link's accessible name does not contain its visible text

**File:** `components/PlayerLinemates.tsx:124-131` (still applies)
**Issue:** The visible text is "× Close player detail", but `aria-label` is `Close ${name} detail`. "Close player detail" is not a
substring of that label, which breaks WCAG 2.5.3 (Label in Name) for speech-control users.
**Fix:** Drop the `aria-label` (the `×` is `aria-hidden`), or use `Close player detail: ${name}`.

### IN-04: Name links get different `sort` values depending on which table they are in

**File:** `app/research/page.tsx:110-111`, `components/ToiTrends.tsx:46` (still applies)
**Issue:** `LastGameLines` and `PlayerLinemates` receive the raw parsed `sort`. `ToiTrends` computes `effectiveSort(...)`
and uses that for its name and sort links. In a 1-game window with `sort=toiDelta` requested, a Last game name link keeps
`sort=toiDelta` while a trends-table name link drops it. The page is therefore inconsistent about whether the URL "keeps the request".
**Fix:** Pick one rule (probably the raw `sort` everywhere, as the `effectiveSort` comment implies) and pass the same value to all three components.

### IN-05: Duplicated situation labels and an export with no consumers

**File:** `components/LastGameLines.tsx:13`, `components/PlayerLinemates.tsx:316` (still applies)
**Issue:**
- `SITUATION_LABELS` repeats `SITUATION_ABBREV` from `lib/research/linemates.ts`. Two copies of one mapping can drift.
- `LinemateRowView` is `export`ed but only used within its own file.
- `buildTrendRows(...)` runs twice per request: once in `PlayerLinemates` and once in `ToiTrends`. This is a duplication note only; performance is out of scope.

**Fix:** Import `SITUATION_ABBREV` in `LastGameLines`, remove the unused `export`, and pass the already built `row` into the panel if the duplication matters.

### IN-06: Window-share ordering favours linemates with few counted games

**File:** `lib/research/linemates.ts:201, 206`
**Issue:** Each row's `windowShare` uses a denominator of only the games where that linemate dressed. The player's own seconds in games the
linemate missed are excluded (D-25). The new sort key is that ratio, so a call-up who dressed for one game and rode the line for 70% of it
outranks a regular who shared 60% over five games.
- **Cap effect.** The only floor is `LINEMATE_MIN_SECONDS` (2:00 at EV), so such a short-sample row can take a capped slot ahead of the regular.
- **Status.** This is a consequence of the chosen D-28 rule, and the equal-share test (`linemates.test.ts:181`) documents it on purpose.
  It is not a defect, but the tradeoff is worth recording.

**Fix:** None required. If it proves noisy, break near-ties by `totalSeconds` first, or sort by `together` over the player's seconds in all counted games.

### IN-07: Line-change tests no longer assert ordering

**File:** `lib/research/linemates.test.ts:335-348`
**Issue:** The 2-, 3- and 5-game line-change test used to pin `[12, 13, 10, 11]`. It now sorts a tag map by id, so it checks tags only.
The resulting order differs by window size (a 2-game window ties 10/11 with 12/13 on share, so the tie-breaks decide; a 3-game window puts 12/13 first), and nothing
asserts it for that scenario. The W-03 and equal-share tests cover the comparator in isolation, so this is a small coverage loss rather than a regression.
**Fix:** Optionally assert the full ordered `[id, tag]` list for the 5-game case so a later change to the tie-break chain is caught.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
