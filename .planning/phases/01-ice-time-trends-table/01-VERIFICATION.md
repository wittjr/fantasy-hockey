---
phase: 01-ice-time-trends-table
verified: 2026-10-12T20:00:00Z
status: passed
score: 9/9 must-haves verified
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
  - .planning/phases/01-ice-time-trends-table/01-08-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-08-SUMMARY.md
  - .planning/phases/01-ice-time-trends-table/01-09-PLAN.md
  - .planning/phases/01-ice-time-trends-table/01-09-SUMMARY.md
  - app/research/page.tsx
  - components/ToiGameStrip.tsx
  - components/ToiStripCell.tsx
  - components/ToiTrends.tsx
  - lib/nhl/client.ts
  - lib/research/format.ts
  - lib/research/game-strip.ts
  - lib/research/lines.ts
  - lib/research/team-games.test.ts
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.ts
covered_digest: "v3:sha256:1febebb28ef93621287b2c4b896924af339d4e4b266040400e6d86cdf7c23cf7"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 9/9
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-10: aria-expanded / data-open track only click and keyboard-toggle state, while hover and :focus-visible also show the popover. After Tab, the popover is already visible with aria-expanded=false, so Enter/Space look like no-ops. Escape always blurs (drops tab position) and cannot dismiss a hover popover."
    category: other
    reason: "Accessibility polish on the secondary drill-down. Every per-game value stays reachable by click, hover and Tab focus, and the aria-label carries the full detail. No shown number is wrong. Enter/Space/Escape were added by review fix WR-07 and are not a plan or roadmap must-have, so the new behaviour is not a verification gate. Fix when convenient (open on keyboard focus, derive aria-expanded from the visibility condition, drop blur() on Escape)."
    evidence_status: "code read (ToiStripCell.tsx, ToiGameStrip.tsx:41); keyboard toggle is exercised only by the nextOpen truth-table tests, not in a browser"
  - finding: "IN-13: aria-expanded on a control whose popover is aria-hidden; IN-12: key repeat and Ctrl/Alt/Meta+Enter still toggle; nextOpen exported from a use-client file"
    category: other
    reason: "Noise / hygiene around WR-10. No breakage today (only the test imports nextOpen)."
    evidence_status: "code read; review 01-REVIEW.md"
  - finding: "IN-11: newestMissing does not cover a failed second-newest game; no test for the OT-with-empty-chart branch or the WR-06 clause"
    category: other
    reason: "The WR-06 note is a disclosure aid on an upstream-failure path. When the second-newest game fails, the amber banner still names the missing date, so the omission is disclosed, just without the re-anchoring sentence."
    evidence_status: "code read (page.tsx:51-54, team-games.ts:98-109)"
  - finding: "Residual copy drift: the strip popover note still says 'No PP/SH data (shift chart not published)' (game-strip.ts) while the legend and Last-game copy now say 'not published yet, or it failed to load' (WR-05)"
    category: other
    reason: "Cosmetic wording on a degraded path; the value shown is a dash, never a wrong number."
    evidence_status: "code read (game-strip.ts:51, ToiTrends.tsx:157)"
  - finding: "WR-08 (partly open): outside-pointerdown listener and blur wiring of ToiStripCell have no unit test (no DOM test library)"
    category: other
    reason: "Behaviour is proven by the real-engine WebKit script re-run against the current code (D3-D10, 15/15) and by UAT 6 in the user's browser."
    evidence_status: "webkit-strip-check.cjs re-run this verification"
  - finding: "IN-01, IN-02, IN-05, IN-06, IN-07, IN-09, IN-10 (carried info items)"
    category: other
    reason: "Hygiene / copy / contrast-margin items already dispositioned as open info; none affects a requirement."
    evidence_status: "01-REVIEW.md, 01-REVIEW-DISPOSITION.md"
---

# Phase 1: Ice-Time Trends Table Verification Report

**Phase Goal:** User can scan a team's ice-time section as a trends table and immediately see which players are gaining or losing TOI and power-play time
**Verified:** 2026-10-12
**Status:** passed
**Re-verification:** Yes, refresh after review-fix commits 1314b03 (WR-05), 88b2299 (WR-06), adb0f61 (WR-07), 888cc03 (WR-08)

## Goal Achievement

The goal still holds and none of the four review-fix commits regressed a must-have. The post-prior-verification diff is exactly six files (`git diff b661c65 HEAD -- app lib components`): `app/research/page.tsx`, `components/ToiStripCell.tsx`, `components/ToiTrends.tsx`, `lib/research/team-games.ts` and the two test files. I read the full diff rather than the fix report.

What each commit actually changed, and the regression question for each:

- **WR-05 (`team-games.ts`)**: the shift-chart `.catch` now returns `null` instead of `[]`. `overtime` is computed before the shift inputs, and an OT/SO game with a `null` chart throws, which `Promise.allSettled` turns into an `unavailableDates` entry (`team-games.ts:98-100`, `:141-148`). A regulation game with a failed chart is kept with boxscore TOI, `lines = null`, so PP/SH render as dashes. An OT game with a published-but-empty chart (`[]`) is kept as "excluded" (`regulationToi = null`). Net effect on TRND-04: an OT game with unknown regulation TOI can no longer enter an average by accident, and no path produces a 0. `buildCell` (`toi-trends.ts`) still yields `pp: null`, `sh: null`, `toi: null` for unknown data and `null` for a missed game; `gameDetail` renders dashes and "Did not play" with no numbers. Tests `team-games.test.ts:103-126` pin both the regulation and OT failure cases and pass.
- **WR-06 (`page.tsx`)**: adds `newestMissing` (a failed ISO date newer than the newest loaded game) and a clause on the amber banner. Display only, guarded by `research.games.length > 0`. It touches no data. Gap noted as IN-11 (second-newest failure gets the banner but not the clause).
- **WR-07 / WR-08 (`ToiStripCell.tsx`)**: `role="img"` became `role="button"` with `aria-expanded`, an Enter/Space/Escape `onKeyDown`, and the state transitions routed through the pure `nextOpen`. The click, outside-pointerdown and blur paths are the same transitions as before (`click` toggles; `blur`, `escape`, `outside` close). The popover markup in `ToiGameStrip.tsx` is byte-identical, so hover (`group-hover/cell:block`), focus (`group-focus-visible/cell:block`) and click (`group-data-[open]/cell:block`) all still reveal it.
- **`ToiTrends.tsx`**: only copy changed in this round (the no-chart footnote wording), on top of the earlier tint and Pos edits.

### Behavioural evidence for the popover (re-run, not inherited)

Because `ToiStripCell.tsx` changed after the last real-engine run, I re-ran `webkit-strip-check.cjs` against the current tree. It uses its own scratch copy on 127.0.0.1:3101 with Playwright's bundled WebKit; port 3000 and installed browsers were not touched. Result: `strip-check: 15 passed, 0 failed, 0 skipped`. This covers click opens and persists (D3), second click closes (D4), outside click closes (D5), opening another closes the first (D6), popover does not block squares beneath (D7), hover (D8), column sweep shows only each row's own popover (D9), Tab focus opens and Tab away closes (D10), no clipping at Last 20 (D11), OT square tag and excluded OT time on live MTL data (D12), and emulated-iPhone tap behaviour (T2-T4). Together with UAT test 6 (user's own browser, pass), the three access paths required by TRND-02 (click, hover, keyboard focus) are behaviourally proven on the current code.

What is not behaviourally exercised in a browser: the new Enter / Space / Escape handlers from WR-07. They are unit-tested only as the `nextOpen` truth table plus SSR markup (`role="button"`, `aria-expanded="false"`). They were added by a review fix and are not part of any roadmap success criterion or plan must-have, so they do not gate the phase. They are recorded under WR-10 below.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: one row per player with Avg TOI, PP share, SH, trend arrow and sparkline, F then D, per-game numeric grid gone (TRND-01) | VERIFIED | Header and ordering tests pass (188/188); `ToiTrends.tsx` rendered by `page.tsx`; UAT test 1 pass; no WR-05..08 edit touches columns |
| 2 | SC2: exact per-game TOI/PP/SH readable without the grid, reachable by click, hover and keyboard; OT visibly flagged (TRND-02, TRND-04) | VERIFIED | WebKit re-run D3 (click), D8 (hover), D10 (Tab), D12 (OT tag + excluded OT time) on the current code; aria-label carries full detail (view test); UAT 6 and 7 pass |
| 3 | SC3: recent-vs-window Delta for TOI and PP share (TRND-03) | VERIFIED | `toi-trends.ts` unchanged since prior verification; delta tests pass |
| 4 | SC4: below-minimum players show no trend with GP visible; missed games never 0; unknown games never 0; OT flagged (TRND-04) | VERIFIED | `buildCell`/`stripCellState`/`gameDetail` unchanged and still produce null/dashes; WR-05 strengthens it (OT game with failed chart is dropped, not averaged); `team-games.test.ts` 103-126 pass; D12 shows live OT square with "TOI —" and "Excluded from averages" |
| 5 | SC5: sort by trend, Avg TOI or PP share, kept in the URL, F/D kept (TRND-05) | VERIFIED | `sortRows`/`researchHref`/`parseSort` unchanged; sort tests pass; UAT 4 pass |
| 6 | PP share / PP Delta / SH / tint correct for games with a shift chart (CR-01) | VERIFIED | `lines.ts`, `uniqueShifts` untouched; `shifts ?? []` change does not alter the published-chart path |
| 7 | 01-08: click/tap opens a square's popover, persists, second click/outside press/blur closes, opening another closes the first; hover and keyboard focus still work | VERIFIED | WebKit re-run on current code D3-D10 and T2-T4 all PASS; `nextOpen` transitions identical to the old inline logic for click/blur/outside; UAT 6 pass |
| 8 | 01-08: open popover never blocks squares under it; pointer cursor; aria-label unchanged; only `ToiStripCell` is client code | VERIFIED | D7, D9 PASS; `ToiGameStrip.tsx` unchanged (still a server component, `pointer-events-none` popover); view tests assert cursor, group, pointer-events |
| 9 | 01-09: separate bordered 20x20 squares on a 24px pitch, header/intro/legend copy, Pos separator, UI-SPEC revised | VERIFIED | S1 PASS (>=20px, 24px pitch); copy tests pass; UAT 7 and 8 pass |

**Score:** 9/9 truths verified (0 present, behavior-unverified). Truths 7 and 8 are behaviour-dependent and are VERIFIED on a passing real-engine run of the current tree plus the user's UAT, not on symbol presence.

### Deferred Items

None. No gap was moved to a later phase.

### Advisory (New Scope, Unevidenced)

Findings that do not block the goal. Most are the open items in `01-REVIEW-DISPOSITION.md`.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | WR-10: `aria-expanded` vs hover/focus popover state; Escape blurs | other | Secondary-drill-down a11y polish; all values still reachable; keyboard-toggle semantics were added by a review fix, not a must-have |
| 2 | IN-11/12/13, popover note copy drift ("shift chart not published") | other | Disclosure/hygiene/copy on degraded or secondary paths; no wrong numbers |
| 3 | WR-08 residual: DOM wiring unit-untested | other | Covered by the WebKit script and UAT 6 |
| 4 | IN-01/02/05/06/07/09/10 | other | Carried info items |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `components/ToiTrends.tsx` | Trends table, tint, Pos GP, legend | VERIFIED | Substantive, imported by `app/research/page.tsx`, renders `ToiGameStrip` |
| `components/ToiGameStrip.tsx` | Strip squares + popover markup | VERIFIED | Unchanged; wired from `ToiTrends`; wraps each square in `ToiStripCell` |
| `components/ToiStripCell.tsx` | Client wrapper: click/tap/keyboard state | VERIFIED | Substantive (nextOpen, effect, handlers); imported by `ToiGameStrip` and the view test |
| `lib/research/team-games.ts` | Game loader with OT/failed-chart handling | VERIFIED | WR-05 path read and tested |
| `lib/research/toi-trends.ts`, `game-strip.ts`, `format.ts`, `lines.ts`, `lib/nhl/client.ts` | Trend rows, strip states, formatting, line analysis, NHL client | VERIFIED | Unchanged since prior verification |
| `app/research/page.tsx` | Page wiring, banners | VERIFIED | WR-06 clause present; wired to `loadTeamResearch` and `ToiTrends` |
| `lib/research/toi-trends-view.test.ts`, `team-games.test.ts` | Tests | VERIFIED | Updated in lockstep, pass |
| `.planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` | Real-engine check | VERIFIED | Re-run: 15/15 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `page.tsx` | `loadTeamResearch` -> `buildTrendRows` -> `ToiTrends` | server data flow | WIRED | unchanged |
| `ToiTrends` | `ToiGameStrip` | per-row component | WIRED | |
| `ToiGameStrip` | `ToiStripCell` | per-square wrapper | WIRED | popover passed as children |
| `ToiStripCell` open state | popover visibility | `data-open` -> `group-data-[open]/cell:block` | WIRED | proven by D3/D4 |
| `loadGame` null chart | `unavailableDates` -> amber banner | `Promise.allSettled` rejected branch | WIRED | `team-games.test.ts:114-119` |
| `row.mover` | tint + "Moving up/down" | `ToiTrends.tsx:79` | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| ToiTrends rows / strip / popover | `row.avgToi`, deltas, `row.perGame` | `loadTeamResearch` (NHL boxscore + shift chart) | Yes: the WebKit run rendered live MTL data, 21 rows, real OT square | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm test` | 188 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Scoped lint | `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx components/ToiStripCell.tsx` | exit 0 | PASS |
| Real-engine strip behaviour | `node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs` | 15 passed, 0 failed, 0 skipped | PASS |

### Probe Execution

Step 7c: SKIPPED (no probes declared).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRND-01 | 01-01 | Trends table, primary columns, grid removed | SATISFIED | truth 1 |
| TRND-02 | 01-02, 01-08, 01-09 | Exact per-game TOI/PP/SH reachable | SATISFIED | truths 2, 7, 8, 9; click, hover and Tab each proven in WebKit on the current code |
| TRND-03 | 01-03 | Recent-vs-window delta for TOI and PP share | SATISFIED | truth 3 |
| TRND-04 | 01-01, 01-02, 01-03, 01-09 | Minimum games, missed/unknown never 0, OT flagged | SATISFIED | truths 4, 9; WR-05 tightens the OT-failure path |
| TRND-05 | 01-04 | Sort by trend/Avg TOI/PP share, URL, F/D kept | SATISFIED | truth 5 |

All five IDs are declared in PLAN frontmatter, defined in REQUIREMENTS.md and mapped to Phase 1; no orphaned requirements. REQUIREMENTS.md now shows all five as `[x]` and Complete in the traceability table (it had been stale in the previous report; it has since been updated).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `components/ToiStripCell.tsx` | 46-62 | `aria-expanded`/`data-open` do not track hover/focus visibility; Escape blurs (WR-10) | Warning | Keyboard toggle visually redundant after Tab; not a goal blocker |
| `components/ToiStripCell.tsx` | 6-11, 53-61 | `nextOpen` in a use-client file; key repeat toggles (IN-12) | Info | No current bug |
| `lib/research/game-strip.ts` | 51 | Popover note "shift chart not published" now narrower than legend wording | Info | Copy drift on a degraded path |
| `app/research/page.tsx` | 51-54 | `newestMissing` ignores a failed second-newest game (IN-11) | Info | Banner still names the date |
| `components/ToiTrends.tsx` | 56 | `pb-28 -mb-24` fixed reserve (IN-05) | Info | User saw no clipping in UAT 6; D11 PASS at Last 20 |

No TBD, FIXME or XXX markers in the phase source files (grep over `app/research/page.tsx`, `components/Toi*.tsx`, `lib/research/*.ts`, `lib/nhl/client.ts`).

Weighing the open review items against the goal: the goal is scanning a trends table to see who is gaining or losing TOI and PP time. Columns, deltas, tint, sparkline, sort and the per-game drill-down deliver that. WR-10 affects only how the keyboard toggle is announced and whether Escape can dismiss a hover popover; every value stays reachable and the aria-label carries the full detail. It does not block the goal, and none of the info items makes a displayed number wrong.

### Human Verification Required

None pending. UAT (`01-UAT.md`, status complete) confirmed the human-facing behaviour; test 3 (phone) is a recorded deferred follow-up for a laptop-targeted site. Optional spot-check for the maintainer when convenient: Tab to a square, press Enter, Space and Escape, to see the WR-10 behaviour first-hand (non-blocking).

### Gaps Summary

No gaps. All five requirements are satisfied and all nine must-haves hold after the WR-05..WR-08 commits. The unknown/missed-game handling (TRND-04) is unchanged or stricter, the per-game values remain reachable by click, hover and keyboard (re-proven in WebKit 15/15 on the current tree), and `npm test` (188/188), `tsc` and scoped `eslint` are clean. WR-10 and the new info items are recorded as advisory.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
