---
status: partial
phase: 01-ice-time-trends-table
source: [01-VERIFICATION.md]
started: 2026-10-11T23:20:00Z
updated: 2026-10-12T01:12:46.838Z
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

## Summary

total: 5
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-01-2
  truth: "Hovering or keyboard-focusing a strip square opens a popover under that square with the game's exact TOI, PP (share), SH, date and opponent, fully visible and not clipped"
  status: failed
  reason: "User reported: I don't see any popovers"
  severity: major
  test: 2
  artifacts: []
  missing: []

- gap_id: G-01-1b
  truth: "The Pos column separates the position from games played so each reads on its own (e.g. 'C' and '5/5 GP', not 'C5/5 GP')"
  status: failed
  reason: "User reported (during test 4, about the test 1 layout): There should be some space between the position and games played, I see things like C5/5 GP"
  severity: cosmetic
  test: 1
  artifacts: []
  missing: []

- gap_id: G-01-5
  truth: "The Per game strip reads as one distinct square per team game (shaded by TOI vs the player's average, with OT/SO ring and missed-game markers), and its popover shows the OT tag and 'OT excluded +m:ss'"
  status: failed
  reason: "User reported: I don't see any popovers. Also the Per Game looks like small pieces of a bold line, I can't tell what it is"
  severity: major
  test: 5
  artifacts: []
  missing: []
