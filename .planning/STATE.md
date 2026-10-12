---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Ice-Time Trends Table
status: executing
stopped_at: Completed 01-08-PLAN.md
last_updated: "2026-10-12T02:02:34.133Z"
last_activity: 2026-10-11
last_activity_desc: Phase 01 execution started
state_head: 987198815537e0fe1f178a5b01514a99a6fa9150
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 9
  completed_plans: 8
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-11)

**Core value:** At a glance, show which players on a team are moving up or down in deployment, so pickup/drop decisions can be made before the rest of the league notices.
**Current focus:** Phase 01 — Ice-Time Trends Table

## Current Position

Phase: 01 (Ice-Time Trends Table) — EXECUTING
Plan: 2 of 9
Status: Ready to execute
Last activity: 2026-10-11 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Early season (October), so a "Last 20" window holds only ~4-8 games; minimum-games threshold for showing a trend and the "recent" span for the delta still need choosing
- [Phase 3]: Decide whether SF%/CF% appear on PP/SH tables (research warns PP/SH "against" counts are easily misread as quality)
- [Phase 3]: NHL API returned HTTP 429 at ~40 concurrent requests; verify the bounded-concurrency cap in dev before production

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-12T02:02:34.103Z
Stopped at: Completed 01-08-PLAN.md
Resume file: None
