---
phase: 02-player-linemate-detail
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 21
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
  - lib/research/lines.test.ts
  - lib/research/pair-seconds.test.ts
  - lib/research/player-detail-view.test.ts
  - lib/research/player-links-view.test.ts
  - lib/research/toi-trends.test.ts
  - lib/research/toi-trends-view.test.ts
findings:
  critical: 0
  warning: 1
  info: 8
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This is an incremental re-review against the prior review at adfa4c6. Since then six files changed: `components/PlayerLinemates.tsx`,
`lib/research/lines.ts`, `lib/research/lines.test.ts`, `lib/research/pair-seconds.ts`, `lib/research/pair-seconds.test.ts` and
`lib/research/player-detail-view.test.ts`. All six were re-read in full along with the diff. `tsc --noEmit` is clean and
`tsx --test lib/research/*.test.ts` passes (271 tests).

**Fixes re-checked, all correct (not re-listed):**
- **WR-01 (and the quick-task 261012-tph follow-up).**
  - `dedupeOnIce` collapses a player's repeated ids before `situationFor` runs, for own team and opponent, in both `analyzeGameLines` (`lines.ts:136-138`) and `pairSeconds` (`pair-seconds.ts:43-45`).
  - The `rawMine.skaters.length === 0` guard runs before the dedupe. Dedupe cannot turn a non-empty list empty, so it is safe.
  - Both passes now classify identically. The extended oracle test (`pair-seconds.test.ts:44-56`) covers own overlap at EV, opponent overlap on the PP and own overlap short-handed, and its situation totals check out.
  - The new `lines.test.ts` cases fail on the old behaviour (6 skaters plus a goalie read as PP), so they are real regression tests.
- **WR-02.** The "no-earlier-data" note now states what the reason checks (`PlayerLinemates.tsx:99`). The pinned view-test string matches.
- **WR-04.** The capped-list footer now reads "highest share of time together first" (`PlayerLinemates.tsx:240`). The view test is updated.

**Open from the prior review:** IN-01 to IN-05 and IN-07 were re-opened against current source and all still apply (line numbers
updated where they moved). None were dropped. IN-06 was accepted by design (D-28, deferred in the disposition ledger) and is omitted.

**New this round:** WR-05 is a second stale ordering sentence that the WR-04 fix missed, plus two minor notes (IN-08, IN-09)
about the dedupe change.

## Warnings

### WR-05: Window-share footnote still says linemates are "ordered by the team's last 2 games, then by the whole window"

**File:** `components/PlayerLinemates.tsx:257-259`, pinned by `lib/research/player-detail-view.test.ts:432`
**Issue:** WR-04 fixed one stale ordering sentence (the capped-list footer), but the explanatory footnote under the table still
describes the pre-D-28 sort. `buildLinemateView` now sorts by `windowShare` descending, then `totalSeconds`, then id
(`linemates.ts:206`). The `recentSeconds` key that the "last 2 games, then the whole window" wording described no longer exists.
- **User impact.** The panel now contradicts itself. The footer says "highest share of time together first" while the footnote says
  "ordered by the team's last 2 games". After a line change, a linemate from the earlier games can sit above one from the last 2 games,
  which the footnote says cannot happen.
- **Why the suite stays green.** The view test at line 432 asserts the stale wording verbatim, the same drift pattern as WR-04.

**Fix:**
```tsx
Window share is time together divided by {name}&apos;s {abbrev} time in the games they both played. Linemates are
ordered by window share, highest first, and only those with {minimum} or more together are listed.
```
and update the expected string at `player-detail-view.test.ts:432` to:
`"Window share is time together divided by Alpha Center's EV time in the games they both played. Linemates are ordered by window share, highest first, and only those with 2:00 or more together are listed."`

## Info

### IN-01: Sort/tab links carry `sit` and `all` when no player is selected

**File:** `components/ToiTrends.tsx:218`, `app/research/page.tsx:64` (still applies)
**Issue:** `SortHeader` always passes `{ player: selected, sit, all }`, and the team nav passes `{ sit }`. `researchHref`
(`toi-trends.ts:211-212`) emits `sit` and `all` regardless of whether `player` is set. With no `?player`, a visit to `?all=1` or
`?sit=pp` (hand-edited or left over) keeps `all=1` or `sit=pp` forever in every sort and team link. They are harmless and
allowlisted, but they pollute shareable URLs with state that has no visible effect.
**Fix:** In `researchHref`, emit `sit` and `all` only when `extras.player` is a number. Update the `researchHref` tests, which currently pin the opposite behaviour.

### IN-02: Escape cannot dismiss a popover that is open by mouse hover alone

**File:** `components/ToiStripCell.tsx:71-77` (still applies; the handler moved up from 75-77)
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
- `SITUATION_LABELS` repeats `SITUATION_ABBREV` from `lib/research/linemates.ts:20`. Two copies of one mapping can drift.
- `LinemateRowView` is `export`ed but only used within its own file.
- `buildTrendRows(...)` runs twice per request: once in `PlayerLinemates` and once in `ToiTrends`. This is a duplication note only; performance is out of scope.

**Fix:** Import `SITUATION_ABBREV` in `LastGameLines`, remove the unused `export`, and pass the already built `row` into the panel if the duplication matters.

### IN-07: Line-change tests no longer assert ordering

**File:** `lib/research/linemates.test.ts:335-348` (still applies)
**Issue:** The 2-, 3- and 5-game line-change test used to pin `[12, 13, 10, 11]`. It now sorts a tag map by id, so it checks tags only.
The resulting order differs by window size (a 2-game window ties 10/11 with 12/13 on share, so the tie-breaks decide; a 3-game window puts 12/13 first), and nothing
asserts it for that scenario. The W-03 and equal-share tests cover the comparator in isolation, so this is a small coverage loss rather than a regression.
**Fix:** Optionally assert the full ordered `[id, tag]` list for the 5-game case so a later change to the tie-break chain is caught.

### IN-08: `regulationSeconds` still double-counts overlapping differing rows, so OT-game TOI no longer matches the line passes

**File:** `lib/research/lines.ts:36-43`, used at `lib/research/team-games.ts:115`
**Issue:** Quick task 261012-tph made `analyzeGameLines` and `pairSeconds` count a player with overlapping, non-identical rows once per
second. `regulationSeconds` only drops verbatim repeats (`uniqueShifts`), so for the same chart it still sums both overlapping rows.
- **Effect.** For an overtime or shootout game, `regulationToi` (feeding Avg TOI and TOI Δ) can exceed the same player's `playerSeconds`/`pairs.self` total by the overlap length. Before this change all three passes double-counted together, so they agreed.
- **Comment drift.** The doc comment ("Equals boxscore TOI minus OT for a complete shift chart") holds only for clean charts.
- **Scope.** Only affects anomalous feeds in OT/SO games. Non-OT games use the boxscore TOI directly.

**Fix:** Either merge a player's overlapping intervals in `regulationSeconds` (the same intent as `dedupeOnIce`), or state in its doc comment that overlapping non-identical rows are summed, so the divergence is deliberate and documented.

### IN-09: `analyzeGameLines` doc comment now describes only the dedupe, not the function

**File:** `lib/research/lines.ts:113-117`
**Issue:** The JSDoc was rewritten around "neither can inflate the on-ice skater count..." and no longer says what the function returns
(per-situation seconds, EV/PP/SH units, per-player seconds). A reader of the signature gets an invariant but no summary. The
`bucketOnIce` comment (lines 86-90) also tells callers to remember to call `dedupeOnIce`. That leaves the invariant to caller discipline,
and a third caller of `bucketOnIce` could reintroduce the inflated count unnoticed.
**Fix:** Lead the `analyzeGameLines` comment with one line on what it computes, and keep the dedupe note as the second sentence. Optionally move the dedupe into `bucketOnIce` itself so no caller can skip it.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
