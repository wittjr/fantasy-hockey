---
quick_id: 261014-quc
type: quick
files_modified:
  - lib/research/events.ts
  - lib/research/events.test.ts
  - lib/research/unit-events-view.ts
  - lib/research/unit-events-view.test.ts
---

# Quick 261014-quc: Phase 3 WR-01 and WR-02

## Task 1: WR-01 contain play-by-play mapping errors
- buildGameEvents catches any throw from mapping/attribution, logs it, returns null (unknown), so malformed play-by-play never drops the game's TOI/lines (D-05). Contained here rather than in loadGame so it is unit-testable.
- verify: test with `plays` undefined, missing `homeTeam`, and a shot without `periodDescriptor` returns null.

## Task 2: WR-02 surface unattributed events
- topNotes appends an amber note when `events.unattributed > 0` (after D-23/D-16), so a Total that is missing events says so.
- verify: topNotes tests for 0 (no note), 1 (singular) and 3 (plural); full suite.
