---
status: complete
phase: 02-player-linemate-detail
source: [02-VERIFICATION.md]
started: 2026-10-12T20:20:00Z
updated: 2026-10-13T01:09:23Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigation and URL state (SC1, PLYR-01, UNIT-04)
expected: Signed in, open /research?team=MTL&games=5. Click a name near the bottom of the trends table, then a name in the "PP - Forwards" Last game table. Each click jumps to the panel (first block under the nav); the PP name opens the PP tab. Back and Forward restore the player and tab; reload and a pasted URL in a new tab show the same player and tab; re-clicking the selected name jumps back to the panel.
result: pass

### 2. Line change at a glance (SC4, PLYR-04)
expected: Open a forward whose line changed in the latest game. New linemates carry the solid New chip; old ones show Fading, or Out if they didn't dress. Decide on review W-03 (in a 3+ game window, a change only in the latest game lists the old Fading linemates above the New ones) and whether ±15 points makes tags too noisy (D-27).
result: pass
note: "W-03: sort by window share for the whole window; the New tags are the indicator" (user). Applied as D-28. ±15 kept.

### 3. Heat strip look and popover (SC2, SC3)
expected: Hover, click and Tab to squares in both the forwards and defense blocks, at Last 5 and Last 20, in light and dark mode; switch EV/PP/SH. Squares read as separate and clickable; the popover shows linemate, game, minutes together, share of the situation time and the player's time, and isn't cut off on the last forward and last defense rows at Last 20. Escape hides it and the next Tab continues from that square. Dark-mode shades are distinguishable; the selected-row bar shows on green and red trends rows; switching tabs keeps the scroll position.
result: pass

### 4. Missing shift chart (SC5)
expected: Open a player on a team with a no-chart game in the window (e.g. MTL, Oct 3). That column is amber dashed in every row and its popover says "No shift chart for this game" with no times; the amber footnote lists the date; nothing shows 0. The Last game tables still show Time and %.
result: pass

### 5. No quality judgment
expected: Tag chips are black, white or grey only, never green or red, and nothing ranks linemates by points, TOI rank or fantasy value.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
