# Phase 1 — Code Review Disposition

Source: `01-REVIEW.md` (standard depth, 13 files; 1 critical, 4 warning, 4 info). Every finding starts `open`; update the disposition when it is fixed, deferred, or accepted.

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| CR-01 | critical | Duplicate shift rows de-duplicated for TOI (`regulationSeconds`) but not in `analyzeGameLines` — PP/SH seconds, PP share and strength classification wrong for affected games (also logged in `deferred-items.md`) | fixed in 01-05 (b382dff) |
| WR-01 | warning | Strip popover anchored to the `<td>`, not the hovered square | open |
| WR-02 | warning | Empty not-yet-published shift chart cached for an hour | fixed in 01-05 (1991867) |
| WR-03 | warning | One failed boxscore/shift request blanks the page and shows the raw error | fixed in 01-06 (d0ce098, 8e74774) |
| WR-04 | warning | `toiDelta`/`ppShare` comment vs behaviour mismatch; Δ columns always "—" at exactly 2 games with no hint | open |
| IN-01 | info | `if (secs)` conflates a 0:00 clock with a malformed one | open |
| IN-02 | info | Non-null assertion inside a closure (`page.tsx:127`) | open |
| IN-03 | info | Negative "OT excluded" time rendered as positive | open |
| IN-04 | info | `getShiftCharts` assumes the response envelope | open |
