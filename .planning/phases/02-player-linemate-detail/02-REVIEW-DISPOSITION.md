# Phase 2 — Code Review Disposition

Source: `02-REVIEW.md` (a325686). Standard depth, 20 files, diff base f6be330; 0 critical, 2 warning, 5 info. Every finding starts `open`; update the disposition when it is fixed, deferred, or accepted.

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| WR-01 | warning | `pairSeconds` classifies strength from `mine.skaters` before de-duplicating, so overlapping differing shift rows can turn a 5v5 second into PP and make `pairs.self` diverge from `analyzeGameLines` (same class as Phase 1 CR-01; oracle fixture has no overlapping rows) | open |
| WR-02 | warning | The `no-earlier-data` note says the player "has no earlier games in this window", but it also fires when earlier games exist and he had no time in that situation (e.g. PP tab) | open |
| W-03 | warning | (verifier) Line change only in the latest game of a 3+ game window lists old Fading linemates above the New ones, because D-12 orders by the last 2 games then window; contradicts the 02-06 "listed first" truth; no test for this case | fixed after UAT: user chose window-share ordering (D-28); New tag marks the change |
| IN-01 | info | Sort/tab links carry `sit` and `all` when no player is selected | open |
| IN-02 | info | Escape cannot dismiss a popover that is open by mouse hover alone | open |
| IN-03 | info | Close link's `aria-label` does not contain its visible text | open |
| IN-04 | info | `LastGameLines`/`PlayerLinemates` get raw `sort` while `ToiTrends` uses `effectiveSort` | open |
| IN-05 | info | `SITUATION_LABELS` duplicates `SITUATION_ABBREV`; `LinemateRowView` exported with no consumers; `buildTrendRows` runs twice per request | open |
