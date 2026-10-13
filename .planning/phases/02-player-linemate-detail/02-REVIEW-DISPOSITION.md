---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "pairSeconds classifies strength from a duplicate-inflated skater count, then deduplicates only the credited seconds"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "\"no-earlier-data\" tag note states a false cause"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Footer still says linemates are sorted \"most recent time together first\" after D-28"
  - id: IN-01
    severity: info
    disposition: open
    title: "Sort/tab links carry `sit` and `all` when no player is selected"
  - id: IN-02
    severity: info
    disposition: open
    title: "Escape cannot dismiss a popover that is open by mouse hover alone"
  - id: IN-03
    severity: info
    disposition: open
    title: "Close link's accessible name does not contain its visible text"
  - id: IN-04
    severity: info
    disposition: open
    title: "Name links get different `sort` values depending on which table they are in"
  - id: IN-05
    severity: info
    disposition: open
    title: "Duplicated situation labels and an export with no consumers"
  - id: IN-06
    severity: info
    disposition: open
    title: "Window-share ordering favours linemates with few counted games"
  - id: IN-07
    severity: info
    disposition: open
    title: "Line-change tests no longer assert ordering"
open: 9
total: 10
recorded: 2026-10-13T01:17:50.086Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | fixed | 02-REVIEW-FIX.md |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
