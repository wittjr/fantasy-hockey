---
status: testing
phase: 03-unit-event-stats
source: [03-VERIFICATION.md]
started: 2026-10-14T14:34:47Z
updated: 2026-10-14T14:34:47Z
---

## Current Test

number: 1
name: Boxscore cross-check
expected: |
  Signed in on a laptop browser, open /research?team=MTL&games=5. For the Last game (Oct 13 vs BUF), add SF across the EV, PP and SH Total rows of the forwards tables. It equals the NHL.com boxscore shots on goal for MTL (38 per the live smoke), minus any penalty shot named in the exclusions note.
awaiting: user response

## Tests

### 1. Boxscore cross-check
expected: Sum of SF over the EV, PP and SH forwards Total rows equals NHL.com boxscore SOG for MTL, minus any penalty shot listed in the exclusions note
result: [pending]

### 2. Legend and exclusions wording
expected: SF, GF, CF, SF%, CF%, +/-, Other, and the placement of pulled-goalie / 4-on-4 / 3-on-3 time and events in Other read clearly
result: [pending]

### 3. Screenshot review (light and dark, 1024 px)
expected: In the session scratchpad's units-check-light.png and units-check-dark.png (or the live page), columns align, the Goals/Shots/Corsi dividers run down each table, and the Total row stands out
result: [pending]

### 4. No-data game
expected: A window game with no shift chart or no play-by-play shows a dash with the amber note in its cells, never 0
result: [pending]

### 5. Post-deploy Vercel Last 20
expected: After deploying, open Last 20 for two or three teams within a minute; no "Couldn't load NHL data" banner
result: [pending]

### 6. Plus-minus exception decision
expected: Accept or reject SC1 with the one pinned, cause-checked exception (2025020500, A. Panarin: official 0, reproduced -1); see the suggested override in 03-VERIFICATION.md
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
