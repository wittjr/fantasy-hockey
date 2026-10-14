---
phase: 03-unit-event-stats
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - components/LastGameLines.tsx
  - lib/nhl/client.test.ts
  - lib/nhl/client.ts
  - lib/research/events.test.ts
  - lib/research/events.ts
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
  info: 3
  total: 5
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

I reviewed the phase diff (c247f98..HEAD) for the unit event stats work. The full research and NHL test suites pass: 480 tests, 0 failures.

I checked the core attribution logic and found no correctness bug in it:
- The [t-1, t) on-ice second lookup is right.
- The `situationCode` field order is read correctly.
- The unit-key sharing between seconds and events is consistent.
- Other is always a subset subtraction (total minus listed), so it can never go negative.
- Event direction is right. I cross-checked `eventOwnerTeamId` against the shooter's side for all blocked shots in the 8 committed fixtures: 0 mismatches.
- `LastGameLines` is only rendered when `research.games.length > 0`, so `game` is never undefined.

The weaknesses are in untrusted-JSON tolerance and in silent loss of data from the tables.

The already-reported `mapPaced` start-gap design issue is not re-reported.

## Warnings

### WR-01: Malformed play-by-play JSON throws outside the D-05 catch and drops the whole game

**File:** `lib/research/events.ts:199-201`, `lib/research/play-events.ts:30-52`, `lib/research/team-games.ts:182`
**Issue:** `loadGame` guards only the play-by-play fetch (`getPlayByPlay(...).catch`). The mapping runs afterwards, unguarded, in `buildGameEvents(...)`. The file header and D-05 promise that play-by-play problems never fail the game, and that mapping is "tolerant ... never thrown on". Three places break that promise on malformed input:
- `getPlayByPlay` itself writes `pbp.plays?.length`, which expects `plays` to be missing. It then returns that same object on the second request. `buildGameEvents` then evaluates `pbp.plays.length`, which throws a TypeError when `plays` is undefined.
- `toGameEvents` reads `pbp.homeTeam.id` and `pbp.awayTeam.id` unguarded.
- `toGameEvents` reads `play.periodDescriptor.periodType` and `.number` unguarded, for every shot-like play, so one play without a `periodDescriptor` throws.

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

### WR-02: Attributed-nowhere events are silently dropped, but the legend says Total is the team's total

**File:** `lib/research/events.ts:98-103`, `lib/research/unit-events-view.ts:127`
**Issue:** An included event whose second has no shift data for the team (including an event at 00:00) increments `result.unattributed` and is skipped. Nothing reads `unattributed`. A grep shows it is only written. These events are in no table, including Total. The legend still states "Total is the team's total, so the listed lines plus Other equal Total."

A small number of lost events (for example 1-2 goals around a chart gap) will not trip `matchIsLow`, which needs 5% or more disagreement. In that case GF, GA, SF and CF are understated with no warning. This contradicts the phase's "unknown, never zeros" rule.

**Fix:** Either surface it or stop counting it as silently lost. A minimal version adds a note in `topNotes` when `events.unattributed > 0` (for example "N events fell in seconds with no shift data and are not counted."). Or credit those events to the situation total from `event.situationCode`, so that Total stays complete.

## Info

### IN-01: `NhlPlay.details` declares fields nothing reads

**File:** `lib/nhl/client.ts:156-162`
**Issue:** The doc comment says the interface "holds only the fields event attribution reads". `shootingPlayerId`, `scoringPlayerId` and `goalieInNetId` are never read in `lib/` (only `eventOwnerTeamId` and `reason` are). The comment and the type disagree.
**Fix:** Delete the three unused fields, or reword the comment.

### IN-02: A play-by-play or shift chart that comes back empty makes a fourth request per game, beyond the rate budget the pacing was tuned for

**File:** `lib/nhl/client.ts:178-182`, `lib/research/team-games.ts:25-29`
**Issue:** `GAME_START_GAP_MS` is justified as "3 requests per game". Every unpublished play-by-play (and every empty shift chart) is re-requested uncached, which makes 4 requests per game. A window of recent unpublished games exceeds the measured rate that avoided 429s. A 429 on that retry is not retried, because the retry goes through `nhlGet`. A shift chart 429 is never retried at all, because `fetchShiftCharts` bypasses `nhlGet`, so it gets none of the new Retry-After handling.
**Fix:** Route `fetchShiftCharts` through the same retry helper, or document that it is deliberately excluded. Consider counting the uncached retry in the pacing budget.

### IN-03: Redundant class and non-drained response on the non-OK path

**File:** `components/LastGameLines.tsx:93`, `lib/nhl/client.ts:19-24`
**Issue:**
- The older-dates `<p>` repeats `text-xs`, which its parent `div` already sets.
- In `nhlGet`, a 429 or other non-OK response's body is never consumed before the retry or throw, which can hold the connection until it is garbage collected.

**Fix:** Drop the duplicate class. Call `await res.arrayBuffer().catch(() => {})` or `res.body?.cancel()` before retrying or throwing.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
