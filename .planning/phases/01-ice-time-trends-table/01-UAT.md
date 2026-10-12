---
status: partial
phase: 01-ice-time-trends-table
source: [01-VERIFICATION.md]
started: 2026-10-11T23:20:00Z
updated: 2026-10-12T14:54:17.666Z
---

## Current Test

[testing complete]

## Tests

### 1. Trends table layout and scannability (Last 5 and Last 20)
expected: Columns Player, Pos (n/N GP), Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend; forwards block above defense block; no per-game numeric grid. Layout matches the UI-SPEC and reads as scannable; Last 20 scrolls horizontally rather than wrapping.
result: pass

### 2. Popover placement and clipping
expected: Hover and keyboard-Tab through strip squares on the first forward row, the last forward row, the last defense row and with Last 20, including an OT game with no shift chart (the largest popover). The popover opens under the hovered square, is fully visible and not clipped by the scrolling wrapper (review WR-01 fix and IN-05).
result: issue
reported: "I don\'t see any popovers"
severity: major

### 3. Tap on touch devices
expected: Tapping a strip square on iOS Safari and Android Chrome shows the popover (if not, add a minimal client wrapper).
result: blocked
blocked_by: physical-device
reason: "I\'m testing on MacOS not mobile"

### 4. Sort header interaction
expected: Clicking Avg TOI, TOI Δ, PP share and PP share Δ headers updates the sort arrow and order; the sort survives reload; forwards stay above defense; the sort carries across team and window links; the spinner shows while pending without layout shift.
result: pass

### 5. OT/SO and missing shift-chart markers
expected: On a team with an OT/SO game and a game with no shift chart in the window: sky ring on the square, OT tag and "OT excluded +m:ss" in the popover, hollow sky dot on the sparkline, amber footnote naming the no-shift-chart dates.
result: issue
reported: "I don\'t see any popovers. Also the Per Game looks like small pieces of a bold line, I can\'t tell what it is"
severity: major

### 6. Re-test after 01-08: click or tap opens a square's popover (G-01-2)
expected: Signed in, /research?team=MTL&games=5 (click into the browser window first). Clicking a Per game square opens its popover directly under it and it stays open; clicking it again closes it; clicking a blank area closes it; opening another square closes the first. Hovering a square also shows its popover, and Tab onto a square shows it. Sweeping the pointer down one column shows each row's own popover without the first one covering the rows below. With games=20 and on the last defense row, popovers are fully visible.
result: pass

### 7. Re-test after 01-09: Per game squares read as separate games (G-01-5)
expected: Each Per game square is a distinct 20x20 bordered square with clear gaps (not a segmented bar), in light and dark mode. The header reads "Per game (click a square)". Missed games are dashed grey, OT games with no shift data dashed blue, played OT/SO games have a blue ring, and the OT popover shows the OT tag and "OT excluded +m:ss" (or "Total (incl. OT)" when no shift data).
result: pass

### 8. Re-test after 01-09: Pos column separates position and games played (G-01-1b)
expected: The Pos column reads like "C 5/5 GP", with the position and games played visibly separate.
result: pass

## Summary

total: 8
passed: 5
issues: 2
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-01-2
  truth: "Hovering or keyboard-focusing a strip square opens a popover under that square with the game's exact TOI, PP (share), SH, date and opponent, fully visible and not clipped"
  status: resolved
  resolved_by: 01-08-PLAN.md
  resolved_at: 2026-10-12
  reason: "User reported: I don't see any popovers"
  severity: major
  test: 2
  root_cause: "Popover reveal is CSS hover/focus only on 12x16 squares with no clickable affordance. Committed CSS and markup work (verified in Chromium and WebKit on the real page), but macOS Safari ignores hover in an unfocused window and Tab went to the terminal, so nothing opened. Secondary: an open popover (z-10, ~100-130px tall) covers the squares of the next ~4 rows."
  artifacts:
    - path: "components/ToiGameStrip.tsx"
      issue: "reveal depends on hover/focus only; no click/tap open; no visible affordance; open popover overlaps squares below"
  missing:
    - "Make each cell clickable/tappable to open its details (hover/focus as extras), e.g. native popover attribute, details, or the minimal client wrapper UI-SPEC allows"
    - "Visible affordance that cells are interactive (cursor, outline)"
    - "Open popover must not block the squares beneath it"
  debug_session: .planning/debug/per-game-strip-popover.md

- gap_id: G-01-1b
  truth: "The Pos column separates the position from games played so each reads on its own (e.g. 'C' and '5/5 GP', not 'C5/5 GP')"
  status: resolved
  resolved_by: 01-09-PLAN.md
  resolved_at: 2026-10-12
  reason: "User reported (during test 4, about the test 1 layout): There should be some space between the position and games played, I see things like C5/5 GP"
  severity: cosmetic
  test: 1
  root_cause: "ToiTrends.tsx Pos cell renders position then a ml-1 span with no text separator, producing the literal text 'C5/5 GP'; only a 4px margin between two near-identical muted tones. View test only checks '2/3 GP'."
  artifacts:
    - path: "components/ToiTrends.tsx"
      issue: "Pos td: {row.player.position}<span className=ml-1 ...> with no separator"
    - path: "lib/research/toi-trends-view.test.ts"
      issue: "no test asserts position and GP are separated"
  missing:
    - "Real separator between position and GP (text space plus wider margin, or a dot)"
    - "View test asserting the cell text reads 'C 5/5 GP'"
  debug_session: .planning/debug/per-game-strip-popover.md

- gap_id: G-01-5
  truth: "The Per game strip reads as one distinct square per team game (shaded by TOI vs the player's average, with OT/SO ring and missed-game markers), and its popover shows the OT tag and 'OT excluded +m:ss'"
  status: resolved
  resolved_by: 01-09-PLAN.md
  resolved_at: 2026-10-12
  reason: "User reported: I don't see any popovers. Also the Per Game looks like small pieces of a bold line, I can't tell what it is"
  severity: major
  test: 5
  root_cause: "Strip renders exactly as UI-SPEC specifies, and that spec reads as one segmented bar: 12x16 cells with 1px gaps, Tailwind 4 rounded-sm = 4px radius (a third of the cell width), one-colour opacity shading so neighbours look alike, no per-cell outline or affordance, legend far below the table. Popover half: same cause as G-01-2."
  artifacts:
    - path: "components/ToiGameStrip.tsx"
      issue: "cell classes h-4 w-3 rounded-sm in flex gap-px; low-opacity cells have no outline"
    - path: ".planning/phases/01-ice-time-trends-table/01-UI-SPEC.md"
      issue: "strip contract specifies 12x16 cells with 1px hairline gap"
  missing:
    - "Wider gap (2-4px) and smaller radius so each game reads as its own square"
    - "Faint outline/track per cell so low-opacity cells still read as squares"
    - "Short hint at the Per game column, not only in the bottom legend"
    - "Clickable cue from G-01-2"
  debug_session: .planning/debug/per-game-strip-popover.md

- gap_id: G-01-7b
  truth: "In dark mode the mover row tint (green = moving up, red = moving down) is clearly visible, as it is in light mode"
  status: resolved
  resolved_by: "/gsd-fast fix (no plan): dark tint raised from 950/30 to 900/40 in components/ToiTrends.tsx"
  resolved_at: 2026-10-12
  reason: "User reported (test 7 passed otherwise): in dark mode the row colors are difficult to see"
  severity: cosmetic
  test: 7
  root_cause: "components/ToiTrends.tsx:79 uses dark:bg-green-950/30 and dark:bg-red-950/30, a near-black tint at 30% opacity on a dark background (interpretation: 'row colors' = the mover row tint)"
  artifacts:
    - path: "components/ToiTrends.tsx"
      issue: "dark-mode mover tint classes too faint"
  missing:
    - "Stronger dark-mode tint for mover rows (e.g. a lighter shade or higher opacity), still subtle enough not to overwhelm the deltas"
