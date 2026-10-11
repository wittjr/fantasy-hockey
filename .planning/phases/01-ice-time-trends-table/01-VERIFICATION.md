---
phase: 01-ice-time-trends-table
verified: 2026-10-11T00:00:00Z
status: gaps_found
score: 5/6 must-haves verified
covered_files:
  - .planning/phases/01-ice-time-trends-table/01-01-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-01-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-02-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-02-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-03-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-03-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-04-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-04-SUMMARY.md
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.ts
  - lib/research/format.ts
  - lib/research/game-strip.ts
  - lib/research/lines.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends.ts
covered_digest: "v3:sha256:9faecd135b5fd2784d017f4fe403c2a39f2a21724e6313635fcdff544222dd79"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
gaps:
  - truth: "The PP share, PP share Δ, SH and mover tint the table shows are correct for games that have a shift chart"
    status: failed
    reason: "analyzeGameLines (lib/research/lines.ts:77-91) does not de-duplicate verbatim-repeated shift rows. regulationSeconds does, so TOI is right while PP/SH (and the team PP total that is PP share's denominator) are wrong in every affected game. Confirmed against live NHL data: game 2026020075 (MTL v DET) has 3 duplicate rows and gives team PP 549s / SH 395s raw vs 480s / 454s de-duplicated; one MTL skater shows 63s PP raw vs 1s real, another 38s vs 0s, another 455s vs 387s; 11 MTL and 12 DET skaters have wrong PP/SH. Sampling 8 teams' games also turned up duplicate rows in at least 3 other games (2026020048, 2026020067, 2026020050), so this is not rare."
    artifacts:
      - path: "lib/research/lines.ts"
        issue: "analyzeGameLines pushes the same playerId into onIce.skaters once per duplicate row, inflating the skater count (mis-classifies strength EV/PP/SH) and double-counting playerSeconds"
      - path: "lib/research/lines.test.ts"
        issue: "de-duplication is covered only for regulationSeconds, not analyzeGameLines"
    missing:
      - "Skip a repeated (playerId, period, startSec, endSec) row at the top of the shift loop in analyzeGameLines (same key regulationSeconds uses), or de-duplicate once in loadGame before both consumers"
      - "Regression test in lines.test.ts: a verbatim duplicate shift row leaves situationSeconds and playerSeconds unchanged"
      - "Update 01-REVIEW-DISPOSITION.md CR-01 and deferred-items.md when fixed"
human_verification:
  - test: "Signed in, open /research?team=MTL&games=5 and then games=20. Check the table reads as a trends table at a glance: columns Player, Pos (n/N GP), Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend; forwards block above defense block; no per-game numeric grid"
    expected: "Layout matches the UI-SPEC and reads as scannable; Last 20 scrolls horizontally rather than wrapping"
    why_human: "/research is Discord-auth-gated; only static-markup tests could be run"
  - test: "Hover and keyboard-Tab through strip squares on the first forward row, the last forward row, the last defense row and with Last 20"
    expected: "The popover is fully visible, not clipped by the overflow-x-auto wrapper, and appears near the hovered square"
    why_human: "Plan 02 backstop truth. Code review WR-01: the popover is positioned against the td (the cell span has no `relative`), so every popover opens at the left edge of the strip rather than under the hovered square. The pb-28 -mb-24 clearance hack is unproven"
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
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

The structure of the goal is delivered: a sortable trends table with deltas, arrows, strip, OT flagging and URL sort, covered by passing tests. One input to the "gaining or losing power-play time" half is wrong on real data: PP share, SH and the mover tint are computed from `analyzeGameLines`, which double-counts repeated shift rows (code-review CR-01). I reproduced this against live NHL data and it is not hypothetical, so I am treating it as a gap rather than a warning.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: one row per player with Avg TOI, PP share, SH, trend arrow and sparkline, grouped F then D, per-game numeric grid gone (TRND-01) | VERIFIED | `components/ToiTrends.tsx` renders the columns (arrow lives after each Δ per D-20); `buildTrendRows` skips goalies and orders F before D; no per-game text columns remain; `page.tsx` renders `<ToiTrends>`; view tests "renders headers in order, forwards before defense, no goalies" pass |
| 2 | SC2: exact per-game TOI/PP/SH readable without the grid; OT games visibly flagged (TRND-02, TRND-04 OT) | VERIFIED (visual behaviour needs human) | `ToiGameStrip.tsx` + `game-strip.ts`: aria-label and popover from one `GameDetail`; OT ring, OT/SO tag, "OT excluded +m:ss", hollow sparkline dot; tests pass. Popover placement and clipping are unproven (WR-01), see Human Verification |
| 3 | SC3: recent-vs-window Δ for TOI and PP share on each row (TRND-03) | VERIFIED | `recentDelta`, `buildTrendRows` compute `toiDelta` / `ppShareDelta` (team-PP-weighted); `DeltaCell` renders signed values; boundary tests (3 vs 2 games, 120 s, 15 pts) pass. Δ inherits the CR-01 error for PP (see truth 6) |
| 4 | SC4: below-minimum players show no trend with GP visible; missed games never 0; OT flagged (TRND-04) | VERIFIED | Δ gated at 3 included games, arrow at 2 (D-06), `perGame` is null for missed games, unknowns render "—"; "n/N GP" in Pos cell; 1-game window hides Δ/arrow/sparkline/tint; unit and view tests pass |
| 5 | SC5: sort by trend (TOI Δ), Avg TOI or PP share, in the URL, F/D grouping kept (TRND-05) | VERIFIED | `parseSort` allowlist, `sortRows` (F before D, nulls last, deterministic tiebreak), `researchHref` carries sort across team/window links, `page.tsx` calls `parseSort(sortParam, dirParam)`; headers are `PendingLink` with `scroll={false}` and `aria-sort`; 1-game fallback tested. "Trend" is implemented as TOI Δ and PP share Δ per D-17 |
| 6 | Derived from the goal: the PP share / PP share Δ / SH / tint values shown are correct for games with a shift chart | FAILED | CR-01 reproduced with live data, see gap above |

**Score:** 5/6 truths verified (0 present, behavior-unverified)

Prohibitions (plan 01, plan 03: unknown/missed games never 0, no Δ or tint below the minimum games) are enforced and tested, status VERIFIED. Plan 02's judgment-tier prohibition (OT never shown undisclosed) is satisfied in code (flagged in strip, popover, sparkline, legend); a human should still confirm it reads clearly (flagged, non-authoritative LLM-judge verdict).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/research/toi-trends.ts` | row builder, Δ, movers, sort | VERIFIED | Substantive, imported by `ToiTrends` and `page.tsx`, data flows from `buildTrendRows` |
| `components/ToiTrends.tsx` | table section | VERIFIED | Rendered by page, wired to rows |
| `components/ToiGameStrip.tsx`, `lib/research/game-strip.ts` | strip + detail | VERIFIED | Wired; popover placement unproven |
| `lib/research/lines.ts` | `regulationSeconds`, `analyzeGameLines` | PARTIAL | `regulationSeconds` correct; `analyzeGameLines` has the duplicate-row defect |
| `lib/research/team-games.ts` | loader fills overtime, regulationToi | VERIFIED | Reads `gameOutcome.lastPeriodType`, regulation via shifts for OT/SO |
| `lib/research/format.ts` | formatters incl. signed | VERIFIED | Used by table and strip |
| `app/research/page.tsx` | sort params, auth gate kept | VERIFIED | Auth redirect unchanged, params validated |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| team-games.ts | lines.ts | `regulationSeconds(team, shiftInputs)` | WIRED |
| team-games.ts | client.ts | `box.gameOutcome?.lastPeriodType` | WIRED |
| ToiTrends | toi-trends.ts | `buildTrendRows`, `sortRows`, `deltaCrossing` | WIRED |
| ToiTrends | ToiGameStrip | per-row `<ToiGameStrip>` | WIRED |
| page.tsx | toi-trends.ts | `parseSort`, `researchHref` | WIRED |
| ToiTrends | PendingLink | `SortHeader` with `scroll={false}` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| ToiTrends Avg TOI | `row.avgToi` | boxscore TOI / de-duplicated shift seconds | Yes | FLOWING |
| ToiTrends PP share, SH, PP Δ | `row.ppShare`, `shAvg`, `ppShareDelta` | `analyzeGameLines` over raw shifts | Yes, but wrong for games with duplicate shift rows | FLOWING, INCORRECT (CR-01) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm test` | 154 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Lint on phase files | `npx eslint components lib/research app/research` | no output | PASS |
| analyzeGameLines on live game 2026020075 vs de-duplicated shifts | scratch tsx script (not committed) | PP/SH differ for 11 MTL and 12 DET skaters; team PP 549 vs 480 | FAIL |
| Same on 4 other MTL games without duplicate rows | same script | identical | PASS |

### Probe Execution

Step 7c: SKIPPED (no probes declared or present).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRND-01 | 01-01 | Trends table, primary columns, grid removed | SATISFIED (PP share values affected by CR-01) | truth 1 |
| TRND-02 | 01-02 | Exact per-game TOI/PP/SH reachable | SATISFIED (popover placement needs human) | truth 2 |
| TRND-03 | 01-03 | Recent-vs-window delta for TOI and PP share | SATISFIED for TOI; PP share Δ inherits CR-01 | truth 3 |
| TRND-04 | 01-01, 01-02, 01-03 | Min games, missed not 0, OT flagged | SATISFIED | truth 4 |
| TRND-05 | 01-04 | Sort by trend/Avg TOI/PP share, URL, F/D kept | SATISFIED | truth 5 |

All five IDs in PLAN frontmatter (TRND-01 to 05) appear in REQUIREMENTS.md and are mapped to Phase 1; no orphaned Phase 1 requirements. REQUIREMENTS.md marks all five Complete, which is premature while the PP-correctness gap is open.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `lib/research/lines.ts` | 77-91 | duplicate shift rows not de-duplicated | BLOCKER | Wrong PP share / SH / tint (CR-01) |
| `components/ToiGameStrip.tsx` | 7, 27, 37 | popover anchored to td, not cell | Warning | WR-01, popover far from hovered square |
| `lib/nhl/client.ts` | 116-145 | empty shift chart cached 1h | Warning | WR-02, shows "no PP/SH data" up to an hour after a game (disclosed, not wrong) |
| `lib/research/team-games.ts` | 71, 123 | one failed fetch blanks the page, raw error shown | Warning | WR-03, pre-existing |
| `lib/research/toi-trends.ts` | 47-56 | `toiDelta`/`ppShare` comments contradict implementation | Warning | WR-04, documentation only; code matches D-05/D-06 |
| various | n/a | IN-01 to IN-04 | Info | See 01-REVIEW.md |

No TBD, FIXME, XXX, TODO or placeholder markers in phase files. All nine review findings remain `open` in 01-REVIEW-DISPOSITION.md; none was fixed.

### Human Verification Required

See the `human_verification` list in the frontmatter (5 items: signed-in layout, popover clipping and placement, touch tap, sort interaction, OT/missing-chart visuals). None was run; /research is auth-gated. They do not change the status, which is already gaps_found, but they must be done after the gap is closed.

### Gaps Summary

One gap, with a small and well-understood fix. The PP-time half of the phase goal ("gaining or losing power-play time") reads from `analyzeGameLines`, which counts a repeated shift row twice. The NHL feed does repeat rows (confirmed in several current-season games), and in an affected game a player's PP seconds can be off by a minute or more and the team PP denominator by over a minute, which feeds PP share, PP share Δ, the mover tint and the SH column. The fix is the one the summary and `deferred-items.md` already describe: skip repeated (playerId, period, startSec, endSec) rows in `analyzeGameLines` (or once in `loadGame`) and add a regression test. Nothing in the phase scope is otherwise missing. This gap is not deferred: Phase 3 does not list shift-chart de-duplication in its goal or success criteria.

---

_Verified: 2026-10-11_
_Verifier: Claude (gsd-verifier)_
