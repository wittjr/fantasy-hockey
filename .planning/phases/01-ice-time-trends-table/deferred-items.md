## Deferred Items

- analyzeGameLines double-counts verbatim duplicate shift rows (found in plan 01-01, pre-existing)
  status: open
  **What:** `analyzeGameLines` (`lib/research/lines.ts`) pushes a player id into `onIce.skaters` once per shift row per second and increments `playerSeconds` per skater entry. The NHL shift chart sometimes repeats a row verbatim (game 2026020075: player 8482087 has 22 rows against 19 boxscore shifts). The duplicated id inflates the on-ice skater count (which can mis-classify EV/PP/SH) and double-counts that player's PP/SH seconds for those seconds.
  **Why deferred:** not caused by plan 01-01; `regulationSeconds` already dedupes identical rows for TOI. The fix is to skip repeated (playerId, period, startSec, endSec) rows at the top of the shift loop in `analyzeGameLines`, with a regression test in `lines.test.ts`.
