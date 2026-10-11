---
status: testing
phase: 01-ice-time-trends-table
source: [01-VERIFICATION.md]
started: 2026-10-11T23:20:00Z
updated: 2026-10-11T23:20:00Z
---

## Current Test

number: 1
name: Trends table layout and scannability (Last 5 and Last 20)
expected: |
  Signed in, /research?team=MTL&games=5 then games=20: columns Player, Pos (n/N GP), Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend; forwards above defense; no per-game numeric grid. Layout matches the UI-SPEC and reads as scannable; Last 20 scrolls horizontally rather than wrapping.
awaiting: user response

## Tests

### 1. Trends table layout and scannability (Last 5 and Last 20)
expected: Columns Player, Pos (n/N GP), Avg TOI, TOI Δ, PP share, PP share Δ, SH, Per game, TOI trend; forwards block above defense block; no per-game numeric grid. Layout matches the UI-SPEC and reads as scannable; Last 20 scrolls horizontally rather than wrapping.
result: [pending]

### 2. Popover placement and clipping
expected: Hover and keyboard-Tab through strip squares on the first forward row, the last forward row, the last defense row and with Last 20, including an OT game with no shift chart (the largest popover). The popover opens under the hovered square, is fully visible and not clipped by the scrolling wrapper (review WR-01 fix and IN-05).
result: [pending]

### 3. Tap on touch devices
expected: Tapping a strip square on iOS Safari and Android Chrome shows the popover (if not, add a minimal client wrapper).
result: [pending]

### 4. Sort header interaction
expected: Clicking Avg TOI, TOI Δ, PP share and PP share Δ headers updates the sort arrow and order; the sort survives reload; forwards stay above defense; the sort carries across team and window links; the spinner shows while pending without layout shift.
result: [pending]

### 5. OT/SO and missing shift-chart markers
expected: On a team with an OT/SO game and a game with no shift chart in the window: sky ring on the square, OT tag and "OT excluded +m:ss" in the popover, hollow sky dot on the sparkline, amber footnote naming the no-shift-chart dates.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
