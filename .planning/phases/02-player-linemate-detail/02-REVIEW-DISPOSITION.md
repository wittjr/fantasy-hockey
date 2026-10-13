---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Window-share footnote still says linemates are \"ordered by the team's last 2 games, then by the whole window\""
  - id: IN-01
    severity: info
    disposition: skipped
    title: "Sort/tab links carry `sit` and `all` when no player is selected"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Escape cannot dismiss a popover that is open by mouse hover alone"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Close link's accessible name does not contain its visible text"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "Name links get different `sort` values depending on which table they are in"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "Duplicated situation labels and an export with no consumers"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "Line-change tests no longer assert ordering"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "`regulationSeconds` still double-counts overlapping differing rows, so OT-game TOI no longer matches the line passes"
  - id: IN-09
    severity: info
    disposition: fixed
    title: "`analyzeGameLines` doc comment now describes only the dedupe, not the function"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "pairSeconds classifies strength from a duplicate-inflated skater count, then deduplicates only the credited seconds"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "\"no-earlier-data\" tag note states a false cause"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Footer still says linemates are sorted \"most recent time together first\" after D-28"
  - id: IN-06
    severity: info
    disposition: deferred
    title: "Window-share ordering favours linemates with few counted games"
open: 0
total: 13
recorded: 2026-10-13T02:02:51.627Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-05 | warning | fixed | 02-REVIEW-FIX.md |
| IN-01 | info | skipped | 02-REVIEW-FIX.md |
| IN-02 | info | fixed | 02-REVIEW-FIX.md |
| IN-03 | info | fixed | 02-REVIEW-FIX.md |
| IN-04 | info | fixed | 02-REVIEW-FIX.md |
| IN-05 | info | fixed | 02-REVIEW-FIX.md |
| IN-07 | info | fixed | 02-REVIEW-FIX.md |
| IN-08 | info | fixed | 02-REVIEW-FIX.md |
| IN-09 | info | fixed | 02-REVIEW-FIX.md |
| WR-01 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| IN-06 | info | deferred | accepted by design, follows from D-28 window-share ordering (user, 2026-10-12); no fix planned (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
