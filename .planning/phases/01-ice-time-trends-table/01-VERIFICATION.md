---
phase: 01-ice-time-trends-table
verified: 2026-10-12T16:00:00Z
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
  - lib/research/team-games.ts
  - lib/research/toi-trends-view.test.ts
  - lib/research/toi-trends.ts
covered_digest: "v3:sha256:a1d4610b6a9e928dd883b4c13e5796d5c73224bbc4219135c004a6cf91968cf3"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/9
  gaps_closed:
    - "Previously pending human checks (own-browser retest of UAT 2/5, visual judgment of the Per game squares) were confirmed by the user in UAT tests 6, 7, 8 (all pass)"
    - "G-01-7b: mover row tint too faint in dark mode (bc35e65, 0425a38)"
    - "WR-09: Pos text below AA on the tinted mover rows (f55f465)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-05: a failed shift-chart request is worded as 'the NHL hasn't published shift charts'; for an OT/SO game the affected game drops out of Avg TOI/Delta"
    category: other
    reason: "Degraded-path copy is inaccurate on a transient upstream failure. A shown number is never wrong (the game is excluded or shown as no-PP/SH) and the cause is logged server-side. Unchanged."
    evidence_status: "reasoned from code (team-games.ts, ToiTrends.tsx legend); not exercised"
  - finding: "WR-06: when the newest game fails to load, 'Last game' and the 'last 2 games' Delta re-anchor to the newest loaded games"
    category: other
    reason: "Partially disclosed by the amber banner naming the missing date. Needs a failed boxscore on the newest game. Unchanged."
    evidence_status: "reasoned from code (team-games.ts, page.tsx); not exercised"
  - finding: "WR-07: Per game square is focusable and clickable but exposed as role=img; Enter/Space do nothing, no aria-expanded, no Escape dismissal (WCAG 1.4.13)"
    category: other
    reason: "Tab focus still opens the popover via CSS focus-visible and Tab away closes it; the aria-label carries the full per-game detail. Accessibility polish on a secondary drill-down, not the scan-the-table goal. Worth a small keydown handler in a maintenance pass."
    evidence_status: "code read (ToiStripCell.tsx); keyboard-open exercised by webkit-strip-check D10 in the previous verification"
  - finding: "WR-08: toggle / outside-click / blur / listener-cleanup behaviour of ToiStripCell has no test in npm test (static markup only)"
    category: other
    reason: "Coverage gap, not a behaviour gap. The behaviour passed UAT test 6 in the user's own browser and the re-runnable webkit-strip-check.cjs (15/15 in the previous verification; not re-run here, optional)."
    evidence_status: "UAT test 6 (human) plus prior WebKit run"
  - finding: "IN-09 / IN-10: tests pin the literal light tint shade and do not cover the dark:bg-*-900/40 classes; text-green-700 on bg-green-100 is 4.56:1, just above AA"
    category: other
    reason: "Hygiene on the post-UAT tint fix. The tint is confirmed visible by the user (UAT G-01-7b resolved); delta text is also coloured and the row is announced 'Moving up/down', so colour is never the only signal."
    evidence_status: "code read (ToiTrends.tsx:79, :232-234); review 01-REVIEW.md"
---

# Phase 1: Ice-Time Trends Table Verification Report

**Phase Goal:** User can scan a team's ice-time section as a trends table and immediately see which players are gaining or losing TOI and power-play time
**Verified:** 2026-10-12
**Status:** passed
**Re-verification:** Yes, refresh after UAT completion and three post-UAT fixes (bc35e65, 0425a38, f55f465)

## Goal Achievement

The goal holds. Since the previous verification, exactly two covered source files changed: `components/ToiTrends.tsx` (two class-string edits) and `lib/research/toi-trends-view.test.ts` (test strings updated to match). `git diff b661c65 HEAD -- app lib components` confirms nothing else under `app/`, `lib/` or `components/` moved, so the data layer (CR-01 dedupe, loader isolation, deltas, sorting) and the strip popover (`ToiStripCell.tsx`, `ToiGameStrip.tsx`) are byte-identical to what the prior verification and the UAT re-tests covered.

The two edits, read in the code:

- `ToiTrends.tsx:79` mover tint: `bg-green-50 dark:bg-green-950/30` / `bg-red-50 dark:bg-red-950/30` became `bg-green-100 dark:bg-green-900/40` / `bg-red-100 dark:bg-red-900/40`. Still applied only when `row.mover === "up"` or `"down"`; flat rows get an empty string. The mover announcement ("Moving up/down") and the green/red delta text (`ToiTrends.tsx:232-234`, with dark variants) are untouched, so colour is not the only signal.
- `ToiTrends.tsx:90` Pos cell: `text-neutral-500` became `text-neutral-600 dark:text-neutral-400`, matching the GP span already in that cell. The `{position}{" "}<span>{n}/{N} GP` structure from 01-09 is intact.

No regression. The tests were updated in lockstep (`bg-green-100` / `bg-red-100`, including the negative assertions for flat rows, mixed-sign movers, DNP rows and one-game windows), so they still prove tint appears only on true movers.

Human items from the previous report are resolved by UAT (`01-UAT.md`, status complete): test 1 layout pass, test 4 sort pass, test 6 click/tap popover pass in the user's own browser (G-01-2), test 7 separate bordered squares pass (G-01-5), test 8 "C 5/5 GP" pass (G-01-1b). Tests 2 and 5 were the failures and are resolved by 01-08/01-09 and confirmed by tests 6 and 7. Test 3 (phone tap) is a recorded deferred follow-up: the site targets laptop browsers only per the user, and the emulated-iPhone tap passed in the WebKit check. It is not pending verification.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: one row per player with Avg TOI, PP share, SH, trend arrow and sparkline, F then D, per-game numeric grid gone (TRND-01) | VERIFIED | Header test passes; UAT test 1 pass |
| 2 | SC2: exact per-game TOI/PP/SH readable without the grid; OT visibly flagged (TRND-02, TRND-04) | VERIFIED | UAT tests 6 and 7 pass in the user's own browser (click, hover, Tab, OT popover with OT tag and "OT excluded"/"Total (incl. OT)") |
| 3 | SC3: recent-vs-window Delta for TOI and PP share (TRND-03) | VERIFIED | `toi-trends.ts` unchanged; delta tests pass |
| 4 | SC4: below-minimum players show no trend with GP visible; missed games never 0; OT flagged (TRND-04) | VERIFIED | Logic unchanged; Pos cell "C 3/3 GP" asserted by view test; UAT test 8 pass |
| 5 | SC5: sort by trend, Avg TOI or PP share, kept in the URL, F/D kept (TRND-05) | VERIFIED | `sortRows`/`researchHref` unchanged; UAT test 4 pass |
| 6 | PP share / PP Delta / SH / tint correct for games with a shift chart (CR-01) | VERIFIED | `uniqueShifts` still used by `regulationSeconds` and `analyzeGameLines`; `lib/` non-test files unmodified |
| 7 | 01-08: click/tap opens a square's popover, persists, second click/outside press/blur closes, opening another closes the first; hover and keyboard focus still work | VERIFIED | `ToiStripCell.tsx` unchanged since the real-engine WebKit run (15/15) and UAT test 6 pass in the user's browser. Behavioural evidence is human plus the WebKit script, not `npm test` (WR-08) |
| 8 | 01-08: open popover never blocks squares under it; pointer cursor; aria-label unchanged; only `ToiStripCell` is client code | VERIFIED | `ToiGameStrip.tsx` unchanged; UAT test 6 "sweeping down a column shows each row's own popover" pass |
| 9 | 01-09: separate bordered 20x20 squares on a 24px pitch, header/intro/legend copy, Pos separator, UI-SPEC revised | VERIFIED | Unchanged; UAT tests 7 and 8 pass in light and dark mode |

**Score:** 9/9 truths verified (0 present, behavior-unverified). Truths 7 and 8 are behaviour-dependent and are VERIFIED on behavioural evidence (human run in the user's browser, plus a prior real-engine script), not on symbol presence.

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `components/ToiTrends.tsx` | VERIFIED | Substantive, rendered by `app/research/page.tsx`; tint and Pos edits present |
| `components/ToiGameStrip.tsx` | VERIFIED | Unchanged, wired from `ToiTrends` |
| `components/ToiStripCell.tsx` | VERIFIED | Unchanged, wired from `ToiGameStrip` |
| `lib/research/toi-trends-view.test.ts` | VERIFIED | Updated for new tint shade, passing |
| `lib/research/{toi-trends,team-games,lines,game-strip,format}.ts`, `lib/nhl/client.ts`, `app/research/page.tsx` | VERIFIED | Unchanged since the prior verification |
| `webkit-strip-check.cjs` | VERIFIED (exists) | Optional re-run skipped per instructions |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| ToiTrends | ToiGameStrip | per-row `<ToiGameStrip>` | WIRED |
| ToiGameStrip | ToiStripCell | per-square wrapper | WIRED |
| `row.mover` | row tint and "Moving up/down" | `ToiTrends.tsx:79` conditional class | WIRED |
| page.tsx / loaders / toi-trends | ToiTrends | unchanged | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| ToiTrends rows, tint, strip | `row.avgToi`, deltas, `row.mover`, `row.perGame` | `buildTrendRows` over `loadTeamResearch` (NHL boxscore + shift chart) | Yes; UAT used live MTL data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npm test` | 186 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Scoped lint | `npx eslint app/research lib/research lib/nhl components/ToiTrends.tsx components/ToiGameStrip.tsx components/ToiStripCell.tsx` | exit 0, no output | PASS |
| WebKit strip check | `webkit-strip-check.cjs` | Not re-run (optional; strip files unchanged; UAT 6/7 cover it in the user's browser) | SKIPPED |

### Probe Execution

Step 7c: SKIPPED (no probes declared).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TRND-01 | 01-01 | Trends table, primary columns, grid removed | SATISFIED | truth 1 |
| TRND-02 | 01-02, 01-08, 01-09 | Exact per-game TOI/PP/SH reachable | SATISFIED | truths 2, 7, 8, 9; UAT 6, 7 |
| TRND-03 | 01-03 | Recent-vs-window delta for TOI and PP share | SATISFIED | truth 3 |
| TRND-04 | 01-01, 01-02, 01-03, 01-09 | Minimum games, missed not 0, OT flagged | SATISFIED | truths 4, 9 |
| TRND-05 | 01-04 | Sort by trend/Avg TOI/PP share, URL, F/D kept | SATISFIED | truth 5; UAT 4 |

All five IDs are declared in PLAN frontmatter, defined in REQUIREMENTS.md and mapped to Phase 1; no orphaned requirements. Housekeeping: REQUIREMENTS.md is stale relative to the code. It still shows TRND-02, TRND-03 and TRND-05 unchecked and "Gaps Found" in the traceability table. This verifier did not edit it; the orchestrator should tick those three and mark all five Complete now that the phase passes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `components/ToiStripCell.tsx` | 35-45 | `role="img"` on a clickable, focusable span; no Enter/Space, `aria-expanded`, Escape (WR-07) | Warning | Keyboard open via focus works; activation/dismissal semantics incomplete. Not a goal blocker |
| `lib/research/toi-trends-view.test.ts` | 423-445 | Click/outside/blur behaviour not covered by `npm test` (WR-08) | Warning | Regression would not fail `npm test` |
| `lib/research/team-games.ts` | 73-80, 133-146 | WR-05, WR-06 | Warning | Only on upstream API failure; banner and log partly disclose |
| `components/ToiTrends.tsx` | 56 | `pb-28 -mb-24` fixed popover reserve (IN-05) | Info | User confirmed no clipping on last defense row and Last 20 in UAT 6 |
| `ToiTrends.tsx` / tests | various | IN-06, IN-07, IN-09, IN-10 | Info | Copy drift, mild affordance quirk, test pins on tint shade, 4.56:1 contrast margin |

No TBD, FIXME or XXX markers in phase source files (grep over `app/research/page.tsx`, `components/Toi*.tsx`, `lib/research/*.ts`, `lib/nhl/client.ts`).

Weighing the open warnings against the goal: the goal is scanning a trends table to see who is gaining or losing TOI and PP time. Columns, deltas, tint, sparkline and sort deliver that and are unaffected by WR-05..WR-08. None makes a shown number wrong or the drill-down unreachable; they are recorded as advisory.

### Human Verification Required

None pending. The previous report's three human items are satisfied by UAT tests 6, 7 and 8 (pass). Phone/touch testing (UAT test 3) is a recorded deferred follow-up, not a pending check, because the site targets laptop browsers only.

### Gaps Summary

No gaps. All five requirements are satisfied, all nine must-haves hold, the post-UAT tint and Pos-text fixes introduced no regression (two class strings changed, tests updated consistently, suite 186/186, tsc and scoped eslint clean), and the UAT human-verification items passed.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
