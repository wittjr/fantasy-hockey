---
gsd_state_version: "1.0"
current_phase: 02
current_phase_name: Player Linemate Detail
status: executing
stopped_at: Completed 02-05-PLAN.md
last_updated: "2026-10-12T19:42:39.070Z"
last_activity: 2026-10-12
last_activity_desc: Phase 02 execution started
state_head: 3a4f205801cce1212f36c8aa50db99322b3be229
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 16
  completed_plans: 14
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-12)

**Core value:** At a glance, show which players on a team are moving up or down in deployment, so pickup/drop decisions can be made before the rest of the league notices.
**Current focus:** Phase 02 — Player Linemate Detail

## Current Position

Phase: 02 (Player Linemate Detail) — EXECUTING
Plan: 6 of 7
Status: Ready to execute
Last activity: 2026-10-12 — Phase 02 execution started

Progress: [███░░░░░░░] 33% (1 of 3 phases; 9/9 Phase 1 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 9 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 → later]: WR-05..WR-08 fixed (1314b03, 88b2299, adb0f61, 888cc03). Still open: WR-10 (strip square aria-expanded tracks click only; Escape always blurs), WR-08 remainder (no DOM test of outside-click/blur), info IN-01..IN-13; see 01-REVIEW-DISPOSITION.md
- [All phases]: Site targets laptop browsers; no phone/touch UAT
- [Phase 3]: Decide whether SF%/CF% appear on PP/SH tables (research warns PP/SH "against" counts are easily misread as quality)
- [Phase 3]: NHL API returned HTTP 429 at ~40 concurrent requests; verify the bounded-concurrency cap in dev before production

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-12T19:42:39.028Z
Stopped at: Completed 02-05-PLAN.md
Resume file: None
