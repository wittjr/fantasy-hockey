---
phase: 01-ice-time-trends-table
verified: 2026-10-11T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/01-ice-time-trends-table/01-01-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-01-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-02-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-02-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-03-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-03-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-04-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-04-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-05-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-05-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-06-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-06-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-07-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-07-SUMMARY.md
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.ts
  - lib/research/format.ts
  - lib/research/game-strip.ts
  - lib/research/lines.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends.ts
covered_digest: "v3:sha256:7c64cfad8775a8bb46dcae3ec086b2acbbdd16d13b414c4fd3698e5e85c6b29e"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "The PP share, PP share Δ, SH and mover tint the table shows are correct for games that have a shift chart (CR-01)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-05: a failed shift-chart request is worded as 'the NHL hasn't published shift charts'; for an OT/SO game the affected game drops out of Avg TOI/Δ"
    category: other
    reason: "Degraded-path copy is inaccurate for a transient upstream failure. Data shown is never wrong (the game is excluded or shown as no-PP/SH), and the cause is logged server-side. Does not stop a user seeing who is gaining or losing time on the normal path."
    evidence_status: "reasoned from code (team-games.ts:73-80, ToiTrends.tsx:153-157); not exercised"
  - finding: "WR-06: when the newest game fails to load, 'Last game' and the 'last 2 games' Δ re-anchor to the newest loaded games"
    category: other
    reason: "Partially disclosed: the amber banner names the missing date and says those games are left out of the window. The recency columns do not say they shifted. Needs a failed boxscore on the newest game to trigger."
    evidence_status: "reasoned from code (team-games.ts:133-146, page.tsx:116-123); not exercised"
human_verification:
  - test: "Signed in, open /research?team=MTL&games=5 and then games=20. Check the table reads as a trends table at a glance: columns Player, Pos (n/N GP), Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend; forwards block above defense block; no per-game numeric grid"
    expected: "Layout matches the UI-SPEC and reads as scannable; Last 20 scrolls horizontally rather than wrapping"
    why_human: "/research is Discord-auth-gated; only static-markup tests could be run"
  - test: "Hover and keyboard-Tab through strip squares on the first forward row, the last forward row, the last defense row and with Last 20, including an OT game with no shift chart (the largest popover)"
    expected: "The popover opens under the hovered square, is fully visible and not clipped by the overflow-x-auto wrapper (pb-28 -mb-24 reserve, review IN-05)"
    why_human: "WR-01 anchoring is fixed in code (relative square, right-0 top-full) but clipping and placement are CSS-layout outcomes with no browser check; plan 02 backstop truth"
  - test: "Tap a strip square on iOS Safari and Android Chrome"
    expected: "Popover shows (plan 02 backstop truth; if not, add a minimal client wrapper)"
    why_human: "Touch behaviour of a CSS-only :focus/:hover popover cannot be asserted from markup"
  - test: "Click each of Avg TOI, TOI Δ, PP share, PP share Δ headers, reload, then switch team and window"
    expected: "Sort arrow and order follow the click, survive reload, F block stays above D block, sort carries across team/window links, spinner shows while pending without layout shift"
    why_human: "Navigation, pending state and scroll preservation need a real browser"
  - test: "Look at a team with an OT/SO game and a game with no shift chart in the window"
    expected: "Sky ring on the square, OT tag and 'OT excluded +m:ss' in the popover, hollow sky dot on the sparkline, amber footnote naming the no-shift-chart dates"
    why_human: "Visual distinguishability of ring, dashed and dot styles is a judgment"
---

# Phase 1: Ice-Time Trends Table Verification Report

**Phase Goal:** User can scan a team's ice-time section as a trends table and immediately see which players are gaining or losing TOI and power-play time
**Verified:** 2026-10-11
**Status:** human_needed
**Re-verification:** Yes, after gap closure (plans 01-05, 01-06, 01-07)

## Goal Achievement

The one blocking gap from the first verification (CR-01, duplicate shift rows corrupting PP/SH) is closed in code and on live NHL data. All six truths are verified, no regressions were found, and the full suite, type check and scoped lint are clean. The status is `human_needed` rather than `passed` only because the phase's visual and touch behaviours (popover placement and clipping, tap on mobile, sort interaction in a browser, OT visuals) sit behind Discord auth and have never been seen in a browser. Open review findings WR-05, WR-06 and IN-01..IN-06 do not block the goal (assessed below).

### Prior Gap Closure

| Prior gap / finding | Status now | Evidence |
| ------------------- | ---------- | -------- |
| CR-01: `analyzeGameLines` double-counts verbatim-repeated shift rows | CLOSED | `lib/research/lines.ts:22-30` exports `uniqueShifts`; both `regulationSeconds` (l.38) and `analyzeGameLines` (l.92) iterate `uniqueShifts(shifts)`. Dedupe key includes team. `lines.test.ts` adds tests for analyzeGameLines duplicate rows, a duplicated skater not turning EV into PP, `uniqueShifts` ordering and exactness, and no player's PP/SH exceeding the team's. Live check (below) |
| Missing regression test for dedupe in `analyzeGameLines` | CLOSED | `lines.test.ts:130-171` |
| WR-01 popover anchored to td | CLOSED in code | `ToiGameStrip.tsx`: td no longer positioned, each square `relative`, popover `absolute right-0 top-full`. Placement unproven in a browser (human item 2) |
| WR-02 empty shift chart pinned for an hour | CLOSED | `client.ts:149-152` re-requests an empty first result with `cache: "no-store"`; tests in `client.test.ts` |
| WR-03 one failed game blanks the page, raw error shown | CLOSED | `team-games.ts:133-150` `Promise.allSettled`, `unavailableDates`, throw only when no game loads; `page.tsx` shows fixed copy plus an amber banner naming dates; error text logged, not rendered |
| WR-04 comment/behaviour mismatch, silent dashes at 2 games | CLOSED | 2-game legend in `ToiTrends.tsx` (MIN_GAMES_FOR_DELTA branch), PP share title corrected; view tests |

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: one row per player with Avg TOI, PP share, SH, trend arrow and sparkline, grouped F then D, per-game numeric grid gone (TRND-01) | VERIFIED | `ToiTrends.tsx` header row: Player, Pos, Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend; `buildTrendRows` skips goalies, F before D; `page.tsx` renders `<ToiTrends>`; no regression in `toi-trends-view.test.ts` |
| 2 | SC2: exact per-game TOI/PP/SH readable without the grid; OT games visibly flagged (TRND-02, TRND-04 OT) | VERIFIED (visual behaviour needs human) | `ToiGameStrip.tsx`: aria-label and popover share one `gameDetail`; ring for OT/SO, dashed styles for DNP/excluded. Anchoring fix confirmed in code. Clipping/touch unproven, see Human Verification |
| 3 | SC3: recent-vs-window Δ for TOI and PP share on each row (TRND-03) | VERIFIED | `toiDelta`/`ppShareDelta` in `toi-trends.ts` rendered as signed values; boundary tests pass. PP inputs now correct (CR-01 closed) |
| 4 | SC4: below-minimum players show no trend with GP visible; missed games never 0; OT flagged (TRND-04) | VERIFIED | Δ gated at 3 included games, arrow at 2; null per-game for missed games; unit and view tests pass |
| 5 | SC5: sort by trend (TOI Δ), Avg TOI or PP share, in the URL, F/D grouping kept (TRND-05) | VERIFIED | `parseSort` allowlist, `sortRows`, `researchHref`, `PendingLink` headers with `scroll={false}`; 1-game fallback tested |
| 6 | Derived: PP share / PP share Δ / SH / tint values are correct for games with a shift chart | VERIFIED (was FAILED) | Live NHL game 2026020075 (the prior reproduction): 756 raw rows, 753 unique; `analyzeGameLines("MTL", …)` now returns team situationSeconds ev 2966 / pp 480 / sh 454, matching the prior verifier's de-duplicated figures (480 / 454, not 549 / 395), and no skater's PP or SH exceeds the team's |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

Prohibitions: unknown/missed games never 0 and no Δ or tint below the minimum games remain enforced and tested. Plan 02's judgment-tier prohibition (OT never shown undisclosed) is satisfied in code (strip ring, popover tag, sparkline dot, legend); a human should still confirm it reads clearly (flagged, non-authoritative LLM-judge verdict).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/research/lines.ts` | `uniqueShifts`, `regulationSeconds`, `analyzeGameLines` | VERIFIED | Dedupe shared by both consumers |
| `lib/research/toi-trends.ts` | row builder, Δ, movers, sort | VERIFIED | Imported by `ToiTrends` and `page.tsx` |
| `components/ToiTrends.tsx` | table section | VERIFIED | Rendered by page |
| `components/ToiGameStrip.tsx`, `lib/research/game-strip.ts` | strip + detail | VERIFIED | Wired; placement unproven in browser |
| `lib/research/team-games.ts` | loader with failure isolation, overtime, regulationToi | VERIFIED | `allSettled`, `unavailableDates` |
| `lib/nhl/client.ts` | shift chart fetch with empty refetch | VERIFIED | `getShiftCharts` |
| `lib/research/format.ts` | formatters | VERIFIED | Used by table and strip |
| `app/research/page.tsx` | sort params, auth gate, error copy | VERIFIED | Auth gate unchanged |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| team-games.ts | lines.ts | `regulationSeconds`, `analyzeGameLines` over the same shift inputs | WIRED |
| lines.ts | lines.ts | `uniqueShifts` used by both consumers | WIRED |
| team-games.ts | client.ts | `getShiftCharts` with per-game `.catch`, `box.gameOutcome` | WIRED |
| ToiTrends | toi-trends.ts | `buildTrendRows`, `sortRows`, `effectiveSort` | WIRED |
| ToiTrends | ToiGameStrip | per-row `<ToiGameStrip>` | WIRED |
| page.tsx | team-games.ts | `unavailableDates` banner, `loadFailed` branch | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| ToiTrends Avg TOI | `row.avgToi` | boxscore TOI / de-duplicated shift seconds | Yes | FLOWING |
| ToiTrends PP share, SH, PP Δ | `row.ppShare`, `shAvg`, `ppShareDelta` | `analyzeGameLines(uniqueShifts(...))` | Yes, correct on the previously failing game | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm test` | 178 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Lint on phase files | `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx` | exit 0, no output | PASS |
| analyzeGameLines on live game 2026020075 (scratch tsx script, not committed) | fetch boxscore + shiftcharts, run `analyzeGameLines` | ev 2966 / pp 480 / sh 454; 756 rows to 753 unique; 0 skaters exceed team PP/SH | PASS |

### Probe Execution

Step 7c: SKIPPED (no probes declared or present).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRND-01 | 01-01 | Trends table, primary columns, grid removed | SATISFIED | truth 1, 6 |
| TRND-02 | 01-02 | Exact per-game TOI/PP/SH reachable | SATISFIED (popover placement needs human) | truth 2 |
| TRND-03 | 01-03 | Recent-vs-window delta for TOI and PP share | SATISFIED | truth 3, 6 |
| TRND-04 | 01-01, 01-02, 01-03 | Min games, missed not 0, OT flagged | SATISFIED | truth 4 |
| TRND-05 | 01-04 | Sort by trend/Avg TOI/PP share, URL, F/D kept | SATISFIED | truth 5 |

All five IDs (TRND-01 to 05) are declared in PLAN frontmatter, defined in REQUIREMENTS.md and mapped to Phase 1; no orphaned Phase 1 requirements. REQUIREMENTS.md currently shows TRND-02, 03 and 05 as "Gaps Found" (reverted after the first verification); that table is now stale and should be updated once the human checks pass. This verifier did not edit it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `lib/research/team-games.ts` | 73-80 | failed shift chart treated as unpublished (WR-05) | Warning | Inaccurate footer copy on a transient failure; data never wrong; OT/SO game excluded from averages in that case |
| `lib/research/team-games.ts` | 133-146 | failed newest game silently re-anchors Last game / Δ (WR-06) | Warning | Banner names the date; recency columns not labelled |
| `components/ToiTrends.tsx` | 56 | `pb-28 -mb-24` fixed popover reserve (IN-05) | Info | Worst-case last-row popover may clip; browser check |
| `team-games.ts:92`, `page.tsx:134`, `game-strip.ts:38`, `client.ts:140`, `ToiTrends.tsx:50`, `page.tsx:97` | n/a | IN-01..IN-04, IN-06 | Info | Edge-case hygiene and copy drift; none changes goal behaviour |

No TBD, FIXME, XXX markers in phase source files.

Weighing the open findings against the goal: WR-05 and WR-06 only trigger when the upstream NHL API fails for a request, both are fail-visible at some level (server log, amber banner) and neither can make a shown number wrong for a game that loaded. The goal's normal path (scan the table, see who is gaining or losing TOI and PP time) is unaffected. They are advisory and worth fixing before relying on Δ during an NHL API outage; they are not gaps. IN-01..IN-06 are info. IN-05 is carried into the popover human check.

### Human Verification Required

See the `human_verification` list in the frontmatter (5 items). None has been run; `/research` is Discord-auth-gated. These cover popover placement and clipping (including the IN-05 worst case), touch tap, sort interaction, OT/no-chart visuals and overall scannability.

### Gaps Summary

No gaps. The prior blocking gap is closed and verified against live data, regressions were checked and none found. Remaining work is human visual/interaction verification, plus optional follow-up on WR-05 and WR-06.

---

_Verified: 2026-10-11_
_Verifier: Claude (gsd-verifier)_
