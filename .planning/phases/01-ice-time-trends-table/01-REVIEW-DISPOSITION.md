# Phase 1 — Code Review Disposition

Source: `01-REVIEW.md`. First review: standard depth, 13 files; 1 critical, 4 warning, 4 info. Re-review after gap plans 01-05..01-07 (90195c6): standard depth, 11 files; 0 critical, 2 warning, 6 info, confirming CR-01 and WR-01..WR-04 fixed. The re-review's two new warnings were renumbered WR-05/WR-06 so they do not collide with the fixed WR-01/WR-02. Second re-review after 01-08/01-09: standard depth, 4 files; 0 critical, 2 warning, 4 info (IN-05, IN-06 still present). Third review (quick, tint fix bc35e65/0425a38): 0 critical, 2 warning (WR-08 still present, new WR-09), 4 info (IN-05, IN-06 still present, new IN-09, IN-10). Every finding starts `open`; update the disposition when it is fixed, deferred, or accepted.

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| CR-01 | critical | Duplicate shift rows de-duplicated for TOI (`regulationSeconds`) but not in `analyzeGameLines` — PP/SH seconds, PP share and strength classification wrong for affected games (also logged in `deferred-items.md`) | fixed in 01-05 (b382dff) |
| WR-01 | warning | Strip popover anchored to the `<td>`, not the hovered square | fixed in 01-07 (42909de) |
| WR-02 | warning | Empty not-yet-published shift chart cached for an hour | fixed in 01-05 (1991867) |
| WR-03 | warning | One failed boxscore/shift request blanks the page and shows the raw error | fixed in 01-06 (d0ce098, 8e74774) |
| WR-04 | warning | `toiDelta`/`ppShare` comment vs behaviour mismatch; Δ columns always "—" at exactly 2 games with no hint | fixed in 01-07 (4146f6e) |
| WR-05 | warning | A failed shift-chart request is reported as "the NHL hasn't published shift charts"; for an OT/SO game every skater silently drops out of that game's averages | open |
| WR-06 | warning | When the newest game(s) fail to load, "Last game" and the "last 2 games" Δ silently re-anchor to older games | open |
| WR-07 | warning | Strip square is focusable and clickable but exposed as `role="img"`: no Enter/Space toggle, no `aria-expanded`, no Escape dismiss (WCAG 1.4.13) | open |
| WR-08 | warning | Click/tap/outside-click/blur behaviour of `ToiStripCell` has no behavioural test (static markup only); popover regex in view test is fragile | open |
| WR-09 | warning | Pos cell `text-neutral-500` fell below AA on the green/red-100 mover tint (no dark variant) | fixed in f55f465 (neutral-600 / dark:neutral-400) |
| IN-01 | info | `if (secs)` conflates a 0:00 clock with a malformed one | open |
| IN-02 | info | Non-null assertion inside a closure (`page.tsx:134`) | open |
| IN-03 | info | Negative "OT excluded" time rendered as positive | open |
| IN-04 | info | `getShiftCharts` assumes the response envelope | open |
| IN-05 | info | Popover headroom (`pb-28 -mb-24`) is a fixed magic number; worst-case last-row popover may clip (not browser-checked) | open |
| IN-06 | info | Intro copy hard-codes 2:00 / 15 pts instead of the mover constants; empty state says "regular-season" though playoff games are included | open |
| IN-07 | info | On desktop a second click on a hovered square has no visible effect (hover keeps the popover up), so the "click a square" hint can mislead | open |
| IN-08 | info | Every square has `tabIndex=0`, about 200 tab stops for 20 skaters at a 10-game window | accepted (UI-phase decision: accept tab stops, revisit if annoying) |
| IN-09 | info | Tests pin the literal light tint shade in five places; no test covers the `dark:bg-*-900/40` classes | open |
| IN-10 | info | `text-green-700` on green-100 is 4.56:1, only just above AA; `text-green-800` would add headroom | open |
