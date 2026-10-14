---
phase: 03-unit-event-stats
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - components/LastGameLines.tsx
  - components/PendingLink.tsx
  - components/PlayerLink.tsx
  - lib/nhl/client.test.ts
  - lib/nhl/client.ts
  - lib/research/events.test.ts
  - lib/research/events.ts
  - lib/research/fixtures/2026020092.json
  - lib/research/lines.test.ts
  - lib/research/lines.ts
  - lib/research/play-events.test.ts
  - lib/research/play-events.ts
  - lib/research/player-detail-view.test.ts
  - lib/research/player-links-view.test.ts
  - lib/research/team-games.test.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/unit-events-view.test.ts
  - lib/research/unit-events-view.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** standard
**Files Reviewed:** 19 (the first pass covered c247f98..12f5f24; this incremental pass covers 12f5f24..HEAD, plans 03-12 and 03-13)
**Status:** issues_found

## Summary

This is an incremental re-review. The first pass covered the phase up to 12f5f24. This pass covers `git diff 12f5f24..HEAD` for plan 03-12 (teammate-blocked attempts now count in CF/CA) and plan 03-13 (overlay spinner on `PendingLink`, centered en-dash separator, stat-cell padding).

`npx tsc --noEmit` is clean. `npx tsx --test lib/research/*.test.ts` passes: 477 tests, 0 failures.

**Plan 03-12 (counting rule): no new bug found.**
- The `teammate-blocked` exclusion was removed consistently. `Exclusion`, `GameEvents.excluded`, `attributeEvents`, `exclusionsNote`, `UNIT_LEGEND` and every test fixture helper now use the two-kind shape. A grep of `app/`, `lib/` and `components/` finds no remaining production reference to `teammateBlocked` or `"teammate-blocked"`.
- `matchQuality` (`events.ts:144`) only skips shootout and penalty-shot events, so teammate-blocked attempts are still checked against `situationCode`. That is correct now that they count.
- A teammate-blocked attempt at a pulled-goalie code is now flagged `pulledGoalie` and goes to Other. A new test pins this (D-21).
- Direction is sound. The new test checks that `eventOwnerTeamId` is the shooter's side for every teammate-blocked play in all fixtures. The delta test shows CF/CA move and SF/GF/SA/GA do not.
- Fixture 2026020092 is used correctly. It is in `ALL_FIXTURES`, so it runs the generic accounting and non-negative-Other loops. It is deliberately not in `GATE_FIXTURES`, and the test comment says so.

**Plan 03-13 (UI): no defect found.**
- `PendingLink` destructures `overlaySpinner`, so the prop never reaches `<Link>` or the DOM.
- The default markup is pinned byte-for-byte by a test.
- The spinner's `-translate-y-1/2` and `animate-spin` compose under Tailwind 4, because translate and rotate are separate properties. In v3 they would clash.
- The absolutely positioned spinner stays inside the `overflow-x-auto` wrapper's row, so nothing is clipped.

The two open Warnings from the first pass are unchanged by this diff (WR-01 and WR-02 below). One Info item was updated (IN-01) and one was added (IN-04).

## Warnings

### WR-01: Malformed play-by-play JSON throws outside the D-05 catch and drops the whole game (still open)

**File:** `lib/research/events.ts:199-201`, `lib/research/play-events.ts:30-46`, `lib/research/team-games.ts:182`
**Issue:** `loadGame` guards only the play-by-play fetch (`getPlayByPlay(...).catch`). The mapping runs afterwards, unguarded, in `buildGameEvents(...)`. The file header and D-05 promise that play-by-play problems never fail the game, and `play-events.ts` is documented as "tolerant ... never thrown on". Three places break that promise on malformed input:
- `buildGameEvents` evaluates `pbp.plays.length`, which throws a TypeError when `plays` is undefined. `getPlayByPlay` itself writes `pbp.plays?.length` and returns the object anyway.
- `toGameEvents` reads `pbp.homeTeam.id` and `pbp.awayTeam.id` unguarded.
- `toGameEvents` reads `play.periodDescriptor.periodType` and `.number` unguarded for every shot-like play. One play without a `periodDescriptor` throws.

A throw rejects `loadGame`, so `mapPaced` records that game as unavailable. The game loses its TOI, lines and linemates, even though only play-by-play was bad. If every game in the window is affected, `loadTeamResearch` throws and the page shows the load-failed state.

**Fix:** Make the mapping total, or contain it in `loadGame`. For example:
```ts
// team-games.ts, loadGame
let events: GameEvents | null = null;
try {
  events = buildGameEvents(team, shiftInputs, positions, pbp);
} catch (err) {
  console.error(`Mapping play-by-play for game ${gameId} (${team}) failed`, err);
}
```
Also use `pbp?.plays?.length` in `buildGameEvents` and `play.periodDescriptor?.periodType` in `toGameEvents` (skip the play when `periodDescriptor` is missing), so the "skipped, never thrown on" comment is true.

### WR-02: Attributed-nowhere events are silently dropped, but the legend says Total is the team's total (still open)

**File:** `lib/research/events.ts:98-103`, `lib/research/unit-events-view.ts:126`
**Issue:** An included event whose second has no shift data for the team (including an event at 00:00) increments `result.unattributed` and is skipped. Nothing reads `unattributed`. A grep shows it is only written, and the tests that read it are the accounting tests. These events are in no table, including Total. The legend still states "Total is the team's total, so the listed lines plus Other equal Total."

A small number of lost events (for example 1-2 goals around a chart gap) will not trip `matchIsLow`, which needs 5% or more disagreement. In that case GF, GA, SF and CF are understated with no warning. This contradicts the phase's "unknown, never zeros" rule. Plan 03-12 makes it slightly more visible, because more event types now count and each can be lost this way.

**Fix:** Either surface it or stop counting it as silently lost. A minimal version adds a note in `topNotes` when `events.unattributed > 0` (for example "N events fell in seconds with no shift data and are not counted."). Or credit those events to the situation total from `event.situationCode`, so that Total stays complete.

## Info

### IN-01: `NhlPlay.details` declares fields no production code reads (updated by plan 03-12)

**File:** `lib/nhl/client.ts:150-162`
**Issue:** The doc comment says the interface "holds only the fields event attribution reads". Before plan 03-12, `reason` was read by `toGameEvents`. It is now unread in `app/`, `lib/` and `components/`. Only tests read it, as a filter for teammate-blocked plays. `shootingPlayerId`, `scoringPlayerId` and `goalieInNetId` were already unread by production code (the tests read `shootingPlayerId`). The comment and the type disagree on four of the five `details` fields.
**Fix:** Delete the unused fields, or reword the comment ("fields attribution and its regression tests read"). Keep `reason` and `shootingPlayerId` if the tests are meant to type-check against them.

### IN-02: A play-by-play or shift chart that comes back empty makes a fourth request per game, beyond the rate budget the pacing was tuned for

**File:** `lib/nhl/client.ts:178-182`, `lib/research/team-games.ts:25-29`
**Issue:** `GAME_START_GAP_MS` is justified as "3 requests per game". Every unpublished play-by-play (and every empty shift chart) is re-requested uncached, which makes 4 requests per game. A window of recent unpublished games exceeds the measured rate that avoided 429s. A 429 on that retry is not retried, because the retry goes through `nhlGet`. A shift chart 429 is never retried at all, because `fetchShiftCharts` bypasses `nhlGet`, so it gets none of the new Retry-After handling.
**Fix:** Route `fetchShiftCharts` through the same retry helper, or document that it is deliberately excluded. Consider counting the uncached retry in the pacing budget.

### IN-03: Redundant class and non-drained response on the non-OK path

**File:** `components/LastGameLines.tsx:92`, `lib/nhl/client.ts:19-24`
**Issue:**
- The older-dates `<p>` repeats `text-xs`, which its parent `div` already sets.
- In `nhlGet`, a 429 or other non-OK response's body is never consumed before the retry or throw, which can hold the connection until it is garbage collected.

**Fix:** Drop the duplicate class. Call `await res.arrayBuffer().catch(() => {})` or `res.body?.cancel()` before retrying or throwing.

### IN-04: The unit-name separator now has no whitespace, so names copy as "A–B–C" and wrapping is left to atomic-inline rules

**File:** `components/LastGameLines.tsx:178-184`
**Issue:** Plan 03-13 replaced `<span aria-hidden> – </span>` with `<span aria-hidden className="mx-1">–</span>`. Nothing between the `inline-flex` links and the separator is a text space any more. Visually this is the intended centered dash. Two side effects follow:
- Copying a unit's names out of the table gives "Suzuki–Caufield–Slafkovský" with no spaces.
- The only line-break opportunities in a long unit are the edges of the atomic inline links. A narrow viewport could leave a dash at the start or end of a line.

Neither is a correctness bug, and the site targets laptop widths.
**Fix:** If wrapping ever shows, keep the margin and wrap each `separator + PlayerLink` pair in `whitespace-nowrap`. Otherwise no action.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
