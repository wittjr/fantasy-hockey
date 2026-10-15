---
gsd_state_version: "1.0"
status: completed
stopped_at: Phases 1-3 complete and verified; review fixes done
last_updated: "2026-10-14T23:24:34.260Z"
last_activity: 2026-10-14
last_activity_desc: All phases complete
state_head: 887771015027d277bad12e41c9b5e51be5b64e71
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 29
  completed_plans: 29
  percent: 100
current_phase: 03
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-14)

**Core value:** At a glance, show which players on a team are moving up or down in deployment, so pickup/drop decisions can be made before the rest of the league notices.
**Current focus:** All planned phases complete; add the next feature with `/gsd-phase` or `/gsd-quick`

## Current Position

Phase: 03 (complete)
Plan: —
Status: All phases complete
Last activity: 2026-10-14 — Phase 3 review fixes (quick 261014-quc)

## Performance Metrics

**Velocity:**
- Total plans completed: 29
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 9 | - | - |
| 02 | 7 | - | - |
| 03 | 13 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 1 P01 | 11 min | 3 tasks | 10 files |
| Phase 01 P02 | 4 min | 2 tasks | 5 files |
| Phase 01 P03 | 4 min | 2 tasks | 5 files |
| Phase 01 P04 | 4 min | 2 tasks | 5 files |
| Phase 01 P05 | 2 min | 2 tasks | 6 files |
| Phase 01 P06 | 3 min | 2 tasks | 5 files |
| Phase 01 P07 | 3 min | 2 tasks | 5 files |
| Phase 01 P08 | 10 min | 2 tasks | 4 files |
| Phase 01 P09 | 3 min | 2 tasks | 5 files |
| Phase 02 P01 | 4 min | 2 tasks | 13 files |
| Phase 02 P02 | 3 min | 2 tasks | 4 files |
| Phase 02 P03 | 25 min | 3 tasks | 7 files |
| Phase 02 P04 | 3 min | 2 tasks | 5 files |
| Phase 02 P05 | 25 min | 2 tasks | 4 files |
| Phase 02 P06 | 20 min | 2 tasks | 5 files |
| Phase 02 P07 | 11 min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Three vertical slices (trends table, linemate detail, unit event stats); research's separate timeline-extraction and event-attribution phases are folded into the slices that need them
- [Roadmap]: UNIT-04 (unit-table name opens player detail) ships with Phase 2, where player detail is built
- [Roadmap]: DATA-02 mapped to Phase 3 (only fully verifiable once event stats exist); Phase 2 still handles missing shift charts as unknown for linemate time
- [Roadmap]: Phase 3 event columns are gated on fixture tests reproducing boxscore SOG and per-skater plus-minus
- [Phase 1]: regulationSeconds counts verbatim-duplicate NHL shift rows once — Feed repeats rows (22 vs 19 boxscore shifts in game 2026020075); plain sum over-counted regulation TOI
- [Phase 1]: Unknown regulation TOI (OT/SO game with no shift chart) is null and excluded from Avg TOI, never 0 — TRND-04: unknown values must not pull down averages
- [Phase 01]: 01-02: strip popover is a hidden wrapper span with an inner grid span; cell and aria-label share one GameDetail model so they cannot drift
- [Phase 01]: Mover thresholds 120 s TOI / 15 PP-share points (D-18) exported as TOI_MOVER_SECONDS and PP_MOVER_POINTS; deltaCrossing compares the displayed (rounded) magnitude
- [Phase 01]: Recent part of a delta is the team's last 2 games by index regardless of whether the player played both; mixed-sign movers are not tinted (D-19)
- [Phase 01]: 01-04: new sort key starts descending, active key flips; sort/dir validated by parseSort allowlist
- [Phase 01]: 01-04: URL keeps the requested sort in a 1-game window; effectiveSort overrides at render time only
- [Phase 01]: 01-05: uniqueShifts de-duplicates verbatim shift rows inside analyzeGameLines and regulationSeconds (not in loadGame) so the pure function is testable and Phase 2/3 reuse is safe
- [Phase 01]: 01-05: WR-02 fixed by one uncached re-request only when the cached shift chart is empty; a short revalidate on every chart rejected (extra NHL load, DATA-01 429 risk)
- [Phase 01]: 01-06: failed boxscore leaves the game out of the window and names its date (never all-DNP or zeros); failed shift chart behaves like an unpublished one — TRND-04: unknown data must not become DNP badges or zeros; no backfill or retry (DATA-01, Phase 3)
- [Phase 01]: 01-06: research page load-error banner shows fixed copy; error detail goes to server log only — T-01-11: no API path or status in markup
- [Phase 01]: 01-07: strip popover is right-aligned to the hovered square (absolute right-0 top-full, square is relative) so the newest squares never clip at the table's right edge; still CSS only
- [Phase 01]: 01-07: at exactly 2 games the Δ columns stay visible as dashes and the legend says why (WR-04); PP share title and toiDelta/ppShare docs now describe the computation, no value changed
- [Phase 01]: 01-08: per-square client wrapper ToiStripCell (click/tap toggles data-open; outside pointerdown and blur close); popover reveals on data-open, focus-visible or hover and is pointer-events-none
- [Phase 01]: 01-09: Per game squares are 20x20 (h-5 w-5) on a 24px pitch (gap-1) with rounded-xs and a 1px border per state; meets WCAG 2.5.8 and keeps rows the same height
- [Phase 02]: 02-01: pairSeconds collapses duplicate skaters per second (Set) so overlapping differing shift rows cannot make time together exceed own seconds
- [Phase 02]: 02-01: window share pooled over counted games only (D-25); a linemate with no counted game is never listed
- [Phase 02]: 02-02: LinemateRowView exported so the dash window share (unreachable through the full panel) is testable
- [Phase 02]: 02-02: StripPopover is the single popover for both strips; heading line shown first, title muted only when a heading is set
- [Phase 02]: 02-03: name links drop all, so a newly opened player starts capped; aria-current applied wherever the selected player appears
- [Phase 02]: 02-04: Escape dismiss is a data-dismissed flag + group-data-[dismissed]/cell:hidden variant (no blur); pointer leave keeps a pin but clears dismissed; aria-expanded removed (WR-10 fixed)
- [Phase 02]: 02-05: emptyReason no-chart is judged over charted games the selected player dressed for, so unknown is never reported as no time (D-24)
- [Phase 02]: 02-05: legend line 2 says 'in the games they both played' (D-25 wording); no-chart empty state shows only the message and tabs, other empty reasons still show the amber note when games lack a chart
- [Phase 02]: 02-06: Linemate tags are neutral chips from rounded pooled time-together shares (+/-15 via deltaCrossing); Out comes from dressing alone; tagged rows bypass the list cap and cappedCount stays the capped count when all=1
- [Phase 03]: Teammate-blocked attempts count in CF/CA (UAT G-03-1, supersedes D-14/D-21 exclusion)
- [Phase 03]: Pulled-goalie events and seconds go to Other, not exclusions; exclusions are shootout and penalty-shot only (D-21, D-22)
- [Phase 03]: Plus-minus override accepted for Panarin 2025020500 (shift chart wins over official 0)
- [Phase 02]: 02-07: overflow-anchor none on the research page main so WebKit scroll anchoring does not move the page to the top when the player panel closes — Measured: no script scrolls; anchoring on main was the cause; N10 requires Close to keep the scroll position (UI-SPEC scroll false)
- [Phase 01]: Re-verified after phases 02-03 changed covered files: passed 9/9 on 2026-10-14; code review not re-run because no phase-01 task commits landed since the 2026-10-12 review — the evaluation-scope fallback would have re-reviewed 42 phase 02-03 files already covered by 02-REVIEW.md and 03-REVIEW.md
- [Phase 02]: Re-verified after phase 03, the 02 review fixes and quick task 261014-lu2 changed covered files: passed 5/5 on 2026-10-14 (555 tests, WebKit player-check 17/17); code review re-run on the 13 files changed outside any reviewed phase, not the degraded 37-file phase range, so phase 03 work reviewed in 03-REVIEW.md was not re-reviewed

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 → later]: WR-05..WR-08 fixed (1314b03, 88b2299, adb0f61, 888cc03); WR-10 fixed in Phase 02 (5bbb68c); IN-13 fixed by ad76e51. Still open: WR-08 remainder (no DOM test of outside-click/blur), info IN-01..IN-12 (not IN-08); see 01-REVIEW-DISPOSITION.md
- [All phases]: Site targets laptop browsers; no phone/touch UAT
- [Phase 3]: Last 20 is only verified on 6-8 finished games per team (October); re-check a full 20-game window later in the season
- [Phase 3]: WR-01 and WR-02 fixed (quick 261014-quc). Still open: IN-01..IN-04 info; no UI audit was run for Phase 3; see 03-REVIEW-DISPOSITION.md
- [Phase 2]: WR-06 and amber footnote contrast fixed (quick 261014-qgu); IN-10 and UI audit copy drift / page chrome weight fixed (quick 261014-qo6). Still open: IN-11 info (no Escape-on-hover regression test); see 02-REVIEW-DISPOSITION.md
- [GSD tooling]: the code-review disposition step cannot parse the hand-curated 01-REVIEW-DISPOSITION.md; a future phase-01 review would rewrite it to 15 rows and reopen WR-10, so reconcile that ledger by hand

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261012-tph | WR-01 follow-up: dedupe on-ice skaters before strength classification in analyzeGameLines | 2026-10-12 | 67949f3 | [261012-tph-wr-01-follow-up-dedupe-skaters-before-st](./quick/261012-tph-wr-01-follow-up-dedupe-skaters-before-st/) |
| 261014-lu2 | Fix phase-01 UI re-audit warnings (dash contrast, window-2 rule, copy drift, Pos gap, signed zero Δ) | 2026-10-14 | f71fe3f | [261014-lu2-fix-phase-01-ui-re-audit-warnings](./quick/261014-lu2-fix-phase-01-ui-re-audit-warnings/) |
| 261014-qgu | Fix WR-06 dash contrast (PlayerLinemates, LastGameLines) and amber-600 note text on /research | 2026-10-14 | 2670b71 | [261014-qgu-fix-wr-06-dash-contrast-in-playerlinemat](./quick/261014-qgu-fix-wr-06-dash-contrast-in-playerlinemat/) |
| 261014-qo6 | Align 02-UI-SPEC copy with code, font-medium page chrome, fix IN-10 formatter coupling | 2026-10-14 | 4892dd6 | [261014-qo6-align-02-ui-spec-copy-with-code-font-med](./quick/261014-qo6-align-02-ui-spec-copy-with-code-font-med/) |
| 261014-qr6 | Raise /research footer text contrast (disabled window counts left gray) | 2026-10-14 | 104cb74 | [261014-qr6-raise-research-page-footer-text-contrast](./quick/261014-qr6-raise-research-page-footer-text-contrast/) |
| 261014-quc | Phase 3 WR-01 contain play-by-play mapping errors, WR-02 note unattributed events | 2026-10-14 | 054cce3 | [261014-quc-phase-3-wr-01-contain-play-by-play-mappi](./quick/261014-quc-phase-3-wr-01-contain-play-by-play-mappi/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-14T22:50:37.602Z
Stopped at: Phases 1-3 complete and verified
Resume file: None

## Operator Next Steps

- Add the next feature as a phase with /gsd-phase, then /gsd-discuss-phase, /gsd-plan-phase, /gsd-execute-phase; small changes with /gsd-quick
